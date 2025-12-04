"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LogoutPage() {
  const router = useRouter();

  useEffect(() => {
    const handleLogout = async () => {
      try {
        // Eliminar el token del localStorage
        localStorage.removeItem('token');

        // Llamada a la API de logout
        const response = await fetch('http://localhost:3004/api/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          // Redirigir a la página principal después de logout
          router.push('/');
        } else {
          console.error('Error al cerrar sesión');
          alert('No se pudo cerrar sesión correctamente');
        }
      } catch (error) {
        console.error('Error al cerrar sesión', error);
        alert('No se pudo conectar con el servidor.');
      }
    };

    handleLogout();
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg overflow-hidden p-8">
        <h2 className="text-xl font-bold text-center text-blue-600">Cerrando sesión...</h2>
      </div>
    </div>
  );
}
