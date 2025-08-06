import type { Document } from '@/lib/types';
import { DocumentCard } from '@/components/dashboard/document-card';
import { EmptyState } from '@/components/dashboard/empty-state';

type DocumentListProps = {
  documents: Document[];
  onDelete: (doc: Document) => void;
};

export default function DocumentList({ documents, onDelete }: DocumentListProps) {
  if (documents.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {documents.map((doc) => (
        <DocumentCard key={doc.id} document={doc} onDelete={onDelete} />
      ))}
    </div>
  );
}
