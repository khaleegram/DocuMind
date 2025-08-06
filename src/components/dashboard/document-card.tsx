import type { Document } from '@/lib/types';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { FileText, Calendar, Building, MoreVertical, Link as LinkIcon, Trash2, Loader2, MessageSquare, FileImage, FileType, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { format, parseISO } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function DocumentCard({ document, onDelete }: { document: Document, onDelete: (docId: string) => void }) {
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const router = useRouter();

  const renderFilePreview = () => {
    if (document.mimeType?.startsWith('image/') && document.thumbnailUrl) {
      return (
         <Image 
            src={document.thumbnailUrl} 
            alt={`Preview of ${document.fileName}`}
            width={200}
            height={150}
            className="object-cover w-full h-full" 
            data-ai-hint="document image"
        />
      );
    }
    if (document.mimeType === 'application/pdf') {
      return <FileType className="h-20 w-20 text-muted-foreground" />;
    }
    return <FileImage className="h-20 w-20 text-muted-foreground" />;
  };


  if (document.isProcessing) {
    return (
      <Card className="flex flex-col overflow-hidden rounded-lg shadow-md">
        <CardHeader className="p-0">
          <div className="aspect-[4/3] bg-muted flex items-center justify-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
          </div>
        </CardHeader>
        <CardContent className="flex-1 p-4 space-y-3">
          <Skeleton className="h-5 w-3/4 rounded" />
          <Skeleton className="h-4 w-1/2 rounded" />
          <Skeleton className="h-4 w-1/3 rounded" />
          <div className="flex flex-wrap gap-2 pt-2">
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
        </CardContent>
        <CardFooter className="flex justify-between items-center bg-muted/50 p-3">
           <Skeleton className="h-8 w-20 rounded-md" />
           <Skeleton className="h-8 w-8 rounded-md" />
        </CardFooter>
      </Card>
    )
  }

  const handleCardClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button, a, [role="menuitem"], [data-collapsible-trigger]')) {
      return;
    }
    router.push(`/dashboard/document/${document.id}`);
  };

  return (
    <Card 
      onClick={handleCardClick}
      className="flex flex-col overflow-hidden rounded-lg shadow-md transition-shadow hover:shadow-xl cursor-pointer"
    >
      <CardHeader className="p-0">
        <div className="aspect-[4/3] bg-muted flex items-center justify-center overflow-hidden">
          {renderFilePreview()}
        </div>
      </CardHeader>
      <CardContent className="flex-1 p-4">
        <CardTitle className="mb-2 text-lg font-semibold leading-tight truncate">{document.owner}</CardTitle>
        <div className="space-y-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 shrink-0" />
            <span>{document.type}</span>
          </div>
          {document.company && (
            <div className="flex items-center gap-2">
              <Building className="h-4 w-4 shrink-0" />
              <span>{document.company}</span>
            </div>
          )}
          {document.expiry && (
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 shrink-0" />
              <span>Expires: {format(parseISO(document.expiry), 'MMM dd, yyyy')}</span>
            </div>
          )}
        </div>
        {document.summary && (
            <Collapsible open={isSummaryOpen} onOpenChange={setIsSummaryOpen} className="mt-4 text-sm">
                <CollapsibleContent className="space-y-2">
                     <p className="text-muted-foreground">{document.summary}</p>
                </CollapsibleContent>
                <CollapsibleTrigger asChild>
                    <Button variant="link" className="p-0 h-auto text-xs text-accent" data-collapsible-trigger>
                        {isSummaryOpen ? 'Read Less' : 'Read More'}
                        <ChevronDown className={`ml-1 h-3 w-3 transition-transform ${isSummaryOpen ? 'rotate-180' : ''}`} />
                    </Button>
                </CollapsibleTrigger>
            </Collapsible>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          {document.keywords.map((keyword) => (
            <Badge key={keyword} variant="secondary">{keyword}</Badge>
          ))}
        </div>
      </CardContent>
      <CardFooter className="flex justify-between items-center bg-muted/50 p-3">
        <Button asChild size="sm" variant="outline" className="text-accent-foreground bg-accent hover:bg-accent/90 border-0">
          <Link href={document.fileUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
            <LinkIcon className="mr-2 h-4 w-4" />
            View
          </Link>
        </Button>
         <Button asChild size="sm" variant="outline" >
          <Link href={`/dashboard/document/${document.id}`} onClick={(e) => e.stopPropagation()}>
            <MessageSquare className="mr-2 h-4 w-4" />
            Chat
          </Link>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onDelete(document.id)} className="text-destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardFooter>
    </Card>
  );
}
