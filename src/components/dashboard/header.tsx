
'use client';

import { Search, Upload } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

type HeaderProps = {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onSearchSubmit: () => void;
  onUploadClick: () => void;
  title: string;
};

export default function Header({ searchQuery, setSearchQuery, onSearchSubmit, onUploadClick, title }: HeaderProps) {
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      onSearchSubmit();
    }
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur-sm sm:h-auto sm:border-0 sm:bg-transparent sm:px-6 sm:py-4">
      <div className="flex w-full items-center gap-4">
        <h1 className="flex-1 shrink-0 text-2xl font-semibold hidden md:block whitespace-nowrap">{title}</h1>
        <form onSubmit={(e) => { e.preventDefault(); onSearchSubmit(); }} className="relative flex-1 ml-auto sm:flex-grow-0">
          <Input
            type="search"
            placeholder="Search documents..."
            className="pl-4 pr-10 w-full sm:w-[200px] lg:w-[320px] h-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            aria-label="Search"
          />
          <Button 
            type="submit" 
            size="icon" 
            className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
            aria-label="Submit search"
            >
            <Search className="h-4 w-4" />
          </Button>
        </form>
        <Button onClick={onUploadClick} className="bg-accent hover:bg-accent/90 h-10">
          <Upload className="mr-0 sm:mr-2 h-4 w-4" /> 
          <span className="hidden sm:inline">Upload</span>
        </Button>
      </div>
    </header>
  );
}
