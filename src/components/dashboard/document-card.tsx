
import type { Document } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  Calendar,
  Download,
  MoreVertical,
  Link as LinkIcon,
  Trash2,
  Loader2,
  MessageSquare,
  FileImage,
  ChevronDown,
  Folder,
  Files,
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { format, isValid, parseISO } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { downloadDocumentFile } from '@/lib/download-document';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { PdfPlaceholder, type DocumentPlaceholderKind } from '@/components/dashboard/pdf-placeholder';

const OFFICE_MIME_KIND_MAP: Record<string, DocumentPlaceholderKind> = {
  'application/pdf': 'pdf',
  'application/msword': 'docx',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'excel',
  'application/vnd.ms-powerpoint': 'powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'powerpoint',
};

const inferPlaceholderKind = (mimeType: string, fileName: string): DocumentPlaceholderKind | null => {
  const mapped = OFFICE_MIME_KIND_MAP[mimeType];
  if (mapped) return mapped;

  const normalizedFileName = fileName.toLowerCase();
  if (normalizedFileName.endsWith('.pdf')) return 'pdf';
  if (normalizedFileName.endsWith('.doc') || normalizedFileName.endsWith('.docx')) return 'docx';
  if (normalizedFileName.endsWith('.xls') || normalizedFileName.endsWith('.xlsx')) return 'excel';
  if (normalizedFileName.endsWith('.ppt') || normalizedFileName.endsWith('.pptx')) return 'powerpoint';
  return null;
};

export function DocumentCard({ document, onDelete }: { document: Document, onDelete: (docId: string) => void }) {
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const renderFilePreview = () => {
    const placeholderKind = inferPlaceholderKind(document.mimeType, document.fileName);
    if (placeholderKind) {
      return (
        <PdfPlaceholder
          kind={placeholderKind}
          pageCount={document.pageCount}
          selected={false}
          processing={document.isProcessing === true}
          pro={false}
          className="h-full w-full rounded-3xl"
        />
      );
    }

    if (document.thumbnailUrl) {
      return (
        <Image
          src={document.thumbnailUrl}
          alt={`Preview of ${document.fileName}`}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1200px) 50vw, 25vw"
          className="object-cover"
          data-ai-hint="document thumbnail"
        />
      );
    }

    if (document.mimeType?.startsWith('image/') && document.fileUrl) {
      return (
         <Image 
            src={document.fileUrl}
            alt={`Preview of ${document.fileName}`}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1200px) 50vw, 25vw"
            className="object-cover" 
            data-ai-hint="document image"
        />
      );
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
  const displayName = document.displayName || document.fileName;
  const primaryFileName = document.sourceFiles[0]?.fileName || document.fileName;

  const handleDownload = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (isDownloading) return;

    setIsDownloading(true);
    try {
      await downloadDocumentFile({
        docId: document.id,
        sourceIndex: 0,
        fallbackFileName: primaryFileName,
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'DOWNLOAD_FAILED',
        description: error instanceof Error ? error.message : 'Could not download this document.',
      });
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <>
    <div
      onClick={handleCardClick}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          router.push(`/dashboard/document/${document.id}`);
        }
      }}
      role="button"
      tabIndex={0}
      className="flex flex-col overflow-hidden rounded-[2rem] bg-[#0C0C0E] border border-white/5 transition-all duration-300 hover:border-white/10 hover:shadow-2xl hover:-translate-y-1 cursor-pointer group p-1 h-full"
      aria-label={`Open ${displayName}`}
    >
      <div className="relative aspect-[4/3] bg-[#111113] flex items-center justify-center rounded-3xl overflow-hidden">
          {renderFilePreview()}
      </div>
      <div className="flex-1 p-5">
        <h3 className="mb-2 text-lg font-black tracking-tight text-white truncate">{displayName}</h3>
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
          {document.fileCount > 1 && (
            <div className="flex items-center gap-2">
              <Files className="h-4 w-4 shrink-0" />
              <span>{document.fileCount} files grouped</span>
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
        <div className="flex items-center gap-2">
          <Button asChild size="sm" variant="outline" className="bg-white/5 border-white/10 hover:bg-white/10 rounded-lg text-zinc-300 hover:text-white">
            <Link href={`/dashboard/document/${document.id}`} onClick={(e) => e.stopPropagation()}>
              <MessageSquare className="mr-2 h-4 w-4" />
              Chat
            </Link>
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleDownload}
            disabled={isDownloading}
            className="bg-white/5 border-white/10 hover:bg-white/10 rounded-lg text-zinc-300 hover:text-white"
          >
            {isDownloading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Download
              </>
            )}
          </Button>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-zinc-500 hover:text-white hover:bg-white/5 rounded-lg"
              aria-label={`Open actions for ${displayName}`}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-[#111113] border-white/10 text-zinc-300">
             <DropdownMenuItem onClick={(e) => { e.stopPropagation(); window.open(document.fileUrl, '_blank'); }} className="focus:bg-white/5 focus:text-white">
              <LinkIcon className="mr-2 h-4 w-4" />
              View Original
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={e => {
                e.stopPropagation();
                setDeleteDialogOpen(true);
              }}
              className="text-red-500 focus:bg-red-500/10 focus:text-red-400"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
    <AlertDialog open={isDeleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
      <AlertDialogContent className="bg-[#0C0C0E] border-white/10 text-white">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete document?</AlertDialogTitle>
          <AlertDialogDescription className="text-zinc-400">
            This will permanently remove &quot;{displayName}&quot; from your vault.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => onDelete(document.id)}
            className="bg-red-600 hover:bg-red-500 text-white"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
