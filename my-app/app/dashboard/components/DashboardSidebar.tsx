"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { jwtDecode } from "jwt-decode";

// --- 1. CONSTANTES DE ROLES (CORREGIDO SEGÚN TU BD) ---
const ROLES = {
  FIRMANTE: 1,      // id_rol en tu BD para "Firmante"
  ADMIN: 2,         // id_rol en tu BD para "administrador"
  PUBLICO: 3,       // id_rol en tu BD para "publico"
  AUDITOR: 7,       // id_rol en tu BD para "auditor"
};

// --- 2. DEFINICIÓN DEL MENÚ CON PERMISOS ---
const menuItems = [
  {
    name: "Usuarios",
    href: "/dashboard/Ussuarios",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
    ),
    allowedRoles: [ROLES.ADMIN], // Solo Admin (Rol 2)
  },
  {
    name: "Búsqueda",
    href: "/dashboard/Busqueda",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
    ),
    allowedRoles: [ROLES.ADMIN, ROLES.AUDITOR], // Admin (2) y Auditor (7)
  },
  {
    name: "Firmas",
    href: "/dashboard/Firmas",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
    ),
    allowedRoles: [ROLES.ADMIN], // Solo Admin (2)
  },
  {
    name: "Anexos",
    href: "/dashboard/Anexos",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
    ),
    // Admin (2), Firmante (1) y Auditor (7) pueden ver Anexos
    allowedRoles: [ROLES.ADMIN, ROLES.FIRMANTE, ROLES.AUDITOR], 
  }
];

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function DashboardSidebar({ isOpen = true, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [userRole, setUserRole] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);

  // --- 3. OBTENER ROL DEL TOKEN ---
  useEffect(() => {
    setMounted(true);
    const token = localStorage.getItem("token");
    if (token) {
      try {
        const decoded: any = jwtDecode(token);
        // IMPORTANTE: Verifica que tu backend envíe 'id_rol' o 'rol'.
        // Si tu backend envía 'rol', usa decoded.rol. Si envía 'id_rol', usa decoded.id_rol.
        // Aquí asumimos que recibes el número ID.
        const roleId = decoded.id_rol || decoded.rol;
        
        setUserRole(Number(roleId)); 
      } catch (error) {
        console.error("Token inválido", error);
      }
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token"); 
    router.push("/"); 
  };

  if (!mounted) return null;

  return (
    <>
      {/* Mobile Overlay */}
      <div 
        className={`fixed inset-0 bg-black/50 z-20 md:hidden transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* Sidebar Container */}
      <aside 
        className={`
          fixed md:static inset-y-0 left-0 z-30
          w-64 bg-[#12173D] text-white flex flex-col shadow-2xl 
          transition-transform duration-300 ease-in-out transform
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0 md:h-screen
        `}
      >
        {/* Header Logo */}
        <div className="h-24 flex items-center justify-between md:justify-center px-6 border-b border-white/10 bg-[#0d112b] shrink-0">
          <div 
            onClick={() => router.push('/dashboard')}
            className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity group"
          >
            <div className="bg-white p-1 rounded-full shadow-lg group-hover:scale-105 transition-transform">
               <Image
                  src="/img/Piura.png"
                  alt="Logo"
                  width={40}
                  height={40}
                  className="rounded-full"
                  priority
                />
            </div>
            <div className="leading-tight select-none">
               <h1 className="font-bold text-lg tracking-wide group-hover:text-blue-200 transition-colors">S.G.D.</h1>
               <p className="text-[10px] text-gray-400 uppercase tracking-wider">Hospital</p>
            </div>
          </div>
          
          <button onClick={onClose} className="md:hidden text-gray-400 hover:text-white">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Navigation - FILTRADO POR ROL */}
        <nav className="flex-1 py-6 px-3 space-y-2 overflow-y-auto">
          {menuItems.filter(item => 
             userRole && item.allowedRoles.includes(userRole)
          ).map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href);
            
            return (
              <Link 
                key={item.name} 
                href={item.href}
                onClick={onClose}
                className={`
                  group flex items-center px-4 py-3 rounded-lg transition-all duration-200 ease-in-out
                  ${isActive 
                    ? "bg-[#0038C2] text-white shadow-md translate-x-1" 
                    : "text-gray-300 hover:bg-white/10 hover:text-white hover:translate-x-1"
                  }
                `}
              >
                <span className={`mr-3 transition-colors ${isActive ? "text-white" : "text-gray-400 group-hover:text-white"}`}>
                  {item.icon}
                </span>
                <span className="font-medium tracking-wide">{item.name}</span>
                
                {isActive && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer Logout */}
        <div className="p-4 border-t border-white/10 shrink-0">
          <button 
            onClick={handleLogout} 
            className="flex items-center justify-center w-full px-4 py-3 rounded-lg text-red-300 hover:bg-red-500/10 hover:text-red-200 transition-all duration-200 group border border-transparent hover:border-red-500/30"
          >
            <svg className="w-5 h-5 mr-2 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            <span className="font-semibold">Cerrar Sesión</span>
          </button>
        </div>
      </aside>
    </>
  );
}