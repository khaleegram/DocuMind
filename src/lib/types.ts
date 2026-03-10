import { z } from 'zod';

const MAX_TIMESTAMP_MS = 8640000000000000;

const sourceFileSchema = z.object({
  fileName: z.string().min(1),
  fileUrl: z.string().min(1),
  mimeType: z.string().min(1),
  storagePath: z.string().min(1),
});

const toIsoString = (value: unknown): string => {
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= MAX_TIMESTAMP_MS) {
    return new Date(value).toISOString();
  }

  if (
    value &&
    typeof value === 'object' &&
    'toDate' in value &&
    typeof (value as { toDate?: unknown }).toDate === 'function'
  ) {
    try {
      const date = (value as { toDate: () => Date }).toDate();
      return date.toISOString();
    } catch {
      return new Date().toISOString();
    }
  }

  return new Date().toISOString();
};

const fallbackString = (value: unknown, fallback: string): string =>
  typeof value === 'string' && value.trim().length > 0 ? value : fallback;

const toStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
};

const toSourceFiles = (value: unknown): z.infer<typeof sourceFileSchema>[] => {
  if (!Array.isArray(value)) return [];

  return value.flatMap(item => {
    if (!item || typeof item !== 'object') return [];
    const record = item as Record<string, unknown>;

    const fileName = fallbackString(record.fileName, '');
    const fileUrl = fallbackString(record.fileUrl, '');
    const mimeType = fallbackString(record.mimeType, '');
    const storagePath = fallbackString(record.storagePath, '');

    if (!fileName || !fileUrl || !mimeType || !storagePath) return [];

    return [{ fileName, fileUrl, mimeType, storagePath }];
  });
};

export const documentSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  displayName: z.string().min(1),
  documentType: z.string().min(1),
  owner: z.string().min(1),
  category: z.string().min(1),
  tags: z.array(z.string()),
  expiry: z.string().nullable(),
  keywords: z.array(z.string()),
  uploadedAt: z.string().min(1),
  fileUrl: z.string(),
  fileName: z.string().min(1),
  pageCount: z.number().int().positive().nullable(),
  isProcessing: z.boolean().optional(),
  summary: z.string().optional(),
  textContent: z.string(),
  mimeType: z.string().min(1),
  thumbnailUrl: z.string().nullable(),
  storagePath: z.string(),
  uploadMode: z.enum(['single', 'group']),
  fileCount: z.number().int().positive(),
  sourceFiles: z.array(sourceFileSchema),
  processingError: z.string().nullable().optional(),
});

export type Document = z.infer<typeof documentSchema>;

export const parseDocumentFromFirestore = (id: string, data: Record<string, unknown>): Document => {
  const sourceFiles = toSourceFiles(data.sourceFiles);
  const fallbackOwner = fallbackString(data.owner, 'Unknown Owner');
  const fallbackFileName = fallbackString(data.fileName, 'Untitled');
  const normalizedStoragePath = fallbackString(data.storagePath, sourceFiles[0]?.storagePath ?? '');
  const normalizedFileCount =
    typeof data.fileCount === 'number' && Number.isFinite(data.fileCount) && data.fileCount > 0
      ? Math.floor(data.fileCount)
      : sourceFiles.length > 0
        ? sourceFiles.length
        : 1;

  const normalized = {
    id,
    userId: fallbackString(data.userId, ''),
    displayName: fallbackString(data.displayName, fallbackOwner || fallbackFileName),
    documentType: fallbackString(data.documentType, 'Document'),
    owner: fallbackOwner,
    category: fallbackString(data.category, 'Uncategorized'),
    tags: toStringArray(data.tags),
    expiry: typeof data.expiry === 'string' || data.expiry === null
      ? data.expiry
      : typeof data.expiryDate === 'string' || data.expiryDate === null
        ? data.expiryDate
        : null,
    keywords: toStringArray(data.keywords),
    uploadedAt: toIsoString(data.uploadedAt),
    fileUrl: fallbackString(data.fileUrl, ''),
    fileName: fallbackString(data.fileName, 'Untitled'),
    pageCount:
      typeof data.pageCount === 'number' && Number.isInteger(data.pageCount) && data.pageCount > 0
        ? data.pageCount
        : null,
    isProcessing: typeof data.isProcessing === 'boolean' ? data.isProcessing : undefined,
    summary: typeof data.summary === 'string' ? data.summary : undefined,
    textContent: typeof data.textContent === 'string' ? data.textContent : '',
    mimeType: fallbackString(data.mimeType, 'application/octet-stream'),
    thumbnailUrl: typeof data.thumbnailUrl === 'string' ? data.thumbnailUrl : null,
    storagePath: normalizedStoragePath,
    uploadMode: data.uploadMode === 'group' ? 'group' : 'single',
    fileCount: normalizedFileCount,
    sourceFiles,
    processingError: typeof data.processingError === 'string' ? data.processingError : null,
  };

  return documentSchema.parse(normalized);
};

export type Folder = {
  id: string;
  userId: string;
  name: string;
  createdAt: string;
};
