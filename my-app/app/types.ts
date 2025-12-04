
// Enums based on Documentation Page 9-11

export enum SignatureLevel {
  B = "B", // Basic - Firma básica
  T = "T", // Time Stamp - Firma con sello de tiempo
  LTA = "LTA" // Long Term Archival - Firma longeva
}

export enum SignatureStyle {
  INVISIBLE = 0,
  HORIZONTAL = 1, // Stamp and description horizontal (Standard)
  VERTICAL = 2,   // Stamp and description vertical
  STAMP_ONLY = 3, // Only the image/logo
  DESCRIPTION_ONLY = 4 // Only the text
}

export interface FirmaPeruConfig {
  signatureFormat: "PAdES"; 
  signatureLevel: SignatureLevel;
  signatureStyle: SignatureStyle;
  positionX: number;
  positionY: number;
  pageNumber: number; 
  reason: string; 
  role: string;   
  visiblePosition: boolean;
}

export interface FirmaPeruModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentUrl: string; 
  fileToSign?: File | null; // Nuevo: Archivo local para subir justo antes de firmar
  idAnexo: number;     
  codigoAnexo?: string; // Nuevo: Requerido para subir el archivo si es local
  idUsuario: number;   
  onSuccess: (data: any) => void;
  onError: (error: string) => void;
}

export interface FirmaPeruBackendParams {
  signatureFormat: string;
  signatureLevel: string;
  signaturePackaging: string;
  documentToSign: string;
  certificateFilter: string;
  webTsa: string;
  userTsa: string;
  passwordTsa: string;
  theme: string;
  visiblePosition: boolean;
  contactInfo: string;
  signatureReason: string;
  bachtOperation: boolean;
  oneByOne: boolean;
  signatureStyle: number;
  imageToStamp: string;
  stampTextSize: number;
  stampWordWrap: number;
  role: string;
  stampPage: number;
  positionx: number;
  positiony: number;
  uploadDocumentSigned: string;
  certificationSignature: boolean;
}

declare global {
  interface Window {
    jqFirmaPeru?: any;
    signatureInit?: () => void;
    signatureOk?: () => void;
    signatureCancel?: () => void;
    startSignature?: (port: number, param: string) => void;
    jQuery?: any;
    $: any;
  }
}


export enum LoaderPhase {
  IDLE = 'IDLE',         // No loader, content visible
  LOADING = 'LOADING',   // Blue spinner visible
  SUCCESS = 'SUCCESS',   // Green checkmark visible
}

export interface PageLoaderProps {
  /**
   * Boolean indicating if the parent process (e.g., API fetch) is still active.
   */
  isLoading: boolean;
  /**
   * The content to render when loading is complete.
   */
  children: React.ReactNode;
  /**
   * Optional text to display during the loading phase.
   */
  loadingText?: string;
  /**
   * Optional text to display during the success phase.
   */
  successText?: string;
}

export interface AIContentData {
  title: string;
  message: string;
}
