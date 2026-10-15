/** SPEC 3: student ids are `YYYY-NNNNNNN`. The one client copy; the API enforces the same rule again. */
export const STUDENT_ID_PATTERN = /^\d{4}-\d{7}$/;

export const isStudentId = (value: string): boolean => STUDENT_ID_PATTERN.test(value);
