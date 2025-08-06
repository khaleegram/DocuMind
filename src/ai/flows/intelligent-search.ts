'use server';

/**
 * @fileOverview A Genkit flow for performing an intelligent, natural language search for documents.
 *
 * - intelligentSearch - A function that takes a natural language query and returns structured search criteria.
 * - IntelligentSearchInput - The input type for the intelligentSearch function.
 * - IntelligentSearchOutput - The output type for the intelligentSearch function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const IntelligentSearchInputSchema = z.object({
  query: z.string().describe('The user\'s natural language search query.'),
});
export type IntelligentSearchInput = z.infer<typeof IntelligentSearchInputSchema>;

const IntelligentSearchOutputSchema = z.object({
  owner: z.string().nullable().describe('The identified owner (person or company) to filter by, if any.'),
  documentType: z.string().nullable().describe('The identified document type to filter by, if any.'),
  country: z.string().nullable().describe('The identified country to filter by, if any.'),
  keywords: z.array(z.string()).describe('A list of general keywords from the query to search for in the document content.'),
});
export type IntelligentSearchOutput = z.infer<typeof IntelligentSearchOutputSchema>;

export async function intelligentSearch(input: IntelligentSearchInput): Promise<IntelligentSearchOutput> {
  return intelligentSearchFlow(input);
}

const prompt = ai.definePrompt({
  name: 'intelligentSearchPrompt',
  input: { schema: IntelligentSearchInputSchema },
  output: { schema: IntelligentSearchOutputSchema },
  prompt: `You are an AI assistant that helps users find documents by converting their natural language query into structured search criteria.

Analyze the user's query and extract the following entities:
- The primary owner of the document (this could be a person's name or a company name).
- The type of document (e.g., "Passport", "Receipt", "Contract").
- The country associated with the document.
- Any remaining words in the query that should be treated as general search keywords.

Return the extracted information in the specified JSON format. If a specific entity is not found in the query, return null for that field.

User Query:
"{{{query}}}"
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
