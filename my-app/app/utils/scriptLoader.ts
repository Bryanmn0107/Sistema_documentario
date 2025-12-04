
import '../types';

// Singleton promise to track the loading state
let scriptLoadPromise: Promise<void> | null = null;

export const loadFirmaPeruScripts = (): Promise<void> => {
  // 1. If already loaded and available, resolve immediately
  if (window.jqFirmaPeru && window.startSignature) {
    return Promise.resolve();
  }

  // 2. If loading is already in progress, return the existing promise
  if (scriptLoadPromise) {
    return scriptLoadPromise;
  }

  // 3. Start loading sequence
  scriptLoadPromise = (async () => {
    try {
      // A. Load jQuery if not present
      if (!window.jQuery && !window.jqFirmaPeru) {
        await loadScript("https://code.jquery.com/jquery-3.6.0.min.js");
      }

      // B. Configure jQuery noConflict as required by docs
      if (window.jQuery && !window.jqFirmaPeru) {
        window.jqFirmaPeru = window.jQuery.noConflict(true);
      }

      // C. Load FirmaPeru script if not present
      if (!window.startSignature) {
        await loadScript("https://apps.firmaperu.gob.pe/web/clienteweb/firmaperu.min.js");
      }
      
    } catch (err) {
      console.error("Firma Peru Script Load Error:", err);
      throw err;
    }
  })();

  // If it fails, reset the promise so we can try again later
  scriptLoadPromise.catch(() => {
    scriptLoadPromise = null;
  });

  return scriptLoadPromise;
};

const loadScript = (src: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    // Check if script tag already exists to avoid duplicates
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    // Try to request CORS access to get better error messages, 
    // though it depends on the server headers.
    script.crossOrigin = "anonymous"; 
    
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    
    document.body.appendChild(script);
  });
};
