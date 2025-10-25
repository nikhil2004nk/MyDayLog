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
        {title && (
          <div className="flex items-center justify-between px-4 md:px-5 pt-3 md:pt-4 pb-2.5 md:pb-3 border-b dark:border-gray-700">
            <h3 className="text-base md:text-lg font-semibold">{title}</h3>
            <button
              type="button"
              aria-label="Close"
              className="inline-flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
              onClick={onClose}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path fillRule="evenodd" d="M6.225 4.811a1 1 0 0 1 1.414 0L12 9.172l4.361-4.361a1 1 0 1 1 1.414 1.414L13.414 10.586l4.361 4.361a1 1 0 0 1-1.414 1.414L12 12l-4.361 4.361a1 1 0 0 1-1.414-1.414l4.361-4.361-4.361-4.361a1 1 0 0 1 0-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        )}
        <div className="px-4 md:px-5 py-3 md:py-4 overflow-y-auto">{children}</div>
        {actions && <div className="px-4 md:px-5 py-3 border-t dark:border-gray-700 flex flex-wrap justify-end gap-2 sticky bottom-0 bg-white dark:bg-gray-800">{actions}</div>}
      </div>
    </div>
  );
}
