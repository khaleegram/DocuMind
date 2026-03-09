export const MAX_UPLOAD_SIZE_MB = 16;
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_SIZE_MB * 1024 * 1024;

export const ALLOWED_UPLOAD_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
] as const;

export const ALLOWED_UPLOAD_EXTENSIONS = ['.pdf', '.jpeg', '.jpg', '.png', '.gif', '.webp'] as const;

export const DEFAULT_PAGE_SIZE = 24;
export const AI_SEARCH_MAX_DOCUMENTS = 120;
