import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { FieldValue } from 'firebase-admin/firestore';
import { requireUserFromBearerToken } from '@/lib/api-auth';
import { adminDb, adminStorage } from '@/lib/firebase-admin';
import { extractDocumentMetadata } from '@/ai/flows/extract-document-metadata';
import { extractTextFromImage } from '@/ai/flows/extract-text-from-image';
import { enhanceSearchWithKeywords } from '@/ai/flows/enhance-search-with-keywords';
import { ALLOWED_UPLOAD_MIME_TYPES, MAX_UPLOAD_BYTES } from '@/lib/constants';

export const runtime = 'nodejs';

const ProcessRequestSchema = z.object({
  docId: z.string().min(1),
});

const isAllowedMimeType = (mimeType: string): boolean =>
  ALLOWED_UPLOAD_MIME_TYPES.includes(mimeType as (typeof ALLOWED_UPLOAD_MIME_TYPES)[number]);

const normalizeErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return 'Document processing failed.';
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

  const storagePath = typeof documentData.storagePath === 'string' ? documentData.storagePath : '';
  if (!storagePath) {
    return NextResponse.json({ error: 'Document storage path is missing.' }, { status: 400 });
  }

  const fileHandle = adminStorage.bucket().file(storagePath);

  try {
    const [metadata] = await fileHandle.getMetadata();
    const mimeTypeFromStorage = metadata.contentType ?? '';
    const mimeTypeFromDocument = typeof documentData.mimeType === 'string' ? documentData.mimeType : '';
    const mimeType = mimeTypeFromStorage || mimeTypeFromDocument;

    if (!mimeType || !isAllowedMimeType(mimeType)) {
      throw new Error('Unsupported file type. Allowed types: PDF, JPG, PNG, GIF, WEBP.');
    }

    const fileSize = metadata.size ? Number(metadata.size) : Number.NaN;
    if (!Number.isFinite(fileSize) || fileSize <= 0) {
      throw new Error('Could not determine document size for processing.');
    }
    if (fileSize > MAX_UPLOAD_BYTES) {
      throw new Error(`File exceeds ${MAX_UPLOAD_BYTES / (1024 * 1024)}MB processing limit.`);
    }

    const [fileBuffer] = await fileHandle.download();
    const dataUrl = `data:${mimeType};base64,${fileBuffer.toString('base64')}`;

    const [metadataResult, textResult] = await Promise.all([
      extractDocumentMetadata({ documentDataUrl: dataUrl }),
      extractTextFromImage({ documentDataUrl: dataUrl }),
    ]);

    const textContent = textResult.text ?? '';
    const keywordResult = textContent
      ? await enhanceSearchWithKeywords({ documentText: textContent })
      : { keywords: [] };

    await docRef.set(
      {
        owner: metadataResult.owner,
        category: metadataResult.category,
        expiry: metadataResult.expiry,
        tags: metadataResult.tags,
        keywords: keywordResult.keywords ?? [],
        summary: metadataResult.summary,
        textContent,
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
        summary: `Error: ${message}`,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
