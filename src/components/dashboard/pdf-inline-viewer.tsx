'use client';

import { useEffect, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { ChevronLeft, ChevronRight, ExternalLink, FileWarning, Loader2 } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

type PdfInlineViewerProps = {
  fileUrl: string;
  fileName: string;
};

type PdfLoadSuccess = {
  numPages: number;
};

export function PdfInlineViewer({ fileUrl, fileName }: PdfInlineViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pageCount, setPageCount] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageWidth, setPageWidth] = useState(320);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    const updateWidth = () => {
      const containerWidth = containerRef.current?.clientWidth ?? 0;
      setPageWidth(Math.max(240, containerWidth - 24));
    };

    updateWidth();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateWidth);
      return () => window.removeEventListener('resize', updateWidth);
    }

    const observer = new ResizeObserver(() => updateWidth());
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const handleLoadSuccess = ({ numPages }: PdfLoadSuccess) => {
    setPageCount(numPages);
    setPageNumber(previous => Math.min(Math.max(previous, 1), numPages));
    setHasError(false);
  };

  const handleLoadError = (error: Error) => {
    console.error('Inline PDF preview failed:', error);
    setHasError(true);
  };

  if (hasError) {
    return (
      <div className="w-full h-full p-8 flex flex-col items-center justify-center">
        <Alert className="bg-[#111113] border-blue-500/20 text-blue-400">
          <FileWarning className="h-4 w-4 !text-blue-400" />
          <AlertTitle>Inline PDF preview is unavailable</AlertTitle>
          <AlertDescription className="text-blue-400/80">
            We could not render this PDF in-app on this device.
          </AlertDescription>
        </Alert>
        <Button asChild className="mt-4 bg-blue-600 hover:bg-blue-500 text-white font-bold">
          <a href={fileUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="mr-2 h-4 w-4" />
            Open PDF
          </a>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col rounded-2xl border border-white/10 bg-[#111113] overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
        <p className="truncate pr-3 text-xs text-zinc-400">{fileName}</p>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8 bg-white/5 border-white/10 hover:bg-white/10"
            onClick={() => setPageNumber(previous => Math.max(1, previous - 1))}
            disabled={pageNumber <= 1}
            aria-label="Previous PDF page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs text-zinc-400 min-w-[68px] text-center">
            {pageCount > 0 ? `${pageNumber} / ${pageCount}` : '...'}
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8 bg-white/5 border-white/10 hover:bg-white/10"
            onClick={() => setPageNumber(previous => Math.min(pageCount, previous + 1))}
            disabled={pageCount < 1 || pageNumber >= pageCount}
            aria-label="Next PDF page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button asChild variant="outline" size="sm" className="bg-white/5 border-white/10 hover:bg-white/10">
            <a href={fileUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-1 h-4 w-4" />
              Open
            </a>
          </Button>
        </div>
      </div>

      <div ref={containerRef} className="relative flex-1 overflow-auto">
        <div className="flex min-h-full items-start justify-center p-3">
          <Document
            file={fileUrl}
            onLoadSuccess={handleLoadSuccess}
            onLoadError={handleLoadError}
            loading={
              <div className="flex h-full min-h-[320px] items-center justify-center text-zinc-400">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            }
            error={null}
          >
            <Page
              key={`${fileUrl}-${pageNumber}`}
              pageNumber={pageNumber}
              width={pageWidth}
              renderTextLayer={false}
              renderAnnotationLayer={false}
              loading={
                <div className="flex h-full min-h-[320px] items-center justify-center text-zinc-400">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              }
            />
          </Document>
        </div>
      </div>
    </div>
  );
}
