export type Document = {
  id: string;
  userId: string;
  owner: string;
  company: string | null;
  type: string;
  expiry: string | null;
  country: string | null;
  keywords: string[];
  uploadedAt: string;
  fileUrl: string;
  fileName: string;
  isProcessing?: boolean;
  summary?: string;
  textContent: string;
  mimeType: string;
  thumbnailUrl: string | null;
  driveFileId: string;
  folderId?: string; // Link to the folder
};

export type Folder = {
    id: string;
    userId: string;
    name: string; // The person or organization name
    driveFolderId: string;
    createdAt: string;
}
