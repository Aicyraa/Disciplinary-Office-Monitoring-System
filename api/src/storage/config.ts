type Env = Record<string, string | undefined>;

const clean = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

/**
 * Bucket for proof files that students upload. `BUCKET_STORAGE_FILES` is the name; `BUCKET_STORAGE` and the
 * original `STORAGE_BUCKET` are still read so an older `.env` keeps working.
 */
export function filesBucketFromEnv(env: Env = process.env): string | undefined {
  return clean(env.BUCKET_STORAGE_FILES) ?? clean(env.BUCKET_STORAGE) ?? clean(env.STORAGE_BUCKET);
}

/**
 * Bucket for the sanction template files staff upload (build step 8). Deliberately no fallback: templates
 * must never end up next to student proof files by accident.
 */
export function templatesBucketFromEnv(env: Env = process.env): string | undefined {
  return clean(env.BUCKET_STORAGE_TEMPLATES);
}
