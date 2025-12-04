"use client";

import { ReactNode, useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation"; 
import { jwtDecode } from "jwt-decode"; 
import DashboardSidebar from "./components/DashboardSidebar";

// --- 1. CONSTANTES DE ROLES ---
const ROLES = {
  FIRMANTE: 1,
  ADMIN: 2,
  PUBLICO: 3,
  AUDITOR: 7,
};

// --- 2. MAPA DE PERMISOS (Ruta -> Roles Permitidos) ---
const PATH_PERMISSIONS: { [key: string]: number[] } = {
  // Rutas específicas (Se revisan primero)
  '/dashboard/Usuarios': [ROLES.ADMIN],
  '/dashboard/Busqueda': [ROLES.ADMIN, ROLES.AUDITOR],
  '/dashboard/Firmas':   [ROLES.ADMIN],
  '/dashboard/Anexos':   [ROLES.ADMIN, ROLES.FIRMANTE, ROLES.AUDITOR],
  // Ruta raíz (Se revisa al final)
  '/dashboard':          [ROLES.ADMIN, ROLES.FIRMANTE, ROLES.AUDITOR] 
};

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [userRoleName, setUserRoleName] = useState("Cargando..."); // Estado para el nombre del rol
  const [userRoleInitial, setUserRoleInitial] = useState("U");     // Estado para la inicial
  
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const checkAuth = () => {
      const token = localStorage.getItem("token");

      // A. ¿Tiene Token?
      if (!token) {
        router.replace("/");
        return;
      }

      try {
        const decoded: any = jwtDecode(token);
        // Asegúrate de leer el campo correcto del token (id_rol o rol)
        const roleId = Number(decoded.id_rol || decoded.rol);
        
        // Configurar nombre para el Header
        const roleNames: {[key: number]: string} = { 
          1: 'Firmante', 
          2: 'Administrador', 
          7: 'Auditor' 
        };
        const nombreRol = roleNames[roleId] || 'Usuario';
        setUserRoleName(nombreRol);
        setUserRoleInitial(nombreRol.charAt(0));

        // B. ¿Es Rol Público? (Bloqueo Total)
        if (roleId === ROLES.PUBLICO) {
          localStorage.removeItem("token");
          router.replace("/");
          return;
        }

        // C. Verificación de Ruta (Lógica mejorada)
        // Ordenamos las llaves por longitud descendente para que '/dashboard/Usuarios' 
        // se verifique antes que '/dashboard'
        const protectedPath = Object.keys(PATH_PERMISSIONS)
          .sort((a, b) => b.length - a.length) 
          .find(path => pathname.startsWith(path));

        if (protectedPath) {
          const allowedRoles = PATH_PERMISSIONS[protectedPath];
          
          if (!allowedRoles.includes(roleId)) {
            // Si no tiene permiso, lo mandamos a su zona segura
            console.warn(`Acceso denegado a ${pathname}. Redirigiendo...`);
            router.replace("/dashboard/Anexos"); 
            return;
          }
        }

        // Autorizado
        setIsAuthorized(true);

      } catch (error) {
        console.error("Error de seguridad:", error);
        localStorage.removeItem("token");
        router.replace("/");
      }
    };

    checkAuth();
  }, [pathname, router]);

  // --- PANTALLA DE CARGA ---
  if (!isAuthorized) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-100 font-sans">
        <div className="flex flex-col items-center gap-4 animate-pulse">
           <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin shadow-lg"></div>
           <p className="text-slate-500 text-sm font-semibold tracking-wide">Verificando permisos...</p>
        </div>
      </div>
    );
  }

  // --- CONTENIDO ---
  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden font-sans">
      <DashboardSidebar 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
      />

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white shadow-sm border-b border-slate-200 flex items-center justify-between px-4 md:px-8 z-10">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setSidebarOpen(true)}
              className="md:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
            <h2 className="text-lg md:text-xl font-bold text-[#12173D] tracking-tight truncate">
              Panel de Control
            </h2>
          </div>
          
          {/* User Profile Dinámico */}
          <div className="flex items-center gap-3">
            <div className="text-right hidden md:block">
              <p className="text-sm font-semibold text-slate-800">{userRoleName}</p>
              <p className="text-xs text-slate-500">En línea</p>
            </div>
            <div className="h-9 w-9 md:h-10 md:w-10 rounded-full bg-[#0038C2] text-white flex items-center justify-center font-bold shadow-md">
              {userRoleInitial}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-50 relative">
          {children}
        </main>
      </div>
    </div>
  );
}