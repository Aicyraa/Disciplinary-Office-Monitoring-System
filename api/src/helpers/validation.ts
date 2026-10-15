/** Result of a boundary validator: the parsed value, or the message for a 400 `invalid_input`. */
export type Validated<T> = { ok: true; value: T } | { ok: false; message: string };

export const valid = <T>(value: T): Validated<T> => ({ ok: true, value });
export const invalid = (message: string): Validated<never> => ({ ok: false, message });
