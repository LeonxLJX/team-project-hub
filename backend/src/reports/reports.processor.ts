import {
  Processor,
  Process,
  OnQueueActive,
  OnQueueCompleted,
  OnQueueFailed,
} from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as ExcelJS from 'exceljs';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../prisma/prisma.service';
import { MinioService } from '../files/minio.service';
import { ReportsService } from './reports.service';
import { ExportFormat, ReportType } from './dto/export-report.dto';
import { WorkLogStatus } from '@prisma/client';

@Processor('reports')
export class ReportsProcessor {
  private readonly logger = new Logger(ReportsProcessor.name);
  private mailer: nodemailer.Transporter;

  constructor(
    private readonly prisma: PrismaService,
    private readonly minioService: MinioService,
    private readonly reportsService: ReportsService,
    private readonly configService: ConfigService,
  ) {
    this.mailer = nodemailer.createTransport({
      host: this.configService.get<string>('SMTP_HOST') ?? 'smtp.example.com',
      port: Number(this.configService.get<number>('SMTP_PORT') ?? 587),
      secure: this.configService.get<string>('SMTP_SECURE') === 'true',
      auth: {
        user: this.configService.get<string>('SMTP_USER'),
        pass: this.configService.get<string>('SMTP_PASS'),
      },
    });
  }

  @OnQueueActive()
  onActive(job: Job) {
    this.logger.log(`Processing report job ${job.id} of type ${job.name}`);
  }

  @OnQueueCompleted()
  onCompleted(job: Job, result: any) {
    this.logger.log(`Report job ${job.id} completed: ${JSON.stringify(result)}`);
  }

  @OnQueueFailed()
  onFailed(job: Job, err: Error) {
    this.logger.error(`Report job ${job.id} failed: ${err.message}`, err.stack);
  }

