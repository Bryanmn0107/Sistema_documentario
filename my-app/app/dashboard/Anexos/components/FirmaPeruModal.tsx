
import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { SignatureLevel, SignatureStyle, FirmaPeruConfig } from '../../../types';
import { loadFirmaPeruScripts } from '../../../utils/scriptLoader';

// Constants for A4 Page Dimensions in Points (standard PDF unit)
const PDF_WIDTH_POINTS = 595;
const PDF_HEIGHT_POINTS = 842;

const PREDEFINED_REASONS = [
  "Soy el autor de este documento",
  "En señal de conformidad",
  "Visto Bueno",
  "Firma de Aprobación",
  "Firma de Recepción",
  "Doy fe",
  "Otro (Personalizado)"
];

// Add global augmentation for window object to include FirmaPeru methods
declare global {
  interface Window {
    signatureInit?: () => void;
    signatureOk?: () => void;
    signatureCancel?: () => void;
    startSignature?: (port: number, params: string) => void;
  }
}

interface ExtendedFirmaPeruModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentUrl: string;
  fileToSign: File | null;
  idAnexo: number;
  codigoAnexo: string;
  idUsuario: number;
  onSuccess: (data: { message: string }) => void;
  onError: (error: string) => void;
  extraParams?: {
    action: 'ALTA_DOCUMENTO' | 'CIERRE_EXPEDIENTE';
    filename: string;
  };
}

