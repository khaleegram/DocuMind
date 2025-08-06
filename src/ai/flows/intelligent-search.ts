'use server';

/**
 * @fileOverview A Genkit flow for performing an intelligent, natural language search for documents.
 *
 * - intelligentSearch - A function that takes a natural language query and a list of documents and returns the IDs of the most relevant documents.
 * - IntelligentSearchInput - The input type for the intelligentSearch function.
 * - IntelligentSearchOutput - The output type for the intelligentSearch function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// Simplified Document schema for passing to the AI
const DocumentSearchSchema = z.object({
  id: z.string(),
  owner: z.string(),
  type: z.string(),
  company: z.string().nullable(),
  country: z.string().nullable(),
  summary: z.string().nullable(),
  keywords: z.array(z.string()),
});

const IntelligentSearchInputSchema = z.object({
  query: z.string().describe("The user's natural language search query."),
  documents: z.array(DocumentSearchSchema).describe('The list of all documents to search through.'),
});
export type IntelligentSearchInput = z.infer<typeof IntelligentSearchInputSchema>;

const IntelligentSearchOutputSchema = z.object({
  documentIds: z.array(z.string()).describe('An array of document IDs that are the most relevant matches for the query.'),
});
export type IntelligentSearchOutput = z.infer<typeof IntelligentSearchOutputSchema>;

export async function intelligentSearch(input: IntelligentSearchInput): Promise<IntelligentSearchOutput> {
  // If the document list is empty, return no results immediately.
  if (input.documents.length === 0) {
    return { documentIds: [] };
  }
  return intelligentSearchFlow(input);
}

const prompt = ai.definePrompt({
  name: 'intelligentSearchPrompt',
  input: { schema: IntelligentSearchInputSchema },
  output: { schema: IntelligentSearchOutputSchema },
  prompt: `You are an intelligent search engine for a user's personal documents.
Your task is to analyze the user's search query and the provided list of documents.
You must identify the most relevant documents that match the user's query.

Consider all fields for each document: owner, type, company, country, summary, and keywords.
The match does not have to be exact. Use contextual understanding. For example, a query for "John's driver license" should match a document with owner "John Doe" and type "Drivers License". A query for "Acme Corp invoice" should match a document for company "Acme Corporation" and type "Receipt".

Return an array containing the 'id' of each matching document. If no documents are a good match, return an empty array.

User Query:
"{{{query}}}"

List of Documents (JSON):
\`\`\`json
{{{json documents}}}
\`\`\`
`,
});

const intelligentSearchFlow = ai.defineFlow(
  {
    name: 'intelligentSearchFlow',
    inputSchema: IntelligentSearchInputSchema,
    outputSchema: IntelligentSearchOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
