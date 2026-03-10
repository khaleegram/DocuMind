import { FileSpreadsheet, FileText, Presentation } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ComponentProps, ComponentType } from 'react';

export type DocumentPlaceholderKind = 'pdf' | 'docx' | 'excel' | 'powerpoint';

type DocumentPlaceholderProps = {
  kind?: DocumentPlaceholderKind;
  pageCount?: number | null;
  selected?: boolean;
  processing?: boolean;
  pro?: boolean;
  className?: string;
};

const PLACEHOLDER_CONFIG: Record<
  DocumentPlaceholderKind,
  {
    badge: string;
    icon: ComponentType<{ className?: string }>;
    badgeClassName: string;
  }
> = {
  pdf: {
    badge: 'PDF',
    icon: FileText,
    badgeClassName: 'bg-destructive/10 text-destructive',
  },
  docx: {
    badge: 'DOCX',
    icon: FileText,
    badgeClassName: 'bg-blue-500/10 text-blue-500',
  },
  excel: {
    badge: 'XLSX',
    icon: FileSpreadsheet,
    badgeClassName: 'bg-emerald-500/10 text-emerald-500',
  },
  powerpoint: {
    badge: 'PPTX',
    icon: Presentation,
    badgeClassName: 'bg-orange-500/10 text-orange-500',
  },
};

const getMetaText = (kind: DocumentPlaceholderKind, pageCount?: number | null): string => {
  if (typeof pageCount === 'number' && pageCount > 0) {
    if (kind === 'excel') {
      return `${pageCount} ${pageCount === 1 ? 'sheet' : 'sheets'}`;
    }
    if (kind === 'powerpoint') {
      return `${pageCount} ${pageCount === 1 ? 'slide' : 'slides'}`;
    }
    return `${pageCount} ${pageCount === 1 ? 'page' : 'pages'}`;
  }

  if (kind === 'powerpoint') {
    return 'Slide count unavailable';
  }
  if (kind === 'excel') {
    return 'Sheet count unavailable';
  }
  return 'Page count unavailable';
};

export function PdfPlaceholder({
  kind = 'pdf',
  pageCount = null,
  selected = false,
  processing = false,
  pro = false,
  className,
}: DocumentPlaceholderProps) {
  const config = PLACEHOLDER_CONFIG[kind];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        'relative flex h-full min-h-[160px] w-full items-center justify-center overflow-hidden rounded-2xl bg-transparent text-card-foreground',
        selected ? 'ring-2 ring-primary/20' : '',
        className
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-white/[0.02] to-transparent" />
      {pro && (
        <span className="absolute right-3 top-3 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
          Pro
        </span>
      )}
      {processing && (
        <span className="absolute left-3 top-3 rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium text-accent-foreground">
          Processing
        </span>
      )}

      <div className="relative flex flex-col items-center gap-3">
        <div className="relative flex h-24 w-24 items-center justify-center rounded-2xl border border-border/70 bg-card/40 backdrop-blur-[1px]">
          <Icon className="h-10 w-10 text-blue-500" />
          <div
            className={cn(
              'absolute -bottom-2 rounded-md border border-border/50 px-2 py-0.5 text-[10px] font-semibold',
              config.badgeClassName
            )}
          >
            {config.badge}
          </div>
        </div>
        <p className="text-xs font-medium text-muted-foreground">{getMetaText(kind, pageCount)}</p>
      </div>
    </div>
  );
}

export const PDFPlaceholder = PdfPlaceholder;
type PlaceholderPropsWithoutKind = Omit<ComponentProps<typeof PdfPlaceholder>, 'kind'>;

export const DocxPlaceholder = (props: PlaceholderPropsWithoutKind) => (
  <PdfPlaceholder kind="docx" {...props} />
);
export const ExcelPlaceholder = (props: PlaceholderPropsWithoutKind) => (
  <PdfPlaceholder kind="excel" {...props} />
);
export const PowerPointPlaceholder = (props: PlaceholderPropsWithoutKind) => (
  <PdfPlaceholder kind="powerpoint" {...props} />
);
