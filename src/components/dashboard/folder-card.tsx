
import type { Folder } from '@/lib/types';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Folder as FolderIcon, FileText, Calendar } from 'lucide-react';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';

type FolderCardProps = {
    folder: Folder;
    documentCount: number;
};

export function FolderCard({ folder, documentCount }: FolderCardProps) {
  return (
    <Card className="flex flex-col overflow-hidden rounded-lg shadow-md transition-shadow hover:shadow-xl">
        <CardHeader>
            <div className="flex items-center gap-4">
                <FolderIcon className="w-10 h-10 text-primary" />
                <div className='flex-1'>
                    <CardTitle className="truncate">{folder.name}</CardTitle>
                    <CardDescription>{documentCount} document{documentCount !== 1 ? 's' : ''}</CardDescription>
                </div>
            </div>
        </CardHeader>
      <CardContent className='flex-1' />
      <CardFooter className="flex justify-between items-center bg-muted/50 p-3">
        <div className="flex items-center text-xs text-muted-foreground">
            <Calendar className="mr-1.5 h-3 w-3" />
            Created {format(parseISO(folder.createdAt), 'MMM dd, yyyy')}
        </div>
        <Button asChild size="sm" variant="outline">
          <Link href={`/dashboard/folders/${folder.id}`}>
            View Folder
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
