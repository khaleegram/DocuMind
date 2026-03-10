import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUserFromBearerToken } from '@/lib/api-auth';
import { adminDb, adminStorage } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

const DownloadDocumentSchema = z.object({
  docId: z.string().min(1),
  sourceIndex: z.number().int().min(0).optional(),
});

const StoredSourceFileSchema = z.object({
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  storagePath: z.string().min(1),
});

const normalizeSourceFiles = (docData: Record<string, unknown>) => {
  const parsed = z.array(StoredSourceFileSchema).safeParse(docData.sourceFiles);
  if (parsed.success && parsed.data.length > 0) {
    return parsed.data;
  }

  const fileName = typeof docData.fileName === 'string' ? docData.fileName : '';
  const mimeType = typeof docData.mimeType === 'string' ? docData.mimeType : '';
  const storagePath = typeof docData.storagePath === 'string' ? docData.storagePath : '';

  if (!fileName || !mimeType || !storagePath) {
    return [];
  }

  return [{ fileName, mimeType, storagePath }];
};

const sanitizeFileName = (fileName: string) =>
  fileName.replace(/[\\/:*?"<>|\r\n]/g, '_').trim() || 'document';

export async function POST(request: NextRequest) {
  const authResult = await requireUserFromBearerToken(request.headers.get('authorization'));
  if ('errorResponse' in authResult) return authResult.errorResponse;

  let parsedBody: z.infer<typeof DownloadDocumentSchema>;
  try {
    parsedBody = DownloadDocumentSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: 'Invalid request payload.' }, { status: 400 });
  }

  const docRef = adminDb.collection('documents').doc(parsedBody.docId);
  const docSnapshot = await docRef.get();
  if (!docSnapshot.exists) {
    return NextResponse.json({ error: 'Document not found.' }, { status: 404 });
  }

  const docData = docSnapshot.data() as Record<string, unknown>;
  if (docData.userId !== authResult.uid) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const sourceFiles = normalizeSourceFiles(docData);
  if (sourceFiles.length === 0) {
    return NextResponse.json({ error: 'No file is attached to this document.' }, { status: 400 });
  }

  const selectedIndex = parsedBody.sourceIndex ?? 0;
  const selectedFile = sourceFiles[selectedIndex];
  if (!selectedFile) {
    return NextResponse.json({ error: 'Requested file index is out of range.' }, { status: 400 });
  }

  try {
    const fileHandle = adminStorage.bucket().file(selectedFile.storagePath);
    const [metadata] = await fileHandle.getMetadata();
    const contentType = metadata.contentType || selectedFile.mimeType || 'application/octet-stream';
    const safeFileName = sanitizeFileName(selectedFile.fileName);
    const encodedFileName = encodeURIComponent(safeFileName);
    const [fileBuffer] = await fileHandle.download();

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${safeFileName}"; filename*=UTF-8''${encodedFileName}`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to download file.',
      },
      { status: 500 }
    );
  }
}