const FirmaPeruModal: React.FC<ExtendedFirmaPeruModalProps> = ({
  isOpen,
  onClose,
  documentUrl,
  fileToSign, 
  idAnexo,
  codigoAnexo,
  idUsuario,
  onSuccess,
  onError,
  extraParams 
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isSigning, setIsSigning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  // NUEVO: Control de modo para permitir Scroll
  const [interactionMode, setInteractionMode] = useState<'NAVIGATE' | 'SIGN'>('SIGN');

  const [previewSrc, setPreviewSrc] = useState<string>("");

  useEffect(() => {
     if (fileToSign) {
        const url = URL.createObjectURL(fileToSign);
        setPreviewSrc(url);
        return () => URL.revokeObjectURL(url);
     } else if (documentUrl) {
        setPreviewSrc(documentUrl);
     }
  }, [fileToSign, documentUrl]);


  const [config, setConfig] = useState<FirmaPeruConfig>({
    signatureFormat: "PAdES",
    signatureLevel: SignatureLevel.B, 
    signatureStyle: SignatureStyle.HORIZONTAL,
    positionX: 200,
    positionY: 150,
    pageNumber: 1,
    reason: "Soy el autor de este documento",
    role: "",
    visiblePosition: true,
  });

  const [selectedReason, setSelectedReason] = useState(PREDEFINED_REASONS[0]);
  const [customReason, setCustomReason] = useState("");

  const previewRef = useRef<HTMLDivElement>(null);

  const addLog = (msg: string) => setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);

  // Load Scripts
  useEffect(() => {
    if (isOpen) {
      addLog("Iniciando carga de scripts...");
      
      window.signatureInit = () => {
        addLog("PROCESO INICIADO (signatureInit invocado)");
        setIsSigning(true);
      };

      window.signatureOk = () => {
        addLog("DOCUMENTO FIRMADO (signatureOk invocado)");
        setIsSigning(false);
        onSuccess({ message: "Firma realizada con éxito" });
        setTimeout(onClose, 2000);
      };

      window.signatureCancel = () => {
        addLog("OPERACIÓN CANCELADA (signatureCancel invocado)");
        setIsSigning(false);
      };

      loadFirmaPeruScripts()
        .then(() => {
          addLog("Scripts de Firma Perú cargados correctamente.");
          setIsLoading(false);
        })
        .catch((err) => {
          addLog(`Error cargando scripts: ${err}`);
          onError("No se pudieron cargar los componentes de Firma Perú. Verifique su conexión.");
        });
    }

    return () => {
      delete window.signatureInit;
      delete window.signatureOk;
      delete window.signatureCancel;
    };
  }, [isOpen, onSuccess, onError, onClose]);

  useEffect(() => {
    if (selectedReason === "Otro (Personalizado)") {
      setConfig(prev => ({ ...prev, reason: customReason }));
    } else {
      setConfig(prev => ({ ...prev, reason: selectedReason }));
    }
  }, [selectedReason, customReason]);

  // Drag Logic
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !previewRef.current || interactionMode !== 'SIGN') return;
      e.preventDefault();

      const rect = previewRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const scaleX = PDF_WIDTH_POINTS / rect.width;
      const scaleY = PDF_HEIGHT_POINTS / rect.height;

      let pdfX = Math.round(x * scaleX);
      let pdfY = Math.round(y * scaleY);

      pdfX = Math.max(0, Math.min(pdfX, PDF_WIDTH_POINTS));
      pdfY = Math.max(0, Math.min(pdfY, PDF_HEIGHT_POINTS));

      setConfig(prev => ({ ...prev, positionX: pdfX, positionY: pdfY }));
    };

    const handleMouseUp = () => {
      if (isDragging) setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, interactionMode]);

  const handlePreviewClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!previewRef.current || !config.visiblePosition || isDragging || interactionMode !== 'SIGN') return;

    const rect = previewRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const scaleX = PDF_WIDTH_POINTS / rect.width;
    const scaleY = PDF_HEIGHT_POINTS / rect.height;

    const pdfX = Math.round(x * scaleX);
    const pdfY = Math.round(y * scaleY);

    setConfig(prev => ({ ...prev, positionX: pdfX, positionY: pdfY }));
  }, [config.visiblePosition, isDragging, interactionMode]);

  const handleSign = async () => {
    if (!window.startSignature) {
      addLog("Error CRÍTICO: Función startSignature no encontrada.");
      return;
    }

    if (!config.role.trim()) {
      alert("Por favor ingrese su Cargo / Rol antes de firmar.");
      return;
    }

    if (!documentUrl) {
        alert("Error: No se ha proporcionado un documento válido para firmar.");
        return;
    }

    setIsSigning(true);

    try {
      const finalDocumentUrl = documentUrl;
      
      addLog(`Documento vinculado: ${finalDocumentUrl}`);
      addLog("Conectando con servidor de firmas...");

      const payload = {
        idAnexo: idAnexo,
        idUsuario: idUsuario,
        role: config.role,
        reason: config.reason,
        pageNumber: config.pageNumber,
        positionX: config.positionX,
        positionY: config.positionY,
        style: config.signatureStyle,
        level: config.signatureLevel, 
        documentUrl: finalDocumentUrl,
        action: extraParams?.action,
        filename: extraParams?.filename
      };

      const response = await axios.post('http://localhost:3004/api/firmas/iniciar', payload);
      
      if (!response.data.success) {
        throw new Error(response.data.message || "Error iniciando firma en servidor");
      }

      const { token, paramUrl } = response.data;
      addLog(`Sesión iniciada. Token: ${token}`);

      // ================== INICIO BLOQUE DEMO (BORRAR EN PRODUCCIÓN) ==================
      if (token.includes("TOKEN_DE_PRUEBA")) {
         addLog("⚠️ MODO DEMO DETECTADO: Simulando proceso...");
         
         // Simulación visual
         setTimeout(() => addLog("Conectando con ReFirma (Simulado)..."), 1000);
         setTimeout(() => addLog("Solicitando PIN de seguridad..."), 2000);
         setTimeout(() => addLog("Generando estampa PAdES..."), 3000);
         
         setTimeout(async () => {
             try {
                 addLog("Enviando confirmación al backend...");
                 const simRes = await axios.post('http://localhost:3004/api/firmas/simular-firma', { token });
                 
                 if (simRes.data.success) {
                     addLog("✅ Firma simulada exitosamente.");
                     onSuccess({ message: "Documento firmado correctamente (Modo Demo)" });
                     setIsSigning(false); // <--- FIX CRÍTICO: Desbloquea el botón
                     setTimeout(onClose, 1500);
                 } else {
                     throw new Error(simRes.data.message);
                 }
             } catch(err) {
                 onError("Error en simulación: " + err);
                 setIsSigning(false);
             }
         }, 4500);

         return; // Detenemos ejecución real
      }
      // ================== FIN BLOQUE DEMO ==================

      const paramLocal = {
        "param_url": paramUrl, 
        "param_token": token, 
        "document_extension": "pdf"
      };
      
      const paramBase64 = btoa(JSON.stringify(paramLocal));
      const port = 48596; 

      addLog(`Abriendo ReFirma en puerto ${port}...`);
      window.startSignature(port, paramBase64);

    } catch (e) {
      console.error(e);
      addLog(`Error: ${e instanceof Error ? e.message : String(e)}`);
      setIsSigning(false);
      onError("No se pudo iniciar el proceso de firma.");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto flex flex-col">
        
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b">
          <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <span className="bg-red-600 text-white p-1 rounded">FP</span>
            Firma Digital (PAdES)
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex-1 p-6 grid md:grid-cols-2 gap-8">
          
          {/* Left Config */}
          <div className="space-y-5">
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cargo / Rol</label>
              <input
                type="text"
                value={config.role}
                onChange={(e) => setConfig(prev => ({...prev, role: e.target.value}))}
                placeholder="Ej. Gerente General"
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Motivo</label>
              <select
                value={selectedReason}
                onChange={(e) => setSelectedReason(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none bg-white"
              >
                {PREDEFINED_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nivel</label>
                <select
                  value={config.signatureLevel}
                  onChange={(e) => setConfig(prev => ({...prev, signatureLevel: e.target.value as SignatureLevel}))}
                  className="w-full p-2 border border-gray-300 rounded-lg bg-white"
                >
                  <option value={SignatureLevel.B}>Básica (B)</option>
                  <option value={SignatureLevel.T}>Con Sello (T)</option>
                  <option value={SignatureLevel.LTA}>Longeva (LTA)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Estilo</label>
                <select
                  value={config.signatureStyle}
                  onChange={(e) => setConfig(prev => ({...prev, signatureStyle: parseInt(e.target.value)}))}
                  className="w-full p-2 border border-gray-300 rounded-lg bg-white"
                >
                  <option value={SignatureStyle.HORIZONTAL}>Horizontal</option>
                  <option value={SignatureStyle.VERTICAL}>Vertical</option>
                </select>
              </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Página</label>
                <input
                  type="number"
                  min={1}
                  value={config.pageNumber}
                  onChange={(e) => setConfig(prev => ({...prev, pageNumber: parseInt(e.target.value) || 1}))}
                  className="w-full p-2 border border-gray-300 rounded-lg"
                />
            </div>

            <div className="bg-gray-900 rounded-lg p-4 h-32 overflow-y-auto font-mono text-xs text-green-400 shadow-inner">
              {logs.map((log, i) => <div key={i}>{log}</div>)}
            </div>

          </div>

          {/* Right Preview */}
          <div className="flex flex-col">
            <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-gray-700">Vista Previa</label>
                
                {/* TOGGLE NAVIGATE / SIGN */}
                <div className="flex bg-gray-100 rounded-lg p-1">
                    <button
                        onClick={() => setInteractionMode('NAVIGATE')}
                        className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${interactionMode === 'NAVIGATE' ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        ✋ Navegar
                    </button>
                    <button
                        onClick={() => setInteractionMode('SIGN')}
                        className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${interactionMode === 'SIGN' ? 'bg-red-100 text-red-700 shadow' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        ✒️ Firmar
                    </button>
                </div>
            </div>
            
            <div 
              className="relative border-2 border-gray-300 bg-gray-100 rounded-lg shadow-inner flex-1 min-h-[400px] overflow-hidden"
              ref={previewRef}
            >
               {/* PDF Viewer Background */}
               {previewSrc ? (
                 <iframe 
                    src={`${previewSrc}#view=FitH`} 
                    className={`absolute inset-0 w-full h-full z-0 ${interactionMode === 'SIGN' ? 'pointer-events-none opacity-80' : 'pointer-events-auto opacity-100'}`}
                    title="Vista Previa PDF"
                 />
               ) : (
                 <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="text-gray-400">Cargando documento...</span>
                 </div>
               )}

               {/* Overlay for Interaction (Only active in SIGN mode) */}
               {interactionMode === 'SIGN' && (
                 <div 
                   className="absolute inset-0 z-10 cursor-crosshair"
                   onClick={handlePreviewClick}
                 />
               )}

               {/* Signature Stamp (Only visible in SIGN mode) */}
               {interactionMode === 'SIGN' && (
                   <div
                     onMouseDown={(e) => { e.stopPropagation(); setIsDragging(true); }}
                     style={{
                       left: `${(config.positionX / PDF_WIDTH_POINTS) * 100}%`,
                       top: `${(config.positionY / PDF_HEIGHT_POINTS) * 100}%`,
                       width: '140px', 
                       height: '60px',
                       transform: 'translate(-50%, -50%)',
                       zIndex: 20
                     }}
                     className={`absolute border-2 border-dashed flex items-center justify-center text-xs text-center select-none cursor-move shadow-lg backdrop-blur-sm bg-white/80
                       ${isDragging ? 'border-red-600 text-red-800 ring-2 ring-red-300' : 'border-blue-500 text-blue-800 hover:bg-blue-50'}
                     `}
                   >
                      <div className="pointer-events-none px-1">
                        <strong>Firma</strong><br/>
                        {config.role || "Cargo"}
                      </div>
                   </div>
               )}
            </div>
            <div className="mt-2 text-right text-xs text-gray-500 font-mono">
               {interactionMode === 'SIGN' ? `X: ${config.positionX} | Y: ${config.positionY}` : "Modo Navegación Activo"}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-6 border-t bg-gray-50 rounded-b-xl flex justify-end gap-4">
          <button onClick={onClose} disabled={isSigning} className="px-6 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-white">
            Cancelar
          </button>
          <button
            onClick={handleSign}
            disabled={isSigning || isLoading}
            className={`px-8 py-2 rounded-lg font-bold text-white shadow-lg transition flex items-center gap-2
              ${isSigning ? 'bg-gray-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700'}
            `}
          >
            {isSigning ? 'Procesando...' : 'Firmar Documento'}
          </button>
        </div>

      </div>
    </div>
  );
};

export default FirmaPeruModal;
