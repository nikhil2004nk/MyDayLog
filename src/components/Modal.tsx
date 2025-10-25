import { type ReactNode, useEffect } from 'react';

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  actions?: ReactNode;
};

export default function Modal({ open, onClose, title, children, actions }: ModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (open) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl bg-white dark:bg-gray-800 rounded-lg shadow-lg flex flex-col">
        {title && <h3 className="text-lg font-semibold px-5 pt-4 pb-3 border-b dark:border-gray-700">{title}</h3>}
        <div className="px-5 py-4 max-h-[70vh] overflow-y-auto">{children}</div>
        {actions && <div className="px-5 py-3 border-t dark:border-gray-700 flex justify-end gap-2 sticky bottom-0 bg-white dark:bg-gray-800">{actions}</div>}
      </div>
    </div>
  );
}
