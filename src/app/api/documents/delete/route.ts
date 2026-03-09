import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUserFromBearerToken } from '@/lib/api-auth';
import { adminDb, adminStorage } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

const DeleteDocumentSchema = z.object({
  docId: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const authResult = await requireUserFromBearerToken(request.headers.get('authorization'));
  if ('errorResponse' in authResult) return authResult.errorResponse;

  let parsedBody: z.infer<typeof DeleteDocumentSchema>;
  try {
    parsedBody = DeleteDocumentSchema.parse(await request.json());
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

  const storagePath = typeof docData.storagePath === 'string' ? docData.storagePath : '';

  try {
    if (storagePath) {
      await adminStorage.bucket().file(storagePath).delete({ ignoreNotFound: true });
    }

    await docRef.delete();
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to delete document.',
      },
      { status: 500 }
    );
  }
}
