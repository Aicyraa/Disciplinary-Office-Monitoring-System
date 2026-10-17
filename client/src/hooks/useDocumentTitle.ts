import { useEffect } from 'react';
import { pageTitle } from '@/utils/pageTitle';

/** Sets the browser tab title to the page's heading while the page is shown. */
export function useDocumentTitle(heading: string): void {
  useEffect(() => {
    document.title = pageTitle(heading);
  }, [heading]);
}
