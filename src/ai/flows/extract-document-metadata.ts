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
  documentDataUrl: z
    .string()
    .describe('A data URI of an image of the document.'),
});
export type ExtractDocumentMetadataInput = z.infer<
  typeof ExtractDocumentMetadataInputSchema
>;

const ExtractDocumentMetadataOutputSchema = z.object({
  owner: z.string().describe('The full name of the primary person on the document, formatted as "Firstname Lastname". If no person is present, use the primary company name, formatted in Title Case.'),
  company: z.string().nullable().describe('The name of the company or organization on the document, formatted in Title Case. Use null if not applicable.'),
  documentType: z.string().describe('The type of document (e.g., "Passport", "Drivers License", "Contract", "Receipt"), formatted in Title Case.'),
  expiryDate: z.string().nullable().describe('The expiration date of the document in YYYY-MM-DD format, or null if not found.'),
  country: z.string().nullable().describe('The country of origin of the document (e.g., "United States", "Canada", "France"), formatted in Title Case. If not found, use null.'),
  keywords: z.array(z.string()).describe('A list of 3-5 relevant keywords for search.'),
  summary: z.string().describe("A concise, one-to-two sentence summary of the document's content."),
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
  prompt: `You are an AI assistant specialized in extracting and normalizing key information from document images.
  Analyze the following document image and extract the required metadata.

  **CRITICAL NORMALIZATION RULES:**
  - **Owner Field:** Identify the primary person's full name. You MUST reformat it to "Firstname Lastname" order and apply Title Case. For example, if the document says "DOE, JOHN" or "john doe", you must return "John Doe". If no person is clearly identified, use the primary company name as the owner, formatted in Title Case.
  - **Other Text Fields:** For 'company', 'documentType', and 'country', you MUST format them in Title Case (e.g., "Innovate Inc.", "Drivers License", "United States"). This ensures consistency.
  - **Dates:** Find the expiration date and format it as YYYY-MM-DD. If no expiry date is present, use null.
  - **Null Values:** If a field like 'company', 'country', or 'expiryDate' is not present on the document, you MUST return null. Do not guess or invent information.

  Image: {{media url=documentDataUrl}}

  Return the extracted and normalized data in the specified JSON format.
  `,
});


const extractDocumentMetadataFlow = ai.defineFlow(
  {
    name: 'extractDocumentMetadataFlow',
    inputSchema: ExtractDocumentMetadataInputSchema,
    outputSchema: ExtractDocumentMetadataOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
