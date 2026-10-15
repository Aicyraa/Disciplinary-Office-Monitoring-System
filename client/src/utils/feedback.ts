/** Pure rules behind the toast and the confirm modal (UI-POLISH-SPEC 4.3). */

export type ModalTone = 'primary' | 'danger' | 'ok';
export type ToastTone = 'success' | 'error' | 'info';

/** How long a toast stays: the source's 4.2 s for confirmations; an error stays until dismissed or replaced. */
export const TOAST_MS = 4200;

export function toastDuration(tone: ToastTone): number | null {
  return tone === 'error' ? null : TOAST_MS;
}

/** The icon, its circle and the confirm button for each tone (source line 3438). */
export function modalTone(tone: ModalTone): { icon: string; circle: string; button: 'primary' | 'dangerSolid' | 'success' } {
  switch (tone) {
    case 'danger':
      return { icon: 'warning', circle: 'bg-danger-soft text-danger', button: 'dangerSolid' };
    case 'ok':
      return { icon: 'task_alt', circle: 'bg-success-soft text-success', button: 'success' };
    default:
      return { icon: 'help', circle: 'bg-info-soft text-primary', button: 'primary' };
  }
}

/** The confirm button stays disabled until a required reason has text. */
export function canConfirm({ reasonRequired, reason }: { reasonRequired: boolean; reason: string }): boolean {
  return !reasonRequired || reason.trim() !== '';
}
