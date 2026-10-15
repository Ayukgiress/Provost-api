import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AuditLog, Document, Draft, Notification, Profile, Report, SavedItem, Subscription } from '@provost/database';
import { DataSource, Repository } from 'typeorm';
import { SupabaseStorageService } from '../../storage/supabase-storage.service.js';

@Injectable()
export class AccountService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly storage: SupabaseStorageService,
    @InjectRepository(Document) private readonly documents: Repository<Document>,
  ) {}

  async delete(userId: string) {
    const documents = await this.documents.find({ where: { userId }, select: { id: true, storagePath: true } });
    await this.storage.deleteObjects(documents.map((document) => document.storagePath));

    await this.dataSource.transaction(async (manager) => {
      for (const entity of [Profile, SavedItem, Draft, Document, Subscription, Notification, Report]) {
        await manager.getRepository(entity).delete({ userId });
      }
      await manager.getRepository(AuditLog).delete({ actorId: userId });
    });

    await this.storage.deleteAuthUser(userId);
    return { deleted: true };
  }
}
