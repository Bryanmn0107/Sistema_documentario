"use client";

import { useState, useEffect } from "react";
import Image from "next/image";

// Array de imagenes para el carrusel.
// Asegúrate de tener estas imágenes en public/img/hospital-1.webp, etc.
const sliderImages = [
  "/img/Hospital_1.webp", // Remplazar con tus imagenes reales
  "/img/Hospital_2.webp",
  "/img/Hospital_3.webp"
];

// Fallback si no existen las imagenes aun
const fallbackImage = "/img/Piura.png"; 

export default function Dashboard() {
  const [currentImage, setCurrentImage] = useState(0);

  // Efecto de Carrusel Automático
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentImage((prev) => (prev + 1) % (sliderImages.length > 0 ? sliderImages.length : 1));
    }, 5000); // Cambia cada 5 segundos
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="h-full flex flex-col gap-8">
      
      {/* Hero Section / Carousel */}
      <div className="relative w-full h-[50vh] min-h-[400px] rounded-2xl overflow-hidden shadow-2xl bg-slate-900 group">
        
        {/* Images Layer */}
        {sliderImages.length > 0 ? (
          sliderImages.map((src, index) => (
            <div
              key={index}
              className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
                index === currentImage ? "opacity-60" : "opacity-0"
              }`}
            >
               {/* Nota: Usamos un div con background para cubrir bien, o Image de Next */}
               <div 
                 className="w-full h-full bg-cover bg-center"
                 style={{ backgroundImage: `url(${src})` }}
               />
               {/* Fallback visual si la imagen falla en cargar (opcional) */}
            </div>
          ))
        ) : (
           <div className="absolute inset-0 opacity-20 flex items-center justify-center">
              <Image src={fallbackImage} width={200} height={200} alt="Hospital Logo" className="opacity-50"/>
           </div>
        )}

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#12173D] via-[#12173D]/80 to-transparent"></div>

        {/* Welcome Text Content */}
        <div className="absolute inset-0 flex flex-col justify-center px-12 md:px-24 max-w-4xl">
          <div className="animate-in slide-in-from-left duration-700 fade-in">
            <span className="inline-block px-3 py-1 mb-4 text-xs font-semibold tracking-wider text-blue-200 uppercase bg-blue-900/50 rounded-full border border-blue-400/30 backdrop-blur-sm">
              Sistema de Gestión Documentaria
            </span>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight drop-shadow-lg">
              Bienvenido al <br/>
              <span className="text-blue-400">Hospital Nuestra Señora</span> <br/>
              de las Mercedes
            </h1>
            <p className="text-lg text-gray-200 max-w-2xl font-light leading-relaxed mb-8">
              Gestione sus trámites, firmas digitales y anexos de manera eficiente, segura y transparente.
            </p>
            
            {/* Quick Action Button (Optional) */}
            <button className="px-8 py-3 bg-white text-[#12173D] font-bold rounded-lg hover:bg-blue-50 transition shadow-lg hover:shadow-white/20">
              Ver Documentos Recientes
            </button>
          </div>
        </div>

        {/* Slider Indicators */}
        <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-3 z-10">
          {sliderImages.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentImage(idx)}
              className={`w-3 h-3 rounded-full transition-all duration-300 ${
                idx === currentImage ? "bg-blue-400 w-8" : "bg-white/30 hover:bg-white/60"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Quick Cards Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Card 1 */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow cursor-pointer group">
           <div className="h-12 w-12 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 mb-4 group-hover:bg-blue-600 group-hover:text-white transition-colors">
             <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
           </div>
           <h3 className="text-lg font-bold text-slate-800 mb-2">Búsqueda Avanzada</h3>
           <p className="text-sm text-slate-500">Localice expedientes y documentos históricos rápidamente.</p>
        </div>

        {/* Card 2 */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow cursor-pointer group">
           <div className="h-12 w-12 rounded-lg bg-green-50 flex items-center justify-center text-green-600 mb-4 group-hover:bg-green-600 group-hover:text-white transition-colors">
             <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
           </div>
           <h3 className="text-lg font-bold text-slate-800 mb-2">Firmas Pendientes</h3>
           <p className="text-sm text-slate-500">Revise y firme digitalmente los documentos asignados.</p>
        </div>

        {/* Card 3 */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow cursor-pointer group">
           <div className="h-12 w-12 rounded-lg bg-purple-50 flex items-center justify-center text-purple-600 mb-4 group-hover:bg-purple-600 group-hover:text-white transition-colors">
             <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
           </div>
           <h3 className="text-lg font-bold text-slate-800 mb-2">Nuevo Anexo</h3>
           <p className="text-sm text-slate-500">Cree y adjunte nuevos archivos al sistema.</p>
        </div>

      </div>
    </div>
  );
}
