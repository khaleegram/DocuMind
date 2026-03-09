import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUserFromBearerToken } from '@/lib/api-auth';
import { adminDb } from '@/lib/firebase-admin';
import { generateSuggestedQuestions } from '@/ai/flows/generate-suggested-questions';

export const runtime = 'nodejs';

const SuggestionsRequestSchema = z.object({
  documentId: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const authResult = await requireUserFromBearerToken(request.headers.get('authorization'));
  if ('errorResponse' in authResult) return authResult.errorResponse;

  let parsedBody: z.infer<typeof SuggestionsRequestSchema>;
  try {
    parsedBody = SuggestionsRequestSchema.parse(await request.json());
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
    return NextResponse.json({ questions: [] });
  }

  const documentText = typeof docData.textContent === 'string' ? docData.textContent : '';
  if (!documentText.trim()) {
    return NextResponse.json({ questions: [] });
  }

  try {
    const { questions } = await generateSuggestedQuestions({ documentText });
    return NextResponse.json({ questions });
  } catch {
    return NextResponse.json({ error: 'Could not generate suggestions.' }, { status: 500 });
  }
}
