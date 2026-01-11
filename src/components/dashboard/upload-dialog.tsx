
'use client';

import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { auth } from '@/lib/firebase';
import { UploadDropzone } from '@uploadthing/react';
import type { OurFileRouter } from '@/app/api/uploadthing/core';
import { ShieldCheck, CloudUpload, X, Lock } from 'lucide-react';
import '@uploadthing/react/styles.css';

type UploadDialogProps = {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
};

export function UploadDialog({ isOpen, setIsOpen }: UploadDialogProps) {
  const { toast } = useToast();
  const router = useRouter();

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[480px] bg-[#050505] border-white/10 p-0 rounded-[2.5rem] overflow-hidden shadow-[0_0_80px_rgba(0,0,0,0.9)] outline-none ring-0">
        
        {/* --- DYNAMIC TOP ACCENT --- */}
        <div className="h-1.5 w-full bg-gradient-to-r from-blue-600 via-indigo-500 to-blue-600" />

        <div className="relative p-8">
            {/* Header Section */}
            <div className="flex items-start justify-between mb-8">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border-blue-500/20 flex items-center justify-center text-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.1)]">
                        <CloudUpload size={24} />
                    </div>
                    <div>
                        <DialogTitle className="text-xl font-black tracking-tight text-white uppercase">Secure Ingestion</DialogTitle>
                        <DialogDescription asChild>
                            <div className="flex items-center gap-1.5 text-zinc-500">
                                <Lock size={12} className="text-blue-500" />
                                <p className="text-xs font-bold tracking-widest uppercase">E2E Encrypted</p>
                            </div>
                        </DialogDescription>
                    </div>
                </div>
                
                <button 
                    onClick={() => setIsOpen(false)}
                    className="p-2 rounded-xl hover:bg-white/5 text-zinc-600 transition-colors"
                >
                    <X size={20} />
                </button>
            </div>

            {/* --- UPLOAD ZONE WITH STYLE OVERRIDES --- */}
            <div className="relative rounded-[2rem] bg-white/[0.02] border border-white/5 p-2">
                <UploadDropzone<OurFileRouter>
                    endpoint="documentUploader"
                    className="ut-label:text-blue-400 ut-button:bg-blue-600 ut-button:w-full ut-button:rounded-xl ut-button:font-bold ut-uploading:pointer-events-none"
                    appearance={{
                        container: "border-none py-8",
                        label: "text-zinc-300 font-bold hover:text-white transition-colors cursor-pointer",
                        allowedContent: "text-zinc-600 text-[10px] font-bold uppercase tracking-widest mt-2",
                        button: "bg-blue-600 hover:bg-blue-500 transition-all text-sm h-12 shadow-lg shadow-blue-600/20 active:scale-95",
                    }}
                    config={{
                        mode: "auto",
                        fetcher: {
                            // @ts-ignore
                            getAuthorizationToken: async () => {
                                const user = auth.currentUser;
                                if (!user) return null;
                                return await user.getIdToken();
                            }
                        }
                    }}
                    onClientUploadComplete={(res) => {
                        if (res) {
                            toast({
                                title: "VAULT SYNCHRONIZED",
                                description: "Your assets have been securely stored.",
                                className: "bg-black border-blue-500/50 text-white rounded-2xl",
                            });
                            setIsOpen(false);
                            router.refresh();
                        }
                    }}
                    onUploadError={(error: Error) => {
                        toast({
                            variant: 'destructive',
                            title: 'TRANSFER ERROR',
                            description: error.message,
                        });
                    }}
                />
            </div>

            {/* --- SECURITY STATUS --- */}
            <div className="mt-6 flex items-center justify-between px-2">
                <div className="flex items-center gap-2">
                    <ShieldCheck size={14} className="text-blue-500" />
                    <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Protocol: AES-256</span>
                </div>
                <div className="flex gap-1">
                    <div className="w-1 h-1 rounded-full bg-blue-500 animate-pulse" />
                    <div className="w-1 h-1 rounded-full bg-blue-500 animate-pulse delay-75" />
                    <div className="w-1 h-1 rounded-full bg-blue-500 animate-pulse delay-150" />
                </div>
            </div>
        </div>

        {/* CSS INJECTION TO KILL THE 'LOADING' TEXT BUG */}
        <style jsx global>{`
            .ut-uploading\:pointer-events-none:empty:before {
                content: "Initializing Secure Channel...";
                color: #52525b;
                font-size: 12px;
                font-weight: 700;
                letter-spacing: 0.1em;
            }
            /* Fix for the Loading text showing up too early */
            .ut-label { display: block !important; opacity: 1 !important; }
            .ut-allowed-content { display: block !important; }
        `}</style>
      </DialogContent>
    </Dialog>
  );
}
