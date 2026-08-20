import { useEffect } from 'react';
import useQuizStore from '../store/useQuizStore';

const BG_IMAGE_URL = '/andrey-metelev-DEuansgqjns-unsplash.jpg';

/**
 * Fixed full-viewport background image + noise overlay,
 * plus the dark-mode class sync on the document root.
 */
export function Background() {
  const theme = useQuizStore((s) => s.theme);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  return (
    <>
      <div className="noise-overlay" />
      <div
        className="fixed inset-0 bg-cover bg-center -z-10 transition-opacity"
        style={{ backgroundImage: `url(${BG_IMAGE_URL})` }}
        aria-hidden="true"
      />
      <div
        className="fixed inset-0 -z-[5] bg-white/60 dark:bg-slate-950/70 transition-colors duration-300"
        aria-hidden="true"
      />
    </>
  );
}