import express from 'express';

const router = express.Router();

// Ruta de logout
router.post('/', (req, res) => {
  // Aquí, simplemente devolvemos una respuesta de éxito
  // ya que la eliminación del token se realiza en el frontend
  res.status(200).json({ message: 'Usuario desconectado con éxito' });
});

export default router;
