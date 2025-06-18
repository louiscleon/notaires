import { useState } from 'react';

export interface ToastMessage {
  message: string;
  type: 'error' | 'success' | 'warning';
  id: number;
}

export const useToast = () => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (message: string, type: 'error' | 'success' | 'warning') => {
    const id = Date.now();
    setToasts(current => [...current, { message, type, id }]);
  };

  const removeToast = (id: number) => {
    setToasts(current => current.filter(toast => toast.id !== id));
  };

  const clearAllToasts = () => {
    setToasts([]);
  };

  return {
    toasts,
    addToast,
    removeToast,
    clearAllToasts
  };
}; 