
'use client';
import {
  Sidebar,
  SidebarContent,
  SidebarInset,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { Home, Folder, Settings, FileSearch, LogOut } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { auth } from '@/lib/firebase';
import { useAuthState } from 'react-firebase-hooks/auth';

function MainSidebar() {
  const pathname = usePathname();
  const { isMobile } = useSidebar();
  const router = useRouter();
  const [user] = useAuthState(auth);

  const handleLogout = async () => {
    await auth.signOut();
    router.push('/');
  };

  return (
    <Sidebar
      collapsible={isMobile ? 'offcanvas' : 'icon'}
      className="group-data-[variant=inset]:bg-card"
    >
      <SidebarHeader className="p-4">
         <div className="flex items-center gap-2 font-semibold cursor-pointer" onClick={() => router.push('/dashboard')}>
            <FileSearch className="h-6 w-6 text-primary" />
            <span className="text-xl group-data-[collapsible=icon]:hidden">DocuMind</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={pathname === '/dashboard'}
              tooltip={{
                children: 'My Documents',
              }}
            >
              <a href="/dashboard">
                <Home />
                <span>My Documents</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={pathname.startsWith('/dashboard/folders')}
              tooltip={{
                children: 'Folders',
              }}
            >
              <a href="/dashboard/folders">
                <Folder />
                <span>Folders</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter>
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <div className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/50 rounded-md">
                     <Avatar className="h-8 w-8">
                        <AvatarImage src={user?.photoURL || ''} alt={user?.displayName || 'User Avatar'} data-ai-hint="profile picture" />
                        <AvatarFallback>{user?.displayName?.charAt(0) || 'U'}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col group-data-[collapsible=icon]:hidden">
                        <span className="text-sm font-semibold truncate">{user?.displayName}</span>
                        <span className="text-xs text-muted-foreground truncate">{user?.email}</span>
                    </div>
                </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top" className="mb-2 w-56">
                <DropdownMenuLabel>{user?.displayName || 'My Account'}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled>Profile</DropdownMenuItem>
                <DropdownMenuItem disabled>Settings</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}


export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
        <div className="flex min-h-screen w-full flex-col bg-muted/40">
            <MainSidebar />
            <SidebarInset>
             {children}
            </SidebarInset>
        </div>
    </SidebarProvider>
  );
}
