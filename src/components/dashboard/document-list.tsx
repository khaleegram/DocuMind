import type { Document } from '@/lib/types';
import { DocumentCard } from '@/components/dashboard/document-card';

type DocumentListProps = {
  documents: Document[];
  onDelete: (docId: string) => void;
  onRetryProcessing?: (docId: string) => void;
  retryingDocIds?: Set<string>;
};

export default function DocumentList({
  documents,
  onDelete,
  onRetryProcessing,
  retryingDocIds,
}: DocumentListProps) {

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {documents.map((doc) => (
        <DocumentCard
          key={doc.id}
          document={doc}
          onDelete={onDelete}
          onRetryProcessing={onRetryProcessing}
          isRetryingProcessing={Boolean(retryingDocIds?.has(doc.id))}
        />
      ))}
    </div>
  );
}
