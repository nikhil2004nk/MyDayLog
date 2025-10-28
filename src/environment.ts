export const API_BASE: string = (() => {
   const url = (import.meta as ImportMeta).env?.VITE_API_URL as string | undefined;
   const fallback = 'https://my-daily-log-svc.onrender.com';
   const chosen = (url && url.trim()) ? url : fallback;
   return chosen.replace(/\/+$/g, '');
})();
