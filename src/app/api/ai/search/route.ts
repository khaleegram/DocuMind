import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUserFromBearerToken } from '@/lib/api-auth';
import { intelligentSearch } from '@/ai/flows/intelligent-search';
import { AI_SEARCH_MAX_DOCUMENTS } from '@/lib/constants';

export const runtime = 'nodejs';

const SearchDocumentSchema = z.object({
  id: z.string().min(1),
  owner: z.string().default(''),
  category: z.string().default(''),
  tags: z.array(z.string()).default([]),
  summary: z.string().nullable().default(null),
  keywords: z.array(z.string()).default([]),
});

const SearchRequestSchema = z.object({
  query: z.string().min(1).max(300),
  documents: z.array(SearchDocumentSchema).max(AI_SEARCH_MAX_DOCUMENTS),
});

export async function POST(request: NextRequest) {
  const authResult = await requireUserFromBearerToken(request.headers.get('authorization'));
  if ('errorResponse' in authResult) return authResult.errorResponse;

  let parsedBody: z.infer<typeof SearchRequestSchema>;
  try {
    parsedBody = SearchRequestSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: 'Invalid request payload.' }, { status: 400 });
  }

  try {
    const result = await intelligentSearch(parsedBody);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: 'AI search failed.' }, { status: 500 });
  }
}
