
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
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur-sm sm:px-6">
      <SidebarTrigger className="sm:hidden" />
      
      <div className="flex w-full items-center gap-4">
        <h1 className="flex-1 text-2xl font-semibold hidden sm:block">{title}</h1>
        <div className="relative flex-1 ml-auto sm:flex-grow-0">
          <Search className="absolute left-2.5 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search documents..."
            className="pl-8 w-full sm:w-[200px] lg:w-[320px] h-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search"
          />
        </div>
        <Button onClick={onUploadClick} className="bg-accent hover:bg-accent/90 h-10">
          <Upload className="mr-0 sm:mr-2 h-4 w-4" /> 
          <span className="hidden sm:inline">Upload</span>
        </Button>
      </div>
    </header>
  );
}
