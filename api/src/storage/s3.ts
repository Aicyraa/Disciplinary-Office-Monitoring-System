import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { filesBucketFromEnv } from './config.js';
import { PRESIGN_TTL_SECONDS, type ObjectStorage } from './types.js';
import { storageUnavailable } from './unavailable.js';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} must be supplied before creating the S3 storage client`);
  return value;
}

// Construct only when file behavior is explicitly needed (mirrors createPrismaClient).
export function createS3Storage(bucket: string = filesBucketFromEnv() ?? requireEnv('BUCKET_STORAGE_FILES')): ObjectStorage {
  const client = new S3Client({
    region: requireEnv('AWS_REGION'),
    endpoint: requireEnv('AWS_ENDPOINT_URL_S3'),
    credentials: {
      accessKeyId: requireEnv('AWS_ACCESS_KEY_ID'),
      secretAccessKey: requireEnv('AWS_SECRET_ACCESS_KEY'),
    },
    forcePathStyle: true,
    requestChecksumCalculation: 'WHEN_REQUIRED',
  });

  // Any failure of the storage service (unknown bucket, rejected credentials, outage) is the server's side of
  // the story, not a bug in the request: log the real reason, answer with one plain 503 (no bucket names, no
  // SDK messages reach the browser).
  async function guarded<T>(operation: string, key: string, run: () => Promise<T>): Promise<T> {
    try {
      return await run();
    } catch (error) {
      console.error(`Object storage ${operation} failed for bucket "${bucket}", key "${key}"`, error);
      throw storageUnavailable();
    }
  }

  return {
    put: (key, body, contentType) =>
      guarded('put', key, async () => {
        await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }));
      }),
    delete: (key) =>
      guarded('delete', key, async () => {
        await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
      }),
    presignGet: (key, expiresInSeconds = PRESIGN_TTL_SECONDS) =>
      guarded('presign', key, () =>
        getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: expiresInSeconds }),
      ),
  };
}
