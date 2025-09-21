import { useMemo, useEffect } from "react";
import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { Home, Calendar, Users, Building2, DollarSign, Settings, LogOut, Shield, UserCog, MessageSquare, FolderOpen, BarChart3, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { ProportionalScaler } from "@/components/ui/proportional-scaler";
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
    logout
  } = useAuth();
  
  // Initialize gradient system
  useGradientDatabase();
  
  // Use session monitoring
  const { verifySession } = useAuthSession();
  const location = useLocation();
  
  const navigate = useNavigate();

  // Verify session on navigation changes
  useEffect(() => {
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
  }, [location.pathname, user, verifySession]);
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
        n.to !== "/reports"
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
        n.to !== "/chat"
      );
    } else if (user?.role === "supervisor") {
      // Supervisores: access to projects, reports, chat, clients but not financeiro, users, coordinator-phases
      filteredNav = filteredNav.filter(n => 
        n.to !== "/user-projects" && 
        n.to !== "/financeiro" && 
        n.to !== "/coordinator-phases"
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
              <Logo size="sm" />
              <div className="min-w-0">
                <h1 className="text-sm sm:text-base font-semibold truncate">CONCEPÇÃO</h1>
                <p className="text-xs text-muted-foreground">Arquitetura</p>
              </div>
            </div>
            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
              <ThemeToggle />
              <Button variant="soft" size="sm" onClick={() => {
              logout();
              navigate("/login");
            }}>
                <LogOut className="mr-1 size-3 sm:size-4" /> 
                <span className="hidden sm:inline">Sair</span>
              </Button>
            </div>
          </div>
          <div className="px-2 pb-2 flex gap-1 overflow-x-auto">
            {items.map(n => <NavLink key={n.to} to={n.to} className={({
            isActive
          }) => `flex items-center gap-1 rounded-md px-2 py-1.5 text-xs sm:text-sm whitespace-nowrap flex-shrink-0 ${isActive ? "bg-primary/10 text-primary" : "bg-secondary"}`}>
                <n.icon className="size-3 sm:size-4" />
                <span>{n.label}</span>
              </NavLink>)}
          </div>
        </header>
        <div className="responsive-padding-lg bg-custom-bg flex-1"><Outlet /></div>
      </main>
    </ProportionalScaler>;
}