"use client";
import React, { useState, useEffect } from "react";
import axios from "axios";
import { jwtDecode } from "jwt-decode";
import FileSaver from 'file-saver';
import FirmaPeruModal from './components/FirmaPeruModal';
import SmartUploadModal from "./components/SmartUploadModal";

// --- TIPOS ---
interface Anexo {
  id_anexo: number;
  codigo_anexo: string;
  descripcion: string;
  estado: string; // 'pendiente' | 'unificado' | 'aprobado'
  ruta_pdf: string | null;
}

interface Documento {
  id_documento: number;
  nombre_archivo: string;
  ruta_archivo: string;
  fecha_subida: string;
  estado_firma?: string;
}

const GestionAnexos = () => {
  // --- ESTADOS DE DATOS ---
  const [codigoAnexo, setCodigoAnexo] = useState("");
  const [anexoEncontrado, setAnexoEncontrado] = useState<Anexo | null>(null);
  const [documentosOriginales, setDocumentosOriginales] = useState<Documento[]>([]);
  const [idUsuario, setIdUsuario] = useState<number | null>(null);

  // --- ESTADOS DE INTERFAZ ---
  const [mensajeError, setMensajeError] = useState("");
  const [mensajeExito, setMensajeExito] = useState("");
  const [isUnifying, setIsUnifying] = useState(false);
  const [activeTab, setActiveTab] = useState<'antecedentes' | 'final'>('antecedentes');
  
  // --- MODALES ---
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false); 

  // Configuración de Firma (Dinámica para usarse en ambos casos)
  const [signatureConfig, setSignatureConfig] = useState({
    documentUrl: "",
    file: null as File | null,
    action: 'CIERRE_EXPEDIENTE' as 'ALTA_DOCUMENTO' | 'CIERRE_EXPEDIENTE'
  });

  // --- EFECTOS ---
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      try {
        const decoded: any = jwtDecode(token);
        setIdUsuario(decoded.id || decoded.id_usuario);
      } catch (e) { console.error(e); }
    }
  }, []);

  // --- FUNCIONES DE BÚSQUEDA ---
  const buscarAnexo = async (codigoForzado?: string) => {
    const codigoABuscar = codigoForzado || codigoAnexo || anexoEncontrado?.codigo_anexo;
    
    if (!codigoABuscar) return;

    setMensajeError("");
    setMensajeExito("");
    setDocumentosOriginales([]);
    
    try {
      // 1. Obtener datos del Anexo
      const resAnexo = await axios.get(`http://localhost:3004/api/anexos/anexos/${codigoABuscar}`);
      const anexoData = resAnexo.data;
      
      if (anexoData.ruta_pdf) anexoData.ruta_pdf = anexoData.ruta_pdf.trim();

      setAnexoEncontrado(anexoData);
      setCodigoAnexo(anexoData.codigo_anexo); // Sincronizar input

      // Lógica de pestañas
      if (anexoData.estado === 'aprobado') {
        setActiveTab('final');
      } else {
        setActiveTab('antecedentes');
      }

      // 2. Obtener documentos adjuntos
      try {
        const resDocs = await axios.get(`http://localhost:3004/api/anexos/anexos/${anexoData.id_anexo}/documentos`);
        setDocumentosOriginales(resDocs.data);
      } catch (docError) {
        console.warn("Sin documentos previos.");
      }
    } catch (error) {
      setMensajeError("No se encontró el anexo. Verifique el código.");
      setAnexoEncontrado(null);
    }
  };

  // --- UTILIDADES ---
  const getFullUrl = (ruta: string) => {
    if (!ruta) return "";
    const cleanRuta = ruta.trim();
    if (cleanRuta.startsWith("http")) return cleanRuta;
    return `http://localhost:3004${cleanRuta.startsWith('/') ? '' : '/'}${cleanRuta}`;
  };

  const abrirDocumento = (ruta: string) => {
    window.open(getFullUrl(ruta), '_blank');
  };


  // 1. HANDLER PARA FIRMA INDIVIDUAL (Botón en la tarjeta del documento)
  const handleFirmarIndividual = (doc: Documento) => {
      setSignatureConfig({
          documentUrl: getFullUrl(doc.ruta_archivo), 
          file: null, // Es remoto
          action: 'ALTA_DOCUMENTO' 
      });
      setShowSignatureModal(true);
  };

  // 2. HANDLER PARA EL CIERRE DE EXPEDIENTE (Botón "Unificar y Firmar")
  const handleUnificarYFirmar = async () => {
    if (!anexoEncontrado || !idUsuario) return;
    if (documentosOriginales.length === 0) return setMensajeError("No hay documentos para unificar.");

    setIsUnifying(true);
    setMensajeError("");
    
    try {
      const ids = documentosOriginales.map(doc => doc.id_documento);
      const formData = new FormData();
      formData.append('idsDocumentos', JSON.stringify(ids));
      formData.append('tituloExpediente', `Expediente Unificado ${codigoAnexo}`);

      const res = await axios.post('http://localhost:3004/api/anexos/unificar', formData);

      if (res.data.success) {
        const cleanUrl = res.data.documentUrl.trim();
        setSignatureConfig({
            documentUrl: getFullUrl(cleanUrl),
            file: null,
            action: 'CIERRE_EXPEDIENTE'
        });
        
        setAnexoEncontrado({ ...anexoEncontrado, ruta_pdf: cleanUrl });
        setActiveTab('final'); 
        setShowSignatureModal(true);
      }
    } catch (error: any) {
      setMensajeError("Error al unificar: " + (error.response?.data?.message || error.message));
    } finally {
      setIsUnifying(false);
    }
  };

  // 3. HANDLER PARA LA SUBIDA INTELIGENTE (Callback del Modal)
  const handleUploadSuccess = (data: any) => {
      // A. Mensaje
      if (data?.codigo_anexo) {
          setMensajeExito(`✅ Documento subido exitosamente en el expediente: ${data.codigo_anexo}`);
      } else {
          setMensajeExito("Documento registrado correctamente.");
      }
      
      // B. Refresco / Redirección
      if (data?.codigo_anexo) {
          buscarAnexo(data.codigo_anexo); // Forzar búsqueda del nuevo
      } else {
          buscarAnexo(); // Refresco normal del actual
      }

      // C. Firma Inmediata (Opcional desde el modal de subida)
      if (data?.firmarAhora && data?.documento) {
          setSignatureConfig({
            documentUrl: getFullUrl(data.documento.url),
            file: null, 
            action: 'ALTA_DOCUMENTO'
          });
          setShowSignatureModal(true); 
      }
  };

  // --- DESCARGAS ---
  const handleDescargaDirecta = async () => {
    if (!anexoEncontrado?.id_anexo) return;
    try {
      const url = `http://localhost:3004/api/anexos/anexos/${anexoEncontrado.id_anexo}/descargar`;
      const response = await axios.get(url, { responseType: 'blob' });
      FileSaver.saveAs(response.data, `Expediente_${codigoAnexo}.pdf`);
    } catch (e) {
      setMensajeError("Error al descargar el archivo.");
    }
  };

  const handleVerEnNuevaPestana = () => {
    if (!anexoEncontrado?.id_anexo) return;
    const url = `http://localhost:3004/api/anexos/anexos/${anexoEncontrado.id_anexo}/descargar`;
    window.open(url, '_blank');
  };


  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans text-slate-800">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* HEADER BÚSQUEDA + BOTÓN SUBIDA */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4 items-end justify-between">
          <div className="flex-1 w-full">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Código de Expediente</label>
            <div className="relative">
              <input
                type="text"
                value={codigoAnexo}
                onChange={(e) => setCodigoAnexo(e.target.value)}
                className="w-full pl-4 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-600 outline-none font-medium text-slate-700 transition-all"
                placeholder="Ej. EXP-2025-001"
                onKeyDown={(e) => e.key === 'Enter' && buscarAnexo()}
              />
              <svg className="w-5 h-5 text-slate-400 absolute right-4 top-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>
          </div>
          
          <button onClick={() => buscarAnexo()} className="w-full md:w-auto bg-slate-900 hover:bg-slate-800 text-white px-8 py-3.5 rounded-xl font-bold shadow-lg transition-transform active:scale-95">
            Buscar
          </button>

          {/* BOTÓN DE ACCIÓN PRINCIPAL */}
          <div className="w-full md:w-auto ml-auto">
             <button 
                onClick={() => setIsUploadModalOpen(true)}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-3.5 rounded-xl font-bold shadow-lg shadow-blue-200 transition-transform active:scale-95 flex items-center justify-center gap-2"
             >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                {anexoEncontrado ? "Agregar Documento" : "Subir / Nuevo Expediente"}
             </button>
          </div>
        </div>

        {/* MENSAJES */}
        {mensajeError && (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100 flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <span className="font-medium">{mensajeError}</span>
          </div>
        )}
        {mensajeExito && (
          <div className="bg-green-50 text-green-600 p-4 rounded-xl border border-green-100 flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            <span className="font-medium">{mensajeExito}</span>
          </div>
        )}

        {/* CONTENIDO PRINCIPAL */}
        {!anexoEncontrado ? (
           // ESTADO VACÍO
           <div className="text-center py-24 bg-white rounded-3xl border-2 border-dashed border-slate-200">
             <div className="w-16 h-16 bg-blue-50 text-blue-400 rounded-full flex items-center justify-center mx-auto mb-4">
               <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
             </div>
             <h3 className="text-lg font-bold text-slate-700">Gestión de Expedientes</h3>
             <p className="text-slate-500 max-w-md mx-auto mt-2">
               Busque un expediente existente por su código o haga clic en el botón superior 
               <strong className="text-blue-600"> "Nuevo Expediente"</strong> para crear uno nuevo automáticamente.
             </p>
           </div>
        ) : (
          <div className="space-y-6 animate-in fade-in duration-300">
            
            {/* TABS */}
            <div className="flex border-b border-slate-200 bg-white px-6 pt-4 rounded-t-2xl shadow-sm">
              <button 
                onClick={() => setActiveTab('antecedentes')}
                className={`pb-4 px-4 font-bold text-sm border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'antecedentes' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              >
                <span>📂</span> Antecedentes ({documentosOriginales.length})
              </button>
              <button 
                onClick={() => setActiveTab('final')}
                className={`pb-4 px-4 font-bold text-sm border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'final' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              >
                <span>📑</span> Expediente Final 
                {anexoEncontrado.estado === 'aprobado' && <span className="ml-2 text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full uppercase tracking-wider">Cerrado</span>}
              </button>
            </div>

            {/* TAB 1: ANTECEDENTES */}
            {activeTab === 'antecedentes' && (
              <div className="bg-white p-6 rounded-b-2xl shadow-sm border border-slate-200 border-t-0 mt-[-1px]">
                
                <div className="flex gap-4 overflow-x-auto pb-4 pt-2 snap-x scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                  
                  {/* CARD: AGREGAR NUEVO */}
                  {anexoEncontrado.estado !== 'aprobado' && (
                    <div 
                      onClick={() => setIsUploadModalOpen(true)}
                      className="flex-none w-48 h-64 border-2 border-dashed border-indigo-200 bg-indigo-50/50 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-indigo-50 hover:border-indigo-400 transition-all snap-start group"
                    >
                      <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-sm mb-4 group-hover:scale-110 transition-transform text-indigo-600">
                          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                      </div>
                      <span className="text-sm font-bold text-indigo-800">Agregar Documento</span>
                      <span className="text-[10px] text-indigo-500 mt-1 px-4 text-center">Registro Inteligente</span>
                    </div>
                  )}

                  {/* LISTA DE DOCUMENTOS */}
                  {documentosOriginales.map((doc) => (
                    <div 
                      key={doc.id_documento} 
                      className="flex-none w-48 h-64 bg-white border border-slate-200 hover:border-indigo-300 rounded-xl shadow-sm hover:shadow-md transition-all flex flex-col overflow-hidden snap-start group relative"
                    >
                      {/* HEADER ESTADO */}
                      {doc.estado_firma === 'FIRMADO' ? (
                        <div className="bg-green-50 px-3 py-1.5 border-b border-green-100 flex justify-between items-center text-[10px] font-bold text-green-700 tracking-wider">
                           FIRMADO <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"/></svg>
                        </div>
                      ) : (
                        <div className="bg-amber-50 px-3 py-1.5 border-b border-amber-100 flex justify-between items-center text-[10px] font-bold text-amber-700 tracking-wider">
                           PENDIENTE <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></div>
                        </div>
                      )}
                      
                      {/* CUERPO + OVERLAY */}
                      <div className="flex-1 flex items-center justify-center bg-slate-50 relative group-hover:bg-slate-100 transition-colors">
                          <svg className="w-16 h-16 text-slate-300 group-hover:text-slate-400 transition-colors" fill="currentColor" viewBox="0 0 20 20"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>
                          
                          <div className="absolute inset-0 bg-white/95 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-2 transition-opacity duration-200 p-3">
                             <button 
                                onClick={() => abrirDocumento(doc.ruta_archivo)}
                                className="w-full bg-slate-100 text-slate-700 px-3 py-1.5 rounded text-xs font-bold hover:bg-slate-200 transition"
                             >
                                Ver
                             </button>
                             {/* AQUÍ ESTÁ EL BOTÓN QUE PEDISTE */}
                             {doc.estado_firma !== 'FIRMADO' && (
                                <button 
                                   onClick={() => handleFirmarIndividual(doc)}
                                   className="w-full bg-red-600 text-white px-3 py-1.5 rounded text-xs font-bold hover:bg-red-700 transition shadow"
                                >
                                   Firmar
                                </button>
                             )}
                          </div>
                      </div>

                      <div className="p-4 border-t border-slate-100 bg-white">
                          <p className="text-xs font-bold text-slate-700 line-clamp-2 leading-snug mb-2" title={doc.nombre_archivo}>{doc.nombre_archivo}</p>
                          <p className="text-[10px] text-slate-400">Subido: {new Date(doc.fecha_subida).toLocaleDateString()}</p>
                      </div>
                    </div>
                  ))}

                  {documentosOriginales.length === 0 && anexoEncontrado.estado !== 'aprobado' && (
                    <div className="flex-none w-64 h-64 flex flex-col items-center justify-center text-slate-400 p-4 text-center border border-dashed rounded-xl">
                      <p className="text-sm">No hay documentos aún.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: EXPEDIENTE FINAL (Igual que antes) */}
            {activeTab === 'final' && (
              <div className="bg-white p-6 rounded-b-2xl rounded-tr-2xl shadow-sm border border-slate-200 border-t-0 mt-[-1px] flex flex-col lg:flex-row gap-8 min-h-[500px]">
                 <div className="flex-1 bg-slate-900 rounded-xl shadow-inner overflow-hidden flex flex-col relative border border-slate-800">
                    <div className="bg-slate-800 px-4 py-3 flex justify-between items-center border-b border-slate-700">
                       <span className="text-xs font-bold text-slate-300 uppercase">Vista Previa</span>
                       {anexoEncontrado.ruta_pdf && (
                          <button onClick={handleDescargaDirecta} className="text-xs text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1">
                             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg> Descargar
                          </button>
                       )}
                    </div>
                    <div className="flex-1 relative bg-slate-800">
                       {anexoEncontrado.ruta_pdf ? (
                          <iframe src={`${getFullUrl(anexoEncontrado.ruta_pdf)}?t=${Date.now()}#toolbar=0`} className="absolute inset-0 w-full h-full bg-white" title="Visor PDF" />
                       ) : (
                          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 gap-4">
                             <p className="text-sm font-medium">El Expediente Final aún no ha sido generado.</p>
                          </div>
                       )}
                    </div>
                 </div>
                 <div className="w-full lg:w-80 flex flex-col gap-4">
                    <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 flex-1 flex flex-col justify-center text-center">
                       {anexoEncontrado.estado === 'aprobado' ? (
                          <>
                             <div className="mx-auto bg-green-100 text-green-600 w-12 h-12 rounded-full flex items-center justify-center mb-3">✓</div>
                             <h4 className="font-bold text-slate-800">Expediente Cerrado</h4>
                             <button onClick={handleDescargaDirecta} className="w-full py-3 bg-indigo-600 text-white rounded-lg font-bold shadow mt-4">Descargar Oficial</button>
                          </>
                       ) : (
                          <>
                             <h4 className="font-bold text-slate-800 mb-2">Acciones de Cierre</h4>
                             <button 
                                onClick={handleUnificarYFirmar}
                                disabled={isUnifying || documentosOriginales.length === 0}
                                className="w-full py-3 bg-indigo-600 text-white rounded-lg font-bold shadow hover:bg-indigo-700 disabled:opacity-50 transition"
                             >
                                {isUnifying ? "Procesando..." : "Unificar y Firmar"}
                             </button>
                          </>
                       )}
                    </div>
                 </div>
              </div>
            )}

          </div>
        )}
      </div>

      {/* --- MODAL INTELIGENTE --- */}
      <SmartUploadModal 
         isOpen={isUploadModalOpen}
         onClose={() => setIsUploadModalOpen(false)}
         idUsuario={idUsuario}
         idAnexoActual={anexoEncontrado?.id_anexo} 
         onSuccess={handleUploadSuccess} // <-- AQUÍ SE LLAMA
      />

      {/* --- MODAL DE FIRMA --- */}
      <FirmaPeruModal 
        isOpen={showSignatureModal}
        onClose={() => setShowSignatureModal(false)}
        documentUrl={signatureConfig.documentUrl}
        fileToSign={signatureConfig.file}
        idAnexo={anexoEncontrado?.id_anexo || 0}
        codigoAnexo={codigoAnexo}
        idUsuario={idUsuario || 0}
        extraParams={{
            action: signatureConfig.action,
            filename: 'Documento.pdf'
        }}
        onSuccess={() => {
          setMensajeExito("Operación de firma completada.");
          setShowSignatureModal(false);
          buscarAnexo(); 
        }}
        onError={(err) => setMensajeError(err)}
      />
    </div>
  );
};

export default GestionAnexos;