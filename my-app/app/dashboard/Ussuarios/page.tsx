'use client';

import { useState, useEffect, useMemo } from 'react';
import UserFormModal, { User, Role } from './components/UserFormModal';

import { PageLoader } from '../components/PageLoader';

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Selection State
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  
  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // --- Data Fetching ---
  const fetchData = async () => {
    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 2500));  
      const [resUsers, resRoles] = await Promise.all([
        fetch('http://localhost:3004/api/admin/usuarios'),
        fetch('http://localhost:3004/api/admin/roles')
      ]);
      const usersData = await resUsers.json();
      const rolesData = await resRoles.json();
      setUsuarios(usersData);
      setRoles(rolesData);
      

    } catch (error) {
      console.error('Error cargando datos:', error);
    } finally {
      // The PageLoader handles the transition when this becomes false
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // --- Reset Pagination on Search ---
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // --- Handlers ---
  const handleRowClick = (user: User) => {
    if (selectedUser?.id_usuario === user.id_usuario) {
      setSelectedUser(null); 
    } else {
      setSelectedUser(user);
    }
  };

  const handleCreateOrUpdate = async (userData: User) => {
    setLoading(true);
    
    
    const API_URL = 'http://localhost:3004/api/admin/usuarios';

    try {
      let response;

      if (selectedUser?.id_usuario) {
        
        response = await fetch(`${API_URL}/${selectedUser.id_usuario}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(userData),
        });
      } else {
        response = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(userData),
        });
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al guardar usuario');
      }
      await fetchData();
      setIsModalOpen(false);
      setSelectedUser(null);

    } catch (error) {
      console.error("Error guardando usuario:", error);
      alert(error instanceof Error ? error.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedUser?.id_usuario) return;
    if (!confirm(`¿Está seguro de eliminar al usuario ${selectedUser.nombre}?`)) return;
    
    setLoading(true);
    
    try {
      const response = await fetch(`http://localhost:3004/api/admin/usuarios/${selectedUser.id_usuario}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json(); 
        throw new Error(errorData.message || 'Error al eliminar usuario');
      }

      setUsuarios(prev => prev.filter(u => u.id_usuario !== selectedUser.id_usuario));
      setSelectedUser(null);

    } catch (error) {
      console.error("Error eliminando usuario:", error);
      alert(error instanceof Error ? error.message : "Error al eliminar");
    } finally {
      setLoading(false);
    }
  };

  const handleReload = () => {
    setUsuarios([]);
    fetchData();
  };

  
  const filteredUsers = useMemo(() => {
    return usuarios.filter(u => 
      u.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.apellido.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.dni.includes(searchTerm)
    );
  }, [usuarios, searchTerm]);

  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  
  const paginatedUsers = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredUsers.slice(startIndex, endIndex);
  }, [filteredUsers, currentPage]);

  return (

    <PageLoader 
      isLoading={loading} 
      loadingText="Cargando directorio..." 
      successText="¡Datos actualizados!"
    >
      <div className="min-h-screen bg-gray-50 p-4 md:p-8 flex flex-col gap-6">
        
        {/* Header & Actions */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Directorio de Usuarios</h1>
            <p className="text-sm text-slate-500">Gestión del personal autorizado</p>
          </div>

          <div className="flex gap-3 w-full md:w-auto">
             {/* Reload Button for Demo */}
             <button 
                onClick={handleReload}
                className="p-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition"
                title="Recargar Datos"
             >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
             </button>

            {/* Search */}
            <div className="relative flex-1 md:w-64">
               <input 
                 type="text" 
                 placeholder="Buscar por nombre o DNI..." 
                 value={searchTerm}
                 onChange={(e) => setSearchTerm(e.target.value)}
                 className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
               />
               <svg className="w-4 h-4 absolute left-3 top-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>

            {/* Create Button */}
            <button
              onClick={() => { setSelectedUser(null); setIsModalOpen(true); }}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium shadow-md transition flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
              <span className="hidden sm:inline">Nuevo</span>
            </button>
          </div>
        </div>

        {/* Action Bar (Contextual) */}
        <div className={`transition-all duration-300 overflow-hidden ${selectedUser ? 'max-h-20 opacity-100' : 'max-h-0 opacity-0'}`}>
           <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-3">
                 <div className="h-10 w-10 rounded-full bg-blue-200 flex items-center justify-center text-blue-700 font-bold">
                    {selectedUser?.nombre.charAt(0)}
                 </div>
                 <div>
                    <p className="text-sm font-bold text-blue-900">{selectedUser?.nombre} {selectedUser?.apellido}</p>
                    <p className="text-xs text-blue-600">Usuario Seleccionado</p>
                 </div>
              </div>
              <div className="flex gap-2">
                 <button
                   onClick={() => setIsModalOpen(true)}
                   className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium shadow transition flex items-center gap-2 text-sm"
                 >
                   <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                   Modificar
                 </button>
                 <button
                   onClick={handleDelete}
                   className="px-4 py-2 bg-white border border-red-200 text-red-600 hover:bg-red-50 rounded-lg font-medium transition flex items-center gap-2 text-sm"
                 >
                   <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                   Eliminar
                 </button>
              </div>
           </div>
        </div>

        {/* Table Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex-1 overflow-hidden flex flex-col">
          <div className="overflow-auto flex-1">
            <table className="min-w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200 sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-4">Nombre Completo</th>
                  <th className="px-6 py-4">DNI</th>
                  <th className="px-6 py-4">Correo</th>
                  <th className="px-6 py-4">Rol</th>
                  <th className="px-6 py-4 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredUsers.length === 0 ? (
                   <tr>
                    <td colSpan={5} className="p-8 text-center text-gray-400">No se encontraron usuarios.</td>
                  </tr>
                ) : (
                  paginatedUsers.map((user) => {
                    const isSelected = selectedUser?.id_usuario === user.id_usuario;
                    return (
                      <tr
                        key={user.id_usuario}
                        onClick={() => handleRowClick(user)}
                        className={`cursor-pointer transition-colors duration-150 group relative
                          ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}
                        `}
                      >
                        <td className="px-6 py-4 font-medium text-slate-800 relative">
                          {isSelected && <span className="w-1 h-full absolute left-0 top-0 bg-blue-600"></span>}
                          {user.nombre} {user.apellido}
                        </td>
                        <td className="px-6 py-4 text-slate-600 font-mono">{user.dni}</td>
                        <td className="px-6 py-4 text-slate-600">{user.correo}</td>
                        <td className="px-6 py-4">
                          <span className="inline-block px-2 py-1 text-xs font-semibold text-slate-600 bg-slate-100 rounded border border-slate-200">
                             {roles.find(r => r.id_rol === user.id_rol)?.nombre_rol || 'N/A'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize
                            ${user.estado === 'activo' 
                              ? 'bg-green-100 text-green-800 ring-1 ring-green-600/20' 
                              : 'bg-red-100 text-red-800 ring-1 ring-red-600/20'}
                          `}>
                            {user.estado}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          
          {/* Pagination Footer */}
          <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
             <span className="text-xs text-gray-500">
               Mostrando {paginatedUsers.length} de {filteredUsers.length} usuarios
             </span>

             <div className="flex items-center gap-2">
               <button
                 onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                 disabled={currentPage === 1}
                 className="px-3 py-1 text-xs font-medium rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition"
               >
                 Anterior
               </button>
               
               <span className="text-xs font-semibold text-gray-700 px-2">
                 Página {currentPage} de {totalPages || 1}
               </span>

               <button
                 onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                 disabled={currentPage === totalPages || totalPages === 0}
                 className="px-3 py-1 text-xs font-medium rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition"
               >
                 Siguiente
               </button>
             </div>
          </div>
        </div>

        {/* Modularized Modal */}
        <UserFormModal 
          isOpen={isModalOpen}
          onClose={() => { setIsModalOpen(false); if(!selectedUser) setSelectedUser(null); }}
          onSubmit={handleCreateOrUpdate}
          initialData={selectedUser} 
          roles={roles}
        />

      </div>
    </PageLoader>
  );
}