'use client';

import type { Document } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { format, parseISO, differenceInDays } from 'date-fns';
import { useRouter } from 'next/navigation';
import { FileText, User, AlertCircle, Calendar } from 'lucide-react';

type ExpiringSoonListProps = {
  documents: Document[];
};

const getUrgencyColor = (daysLeft: number) => {
    if (daysLeft < 15) return 'text-destructive';
    if (daysLeft < 30) return 'text-yellow-600';
    return 'text-muted-foreground';
}

export default function ExpiringSoonList({ documents }: ExpiringSoonListProps) {
  const router = useRouter();

  if (documents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center bg-muted/50 rounded-lg">
        <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold">All Good!</h3>
        <p className="text-sm text-muted-foreground">You have no documents expiring in the next 90 days.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
      {documents.map((doc) => {
        const daysLeft = differenceInDays(parseISO(doc.expiry!), new Date());
        const urgencyColor = getUrgencyColor(daysLeft);

        return (
            <Card 
                key={doc.id} 
                className="p-4 flex items-center gap-4 hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={() => router.push(`/dashboard/document/${doc.id}`)}
            >
                <div className={`p-2 rounded-full bg-secondary ${urgencyColor}`}>
                    <AlertCircle className="h-6 w-6" />
                </div>
                <div className="flex-1 grid grid-cols-3 gap-4 items-center">
                   <div className="flex items-center gap-2 truncate">
                        <FileText className="h-4 w-4 text-muted-foreground shrink-0"/>
                        <span className="font-semibold truncate">{doc.type}</span>
                    </div>
                    <div className="flex items-center gap-2 truncate">
                        <User className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="truncate">{doc.owner}</span>
                    </div>
                   <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div>
                             <p className="font-medium">{format(parseISO(doc.expiry!), 'MMM dd, yyyy')}</p>
                             <p className={`text-xs ${urgencyColor}`}>{daysLeft} days left</p>
                        </div>
                    </div>
                </div>
            </Card>
        )
      })}
    </div>
  );
}
