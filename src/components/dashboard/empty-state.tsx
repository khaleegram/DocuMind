import { FolderArchive } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 bg-card p-12 text-center h-[400px]">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
        <FolderArchive className="h-10 w-10 text-muted-foreground" />
      </div>
      <h3 className="mt-4 text-xl font-semibold">No documents found</h3>
      <p className="mt-2 text-sm text-muted-foreground">
        Try adjusting your search or upload a new document to get started.
      </p>
    </div>
  );
}
