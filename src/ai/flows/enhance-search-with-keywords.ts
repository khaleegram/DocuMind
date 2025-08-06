'use server';
/**
 * @fileOverview This file defines a Genkit flow to enhance search results by identifying relevant keywords within a document's text content.
 *
 * - enhanceSearchWithKeywords - A function that takes document text as input and returns a list of keywords.
 * - EnhanceSearchWithKeywordsInput - The input type for the enhanceSearchWithKeywords function.
 * - EnhanceSearchWithKeywordsOutput - The return type for the enhanceSearchWithKeywords function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const EnhanceSearchWithKeywordsInputSchema = z.object({
  documentText: z.string().describe('The text content of the document.'),
});
export type EnhanceSearchWithKeywordsInput = z.infer<typeof EnhanceSearchWithKeywordsInputSchema>;

const EnhanceSearchWithKeywordsOutputSchema = z.object({
  keywords: z.array(z.string()).describe('A list of relevant keywords extracted from the document text.'),
});
export type EnhanceSearchWithKeywordsOutput = z.infer<typeof EnhanceSearchWithKeywordsOutputSchema>;

export async function enhanceSearchWithKeywords(input: EnhanceSearchWithKeywordsInput): Promise<EnhanceSearchWithKeywordsOutput> {
  return enhanceSearchWithKeywordsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'enhanceSearchWithKeywordsPrompt',
  input: {schema: EnhanceSearchWithKeywordsInputSchema},
  output: {schema: EnhanceSearchWithKeywordsOutputSchema},
  prompt: `You are an AI assistant designed to extract relevant keywords from document text for search optimization.

  Given the following document text, identify and return a list of keywords that would be helpful for users to find this document when searching.

  Document Text: {{{documentText}}}

  Keywords:`, // Removed the 