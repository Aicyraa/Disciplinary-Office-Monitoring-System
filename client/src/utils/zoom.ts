/**
 * The prototype scales the whole signed-in frame with the window width (src 2565): 1 at 1536 px, down to 0.8
 * and up to 1.3. Phones (under 720 px) are not scaled.
 */
export function uiZoom(width: number): number {
  if (width < 720) return 1;
  return Number(Math.min(1.3, Math.max(0.8, width / 1536)).toFixed(3));
}
