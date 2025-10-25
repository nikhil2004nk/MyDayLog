import { useEffect } from 'react';

export type ToastProps = {
  open: boolean;
  message: string;
  onClose: () => void;
  duration?: number;
};

export default function Toast({ open, message, onClose, duration = 2000 }: ToastProps) {
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(onClose, duration);
    return () => clearTimeout(t);
  }, [open, duration, onClose]);

  if (!open) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
      <div className="bg-black text-white text-sm px-4 py-2 rounded shadow">
        {message}
      </div>
    </div>
  );
}
