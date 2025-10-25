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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 md:p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-full md:max-w-2xl bg-white dark:bg-gray-800 rounded-none md:rounded-lg shadow-lg flex flex-col max-h-[92vh] md:max-h-[80vh]">
        {title && <h3 className="text-base md:text-lg font-semibold px-4 md:px-5 pt-3 md:pt-4 pb-2.5 md:pb-3 border-b dark:border-gray-700">{title}</h3>}
        <div className="px-4 md:px-5 py-3 md:py-4 overflow-y-auto">{children}</div>
        {actions && <div className="px-4 md:px-5 py-3 border-t dark:border-gray-700 flex flex-wrap justify-end gap-2 sticky bottom-0 bg-white dark:bg-gray-800">{actions}</div>}
      </div>
    </div>
  );
}
