type Env = Record<string, string | undefined>;

const clean = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

/** Defaults shown in `.env.example` and used by the storage smoke test when nothing is configured. */
export const DEFAULT_FILES_BUCKET = 'assets-files';
export const DEFAULT_TEMPLATES_BUCKET = 'assets-sanction-templates';

/**
 * Bucket for proof files that students upload. `STORAGE_BUCKET_FILES` is the name; the earlier spellings
 * `BUCKET_STORAGE_FILES`, `BUCKET_STORAGE` and `STORAGE_BUCKET` are still read so an older `.env` keeps working.
 */
export function filesBucketFromEnv(env: Env = process.env): string | undefined {
  return (
    clean(env.STORAGE_BUCKET_FILES) ??
    clean(env.BUCKET_STORAGE_FILES) ??
    clean(env.BUCKET_STORAGE) ??
    clean(env.STORAGE_BUCKET)
  );
}

/**
 * Bucket for the sanction template files staff upload (build step 8). Deliberately no fallback to the files
 * bucket: templates must never end up next to student proof files by accident.
 */
export function templatesBucketFromEnv(env: Env = process.env): string | undefined {
  return clean(env.STORAGE_BUCKET_TEMPLATES) ?? clean(env.BUCKET_STORAGE_TEMPLATES);
}
