import React, { useState, useEffect } from 'react';

export type User = {
  id_usuario?: number;
  nombre: string;
  apellido: string;
  correo: string;
  password?: string; // Optional for edit
  estado: 'activo' | 'inactivo';
  id_rol: number;
  dni: string;
};

export type Role = {
  id_rol: number;
  nombre_rol: string;
};

interface UserFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (user: User) => Promise<void>;
  initialData?: User | null;
  roles: Role[];
}

const UserFormModal: React.FC<UserFormModalProps> = ({ 
  isOpen, 
  onClose, 
  onSubmit, 
  initialData, 
  roles 
}) => {
  const [formData, setFormData] = useState<User>({
    nombre: '',
    apellido: '',
    correo: '',
    password: '',
    id_rol: 1,
    estado: 'activo',
    dni: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (initialData) {
      setFormData({ ...initialData, password: '' }); // Don't show password on edit
    } else {
      // Reset for create mode
      setFormData({
        nombre: '',
        apellido: '',
        correo: '',
        password: '',
        id_rol: 1,
        estado: 'activo',
        dni: ''
      });
    }
    setError("");
  }, [initialData, isOpen]);

  const validate = () => {
    if (!formData.dni || !formData.nombre || !formData.apellido || !formData.correo) {
      return 'Por favor complete todos los campos obligatorios.';
    }
    
    // Password check only for new users
    if (!initialData && (!formData.password || formData.password.length < 8)) {
      return 'La contraseña debe tener al menos 8 caracteres.';
    }

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(formData.correo)) return 'Correo electrónico inválido.';

    const dniRegex = /^[0-9]{8}$/;
    if (!dniRegex.test(formData.dni)) return 'El DNI debe contener 8 dígitos numéricos.';

    return null;
  };

  const handleSubmit = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsLoading(true);
    setError("");
    try {
      await onSubmit(formData);
      onClose();
    } catch (err: any) {
      setError(err.message || "Error al guardar usuario.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const isEdit = !!initialData;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 transition-opacity duration-300">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden transform transition-all scale-100">
        
        {/* Header */}
        <div className="bg-blue-900 px-6 py-4 flex justify-between items-center">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            {isEdit ? (
              <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
            ) : (
              <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
            )}
            {isEdit ? 'Modificar Usuario' : 'Nuevo Usuario'}
          </h3>
          <button onClick={onClose} className="text-white/70 hover:text-white">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          
          {error && (
            <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg border-l-4 border-red-500">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nombre</label>
              <input
                type="text"
                value={formData.nombre}
                onChange={(e) => setFormData({...formData, nombre: e.target.value})}
                className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition"
                placeholder="Ej. Juan"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Apellido</label>
              <input
                type="text"
                value={formData.apellido}
                onChange={(e) => setFormData({...formData, apellido: e.target.value})}
                className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition"
                placeholder="Ej. Pérez"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">DNI</label>
              <input
                type="text"
                maxLength={8}
                value={formData.dni}
                onChange={(e) => setFormData({...formData, dni: e.target.value.replace(/\D/g,'')})}
                className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition"
                placeholder="8 dígitos"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Rol</label>
              <select
                value={formData.id_rol}
                onChange={(e) => setFormData({...formData, id_rol: Number(e.target.value)})}
                className="w-full p-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition"
              >
                {roles.map(r => <option key={r.id_rol} value={r.id_rol}>{r.nombre_rol}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Correo Electrónico</label>
            <input
              type="email"
              value={formData.correo}
              onChange={(e) => setFormData({...formData, correo: e.target.value})}
              className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition"
              placeholder="correo@hospital.gob.pe"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                {isEdit ? 'Nueva Contraseña (Opcional)' : 'Contraseña'}
              </label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
                className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition"
                placeholder={isEdit ? "Sin cambios" : "Mínimo 8 caracteres"}
              />
            </div>
            <div>
               <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Estado</label>
               <div className="flex gap-2 mt-1">
                  <button 
                    onClick={() => setFormData({...formData, estado: 'activo'})}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${formData.estado === 'activo' ? 'bg-green-100 text-green-700 border border-green-300' : 'bg-gray-100 text-gray-400'}`}
                  >
                    Activo
                  </button>
                  <button 
                    onClick={() => setFormData({...formData, estado: 'inactivo'})}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${formData.estado === 'inactivo' ? 'bg-red-100 text-red-700 border border-red-300' : 'bg-gray-100 text-gray-400'}`}
                  >
                    Inactivo
                  </button>
               </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-lg text-gray-600 hover:bg-gray-200 font-medium transition"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className={`px-6 py-2.5 rounded-lg text-white font-bold shadow-lg transition flex items-center gap-2
              ${isLoading ? 'bg-blue-400 cursor-not-allowed' : isEdit ? 'bg-amber-500 hover:bg-amber-600' : 'bg-blue-600 hover:bg-blue-700'}
            `}
          >
            {isLoading && (
              <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            {isEdit ? 'Guardar Cambios' : 'Crear Usuario'}
          </button>
        </div>

      </div>
    </div>
  );
};

export default UserFormModal;