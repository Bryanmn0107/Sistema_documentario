import { resolveMx } from 'dns';  // Importando el módulo DNS
import validator from 'validator';  // Importando la librería de validación

// Función para verificar el correo y los registros MX
const verificarCorreo = (email) => {
  // Validar el formato del correo con validator
  if (!validator.isEmail(email)) {
    console.log('El correo no es válido');
    return;
  }

  // Extraer el dominio del correo
  const domain = email.split('@')[1];

  console.log(`Verificando los registros MX para el dominio: ${domain}`);

  // Realizar la consulta de registros MX
  resolveMx(domain, (err, addresses) => {
    if (err) {
      console.error('No se pudieron obtener los registros MX:', err);
    } else {
      if (addresses && addresses.length > 0) {
        console.log(`El dominio ${domain} tiene los siguientes registros MX:`);
        console.log(addresses);
      } else {
        console.log(`El dominio ${domain} no tiene registros MX.`);
      }
    }
  });
};

// Correo de prueba
const email = 'brmartinezna0705@gmail.com'; 
verificarCorreo(email);
