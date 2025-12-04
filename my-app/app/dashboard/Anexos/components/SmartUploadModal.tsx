'use client';
import { useState, useEffect } from 'react';
import axios from 'axios';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  idUsuario: number | null;
  idAnexoActual?: number | null;
  onSuccess: (data?: any) => void; // Permitimos pasar datos de vuelta
}

export default function SmartUploadModal({ isOpen, onClose, idUsuario, idAnexoActual, onSuccess }: Props) {
  // Estados del Formulario
  const [tipos, setTipos] = useState<any[]>([]);
  const [selectedTipo, setSelectedTipo] = useState('');
  const [numeroDoc, setNumeroDoc] = useState('');
  const [archivo, setArchivo] = useState<File | null>(null);
  
  // --- AQUÍ ESTÁ LA VARIABLE QUE FALTABA ---
  // Estado para el checkbox "¿Firmar ahora?"
  const [firmarAhora, setFirmarAhora] = useState(true); 
  
  // Estados Visuales
  const [previewName, setPreviewName] = useState('---');
  const [loading, setLoading] = useState(false);
  const [loadingNum, setLoadingNum] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [duplicateInfo, setDuplicateInfo] = useState<string | null>(null);

  // 1. Cargar Tipos y Resetear
  useEffect(() => {
    if (isOpen) {
      // Reset de todo el formulario al abrir
      setNumeroDoc(''); setSelectedTipo(''); setArchivo(null); 
      setErrorMsg(null); setDuplicateInfo(null); setFirmarAhora(true); // Reset del check
      
      axios.get('http://localhost:3004/api/anexos/tipos')
        .then(res => setTipos(res.data))
        .catch(err => console.error(err));
    }
  }, [isOpen]);

  // 2. Autocompletar Número (Correlativo)
  useEffect(() => {
    if (selectedTipo && idUsuario && isOpen) {
        setLoadingNum(true);
        axios.get(`http://localhost:3004/api/anexos/correlativo`, {
            params: { id_usuario: idUsuario, id_tipo: selectedTipo }
        })
        .then(res => setNumeroDoc(res.data.next))
        .catch(console.error)
        .finally(() => setLoadingNum(false));
    }
  }, [selectedTipo, idUsuario, isOpen]);

  // 3. Vista Previa Nombre
  useEffect(() => {
    if (selectedTipo && numeroDoc) {
      const tipoObj = tipos.find(t => t.id_tipo == selectedTipo);
      if (tipoObj) {
        setPreviewName(`${tipoObj.siglas}_${numeroDoc}_[USUARIO].pdf`);
      }
    } else {
      setPreviewName('---');
    }
  }, [selectedTipo, numeroDoc, tipos]);

  // 4. Enviar al Backend
  const handleSubmit = async () => {
    if (!archivo || !idUsuario) return;
    setLoading(true);
    setErrorMsg(null);
    setDuplicateInfo(null);

    const formData = new FormData();
    formData.append('archivo', archivo);
    formData.append('id_usuario', String(idUsuario));
    formData.append('id_tipo', selectedTipo);
    formData.append('numero_doc', numeroDoc);
    
    if (idAnexoActual) {
        formData.append('id_anexo', String(idAnexoActual));
    }

    try {
      const res = await axios.post('http://localhost:3004/api/anexos/smart-upload', formData);
      
      // AL TERMINAR, AVISAMOS AL PADRE (GestionAnexos)
      // Le pasamos 'firmarAhora' para que él decida si abre el FirmaPeruModal
      onSuccess({
          firmarAhora: firmarAhora, // <--- Aquí enviamos la decisión del usuario
          documento: res.data.documento, 
          idAnexo: res.data.anexo,
          codigo_anexo: res.data.codigo_anexo
      });
      
      onClose();
    } catch (err: any) {
      if (err.response?.status === 409) {
        setDuplicateInfo(err.response.data.detalle + '\n' + err.response.data.ubicacion);
      } else {
        setErrorMsg("Error al subir el documento.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        
        <div className="bg-slate-900 p-4 text-white flex justify-between items-center">
          <h3 className="font-bold flex items-center gap-2">
             Registro de Documento
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">&times;</button>
        </div>

        <div className="p-6 space-y-4">
          
          {/* Alerta Duplicado */}
          {duplicateInfo && (
            <div className="bg-amber-50 border-l-4 border-amber-500 p-3 rounded text-sm text-amber-800">
              <strong>⚠ Documento Existente:</strong><br/>
              <span className="whitespace-pre-wrap">{duplicateInfo}</span>
            </div>
          )}
          
          {/* Error Genérico */}
          {errorMsg && (
             <div className="bg-red-50 text-red-600 p-3 rounded text-sm">{errorMsg}</div>
          )}

          {/* Inputs */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tipo de Documento</label>
            <select 
              className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
              value={selectedTipo}
              onChange={e => setSelectedTipo(e.target.value)}
            >
              <option value="">-- Seleccionar --</option>
              {tipos.map(t => (
                <option key={t.id_tipo} value={t.id_tipo}>{t.nombre}</option>
              ))}
            </select>
          </div>

          <div className="relative">
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1 flex justify-between">
                <span>Número / Código</span>
                {loadingNum && <span className="text-blue-500 text-[10px]">Generando...</span>}
            </label>
            <input 
              type="text" 
              className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Ej: 001-2025"
              value={numeroDoc}
              onChange={e => setNumeroDoc(e.target.value)}
            />
          </div>

          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-center">
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Nombre Final</span>
            <p className="font-mono text-sm font-bold text-blue-700 break-all mt-1">
              {previewName}
            </p>
          </div>

          <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:bg-gray-50 transition cursor-pointer relative group">
            <input 
              type="file" 
              accept=".pdf" 
              className="absolute inset-0 opacity-0 cursor-pointer"
              onChange={e => setArchivo(e.target.files ? e.target.files[0] : null)}
            />
            <div className="text-gray-500 group-hover:text-blue-500">
              {archivo ? (
                <span className="text-sm font-bold text-slate-800 flex items-center justify-center gap-2">
                   📄 {archivo.name}
                </span>
              ) : (
                <span className="text-sm">Clic para seleccionar PDF</span>
              )}
            </div>
          </div>

          {/* --- CHECKBOX: FIRMAR AHORA (Aquí está la variable) --- */}
          <div 
             className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${firmarAhora ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200'}`}
             onClick={() => setFirmarAhora(!firmarAhora)}
          >
             <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${firmarAhora ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-300'}`}>
                {firmarAhora && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                )}
             </div>
             <div>
                <span className={`text-sm font-bold ${firmarAhora ? 'text-blue-800' : 'text-gray-600'}`}>
                    Firmar Digitalmente ahora
                </span>
                <p className="text-[10px] text-slate-500">Se abrirá el firmador automáticamente al guardar.</p>
             </div>
          </div>

          <button 
            onClick={handleSubmit}
            disabled={!archivo || !selectedTipo || !numeroDoc || loading}
            className="w-full bg-slate-900 text-white py-3 rounded-lg font-bold shadow-lg hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {loading ? 'Guardando...' : (firmarAhora ? 'Guardar y Firmar' : 'Solo Guardar')}
          </button>

        </div>
      </div>
    </div>
  );
}