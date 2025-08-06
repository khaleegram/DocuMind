
'use client';

import { useRouter } from 'next/navigation';
import { Search, FileSearch, Upload } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { SidebarTrigger } from '@/components/ui/sidebar';

type HeaderProps = {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onUploadClick: () => void;
  title: string;
};

export default function Header({ searchQuery, setSearchQuery, onUploadClick, title }: HeaderProps) {
  const router = useRouter();

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
      <SidebarTrigger className="sm:hidden" />
      
      <div className="flex w-full items-center gap-4 md:ml-auto md:gap-2 lg:gap-4">
        <h1 className="flex-1 text-xl font-semibold">{title}</h1>
        <form className="ml-auto flex-1 sm:flex-initial max-w-xs" onSubmit={(e) => e.preventDefault()}>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search..."
              className="pl-8 sm:w-[300px] md:w-[200px] lg:w-[300px]"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search"
            />
          </div>
        </form>
        <Button onClick={onUploadClick} className="bg-accent hover:bg-accent/90">
          <Upload className="mr-2 h-4 w-4" /> Upload
        </Button>
      </div>
    </header>
  );
}
