import { describe, expect, it } from 'vitest';
import { parseDocumentFromFirestore } from './types';

describe('parseDocumentFromFirestore', () => {
  it('normalizes legacy expiryDate into expiry', () => {
    const parsed = parseDocumentFromFirestore('doc-1', {
      userId: 'user-1',
      owner: 'Jane Doe',
      category: 'Legal',
      tags: ['contract'],
      expiryDate: '2030-01-01',
      keywords: ['nda'],
      uploadedAt: '2025-01-01T00:00:00.000Z',
      fileUrl: 'https://example.com/file.pdf',
      fileName: 'contract.pdf',
      textContent: 'Sample text',
      mimeType: 'application/pdf',
      storagePath: 'documents/user-1/contract.pdf',
    });

    expect(parsed.expiry).toBe('2030-01-01');
    expect(parsed.thumbnailUrl).toBeNull();
    expect(parsed.tags).toEqual(['contract']);
    expect(parsed.displayName).toBe('Jane Doe');
    expect(parsed.documentType).toBe('Document');
    expect(parsed.uploadMode).toBe('single');
    expect(parsed.fileCount).toBe(1);
    expect(parsed.pageCount).toBeNull();
  });

  it('falls back to safe defaults for missing optional fields', () => {
    const parsed = parseDocumentFromFirestore('doc-2', {
      userId: 'user-2',
      owner: 'Acme',
      category: 'Financial',
      uploadedAt: Date.now(),
      fileUrl: 'https://example.com/invoice.pdf',
      fileName: 'invoice.pdf',
      mimeType: 'application/pdf',
      storagePath: 'documents/user-2/invoice.pdf',
    });

    expect(parsed.tags).toEqual([]);
    expect(parsed.keywords).toEqual([]);
    expect(parsed.expiry).toBeNull();
    expect(parsed.textContent).toBe('');
    expect(parsed.displayName).toBe('Acme');
    expect(parsed.documentType).toBe('Document');
    expect(parsed.fileCount).toBe(1);
    expect(parsed.pageCount).toBeNull();
  });
});
