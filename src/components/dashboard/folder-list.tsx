
import type { Folder, Document } from '@/lib/types';
import { FolderCard } from '@/components/dashboard/folder-card';
import { FolderEmptyState } from '@/components/dashboard/folder-empty-state';

type FolderListProps = {
  folders: Folder[];
  documents: Document[];
};

export default function FolderList({ folders, documents }: FolderListProps) {
  if (folders.length === 0) {
    return <FolderEmptyState />;
  }

  const getDocumentCount = (folderId: string) => {
    return documents.filter(doc => doc.folderId === folderId).length;
  };

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {folders.map((folder) => (
        <FolderCard key={folder.id} folder={folder} documentCount={getDocumentCount(folder.id)} />
      ))}
    </div>
  );
}
