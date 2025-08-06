'use server';

/**
 * @fileOverview A Genkit flow for generating suggested questions about a document.
 *
 * - generateSuggestedQuestions - A function that takes document text and returns a list of questions.
 * - GenerateSuggestedQuestionsInput - The input type for the generateSuggestedQuestions function.
 * - GenerateSuggestedQuestionsOutput - The output type for the generateSuggestedQuestions function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateSuggestedQuestionsInputSchema = z.object({
  documentText: z.string().describe('The full text content of the document.'),
});
export type GenerateSuggestedQuestionsInput = z.infer<typeof GenerateSuggestedQuestionsInputSchema>;

const GenerateSuggestedQuestionsOutputSchema = z.object({
  questions: z.array(z.string()).describe('A list of 3 suggested questions a user might ask about the document.'),
});
export type GenerateSuggestedQuestionsOutput = z.infer<typeof GenerateSuggestedQuestionsOutputSchema>;

export async function generateSuggestedQuestions(input: GenerateSuggestedQuestionsInput): Promise<GenerateSuggestedQuestionsOutput> {
  return generateSuggestedQuestionsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateSuggestedQuestionsPrompt',
  input: {schema: GenerateSuggestedQuestionsInputSchema},
  output: {schema: GenerateSuggestedQuestionsOutputSchema},
  prompt: `You are an AI assistant designed to help users understand their documents.
  Based on the following document text, please generate exactly three concise and relevant questions that a user might want to ask.
  The questions should be distinct and cover key aspects of the document.

  Document Text:
  ---
  {{{documentText}}}
  ---
  
  Generate three suggested questions.`,
});

const generateSuggestedQuestionsFlow = ai.defineFlow(
  {
    name: 'generateSuggestedQuestionsFlow',
    inputSchema: GenerateSuggestedQuestionsInputSchema,
    outputSchema: GenerateSuggestedQuestionsOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
