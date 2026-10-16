import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import { Readable } from 'stream';

@Injectable()
export class MinioService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MinioService.name);
  private client: Minio.Client;
  private bucketName: string;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    this.bucketName =
      this.configService.get<string>('MINIO_BUCKET') ?? 'team-project-hub';

    this.client = new Minio.Client({
      endPoint: this.configService.get<string>('MINIO_ENDPOINT') ?? 'localhost',
      port: Number(this.configService.get<number>('MINIO_PORT') ?? 9000),
      useSSL: this.configService.get<string>('MINIO_USE_SSL') === 'true',
      accessKey: this.configService.get<string>('MINIO_ACCESS_KEY') ?? 'minioadmin',
      secretKey: this.configService.get<string>('MINIO_SECRET_KEY') ?? 'minioadmin',
    });

    try {
      const exists = await this.client.bucketExists(this.bucketName);
      if (!exists) {
        await this.client.makeBucket(this.bucketName, 'us-east-1');
        this.logger.log(`Created MinIO bucket "${this.bucketName}"`);
      }
    } catch (error) {
      this.logger.error(`Failed to initialize MinIO bucket: ${error.message}`);
    }
  }

  async onModuleDestroy() {
    // MinIO client doesn't require explicit cleanup
  }

  /**
   * Uploads a buffer/stream to MinIO and returns the object key.
   */
  async uploadFile(
    objectKey: string,
    data: Buffer | Readable | string,
    size?: number,
    metadata?: Record<string, string>,
  ): Promise<string> {
    const metaData = {
      'Content-Type': metadata?.['Content-Type'] ?? 'application/octet-stream',
      ...metadata,
    };

    if (data instanceof Buffer) {
      await this.client.putObject(this.bucketName, objectKey, data, data.length, metaData);
    } else if (typeof data === 'string') {
      await this.client.fPutObject(this.bucketName, objectKey, data, metaData);
    } else {
      await this.client.putObject(this.bucketName, objectKey, data, size, metaData);
    }

    return objectKey;
  }

  /**
   * Uploads a file buffer as a versioned object.
   */
  async uploadVersion(
    objectKey: string,
    data: Buffer,
    metadata?: Record<string, string>,
  ): Promise<string> {
    return this.uploadFile(objectKey, data, undefined, metadata);
  }

  /**
   * Returns a presigned URL for downloading an object.
   */
  async getFileUrl(objectKey: string, expiresIn = 3600): Promise<string> {
    return this.client.presignedGetObject(this.bucketName, objectKey, expiresIn);
  }

  /**
   * Deletes an object from MinIO.
   */
  async deleteFile(objectKey: string): Promise<void> {
    await this.client.removeObject(this.bucketName, objectKey);
  }

  /**
   * Returns the raw object stream.
   */
  async getObjectStream(objectKey: string): Promise<Readable> {
    return this.client.getObject(this.bucketName, objectKey);
  }

  getBucketName(): string {
    return this.bucketName;
  }
}
