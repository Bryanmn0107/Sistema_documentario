'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Cookie from 'js-cookie';

const useAuth = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(true);  // Para manejar el estado de carga

  useEffect(() => {
    // Asegúrate de que el código se ejecute solo en el cliente
    const token = Cookie.get('token');

    if (!token) {
      router.replace('/login');
      return;
    }

    try {
      // Decodificar el JWT y obtener la fecha de expiración
      const decodedToken = JSON.parse(atob(token.split('.')[1])); // Decodificamos el token
      const currentTime = Date.now() / 1000;

      if (decodedToken.exp < currentTime) {
        // Si el token está expirado, redirigir al login
        Cookie.remove('token');
        router.replace('/login');
      } else {
        setLoading(false);  // Si todo es válido, cargamos el contenido
      }
    } catch (error) {
      console.error('Error al decodificar el token:', error);
      router.replace('/login');
    }
  }, [router]);

  // Mientras verificamos el token, mostramos un "loading"
  if (loading) return <div>Loading...</div>;
};

export default useAuth;
