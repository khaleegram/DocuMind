import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { FieldValue } from 'firebase-admin/firestore';
import { getDownloadURL as getAdminDownloadURL } from 'firebase-admin/storage';
import { inflateRawSync } from 'node:zlib';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import { requireUserFromBearerToken } from '@/lib/api-auth';
import { adminDb, adminStorage } from '@/lib/firebase-admin';
import { extractDocumentMetadata, type ExtractDocumentMetadataOutput } from '@/ai/flows/extract-document-metadata';
import { extractTextFromImage } from '@/ai/flows/extract-text-from-image';
import { enhanceSearchWithKeywords } from '@/ai/flows/enhance-search-with-keywords';
import {
  ALLOWED_UPLOAD_EXTENSIONS,
  ALLOWED_UPLOAD_MIME_TYPES,
  MAX_FILES_PER_UPLOAD,
  MAX_UPLOAD_BYTES,
} from '@/lib/constants';

export const runtime = 'nodejs';
export const maxDuration = 300;

const ProcessRequestSchema = z.object({
  docId: z.string().min(1),
});

const StoredSourceFileSchema = z.object({
  fileName: z.string().min(1),
  fileUrl: z.string().min(1),
  mimeType: z.string().min(1),
  storagePath: z.string().min(1),
});

type StoredSourceFile = z.infer<typeof StoredSourceFileSchema>;

const THUMBNAIL_WIDTH = 640;
const THUMBNAIL_HEIGHT = 480;
const PDF_THUMBNAIL_BACKGROUND = '#1f2937';
const PDF_THUMBNAIL_BORDER = '#334155';
const PDF_THUMBNAIL_ACCENT = '#ef4444';
const ZIP_EOCD_SIGNATURE = 0x06054b50;
const ZIP_CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const ZIP_LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;
const ZIP_MAX_COMMENT_BYTES = 0xffff;

type ZipEntry = {
  name: string;
  compressionMethod: number;
  compressedSize: number;
  dataOffset: number;
};

const isAllowedMimeType = (mimeType: string): boolean =>
  ALLOWED_UPLOAD_MIME_TYPES.includes(mimeType as (typeof ALLOWED_UPLOAD_MIME_TYPES)[number]);
const isAiMediaMimeType = (mimeType: string): boolean =>
  mimeType === 'application/pdf' || mimeType.startsWith('image/');

const normalizeErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return 'Document processing failed.';
};

const withTimeout = async <T>(
  promiseFactory: () => Promise<T>,
  timeoutMs: number,
  timeoutMessage: string
): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
  });

  try {
    return await Promise.race([promiseFactory(), timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

const parseStoredSourceFiles = (documentData: Record<string, unknown>): StoredSourceFile[] => {
  const parsed = z.array(StoredSourceFileSchema).safeParse(documentData.sourceFiles);
  if (parsed.success && parsed.data.length > 0) {
    return parsed.data;
  }

  const storagePath = typeof documentData.storagePath === 'string' ? documentData.storagePath : '';
  const fileName = typeof documentData.fileName === 'string' ? documentData.fileName : '';
  const fileUrl = typeof documentData.fileUrl === 'string' ? documentData.fileUrl : '';
  const mimeType = typeof documentData.mimeType === 'string' ? documentData.mimeType : '';

  if (!storagePath || !fileName || !fileUrl || !mimeType) {
    return [];
  }

  return [{ fileName, fileUrl, mimeType, storagePath }];
};

const inferDocumentTypeFromCategory = (category: string): string => {
  const normalized = category.trim().toLowerCase();
  if (!normalized) return 'Document';
  if (normalized.includes('credential')) return 'Certificate';
  if (normalized.includes('financial')) return 'Financial Document';
  if (normalized.includes('legal')) return 'Legal Document';
  if (normalized.includes('medical')) return 'Medical Document';
  if (normalized.includes('receipt')) return 'Receipt';
  if (normalized.includes('travel')) return 'Travel Document';
  if (normalized.includes('id')) return 'Identity Document';
  return 'Document';
};

const inferDocumentTypeFromFile = (fileName: string, mimeType: string): string => {
  const normalizedFileName = fileName.toLowerCase();
  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    normalizedFileName.endsWith('.docx')
  ) {
    return 'Word Document';
  }
  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    normalizedFileName.endsWith('.xlsx')
  ) {
    return 'Spreadsheet';
  }
  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
    normalizedFileName.endsWith('.pptx')
  ) {
    return 'Presentation';
  }
  if (mimeType === 'application/pdf' || normalizedFileName.endsWith('.pdf')) {
    return 'PDF Document';
  }
  if (mimeType.startsWith('image/')) {
    return 'Image Document';
  }
  return 'Document';
};

