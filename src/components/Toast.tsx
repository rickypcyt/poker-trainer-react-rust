import React, { useEffect } from 'react';

export type ToastProps = {
  message: string;
  onClose: () => void;
  durationMs?: number;
};

const Toast: React.FC<ToastProps> = ({ message, onClose, durationMs = 1800 }) => {
  useEffect(() => {
    const id = setTimeout(onClose, durationMs);
    return () => clearTimeout(id);
  }, [onClose, durationMs]);

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
      <div className="bg-black/80 text-white px-4 py-2 rounded-md shadow-lg border border-white/20">
        {message}
      </div>
    </div>
  );
};

export default Toast;


