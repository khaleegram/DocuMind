import { auth } from '@/lib/firebase';

type DownloadDocumentParams = {
  docId: string;
  sourceIndex?: number;
  fallbackFileName: string;
};

const parseFileNameFromDisposition = (contentDisposition: string | null): string | null => {
  if (!contentDisposition) return null;

  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]);
  }

  const quotedMatch = contentDisposition.match(/filename=\"([^\"]+)\"/i);
  if (quotedMatch?.[1]) {
    return quotedMatch[1];
  }

  const plainMatch = contentDisposition.match(/filename=([^;]+)/i);
  if (plainMatch?.[1]) {
    return plainMatch[1].trim();
  }

  return null;
};

export const downloadDocumentFile = async ({
  docId,
  sourceIndex = 0,
  fallbackFileName,
}: DownloadDocumentParams): Promise<void> => {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('You must be signed in to download files.');
  }

  const idToken = await user.getIdToken();
  const response = await fetch('/api/documents/download', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ docId, sourceIndex }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error || 'Download failed.');
  }

  const blob = await response.blob();
  const fileName =
    parseFileNameFromDisposition(response.headers.get('content-disposition')) || fallbackFileName;

  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
};
