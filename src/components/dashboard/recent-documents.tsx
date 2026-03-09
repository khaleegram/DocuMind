
'use client';

import type { Document } from '@/lib/types';
import { useRouter } from 'next/navigation';
import { FileText, Loader2, Sparkles } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

type RecentDocumentsProps = {
  documents: Document[];
};

export default function RecentDocuments({ documents }: RecentDocumentsProps) {
  const router = useRouter();

  if (documents.length === 0) {
    return null; // Don't render anything if there are no recent documents
  }

  return (
    <div className="space-y-8">
        <div className="flex items-center gap-3">
            <Sparkles className="text-blue-500" />
            <h2 className="text-2xl font-black tracking-tighter">Latest Activity</h2>
        </div>
        <div className="space-y-2">
            {documents.map((doc) => (
                <div 
                    key={doc.id}
                    onClick={() => router.push(`/dashboard/document/${doc.id}`)}
                    className="grid grid-cols-[auto_1fr_auto] items-center gap-4 p-4 rounded-2xl bg-[#0C0C0E] border border-white/5 hover:bg-white/[0.04] hover:border-white/10 transition-all cursor-pointer"
                >
                    <div className="p-3 bg-zinc-800/50 rounded-lg border border-white/5 text-zinc-400">
                        {doc.isProcessing ? <Loader2 className="animate-spin" /> : <FileText />}
                    </div>
                    <div>
                        <p className="font-bold text-white truncate">{doc.owner || doc.fileName}</p>
                        <p className="text-xs text-zinc-500 truncate">{doc.category || 'Processing...'}</p>
                    </div>
                    <p className="text-xs text-zinc-600 font-medium justify-self-end">
                        {doc.uploadedAt ? formatDistanceToNow(new Date(doc.uploadedAt), { addSuffix: true }) : 'just now'}
                    </p>
                </div>
            ))}
        </div>
    </div>
  );
}

    
