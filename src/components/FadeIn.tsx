import { type ReactNode, useEffect, useState } from 'react';

export default function FadeIn({ children }: { children: ReactNode }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setShow(true));
    return () => cancelAnimationFrame(t);
  }, []);
  return (
    <div className={`transition-opacity duration-200 ${show ? 'opacity-100' : 'opacity-0'}`}>{children}</div>
  );
}
