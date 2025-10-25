export const API_BASE: string = (() => {
   const url = (import.meta as ImportMeta).env?.VITE_API_URL as string | undefined;
   if (!url) {
     throw new Error('VITE_API_URL is not set');
   }
   return url.replace(/\/+$/g, '');
 })();