  @Process('exportExcel')
  async exportExcel(job: Job<{
    type: ReportType;
    targetId: string;
    startDate?: string;
    endDate?: string;
    requestedById: string;
  }>) {
    const { type, targetId, startDate, endDate, requestedById } = job.data;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Team Project Hub';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet(`${type}-report-${targetId}`);

    const data = await this.fetchReportData(type, targetId, startDate, endDate);

    sheet.columns = data.columns;
    data.rows.forEach((row) => sheet.addRow(row));

    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: data.columns.length },
    };

    const buffer = await workbook.xlsx.writeBuffer();

    const objectKey = `reports/${type}-${targetId}-${Date.now()}.xlsx`;
    await this.minioService.uploadVersion(objectKey, Buffer.from(buffer), {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    const downloadUrl = await this.minioService.getFileUrl(objectKey, 7 * 24 * 3600);

    await this.sendExportEmail(requestedById, type, targetId, downloadUrl, ExportFormat.EXCEL);

    return {
      success: true,
      objectKey,
      downloadUrl,
      rowCount: data.rows.length,
      format: ExportFormat.EXCEL,
    };
  }

  @Process('exportCsv')
  async exportCsv(job: Job<{
    type: ReportType;
    targetId: string;
    startDate?: string;
    endDate?: string;
    requestedById: string;
  }>) {
    const { type, targetId, startDate, endDate, requestedById } = job.data;

    const data = await this.fetchReportData(type, targetId, startDate, endDate);

    const headers = data.columns.map((c: any) => c.header);
    const keys = data.columns.map((c: any) => c.key);

    const csvLines = [headers.join(',')];
    for (const row of data.rows) {
      const line = keys
        .map((key: string) => {
          const value = (row as any)[key];
          if (value === null || value === undefined) return '';
          const str = String(value).replace(/"/g, '""');
          return /[",\n]/.test(str) ? `"${str}"` : str;
        })
        .join(',');
      csvLines.push(line);
    }

    const csvBuffer = Buffer.from(csvLines.join('\n'), 'utf-8');

    const objectKey = `reports/${type}-${targetId}-${Date.now()}.csv`;
    await this.minioService.uploadVersion(objectKey, csvBuffer, {
      'Content-Type': 'text/csv',
    });

    const downloadUrl = await this.minioService.getFileUrl(objectKey, 7 * 24 * 3600);

    await this.sendExportEmail(requestedById, type, targetId, downloadUrl, ExportFormat.CSV);

    return {
      success: true,
      objectKey,
      downloadUrl,
      rowCount: data.rows.length,
      format: ExportFormat.CSV,
    };
  }

  @Process('recalculate-project')
  async recalculateProject(job: Job<{ projectId: string }>) {
    const { projectId } = job.data;
    await this.reportsService.invalidateCache(`project:${projectId}`);
    this.logger.log(`Invalidated cache for project ${projectId}`);
    return { success: true, projectId };
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private async fetchReportData(
    type: ReportType,
    targetId: string,
    startDate?: string,
    endDate?: string,
  ): Promise<{ columns: { header: string; key: string }[]; rows: any[] }> {
    const dateFilter: any = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate);

    if (type === ReportType.PROJECT) {
      const workLogs = await this.prisma.workLog.findMany({
        where: {
          task: { projectId: targetId },
          ...(Object.keys(dateFilter).length > 0 ? { logDate: dateFilter } : {}),
          status: WorkLogStatus.APPROVED,
        },
        select: {
          id: true,
          logDate: true,
          hours: true,
          overtimeHours: true,
          description: true,
          task: { select: { id: true, title: true, status: true } },
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { logDate: 'desc' },
      });

      return {
        columns: [
          { header: 'Log ID', key: 'id' },
          { header: 'Date', key: 'logDate' },
          { header: 'Task', key: 'taskTitle' },
          { header: 'Status', key: 'taskStatus' },
          { header: 'User', key: 'userName' },
          { header: 'Hours', key: 'hours' },
          { header: 'Overtime', key: 'overtimeHours' },
          { header: 'Description', key: 'description' },
        ],
        rows: workLogs.map((w) => ({
          id: w.id,
          logDate: w.logDate.toISOString().slice(0, 10),
          taskTitle: w.task.title,
          taskStatus: w.task.status,
          userName: w.user.name,
          hours: w.hours,
          overtimeHours: w.overtimeHours,
          description: w.description ?? '',
        })),
      };
    }

    if (type === ReportType.TEAM) {
      const team = await this.prisma.team.findUnique({
        where: { id: targetId },
        select: {
          name: true,
          projects: {
            select: {
              id: true,
              name: true,
              tasks: {
                select: {
                  title: true,
                  status: true,
                  workLogs: {
                    where: {
                      ...(Object.keys(dateFilter).length > 0 ? { logDate: dateFilter } : {}),
                      status: WorkLogStatus.APPROVED,
                    },
                    select: { hours: true, user: { select: { name: true } } },
                  },
                },
              },
            },
          },
        },
      });

      const rows: any[] = [];
      if (team) {
        for (const project of team.projects) {
          for (const task of project.tasks) {
            for (const log of task.workLogs) {
              rows.push({
                projectName: project.name,
                taskTitle: task.title,
                taskStatus: task.status,
                userName: log.user.name,
                hours: log.hours,
              });
            }
          }
        }
      }

      return {
        columns: [
          { header: 'Project', key: 'projectName' },
          { header: 'Task', key: 'taskTitle' },
          { header: 'Status', key: 'taskStatus' },
          { header: 'User', key: 'userName' },
          { header: 'Hours', key: 'hours' },
        ],
        rows,
      };
    }

    if (type === ReportType.USER) {
      const workLogs = await this.prisma.workLog.findMany({
        where: {
          userId: targetId,
          ...(Object.keys(dateFilter).length > 0 ? { logDate: dateFilter } : {}),
          status: WorkLogStatus.APPROVED,
        },
        select: {
          logDate: true,
          hours: true,
          overtimeHours: true,
          description: true,
          task: {
            select: {
              title: true,
              project: { select: { name: true } },
            },
          },
        },
        orderBy: { logDate: 'desc' },
      });

      return {
        columns: [
          { header: 'Date', key: 'logDate' },
          { header: 'Project', key: 'projectName' },
          { header: 'Task', key: 'taskTitle' },
          { header: 'Hours', key: 'hours' },
          { header: 'Overtime', key: 'overtimeHours' },
          { header: 'Description', key: 'description' },
        ],
        rows: workLogs.map((w) => ({
          logDate: w.logDate.toISOString().slice(0, 10),
          projectName: w.task.project.name,
          taskTitle: w.task.title,
          hours: w.hours,
          overtimeHours: w.overtimeHours,
          description: w.description ?? '',
        })),
      };
    }

    return { columns: [], rows: [] };
  }

  private async sendExportEmail(
    userId: string,
    type: ReportType,
    targetId: string,
    downloadUrl: string,
    format: ExportFormat,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    });

    if (!user?.email) {
      this.logger.warn(`Cannot send export email: user ${userId} has no email`);
      return;
    }

    const subject = `Your ${type} report is ready (${format.toUpperCase()})`;
    const html = `
      <h2>Report Export Ready</h2>
      <p>Hello ${user.name},</p>
      <p>Your <strong>${type}</strong> report (ID: ${targetId}) has been generated successfully.</p>
      <p><a href="${downloadUrl}">Click here to download</a> (link expires in 7 days)</p>
      <p>— Team Project Hub</p>
    `;

    try {
      await this.mailer.sendMail({
        from: this.configService.get<string>('SMTP_FROM') ?? 'noreply@teamprojecthub.com',
        to: user.email,
        subject,
        html,
      });
      this.logger.log(`Export email sent to ${user.email}`);
    } catch (err) {
      this.logger.error(`Failed to send export email: ${err.message}`);
    }
  }
}
