
import { FolderSearch } from 'lucide-react';

export function FolderEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 bg-card p-12 text-center h-[400px]">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
        <FolderSearch className="h-10 w-10 text-muted-foreground" />
      </div>
      <h3 className="mt-4 text-xl font-semibold">No folders found</h3>
      <p className="mt-2 text-sm text-muted-foreground">
        Upload a document to automatically create a folder, or try a different search.
      </p>
    </div>
  );
}
