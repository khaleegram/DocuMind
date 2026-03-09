import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUserFromBearerToken } from '@/lib/api-auth';
import { adminDb } from '@/lib/firebase-admin';
import { chatWithDocument } from '@/ai/flows/chat-with-document';

export const runtime = 'nodejs';

const ChatRequestSchema = z.object({
  documentId: z.string().min(1),
  question: z.string().min(1).max(500),
});

export async function POST(request: NextRequest) {
  const authResult = await requireUserFromBearerToken(request.headers.get('authorization'));
  if ('errorResponse' in authResult) return authResult.errorResponse;

  let parsedBody: z.infer<typeof ChatRequestSchema>;
  try {
    parsedBody = ChatRequestSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: 'Invalid request payload.' }, { status: 400 });
  }

  const docSnapshot = await adminDb.collection('documents').doc(parsedBody.documentId).get();
  if (!docSnapshot.exists) {
    return NextResponse.json({ error: 'Document not found.' }, { status: 404 });
  }

  const docData = docSnapshot.data() as Record<string, unknown>;
  if (docData.userId !== authResult.uid) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  if (docData.isProcessing === true) {
    return NextResponse.json({ error: 'Document processing is still in progress.' }, { status: 409 });
  }

  const documentText = typeof docData.textContent === 'string' ? docData.textContent : '';
  if (!documentText.trim()) {
    return NextResponse.json({ error: 'Document has no extracted text.' }, { status: 422 });
  }

  try {
    const { answer } = await chatWithDocument({
      documentText,
      question: parsedBody.question,
    });
    return NextResponse.json({ answer });
  } catch {
    return NextResponse.json({ error: 'Could not generate response.' }, { status: 500 });
  }
}
