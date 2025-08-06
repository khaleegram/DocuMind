'use server';

/**
 * @fileOverview This file defines a Genkit flow for extracting document metadata using AI.
 *
 * - extractDocumentMetadata - A function that extracts metadata from a document.
 * - ExtractDocumentMetadataInput - The input type for the extractDocumentMetadata function.
 * - ExtractDocumentMetadataOutput - The output type for the extractDocumentMetadata function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ExtractDocumentMetadataInputSchema = z.object({
  documentText: z
    .string()
    .describe('The text extracted from the document using OCR or a data URI of an image.'),
});
export type ExtractDocumentMetadataInput = z.infer<
  typeof ExtractDocumentMetadataInputSchema
>;

const ExtractDocumentMetadataOutputSchema = z.object({
  owner: z.string().describe('The owner of the document (person/company).'),
  documentType: z.string().describe('The type of document (passport, visa, contract, receipt, etc.).'),
  expiryDate: z.string().nullable().describe('The expiry date of the document (YYYY-MM-DD), or null if not applicable.'),
  keywords: z.array(z.string()).describe('Keywords for searching the document.'),
});
export type ExtractDocumentMetadataOutput = z.infer<
  typeof ExtractDocumentMetadataOutputSchema
>;

export async function extractDocumentMetadata(
  input: ExtractDocumentMetadataInput
): Promise<ExtractDocumentMetadataOutput> {
  return extractDocumentMetadataFlow(input);
}

const prompt = ai.definePrompt({
  name: 'extractDocumentMetadataPrompt',
  input: {schema: ExtractDocumentMetadataInputSchema},
  output: {schema: ExtractDocumentMetadataOutputSchema},
  prompt: `You are an AI assistant that extracts metadata from documents.

  The user has provided either text extracted from a document, or a data URI for an image of the document.
  Your task is to extract the owner, document type, expiry date, and keywords.

  If the input is an image data URI, analyze the image content.
  If the input is text, analyze the text content.

  Data: {{{documentText}}}

  Output the data in JSON format.
  If an expiry date can't be found, set it to null.
  Keywords should be relevant to the content of the document.
  If the input is an image, use the image to derive the response.
  `,
});


const extractDocumentMetadataFlow = ai.defineFlow(
  {
    name: 'extractDocumentMetadataFlow',
    inputSchema: ExtractDocumentMetadataInputSchema,
    outputSchema: ExtractDocumentMetadataOutputSchema,
  },
  async input => {
    
    const requestPayload = input.documentText.startsWith('data:image')
    ? { media: { url: input.documentText } }
    : { text: input.documentText };

    const {output} = await prompt(input);
    return output!;
  }
);
