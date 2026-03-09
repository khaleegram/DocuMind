
import type { Document } from '@/lib/types';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { FileText, Calendar, Tag, MoreVertical, Link as LinkIcon, Trash2, Loader2, MessageSquare, FileImage, FileType, ChevronDown, Folder } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { format, isValid, parseISO } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function DocumentCard({ document, onDelete }: { document: Document, onDelete: (docId: string) => void }) {
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const router = useRouter();

  const renderFilePreview = () => {
    if (document.mimeType?.startsWith('image/') && document.fileUrl) {
      return (
         <Image 
            src={document.fileUrl}
            alt={`Preview of ${document.fileName}`}
            fill
            className="object-cover" 
            data-ai-hint="document image"
        />
      );
    }
    if (document.mimeType === 'application/pdf') {
      return <FileType className="h-20 w-20 text-zinc-600" />;
    }
    return <FileImage className="h-20 w-20 text-zinc-600" />;
  };


  if (document.isProcessing) {
    return (
      <div className="flex flex-col overflow-hidden rounded-[2rem] bg-[#0C0C0E] border border-white/5 p-1 h-full">
          <div className="relative aspect-[4/3] bg-[#111113] flex items-center justify-center rounded-3xl">
            <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
          </div>
        <div className="flex-1 p-5 space-y-4">
          <Skeleton className="h-5 w-3/4 rounded-lg bg-white/10" />
          <Skeleton className="h-4 w-1/2 rounded-lg bg-white/5" />
          <Skeleton className="h-4 w-1/3 rounded-lg bg-white/5" />
        </div>
        <div className="flex justify-between items-center p-5 pt-0">
           <Skeleton className="h-9 w-20 rounded-xl bg-white/5" />
           <Skeleton className="h-9 w-9 rounded-xl bg-white/5" />
        </div>
      </div>
    )
  }

  const handleCardClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button, a, [role="menuitem"], [data-collapsible-trigger]')) {
      return;
    }
    router.push(`/dashboard/document/${document.id}`);
  };
  
  const tagsToShow = document.tags?.slice(0, 3) || [];
  const parsedExpiry = document.expiry ? parseISO(document.expiry) : null;
  const shouldShowExpiry = Boolean(parsedExpiry && isValid(parsedExpiry));

  return (
    <div 
      onClick={handleCardClick}
      className="flex flex-col overflow-hidden rounded-[2rem] bg-[#0C0C0E] border border-white/5 transition-all duration-300 hover:border-white/10 hover:shadow-2xl hover:-translate-y-1 cursor-pointer group p-1 h-full"
    >
      <div className="relative aspect-[4/3] bg-[#111113] flex items-center justify-center rounded-3xl overflow-hidden">
          {renderFilePreview()}
      </div>
      <div className="flex-1 p-5">
        <h3 className="mb-2 text-lg font-black tracking-tight text-white truncate">{document.owner}</h3>
        <div className="space-y-2 text-sm text-zinc-500 min-h-[2.5rem]">
          <div className="flex items-center gap-2">
            <Folder className="h-4 w-4 shrink-0" />
            <span className="truncate">{document.category}</span>
          </div>
          {shouldShowExpiry && parsedExpiry && (
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 shrink-0" />
              <span>Expires: {format(parsedExpiry, 'MMM dd, yyyy')}</span>
            </div>
          )}
        </div>
        
        <Collapsible open={isSummaryOpen} onOpenChange={setIsSummaryOpen} className="mt-4 text-sm">
            {(document.summary || tagsToShow.length > 0) && (
              <CollapsibleTrigger asChild>
                  <Button variant="link" className="p-0 h-auto text-xs text-blue-500 hover:text-blue-400" data-collapsible-trigger>
                      {isSummaryOpen ? 'Show Less' : 'Show More'}
                      <ChevronDown className={`ml-1 h-3 w-3 transition-transform ${isSummaryOpen ? 'rotate-180' : ''}`} />
                  </Button>
              </CollapsibleTrigger>
            )}
            <CollapsibleContent className="space-y-4 pt-2">
                 {document.summary && <p className="text-zinc-400 text-xs leading-relaxed">{document.summary}</p>}
                 {tagsToShow.length > 0 && (
                     <div className="flex flex-wrap gap-2">
                         {tagsToShow.map((tag, index) => (
                             <Badge key={`${tag}-${index}`} variant="secondary" className="bg-white/5 border border-transparent text-zinc-400">{tag}</Badge>
                         ))}
                     </div>
                 )}
            </CollapsibleContent>
        </Collapsible>
      </div>

      <div className="flex justify-between items-center p-5 pt-0 mt-auto">
        <Button asChild size="sm" variant="outline" className="bg-white/5 border-white/10 hover:bg-white/10 rounded-lg text-zinc-300 hover:text-white">
          <Link href={`/dashboard/document/${document.id}`} onClick={(e) => e.stopPropagation()}>
            <MessageSquare className="mr-2 h-4 w-4" />
            Chat
          </Link>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-500 hover:text-white hover:bg-white/5 rounded-lg">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-[#111113] border-white/10 text-zinc-300">
             <DropdownMenuItem onClick={(e) => { e.stopPropagation(); window.open(document.fileUrl, '_blank'); }} className="focus:bg-white/5 focus:text-white">
              <LinkIcon className="mr-2 h-4 w-4" />
              View Original
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDelete(document.id) }} className="text-red-500 focus:bg-red-500/10 focus:text-red-400">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
