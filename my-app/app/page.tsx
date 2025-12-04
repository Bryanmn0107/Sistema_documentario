
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const res = await fetch("http://localhost:3004/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const text = await res.text().catch(() => "");
      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { raw: text };
      }

      if (!res.ok) {
        setError(data.message || "Credenciales incorrectas o error en el servidor.");
        setIsLoading(false);
        return;
      }

      // Éxito
      if (data?.token) {
        localStorage.setItem("token", data.token);
        localStorage.setItem("id_usuario", data.user.Usuario);
        // Pequeña pausa para que el usuario vea el éxito antes de redirigir
        setTimeout(() => {
            router.replace("/dashboard");
        }, 500);
      } else {
        setError("Inicio correcto pero no se recibió token.");
        setIsLoading(false);
      }
    } catch (err: any) {
      console.error("Fetch failed:", err);
      setError("Error de conexión. Verifique que el servidor esté activo.");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Sección Izquierda: Visual / Decorativa */}
      <div className="hidden lg:flex w-1/2 bg-blue-900 relative overflow-hidden items-center justify-center">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-800 to-slate-900 opacity-90"></div>
        
        {/* Patrón de fondo abstracto */}
        <div className="absolute inset-0 opacity-10" 
             style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '30px 30px' }}>
        </div>

        <div className="relative z-10 text-white text-center px-12">
          <div className="mb-8 flex justify-center">
             {/* Contenedor del logo para versión desktop */}
             <div className="w-32 h-32 bg-white rounded-full flex items-center justify-center shadow-2xl p-4">
                <img
                    src="/img/Piura.png"
                    alt="Logo Institucional"
                    className="max-w-full max-h-full object-contain"
                />
             </div>
          </div>
          <h1 className="text-4xl font-bold mb-4 tracking-tight font-serif">Gestión Documentaria</h1>
          <p className="text-blue-200 text-lg font-light">
            Plataforma integral para la administración de documentos hospitalarios y firmas digitales.
          </p>
        </div>
      </div>

      {/* Sección Derecha: Formulario */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-8 lg:p-16 bg-white">
        <div className="w-full max-w-md space-y-8">
          
          {/* Header Móvil (Logo visible solo en móvil) */}
          <div className="lg:hidden text-center mb-8">
            <img
              src="/img/Piura.png"
              alt="Logo"
              className="h-20 mx-auto mb-4 object-contain"
            />
            <h2 className="text-2xl font-bold text-slate-800">Gestión Documentaria</h2>
          </div>

          {/* Título del Formulario */}
          <div className="text-center lg:text-left">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">
              Bienvenido de nuevo
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Ingrese sus credenciales institucionales para acceder al sistema.
            </p>
          </div>

          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-5">
              
              {/* Input Email con efecto flotante */}
              <div className="relative group">
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="peer w-full px-4 py-3 border-2 border-slate-200 rounded-lg outline-none focus:border-blue-600 focus:ring-0 transition-colors bg-slate-50 focus:bg-white placeholder-transparent text-slate-800"
                  placeholder="Correo electrónico"
                />
                <label 
                  htmlFor="email"
                  className="absolute left-4 -top-2.5 bg-white px-1 text-xs font-medium text-slate-500 transition-all peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-base peer-placeholder-shown:text-slate-400 peer-focus:-top-2.5 peer-focus:text-xs peer-focus:text-blue-600"
                >
                  Correo Institucional
                </label>
              </div>

              {/* Input Password */}
              <div className="relative group">
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="peer w-full px-4 py-3 border-2 border-slate-200 rounded-lg outline-none focus:border-blue-600 focus:ring-0 transition-colors bg-slate-50 focus:bg-white placeholder-transparent text-slate-800"
                  placeholder="Contraseña"
                />
                <label 
                  htmlFor="password"
                  className="absolute left-4 -top-2.5 bg-white px-1 text-xs font-medium text-slate-500 transition-all peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-base peer-placeholder-shown:text-slate-400 peer-focus:-top-2.5 peer-focus:text-xs peer-focus:text-blue-600"
                >
                  Contraseña
                </label>
              </div>
            </div>

            {/* Mensaje de Error */}
            {error && (
              <div className="p-3 rounded-lg bg-red-50 border-l-4 border-red-500 text-red-700 text-sm animate-pulse">
                {error}
              </div>
            )}

            {/* Botón de Acción */}
            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-semibold rounded-lg text-white bg-blue-900 hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-900 transition-all disabled:opacity-70 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
              >
                {isLoading ? (
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                   <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                    <svg className="h-5 w-5 text-blue-500 group-hover:text-blue-400 transition-colors" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                    </svg>
                  </span>
                )}
                {isLoading ? "Autenticando..." : "Ingresar al Sistema"}
              </button>
            </div>

            {/* Footer Informativo */}
            <div className="text-center mt-4">
                <p className="text-xs text-slate-400">
                    Acceso restringido únicamente a personal autorizado. <br/>
                    Si olvidó sus credenciales, contacte a la oficina de TI.
                </p>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
}
