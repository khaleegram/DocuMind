'use server';

/**
 * @fileOverview A Genkit flow for answering questions about a document.
 *
 * - chatWithDocument - A function that takes document text and a question and returns an answer.
 * - ChatWithDocumentInput - The input type for the chatWithDocument function.
 * - ChatWithDocumentOutput - The output type for the chatWithDocument function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ChatWithDocumentInputSchema = z.object({
  documentText: z.string().describe('The full text content of the document.'),
  question: z.string().describe('The user\'s question about the document.'),
});
export type ChatWithDocumentInput = z.infer<typeof ChatWithDocumentInputSchema>;

const ChatWithDocumentOutputSchema = z.object({
  answer: z.string().describe('The AI-generated answer to the user\'s question.'),
});
export type ChatWithDocumentOutput = z.infer<typeof ChatWithDocumentOutputSchema>;

export async function chatWithDocument(input: ChatWithDocumentInput): Promise<ChatWithDocumentOutput> {
  return chatWithDocumentFlow(input);
}

const prompt = ai.definePrompt({
  name: 'chatWithDocumentPrompt',
  input: {schema: ChatWithDocumentInputSchema},
  output: {schema: ChatWithDocumentOutputSchema},
  prompt: `You are a helpful AI assistant designed to answer questions about a specific document.
  The user will provide you with the full text of a document and a question.
  Your task is to answer the user's question based *only* on the information contained within the provided document text.

  Do not use any external knowledge. If the answer cannot be found in the document, state that clearly.

  Document Text:
  ---
  {{{documentText}}}
  ---

  User's Question:
  "{{{question}}}"

  Answer:`,
});

const chatWithDocumentFlow = ai.defineFlow(
  {
    name: 'chatWithDocumentFlow',
    inputSchema: ChatWithDocumentInputSchema,
    outputSchema: ChatWithDocumentOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
