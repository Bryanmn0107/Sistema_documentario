'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Skeleton } from './../components/ui/Skeleton';

// --- TIPOS DE DATOS ---
type RawRow = {
  id_usuario: number;
  nombre: string;
  apellido: string;
  correo: string;
  estado: 'activo' | 'inactivo' | string;
  id_anexo: number | null;
  id_documento: number | null;
  nombre_archivo: string | null;
  fecha_subida: string | null;
};

// Tipo para el Log que viene del backend
type LogRow = {
  fecha: string;
  ip_origen: string;
  resultado: string;
  razon: string;
};

type GroupedUser = {
  userInfo: {
    id: number;
    nombre: string;
    apellido: string;
    correo: string;
    estado: string;
  };
  documents: {
    id_anexo: number | null;
    id_documento: number | null;
    nombre_archivo: string | null;
    fecha_subida: string | null;
  }[];
};

export default function BusquedaPage() {
  const router = useRouter();
  
  // Filtros
  const [usuarioFilter, setUsuarioFilter] = useState('');
  const [estadoFilter, setEstadoFilter] = useState<string>('');
  const [documentoFilter, setDocumentoFilter] = useState('');
  
  // Datos principales
  const [rawData, setRawData] = useState<RawRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // --- ESTADOS NUEVOS PARA EL HISTORIAL ---
  const [expandedUserId, setExpandedUserId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'docs' | 'logs'>('docs'); // Pestaña activa
  const [userLogs, setUserLogs] = useState<LogRow[]>([]); // Aquí guardamos los logs
  const [loadingLogs, setLoadingLogs] = useState(false);

  useEffect(() => {
    const t = localStorage.getItem('token');
    if (!t) router.replace('/login');
  }, [router]);

  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    if (usuarioFilter.trim()) p.set('usuario', usuarioFilter.trim());
    if (estadoFilter) p.set('estado', estadoFilter);
    if (documentoFilter.trim()) p.set('documento', documentoFilter.trim());
    return p.toString();
  }, [usuarioFilter, estadoFilter, documentoFilter]);

  const runSearch = async () => {
    setLoading(true);
    setErr(null);
    setRawData(null);
    setExpandedUserId(null); // Reseteamos expansión al buscar de nuevo

    try {
      const token = localStorage.getItem('token') || '';
      const url = `http://localhost:3004/api/search/busqueda${queryString ? `?${queryString}` : ''}`;
      
      const res = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : '',
        },
      });

      if (res.status === 404) {
        setRawData([]);
        setLoading(false);
        return;
      }
      if (!res.ok) {
        throw new Error(`Error ${res.status}`);
      }

      const json: RawRow[] = await res.json();
      setRawData(json);
    } catch (e: any) {
      setErr(e?.message || 'Error al buscar');
    } finally {
      setLoading(false);
    }
  };

  // --- FUNCIÓN PARA TRAER LOS LOGS DESDE EL BACKEND ---
  const fetchUserLogs = async (userId: number) => {
    setLoadingLogs(true);
    setUserLogs([]); // Limpiar anteriores
    try {
      // Llamamos al endpoint que creamos en search.js
      const res = await fetch(`http://localhost:3004/api/search/historial/${userId}`);
      if (res.ok) {
        const data = await res.json();
        setUserLogs(data);
      }
    } catch (error) {
      console.error("Error logs", error);
    } finally {
      setLoadingLogs(false);
    }
  };

  const groupedData = useMemo(() => {
    if (!rawData) return null;
    const groups: Record<number, GroupedUser> = {};

    rawData.forEach(row => {
      if (!groups[row.id_usuario]) {
        groups[row.id_usuario] = {
          userInfo: {
            id: row.id_usuario,
            nombre: row.nombre,
            apellido: row.apellido,
            correo: row.correo,
            estado: row.estado
          },
          documents: []
        };
      }
      if (row.id_documento) {
        groups[row.id_usuario].documents.push({
          id_anexo: row.id_anexo,
          id_documento: row.id_documento,
          nombre_archivo: row.nombre_archivo,
          fecha_subida: row.fecha_subida
        });
      }
    });
    return Object.values(groups);
  }, [rawData]);

  const onKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') runSearch();
  };

  // Manejador para abrir/cerrar usuario
  const toggleUser = (userId: number) => {
    if (expandedUserId === userId) {
      setExpandedUserId(null);
    } else {
      setExpandedUserId(userId);
      setActiveTab('docs'); // Siempre abrir primero en Documentos
    }
  };

  // Manejador para cambiar de pestaña
  const handleTabChange = (userId: number, tab: 'docs' | 'logs') => {
    setActiveTab(tab);
    if (tab === 'logs') {
      fetchUserLogs(userId); // Cargar logs solo si se pide
    }
  };

  return (
    <div className="h-full flex flex-col gap-6">
      
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Auditoría y Búsqueda</h1>
              <p className="text-sm text-slate-500">Historial de accesos y documentos por usuario</p>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Usuario</label>
            <input className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition" placeholder="Nombre..." value={usuarioFilter} onChange={(e) => setUsuarioFilter(e.target.value)} onKeyDown={onKeyPress} />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Estado</label>
            <select className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none transition" value={estadoFilter} onChange={(e) => setEstadoFilter(e.target.value)}>
              <option value="">(Todos)</option>
              <option value="activo">Activo</option>
              <option value="inactivo">Inactivo</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Documento</label>
            <input className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition" placeholder="Nombre archivo..." value={documentoFilter} onChange={(e) => setDocumentoFilter(e.target.value)} onKeyDown={onKeyPress} />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6 border-t pt-4 border-gray-100">
          <button onClick={() => { setUsuarioFilter(''); setEstadoFilter(''); setDocumentoFilter(''); setRawData(null); setErr(null); }} className="px-5 py-2 rounded-lg text-gray-600 hover:bg-gray-100 font-medium text-sm transition">Limpiar</button>
          <button onClick={runSearch} disabled={loading} className="px-6 py-2 rounded-lg bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 shadow-md transition flex items-center gap-2 disabled:opacity-50">
            {loading ? 'Buscando...' : 'Buscar'}
          </button>
        </div>
      </div>
      
      {err && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg">
           <p className="text-red-700 font-bold text-sm">Error</p>
           <p className="text-red-600 text-xs mt-1">{err}</p>
        </div>
      )}

      {!loading && groupedData && (
        <div className="space-y-4 pb-8">
           <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider ml-1">Resultados ({groupedData.length})</h3>

           {groupedData.length === 0 ? (
             <div className="bg-white p-12 text-center rounded-xl border border-gray-200 text-gray-400">Sin resultados.</div>
           ) : (
             groupedData.map((user) => {
               const isExpanded = expandedUserId === user.userInfo.id;
               
               return (
                 <div key={user.userInfo.id} className={`bg-white rounded-xl border transition-all duration-300 overflow-hidden ${isExpanded ? 'border-blue-500 shadow-md ring-1 ring-blue-500' : 'border-gray-200 hover:border-blue-300'}`}>
                    
                    {/* CABECERA USUARIO */}
                    <div onClick={() => toggleUser(user.userInfo.id)} className={`p-4 cursor-pointer flex justify-between items-center ${isExpanded ? 'bg-blue-50' : 'bg-white hover:bg-gray-50'}`}>
                        <div className="flex items-center gap-4">
                           <div className={`h-10 w-10 shrink-0 rounded-full flex items-center justify-center font-bold text-sm ${isExpanded ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                              {user.userInfo.nombre.charAt(0)}
                           </div>
                           <div>
                              <h4 className={`font-bold text-sm ${isExpanded ? 'text-blue-900' : 'text-slate-800'}`}>{user.userInfo.nombre} {user.userInfo.apellido}</h4>
                              <p className="text-xs text-slate-500">{user.userInfo.correo}</p>
                           </div>
                        </div>
                        <div className="flex items-center gap-4">
                           <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${user.userInfo.estado === 'activo' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{user.userInfo.estado}</span>
                           <svg className={`w-5 h-5 text-slate-400 transition-transform ${isExpanded ? 'rotate-180 text-blue-600' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </div>
                    </div>

                    {/* DETALLES EXPANDIBLES */}
                    {isExpanded && (
                      <div className="border-t border-blue-100 bg-white">
                         
                         {/* BARRA DE PESTAÑAS (TABS) */}
                         <div className="flex border-b border-gray-200">
                            <button 
                              onClick={() => handleTabChange(user.userInfo.id, 'docs')}
                              className={`flex-1 py-3 text-sm font-bold transition-colors border-b-2 
                                ${activeTab === 'docs' ? 'border-blue-600 text-blue-600 bg-blue-50/50' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
                            >
                               📄 Documentos ({user.documents.length})
                            </button>
                            <button 
                              onClick={() => handleTabChange(user.userInfo.id, 'logs')}
                              className={`flex-1 py-3 text-sm font-bold transition-colors border-b-2 
                                ${activeTab === 'logs' ? 'border-blue-600 text-blue-600 bg-blue-50/50' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
                            >
                               🕒 Historial de Accesos
                            </button>
                         </div>

                         {/* CONTENIDO PESTAÑA: DOCUMENTOS */}
                         {activeTab === 'docs' && (
                            <div className="p-4 animate-in fade-in slide-in-from-left-2 duration-200">
                               {user.documents.length > 0 ? (
                                 <table className="w-full text-sm text-left">
                                   <thead className="bg-slate-50 text-slate-500 font-medium">
                                     <tr>
                                       <th className="px-4 py-2">ID</th>
                                       <th className="px-4 py-2">Archivo</th>
                                       <th className="px-4 py-2">Fecha</th>
                                       <th className="px-4 py-2 text-right">Acción</th>
                                     </tr>
                                   </thead>
                                   <tbody className="divide-y divide-slate-100">
                                     {user.documents.map((doc, idx) => (
                                       <tr key={idx} className="hover:bg-slate-50">
                                         <td className="px-4 py-2 font-mono text-xs">#{doc.id_anexo}</td>
                                         <td className="px-4 py-2 font-medium">{doc.nombre_archivo}</td>
                                         <td className="px-4 py-2 text-slate-500 text-xs">{doc.fecha_subida ? new Date(doc.fecha_subida).toLocaleDateString() : '-'}</td>
                                         <td className="px-4 py-2 text-right"><span className="text-blue-600 text-xs cursor-pointer hover:underline font-bold">Ver</span></td>
                                       </tr>
                                     ))}
                                   </tbody>
                                 </table>
                               ) : (
                                 <div className="p-8 text-center text-gray-400 italic">No hay documentos registrados.</div>
                               )}
                            </div>
                         )}

                         {/* CONTENIDO PESTAÑA: HISTORIAL (LOGS) */}
                         {activeTab === 'logs' && (
                            <div className="p-4 animate-in fade-in slide-in-from-right-2 duration-200">
                               {loadingLogs ? (
                                 <div className="flex justify-center p-8"><div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>
                               ) : userLogs.length > 0 ? (
                                 <div className="max-h-60 overflow-y-auto rounded-lg border border-slate-200">
                                   <table className="w-full text-xs text-left">
                                     <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0">
                                       <tr>
                                         <th className="px-4 py-2">Fecha / Hora</th>
                                         <th className="px-4 py-2">Estado</th>
                                         <th className="px-4 py-2">Detalle</th>
                                         <th className="px-4 py-2">IP</th>
                                       </tr>
                                     </thead>
                                     <tbody className="divide-y divide-slate-100">
                                       {userLogs.map((log, i) => (
                                         <tr key={i} className="hover:bg-slate-50">
                                           <td className="px-4 py-2 text-slate-600 font-mono whitespace-nowrap">
                                             {new Date(log.fecha).toLocaleString()}
                                           </td>
                                           <td className="px-4 py-2">
                                             <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                               log.resultado === 'EXITOSO' ? 'bg-green-50 text-green-700 border-green-200' : 
                                               log.resultado === 'BLOQUEADO' ? 'bg-gray-100 text-gray-700 border-gray-300' :
                                               'bg-red-50 text-red-700 border-red-200'
                                             }`}>
                                               {log.resultado}
                                             </span>
                                           </td>
                                           <td className="px-4 py-2 text-slate-700">{log.razon}</td>
                                           <td className="px-4 py-2 text-slate-400 font-mono">{log.ip_origen}</td>
                                         </tr>
                                       ))}
                                     </tbody>
                                   </table>
                                 </div>
                               ) : (
                                 <div className="p-8 text-center text-gray-400 italic">No se encontró historial de actividad reciente.</div>
                               )}
                            </div>
                         )}

                      </div>
                    )}
                 </div>
               );
             })
           )}
        </div>
      )}
    </div>
  );
}