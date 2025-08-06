
'use client';

import { Search, Upload } from 'lucide-react';
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
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-0">
      <SidebarTrigger className="sm:hidden" />
      
      <div className="flex w-full items-center gap-4">
        <h1 className="flex-1 text-xl font-semibold hidden sm:block">{title}</h1>
        <div className="relative flex-1 sm:flex-initial sm:ml-auto">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search..."
            className="pl-8 w-full sm:w-[200px] lg:w-[300px]"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search"
          />
        </div>
        <Button onClick={onUploadClick} className="bg-accent hover:bg-accent/90">
          <Upload className="mr-0 sm:mr-2 h-4 w-4" /> 
          <span className="hidden sm:inline">Upload</span>
        </Button>
      </div>
    </header>
  );
}

    