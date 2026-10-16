import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * Clean database helper — useful for integration tests / seeding resets.
   * Deletes in FK-dependency order inside a single transaction.
   */
  async cleanDatabase() {
    if (process.env.NODE_ENV === 'production') return;
    await this.$transaction([
      this.notification.deleteMany(),
      this.fileVersion.deleteMany(),
      this.workLog.deleteMany(),
      this.taskComment.deleteMany(),
      this.task.deleteMany(),
      this.project.deleteMany(),
      this.teamInvite.deleteMany(),
      this.user.deleteMany(),
      this.team.deleteMany(),
    ]);
  }
}
