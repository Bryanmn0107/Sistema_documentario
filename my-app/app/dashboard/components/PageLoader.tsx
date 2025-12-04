import React, { useState, useEffect } from 'react';
import { Loader2, Check } from 'lucide-react';
import { LoaderPhase, PageLoaderProps } from '../../types';

export const PageLoader: React.FC<PageLoaderProps> = ({
  isLoading,
  children,
  loadingText = "Loading resources...",
  successText = "Ready!"
}) => {
  const [phase, setPhase] = useState<LoaderPhase>(isLoading ? LoaderPhase.LOADING : LoaderPhase.IDLE);
  const [shouldRenderChildren, setShouldRenderChildren] = useState(!isLoading);

  useEffect(() => {
    if (isLoading) {
      
      setPhase(LoaderPhase.LOADING);
      setShouldRenderChildren(false);
    } else {
      
      if (phase === LoaderPhase.LOADING) {
        setPhase(LoaderPhase.SUCCESS);
        const timer = setTimeout(() => {
          setPhase(LoaderPhase.IDLE);
          setShouldRenderChildren(true);
        }, 1500);

        return () => clearTimeout(timer);
      }
    }
    
  }, [isLoading]);
  
  if (phase === LoaderPhase.IDLE && shouldRenderChildren) {
    return <>{children}</>;
  }

  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      {/* 
        We keep children mounted in the background if needed, or unmounted. 
        In this pattern, we unmount them to simulate true "page load" waiting,
        but you could toggle opacity instead if you want SEO-friendly pre-rendering.
      */}
      {shouldRenderChildren && <div className="opacity-0">{children}</div>}

      <div
        className={`fixed inset-0 z-50 flex flex-col items-center justify-center transition-colors duration-700 ease-in-out
          ${phase === LoaderPhase.SUCCESS ? 'bg-green-500' : 'bg-blue-600'}
        `}
      >
        <div className="flex flex-col items-center justify-center text-white p-8 rounded-2xl">
          {/* Icon Container */}
          <div className="relative flex items-center justify-center w-24 h-24 mb-6">
            
            {/* Loading Icon (Blue State) */}
            <div
              className={`absolute inset-0 flex items-center justify-center transition-all duration-500 transform
                ${phase === LoaderPhase.LOADING ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}
              `}
            >
              <Loader2 className="w-20 h-20 animate-spin text-white" />
            </div>

            {/* Success Icon (Green State) */}
            <div
              className={`absolute inset-0 flex items-center justify-center transition-all duration-500 delay-100 transform
                ${phase === LoaderPhase.SUCCESS ? 'opacity-100 scale-100' : 'opacity-0 scale-50 rotate-45'}
              `}
            >
              <div className="bg-white rounded-full p-3 shadow-lg">
                <Check className="w-12 h-12 text-green-600 stroke-[4]" />
              </div>
            </div>
          </div>

          {/* Text Transition */}
          <div className="h-8 overflow-hidden relative w-full text-center">
             <p
              className={`text-xl font-semibold tracking-wide transition-all duration-500 transform absolute w-full
                ${phase === LoaderPhase.LOADING ? 'translate-y-0 opacity-100' : '-translate-y-8 opacity-0'}
              `}
            >
              {loadingText}
            </p>
            <p
              className={`text-2xl font-bold tracking-wide transition-all duration-500 transform absolute w-full
                ${phase === LoaderPhase.SUCCESS ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}
              `}
            >
              {successText}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};