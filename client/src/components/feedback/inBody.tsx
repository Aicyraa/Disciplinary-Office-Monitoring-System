import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * Renders an overlay straight under `<body>`. The page content sits in zoomed, clipped containers, which would
 * confine a `fixed` scrim to the work area instead of the whole window. Without a DOM (server markup in tests)
 * it renders in place.
 */
export function inBody(node: ReactNode): ReactNode {
  return typeof document === 'undefined' ? node : createPortal(node, document.body);
}
