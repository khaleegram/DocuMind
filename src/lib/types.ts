import { z } from 'zod';

const MAX_TIMESTAMP_MS = 8640000000000000;

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

export const documentSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  owner: z.string().min(1),
  category: z.string().min(1),
  tags: z.array(z.string()),
  expiry: z.string().nullable(),
  keywords: z.array(z.string()),
  uploadedAt: z.string().min(1),
  fileUrl: z.string(),
  fileName: z.string().min(1),
  isProcessing: z.boolean().optional(),
  summary: z.string().optional(),
  textContent: z.string(),
  mimeType: z.string().min(1),
  thumbnailUrl: z.string().nullable(),
  storagePath: z.string(),
  processingError: z.string().nullable().optional(),
});

export type Document = z.infer<typeof documentSchema>;

export const parseDocumentFromFirestore = (id: string, data: Record<string, unknown>): Document => {
  const normalized = {
    id,
    userId: fallbackString(data.userId, ''),
    owner: fallbackString(data.owner, 'Unknown Owner'),
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
    isProcessing: typeof data.isProcessing === 'boolean' ? data.isProcessing : undefined,
    summary: typeof data.summary === 'string' ? data.summary : undefined,
    textContent: typeof data.textContent === 'string' ? data.textContent : '',
    mimeType: fallbackString(data.mimeType, 'application/octet-stream'),
    thumbnailUrl: typeof data.thumbnailUrl === 'string' ? data.thumbnailUrl : null,
    storagePath: fallbackString(data.storagePath, ''),
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
