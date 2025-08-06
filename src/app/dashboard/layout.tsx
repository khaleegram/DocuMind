
'use client';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarProvider,
} from '@/components/ui/sidebar';
import { Files, Folder, Home, LogOut } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
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
import { Skeleton } from '@/components/ui/skeleton';

function MainSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, loading] = useAuthState(auth);

  const handleLogout = async () => {
    await auth.signOut();
    router.push('/');
  };

  return (
    <Sidebar
      collapsible="icon"
      className="group-data-[variant=inset]:bg-card hidden sm:flex"
    >
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2 font-semibold cursor-pointer" onClick={() => router.push('/dashboard')}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-primary"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M12.5 13h-1a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1h1a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1h-1"></path><path d="M17.5 13h-1a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1h1a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1h-1"></path></svg>
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
                children: 'Dashboard',
              }}
            >
              <a href="/dashboard">
                <Home />
                <span>Dashboard</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
           <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={pathname.startsWith('/dashboard/documents')}
              tooltip={{
                children: 'All Documents',
              }}
            >
              <a href="/dashboard/documents">
                <Files />
                <span>All Documents</span>
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
                        {user && <AvatarImage src={user.photoURL || ''} alt={user.displayName || 'User Avatar'} data-ai-hint="profile picture" />}
                        <AvatarFallback>
                           {loading ? <Skeleton className="h-8 w-8 rounded-full" /> : (user?.displayName?.charAt(0)?.toUpperCase() || 'U')}
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col group-data-[collapsible=icon]:hidden truncate">
                       {loading ? (
                         <div className="space-y-1">
                           <Skeleton className="h-4 w-24" />
                           <Skeleton className="h-3 w-32" />
                         </div>
                       ) : (
                         <>
                           <span className="text-sm font-semibold truncate">{user?.displayName}</span>
                           <span className="text-xs text-muted-foreground truncate">{user?.email}</span>
                         </>
                       )}
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
            <main className="flex flex-col sm:pl-14 flex-1">
                 <div className="flex-1">
                    {children}
                </div>
            </main>
        </div>
    </SidebarProvider>
  );
}
