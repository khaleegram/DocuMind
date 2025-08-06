
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


function MainSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  
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
        {/* User profile moved to header */}
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
      <div className="flex min-h-screen w-full bg-muted/40">
        <MainSidebar />
        <div className="flex flex-col flex-1 w-full">
          {children}
        </div>
      </div>
    </SidebarProvider>
  );
}
