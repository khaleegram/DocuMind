import { FolderArchive, SearchX } from 'lucide-react';
import { Button } from '@/components/ui/button';

type EmptyStateProps = {
  isFiltered?: boolean;
  onClear?: () => void;
};

export function EmptyState({ isFiltered = false, onClear }: EmptyStateProps) {
  const Icon = isFiltered ? SearchX : FolderArchive;
  const title = isFiltered ? "No Matching Documents" : "Your Vault is Empty";
  const description = isFiltered 
    ? "Try adjusting your search query or clearing the active filters." 
    : "Upload your first document to begin building your intelligent library.";

  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-white/10 bg-[#0C0C0E] p-12 text-center h-[400px] mt-8">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/5 text-zinc-500">
        <Icon className="h-10 w-10" />
      </div>
      <h3 className="mt-6 text-xl font-bold text-white">{title}</h3>
      <p className="mt-2 text-sm text-zinc-400 max-w-sm">
        {description}
      </p>
       {isFiltered && onClear && (
        <Button onClick={onClear} variant="outline" className="mt-6 bg-white/5 border-white/10 hover:bg-white/10 text-zinc-300 hover:text-white">
          Clear Search & Filters
        </Button>
      )}
    </div>
  );
}
