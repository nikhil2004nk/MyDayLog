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
      <div className="text-base md:text-lg px-5 py-3 rounded-lg shadow-lg border bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-700">
        {message}
      </div>
    </div>
  );
}
