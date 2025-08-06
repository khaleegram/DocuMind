import type { Document } from '@/lib/types';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { FileText, Calendar, User, Building, MoreVertical, Link as LinkIcon, Trash2 } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { format, parseISO } from 'date-fns';

export function DocumentCard({ document, onDelete }: { document: Document, onDelete: (id: string) => void }) {
  const getAiHint = (type: string) => {
    switch (type.toLowerCase()) {
      case 'passport':
        return 'passport document';
      case 'contract':
        return 'contract paper';
      case 'receipt':
        return 'bill receipt';
      case 'visa':
        return 'visa stamp';
      default:
        return 'document paper';
    }
  }

  return (
    <Card className="flex flex-col overflow-hidden rounded-lg shadow-md transition-shadow hover:shadow-xl">
      <CardHeader className="p-0">
        <div className="aspect-w-4 aspect-h-3">
          <Image 
            src={document.fileUrl} 
            alt={document.type} 
            width={400} 
            height={300} 
            className="object-cover" 
            data-ai-hint={getAiHint(document.type)}
          />
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
        <div className="mt-4 flex flex-wrap gap-2">
          {document.keywords.slice(0, 3).map((keyword) => (
            <Badge key={keyword} variant="secondary">{keyword}</Badge>
          ))}
        </div>
      </CardContent>
      <CardFooter className="flex justify-between items-center bg-muted/50 p-3">
        <Button asChild size="sm" variant="outline" className="text-accent-foreground bg-accent hover:bg-accent/90 border-0">
          <Link href={document.fileUrl} target="_blank" rel="noopener noreferrer">
            <LinkIcon className="mr-2 h-4 w-4" />
            View
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
