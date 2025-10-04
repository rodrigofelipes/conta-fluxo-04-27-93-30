import { useMemo, useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { Home, Calendar, Users, Building2, DollarSign, Settings, LogOut, Shield, UserCog, MessageSquare, FolderOpen, BarChart3, BookOpen, Megaphone, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { ProportionalScaler } from "@/components/ui/proportional-scaler";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/state/auth";
import { useGradientDatabase } from "@/hooks/useGradientDatabase";
import { useAuthSession } from "@/hooks/useAuthSession";
import { getRoleLabel } from "@/lib/roleUtils";

interface NavItem {
  to: string;
  label: string;
  icon: any;
  adminOnly?: boolean;
}

const nav: NavItem[] = [{
  to: "/dashboard",
  label: "Dashboard",
  icon: Home
}, {
  to: "/agenda",
  label: "Agenda",
  icon: Calendar
}, {
  to: "/projects",
  label: "Projetos",
  icon: FolderOpen
}, {
  to: "/clients",
  label: "Clientes",
  icon: Users
}, {
  to: "/chat",
  label: "Chat",
  icon: MessageSquare
}, {
  to: "/user-projects",
  label: "Minhas Etapas",
  icon: Building2
}, {
  to: "/coordinator-phases",
  label: "Etapas",
  icon: Users
}, {
  to: "/reports",
  label: "Relatórios",
  icon: BarChart3
}, {
  to: "/financeiro",
  label: "Financeiro",
  icon: DollarSign,
  adminOnly: true
}, {
  to: "/marketing",
  label: "Marketing",
  icon: Megaphone
}, {
  to: "/rules-features",
  label: "Regras e Funcionalidades",
  icon: BookOpen
}, {
  to: "/settings",
  label: "Configurações",
  icon: Settings
}];

export default function AppLayout() {
  const {
    user,
    logout,
    isAuthReady
  } = useAuth();
  
  // Initialize gradient system
  useGradientDatabase();
  
  // Use session monitoring
  const { verifySession } = useAuthSession();
  const location = useLocation();
  
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Verify session on navigation changes
  useEffect(() => {
    if (!isAuthReady) {
      return;
    }
    console.log('Navigation changed to:', location.pathname);
    const checkSessionOnNavigation = async () => {
      if (user) {
        const isValid = await verifySession();
        if (!isValid) {
          console.warn('Sessão inválida detectada na navegação');
        }
      }
    };

    checkSessionOnNavigation();
  }, [location.pathname, user, verifySession, isAuthReady]);
  const items = useMemo(() => {
    let filteredNav = nav;

    // Filter by role permissions
    if (user?.role === "user") {
      filteredNav = filteredNav.filter(n => 
        n.to !== "/financeiro" && 
        n.to !== "/users" && 
        n.to !== "/clients" && 
        n.to !== "/chat" &&
        n.to !== "/projects" &&
        n.to !== "/reports" &&
        n.to !== "/marketing"
      );
    } else if (user?.role === "admin") {
      // Remove user-specific projects tab for admins
      filteredNav = filteredNav.filter(n => n.to !== "/user-projects");
    } else if (user?.role === "coordenador") {
      // Coordenadores: access to agenda, dashboard, coordinator-phases, user-projects, and settings
      filteredNav = filteredNav.filter(n => 
        n.to !== "/financeiro" && 
        n.to !== "/clients" &&
        n.to !== "/projects" &&
        n.to !== "/reports" &&
        n.to !== "/chat" &&
        n.to !== "/marketing"
      );
    } else if (user?.role === "supervisor") {
      // Supervisores: access to projects, reports, chat, clients but not financeiro, users, coordinator-phases
      filteredNav = filteredNav.filter(n => 
        n.to !== "/user-projects" && 
        n.to !== "/financeiro" && 
        n.to !== "/coordinator-phases" &&
        n.to !== "/marketing"
      );
    } else if (user?.role === "marketing") {
      // Marketing: acesso limitado a dashboard, agenda, configurações e marketing
      filteredNav = filteredNav.filter(n => 
        n.to === "/dashboard" ||
        n.to === "/agenda" ||
        n.to === "/settings" ||
        n.to === "/marketing"
      );
    }

    // Filter admin-only items (now also includes coordenador for some features)
    filteredNav = filteredNav.filter(n => {
      if (n.adminOnly) {
        return user?.role === "admin";
      }
      if (n.to === "/chat" || n.to === "/reports") {
        // Chat and Reports are accessible to admin and supervisor only
        return user?.role === "admin" || user?.role === "supervisor";
      }
      if (n.to === "/coordinator-phases") {
        // Coordinator phases are only accessible to coordenador
        return user?.role === "coordenador";
      }
      if (n.to === "/marketing") {
        // Marketing page is only accessible to marketing role
        return user?.role === "marketing" || user?.role === "admin";
      }
      return true;
    });
    
    return filteredNav;
  }, [user?.role]);
  
  return <ProportionalScaler className="min-h-screen flex flex-col md:flex-row bg-app-gradient">
      <aside className="hidden md:flex md:flex-col border-r bg-card/80 backdrop-blur-sm sticky top-0 h-screen w-full md:w-60 lg:w-64 xl:w-72 flex-shrink-0">
        <div className="p-3 sm:p-4 border-b">
          <div className="flex items-center gap-2 sm:gap-3">
            <Logo size="md" />
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-semibold truncate">CONCEPÇÃO</h1>
              <p className="text-xs sm:text-sm text-muted-foreground">Arquitetura</p>
            </div>
          </div>
        </div>
        
        <nav className="flex-1 p-2 sm:p-4 space-y-1">
          {items.map(n => <NavLink key={n.to} to={n.to} className={({
          isActive
        }) => `flex items-center gap-2 sm:gap-3 rounded-md px-2 sm:px-3 py-2 text-sm transition-colors ${isActive ? "bg-primary/10 text-primary" : "hover:bg-accent"}`}>
              <n.icon className="size-4 flex-shrink-0" />
              <span className="truncate">{n.label}</span>
            </NavLink>)}
        </nav>
        
        <div className="mt-auto p-2 sm:p-4 border-t bg-card/90">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm min-w-0 flex-1">
              <p className="font-medium flex items-center gap-2 truncate">
                <span className="truncate">{user?.name}</span>
                {user?.role === "admin" && <Shield className="size-3 text-primary flex-shrink-0" />}
              </p>
              <p className="text-muted-foreground text-xs truncate">{getRoleLabel(user?.role as any)}</p>
            </div>
            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
              <ThemeToggle />
              <Button variant="soft" size="sm" onClick={() => {
              logout();
              navigate("/login");
            }} className="hidden sm:flex">
                <LogOut className="mr-1" /> Sair
              </Button>
              <Button variant="soft" size="sm" onClick={() => {
              logout();
              navigate("/login");
            }} className="sm:hidden">
                <LogOut className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex flex-col min-h-screen w-full min-w-0">
        <header className="md:hidden sticky top-0 z-10 border-b bg-card/80 backdrop-blur-sm">
          <div className="px-3 py-2 sm:px-4 sm:py-3 flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-9 w-9 p-0">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[280px] p-0">
                  <SheetHeader className="p-4 border-b">
                    <div className="flex items-center gap-2">
                      <Logo size="md" />
                      <div>
                        <SheetTitle className="text-base">CONCEPÇÃO</SheetTitle>
                        <p className="text-xs text-muted-foreground">Arquitetura</p>
                      </div>
                    </div>
                  </SheetHeader>
                  
                  <nav className="p-3 space-y-1">
                    {items.map(n => (
                      <NavLink 
                        key={n.to} 
                        to={n.to}
                        onClick={() => setMobileMenuOpen(false)}
                        className={({isActive}) => 
                          `flex items-center gap-3 rounded-md px-3 py-3 text-sm transition-colors ${
                            isActive ? "bg-primary/10 text-primary font-medium" : "hover:bg-accent"
                          }`
                        }
                      >
                        <n.icon className="size-5 flex-shrink-0" />
                        <span>{n.label}</span>
                      </NavLink>
                    ))}
                  </nav>

                  <div className="absolute bottom-0 left-0 right-0 p-3 border-t bg-card">
                    <div className="space-y-2">
                      <div className="text-sm px-2">
                        <p className="font-medium flex items-center gap-2 truncate">
                          <span className="truncate">{user?.name}</span>
                          {user?.role === "admin" && <Shield className="size-3 text-primary flex-shrink-0" />}
                        </p>
                        <p className="text-muted-foreground text-xs truncate">{getRoleLabel(user?.role as any)}</p>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => {
                          logout();
                          navigate("/login");
                          setMobileMenuOpen(false);
                        }} 
                        className="w-full"
                      >
                        <LogOut className="mr-2 h-4 w-4" />
                        Sair
                      </Button>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>

              <Logo size="sm" />
              <div className="min-w-0">
                <h1 className="text-sm sm:text-base font-semibold truncate">CONCEPÇÃO</h1>
                <p className="text-xs text-muted-foreground">Arquitetura</p>
              </div>
            </div>
            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
              <ThemeToggle />
            </div>
          </div>
        </header>
        <div className="px-3 py-4 md:responsive-padding-lg bg-custom-bg flex-1"><Outlet /></div>
      </main>
    </ProportionalScaler>;
}