const inferCategoryFromDocumentType = (documentType: string): string => {
  const normalizedType = documentType.toLowerCase();
  if (normalizedType.includes('certificate')) return 'Credential';
  if (normalizedType.includes('invoice') || normalizedType.includes('receipt')) return 'Financial';
  if (normalizedType.includes('contract') || normalizedType.includes('letter')) return 'Legal';
  if (normalizedType.includes('presentation') || normalizedType.includes('spreadsheet')) return 'Work';
  return 'Work';
};

const toTitleCase = (value: string): string =>
  value
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

const extractKeywordsFromFileName = (fileName: string): string[] => {
  const base = fileName.replace(/\.[^/.]+$/, '').toLowerCase();
  return base
    .split(/[^a-z0-9]+/)
    .filter(token => token.length > 1)
    .slice(0, 5);
};

const buildFallbackMetadata = (params: {
  fileName: string;
  mimeType: string;
  fileCount: number;
}): ExtractDocumentMetadataOutput => {
  const { fileName, mimeType, fileCount } = params;
  const documentType = inferDocumentTypeFromFile(fileName, mimeType);
  const category = inferCategoryFromDocumentType(documentType);
  const baseName = fileName
    .replace(/\.[^/.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .trim();
  const humanizedBaseName = baseName ? toTitleCase(baseName) : documentType;
  const keywords = extractKeywordsFromFileName(fileName);
  const typeTag = documentType.toLowerCase().replace(/\s+/g, '-');

  return {
    displayName: humanizedBaseName || documentType,
    documentType,
    owner: 'Unknown Owner',
    category,
    expiry: null,
    tags: [typeTag, fileCount > 1 ? 'grouped' : 'single'].filter(Boolean),
    keywords,
    summary:
      fileCount > 1
        ? `Grouped document containing ${fileCount} files.`
        : `${documentType} uploaded and ready for review.`,
  };
};

const buildDisplayNameFallback = (
  owner: string,
  documentType: string,
  fileNameHint: string
): string => {
  const cleanOwner = owner.trim();
  const cleanType = documentType.trim() || 'Document';
  if (cleanOwner) {
    const firstToken = cleanOwner.split(/\s+/)[0] ?? cleanOwner;
    if (/^[A-Za-z][A-Za-z'-]*$/.test(firstToken)) {
      const possessiveSuffix = firstToken.toLowerCase().endsWith('s') ? "'" : "'s";
      return `${firstToken}${possessiveSuffix} ${cleanType}`;
    }
    return `${cleanOwner} ${cleanType}`;
  }

  const baseFileName = fileNameHint.replace(/\.[^/.]+$/, '').trim();
  return baseFileName || cleanType;
};

const extractPdfPageCount = (fileBuffer: Buffer): number | null => {
  try {
    const pdfText = fileBuffer.toString('latin1');
    const matches = pdfText.match(/\/Type\s*\/Page\b/g);
    if (!matches || matches.length === 0) {
      return null;
    }
    return matches.length;
  } catch {
    return null;
  }
};

const findEndOfCentralDirectoryOffset = (zipBuffer: Buffer): number => {
  const minimumOffset = Math.max(0, zipBuffer.length - ZIP_MAX_COMMENT_BYTES - 22);
  for (let offset = zipBuffer.length - 22; offset >= minimumOffset; offset -= 1) {
    if (zipBuffer.readUInt32LE(offset) === ZIP_EOCD_SIGNATURE) {
      return offset;
    }
  }
  return -1;
};

const parseZipEntries = (zipBuffer: Buffer): ZipEntry[] => {
  try {
    const eocdOffset = findEndOfCentralDirectoryOffset(zipBuffer);
    if (eocdOffset < 0) return [];

    const totalEntries = zipBuffer.readUInt16LE(eocdOffset + 10);
    const centralDirectorySize = zipBuffer.readUInt32LE(eocdOffset + 12);
    const centralDirectoryOffset = zipBuffer.readUInt32LE(eocdOffset + 16);
    if (centralDirectoryOffset + centralDirectorySize > zipBuffer.length) return [];

    const entries: ZipEntry[] = [];
    let cursor = centralDirectoryOffset;

    for (let index = 0; index < totalEntries; index += 1) {
      if (cursor + 46 > zipBuffer.length) break;
      if (zipBuffer.readUInt32LE(cursor) !== ZIP_CENTRAL_DIRECTORY_SIGNATURE) break;

      const compressionMethod = zipBuffer.readUInt16LE(cursor + 10);
      const compressedSize = zipBuffer.readUInt32LE(cursor + 20);
      const fileNameLength = zipBuffer.readUInt16LE(cursor + 28);
      const extraFieldLength = zipBuffer.readUInt16LE(cursor + 30);
      const commentLength = zipBuffer.readUInt16LE(cursor + 32);
      const localHeaderOffset = zipBuffer.readUInt32LE(cursor + 42);

      const fileNameStart = cursor + 46;
      const fileNameEnd = fileNameStart + fileNameLength;
      if (fileNameEnd > zipBuffer.length) break;

      const name = zipBuffer.toString('utf8', fileNameStart, fileNameEnd);
      if (localHeaderOffset + 30 <= zipBuffer.length) {
        const localHeaderSignature = zipBuffer.readUInt32LE(localHeaderOffset);
        if (localHeaderSignature === ZIP_LOCAL_FILE_HEADER_SIGNATURE) {
          const localFileNameLength = zipBuffer.readUInt16LE(localHeaderOffset + 26);
          const localExtraFieldLength = zipBuffer.readUInt16LE(localHeaderOffset + 28);
          const dataOffset = localHeaderOffset + 30 + localFileNameLength + localExtraFieldLength;
          if (dataOffset + compressedSize <= zipBuffer.length) {
            entries.push({ name, compressionMethod, compressedSize, dataOffset });
          }
        }
      }

      cursor += 46 + fileNameLength + extraFieldLength + commentLength;
    }

    return entries;
  } catch {
    return [];
  }
};

const readZipEntryText = (zipBuffer: Buffer, entries: ZipEntry[], entryName: string): string | null => {
  const target = entryName.toLowerCase();
  const entry = entries.find(candidate => candidate.name.toLowerCase() === target);
  if (!entry) return null;

  try {
    const compressed = zipBuffer.subarray(entry.dataOffset, entry.dataOffset + entry.compressedSize);
    if (entry.compressionMethod === 0) {
      return compressed.toString('utf8');
    }
    if (entry.compressionMethod === 8) {
      return inflateRawSync(compressed).toString('utf8');
    }
    return null;
  } catch {
    return null;
  }
};

const extractTaggedCount = (xmlText: string, tagName: string): number | null => {
  const match = xmlText.match(new RegExp(`<${tagName}>(\\d+)</${tagName}>`, 'i'));
  if (!match?.[1]) return null;

  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const extractDocxPageCount = (fileBuffer: Buffer, entries: ZipEntry[]): number | null => {
  const appXml = readZipEntryText(fileBuffer, entries, 'docProps/app.xml');
  if (appXml) {
    const appPages = extractTaggedCount(appXml, 'Pages');
    if (appPages) return appPages;
  }

  const documentXml = readZipEntryText(fileBuffer, entries, 'word/document.xml');
  if (!documentXml) return null;

  const renderedBreaks = documentXml.match(/<w:lastRenderedPageBreak\b/gi)?.length ?? 0;
  return renderedBreaks > 0 ? renderedBreaks + 1 : null;
};

const extractXlsxSheetCount = (entries: ZipEntry[]): number | null => {
  const sheetCount = entries.filter(entry => /^xl\/worksheets\/sheet\d+\.xml$/i.test(entry.name)).length;
  return sheetCount > 0 ? sheetCount : null;
};

const extractPptxSlideCount = (entries: ZipEntry[]): number | null => {
  const slideCount = entries.filter(entry => /^ppt\/slides\/slide\d+\.xml$/i.test(entry.name)).length;
  return slideCount > 0 ? slideCount : null;
};

const extractDocumentUnitCount = (fileBuffer: Buffer, mimeType: string, fileName: string): number | null => {
  if (mimeType === 'application/pdf') {
    return extractPdfPageCount(fileBuffer);
  }

  const normalizedFileName = fileName.toLowerCase();
  const isDocx =
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    normalizedFileName.endsWith('.docx');
  const isXlsx =
    mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    normalizedFileName.endsWith('.xlsx');
  const isPptx =
    mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
    normalizedFileName.endsWith('.pptx');

  if (!isDocx && !isXlsx && !isPptx) {
    return null;
  }

  const entries = parseZipEntries(fileBuffer);
  if (entries.length === 0) return null;

  if (isDocx) return extractDocxPageCount(fileBuffer, entries);
  if (isXlsx) return extractXlsxSheetCount(entries);
  if (isPptx) return extractPptxSlideCount(entries);
  return null;
};

const buildFirebaseDownloadUrl = (bucketName: string, objectPath: string, token: string): string =>
  `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(
    objectPath
  )}?alt=media&token=${token}`;

const escapeXml = (input: string): string =>
  input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const truncateText = (input: string, maxLength: number): string =>
  input.length > maxLength ? `${input.slice(0, Math.max(0, maxLength - 1))}\u2026` : input;

const createPdfPlaceholderThumbnail = async (fileName: string): Promise<{ buffer: Buffer; contentType: string }> => {
  const safeName = truncateText(fileName || 'PDF Document', 48);
  const svg = `
    <svg width="${THUMBNAIL_WIDTH}" height="${THUMBNAIL_HEIGHT}" viewBox="0 0 ${THUMBNAIL_WIDTH} ${THUMBNAIL_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${THUMBNAIL_WIDTH}" height="${THUMBNAIL_HEIGHT}" fill="${PDF_THUMBNAIL_BACKGROUND}" />
      <rect x="16" y="16" width="${THUMBNAIL_WIDTH - 32}" height="${THUMBNAIL_HEIGHT - 32}" rx="18" fill="none" stroke="${PDF_THUMBNAIL_BORDER}" stroke-width="2" />
      <rect x="32" y="36" width="96" height="40" rx="10" fill="${PDF_THUMBNAIL_ACCENT}" />
      <text x="80" y="62" text-anchor="middle" font-size="20" font-family="Arial, sans-serif" font-weight="700" fill="#ffffff">PDF</text>
      <text x="32" y="130" font-size="22" font-family="Arial, sans-serif" font-weight="700" fill="#f8fafc">${escapeXml(safeName)}</text>
      <text x="32" y="168" font-size="16" font-family="Arial, sans-serif" fill="#94a3b8">Preview generated placeholder</text>
    </svg>
  `;

  const buffer = await sharp(Buffer.from(svg)).webp({ quality: 84 }).toBuffer();
  return { buffer, contentType: 'image/webp' };
};

const createThumbnailBuffer = async (
  fileBuffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<{ buffer: Buffer; contentType: string } | null> => {
  const isImage = mimeType.startsWith('image/');
  const isPdf = mimeType === 'application/pdf';
  const canDecodePdf = Boolean(sharp.format.pdf?.input?.buffer);

  if (!isImage && !isPdf) {
    return null;
  }

  if (isPdf && !canDecodePdf) {
    return createPdfPlaceholderThumbnail(fileName);
  }

  try {
    const pipeline = isPdf
      ? sharp(fileBuffer, { density: 192, page: 0 })
      : sharp(fileBuffer).rotate();

    const resized = await pipeline
      .resize({
        width: THUMBNAIL_WIDTH,
        height: THUMBNAIL_HEIGHT,
        fit: 'cover',
        position: 'center',
        withoutEnlargement: true,
      })
      .webp({ quality: 78 })
      .toBuffer();

    return { buffer: resized, contentType: 'image/webp' };
  } catch {
    if (isPdf) {
      return createPdfPlaceholderThumbnail(fileName);
    }
    return null;
  }
};

const uploadThumbnailAndGetUrl = async (params: {
  userId: string;
  docId: string;
  thumbnail: { buffer: Buffer; contentType: string };
  bucketName: string;
}) => {
  const { userId, docId, thumbnail, bucketName } = params;
  const objectPath = `documents/${userId}/thumbnails/${docId}-${Date.now()}.webp`;
  const token = uuidv4();
  const thumbnailFile = adminStorage.bucket().file(objectPath);

  await thumbnailFile.save(thumbnail.buffer, {
    resumable: false,
    metadata: {
      contentType: thumbnail.contentType,
      cacheControl: 'public,max-age=31536000,immutable',
      metadata: {
        firebaseStorageDownloadTokens: token,
      },
    },
  });

  try {
    return await getAdminDownloadURL(thumbnailFile);
  } catch {
    return buildFirebaseDownloadUrl(bucketName, objectPath, token);
  }
};

export async function POST(request: NextRequest) {
  const authResult = await requireUserFromBearerToken(request.headers.get('authorization'));
  if ('errorResponse' in authResult) return authResult.errorResponse;

  let parsedBody: z.infer<typeof ProcessRequestSchema>;
  try {
    parsedBody = ProcessRequestSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: 'Invalid request payload.' }, { status: 400 });
  }

  const docRef = adminDb.collection('documents').doc(parsedBody.docId);
  const docSnapshot = await docRef.get();

  if (!docSnapshot.exists) {
    return NextResponse.json({ error: 'Document not found.' }, { status: 404 });
  }

  const documentData = docSnapshot.data() as Record<string, unknown>;
  if (documentData.userId !== authResult.uid) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const sourceFiles = parseStoredSourceFiles(documentData);
  if (sourceFiles.length === 0) {
    return NextResponse.json({ error: 'Document source files are missing.' }, { status: 400 });
  }
  if (sourceFiles.length > MAX_FILES_PER_UPLOAD) {
    return NextResponse.json(
      { error: `Too many files in one grouped upload. Maximum is ${MAX_FILES_PER_UPLOAD}.` },
      { status: 400 }
    );
  }

  await docRef.set(
    {
      isProcessing: true,
      processingError: null,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  const bucket = adminStorage.bucket();

  try {
    const hydratedFiles: Array<StoredSourceFile & { mimeType: string; dataUrl: string | null }> = [];
    let primaryFileBuffer: Buffer | null = null;
    let primaryMimeType = '';
    for (const file of sourceFiles) {
      const fileHandle = bucket.file(file.storagePath);
      const [metadata] = await fileHandle.getMetadata();
      const mimeTypeFromStorage = metadata.contentType ?? '';
      const mimeType = mimeTypeFromStorage || file.mimeType;

      if (!mimeType || !isAllowedMimeType(mimeType)) {
        throw new Error(
          `Unsupported file type for "${file.fileName}". Allowed types: ${ALLOWED_UPLOAD_EXTENSIONS.join(', ')}.`
        );
      }

      const fileSize = metadata.size ? Number(metadata.size) : Number.NaN;
      if (!Number.isFinite(fileSize) || fileSize <= 0) {
        throw new Error(`Could not determine size for "${file.fileName}".`);
      }
      if (fileSize > MAX_UPLOAD_BYTES) {
        throw new Error(
          `"${file.fileName}" exceeds ${MAX_UPLOAD_BYTES / (1024 * 1024)}MB processing limit.`
        );
      }

      const [fileBuffer] = await fileHandle.download();
      if (!primaryFileBuffer) {
        primaryFileBuffer = fileBuffer;
        primaryMimeType = mimeType;
      }
      const dataUrl = isAiMediaMimeType(mimeType)
        ? `data:${mimeType};base64,${fileBuffer.toString('base64')}`
        : null;
      hydratedFiles.push({ ...file, mimeType, dataUrl });
    }

    const textResults = await Promise.all(
      hydratedFiles.map(async file => {
        const dataUrl = file.dataUrl;
        if (!dataUrl) return { text: '' };
        try {
          return await withTimeout(
            () => extractTextFromImage({ documentDataUrl: dataUrl }),
            35_000,
            'Text extraction timed out.'
          );
        } catch {
          return { text: '' };
        }
      })
    );
    const textContent = textResults
      .map(result => (result.text ?? '').trim())
      .filter(Boolean)
      .join('\n\n');

    const primaryAiFile = hydratedFiles.find(file => file.dataUrl);
    const primaryAiDataUrl = primaryAiFile?.dataUrl ?? null;
    const fallbackMetadata = buildFallbackMetadata({
      fileName: hydratedFiles[0].fileName,
      mimeType: hydratedFiles[0].mimeType,
      fileCount: hydratedFiles.length,
    });
    let metadataResult: ExtractDocumentMetadataOutput = fallbackMetadata;
    if (primaryAiDataUrl) {
      try {
        metadataResult = await withTimeout(
          () =>
            extractDocumentMetadata({
              documentDataUrl: primaryAiDataUrl,
              documentText: textContent || undefined,
              fileNameHints: hydratedFiles.map(file => file.fileName),
              fileCount: hydratedFiles.length,
            }),
          35_000,
          'Metadata extraction timed out.'
        );
      } catch {
        metadataResult = fallbackMetadata;
      }
    }

    const owner = metadataResult.owner?.trim() || 'Unknown Owner';
    const category = metadataResult.category?.trim() || 'Uncategorized';
    const documentType =
      metadataResult.documentType?.trim() || inferDocumentTypeFromCategory(category);
    const displayName =
      metadataResult.displayName?.trim() ||
      buildDisplayNameFallback(owner, documentType, hydratedFiles[0].fileName);
    const tags = Array.from(
      new Set((metadataResult.tags ?? []).map(tag => tag.trim()).filter(Boolean))
    );
    let keywordResult: { keywords: string[] } = { keywords: metadataResult.keywords ?? [] };
    if (textContent) {
      try {
        keywordResult = await withTimeout(
          () => enhanceSearchWithKeywords({ documentText: textContent }),
          12_000,
          'Keyword extraction timed out.'
        );
      } catch {
        keywordResult = { keywords: metadataResult.keywords ?? [] };
      }
    }
    const keywords = Array.from(
      new Set((keywordResult.keywords ?? []).map(keyword => keyword.trim()).filter(Boolean))
    );
    const thumbnail =
      primaryFileBuffer && primaryMimeType
        ? await createThumbnailBuffer(primaryFileBuffer, primaryMimeType, hydratedFiles[0].fileName)
        : null;
    const thumbnailUrl = thumbnail
      ? await uploadThumbnailAndGetUrl({
          userId: authResult.uid,
          docId: parsedBody.docId,
          thumbnail,
          bucketName: bucket.name,
        })
      : null;
    const pageCount =
      primaryFileBuffer && primaryMimeType
        ? extractDocumentUnitCount(primaryFileBuffer, primaryMimeType, hydratedFiles[0].fileName)
        : null;

    await docRef.set(
      {
        displayName,
        documentType,
        owner,
        category,
        expiry: metadataResult.expiry,
        tags,
        keywords,
        summary: metadataResult.summary,
        textContent,
        fileCount: hydratedFiles.length,
        uploadMode: documentData.uploadMode === 'group' ? 'group' : 'single',
        sourceFiles: hydratedFiles.map(file => ({
          fileName: file.fileName,
          fileUrl: file.fileUrl,
          mimeType: file.mimeType,
          storagePath: file.storagePath,
        })),
        fileUrl: hydratedFiles[0].fileUrl,
        fileName: hydratedFiles[0].fileName,
        pageCount,
        mimeType: hydratedFiles[0].mimeType,
        storagePath: hydratedFiles[0].storagePath,
        thumbnailUrl,
        isProcessing: false,
        processingError: null,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = normalizeErrorMessage(error);
    await docRef.set(
      {
        isProcessing: false,
        processingError: message,
        category: 'Processing Failed',
        owner: 'Processing Failed',
        documentType: 'Processing Failed',
        displayName: 'Processing Failed',
        summary: `Error: ${message}`,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
