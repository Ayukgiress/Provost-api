import { NotFoundException } from '@nestjs/common';
import { DocumentsService } from './documents.service.js';

describe('DocumentsService ownership', () => {
  it('queries documents using both the document id and authenticated user id', async () => {
    const documents = { findOne: vi.fn().mockResolvedValue(null) };
    const storage = { createSignedDownloadUrl: vi.fn() };
    const service = new DocumentsService(documents as never, storage as never);

    await expect(
      service.getDownloadUrl('user-a', 'document-b'),
    ).rejects.toThrow(NotFoundException);
    expect(documents.findOne).toHaveBeenCalledWith({
      where: { id: 'document-b', userId: 'user-a' },
    });
    expect(storage.createSignedDownloadUrl).not.toHaveBeenCalled();
  });

  it('does not read another user’s document content', async () => {
    const documents = {};
    const storage = { readObject: vi.fn() };
    const service = new DocumentsService(documents as never, storage as never);

    await expect(
      service.readText('user-a', {
        userId: 'user-b',
        storagePath: 'user-b/private.pdf',
        mimeType: 'application/pdf',
      } as never),
    ).rejects.toThrow(NotFoundException);
    expect(storage.readObject).not.toHaveBeenCalled();
  });
});
