import { useEffect } from 'react';
import { uiZoom } from '@/utils/zoom';

/** Keeps the `--zoom` CSS variable (read by `.ui-zoom` and `--page-h`) in step with the window width. */
export function useUiZoom(): void {
  useEffect(() => {
    const root = document.documentElement;
    const apply = () => root.style.setProperty('--zoom', String(uiZoom(window.innerWidth)));
    apply();
    window.addEventListener('resize', apply);
    return () => {
      window.removeEventListener('resize', apply);
      root.style.removeProperty('--zoom');
    };
  }, []);
}
