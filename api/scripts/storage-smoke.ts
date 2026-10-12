// Neon Object Storage smoke test (SPEC 6.1, build step 1). LIVE: touches the real bucket of the
// branch your credentials belong to. Run it yourself; no agent runs it.
//
//   cd api && ./node_modules/.bin/tsx --env-file=../.env scripts/storage-smoke.ts [--expiry]
//
// Needs in the root .env: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_ENDPOINT_URL_S3, AWS_REGION.
// Optional: BUCKET_STORAGE_FILES (default "assets"), CORS_TEST_ORIGIN
// (default http://localhost:5173), --expiry (also waits 65 s to prove the presigned URL expires).
//
// What it proves: upload, direct read-back, presigned GET (60 s), a server-side CORS probe,
// optional expiry, delete. The CORS probe only reads response headers; the final word on browser
// CORS is `fetch(<presigned url>)` from the console of http://localhost:5173 (see README note at end).
import { randomUUID } from 'node:crypto';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

type Result = { step: string; ok: boolean; detail: string };
const results: Result[] = [];

function record(step: string, ok: boolean, detail: string): void {
  results.push({ step, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${step}: ${detail}`);
}

function env(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing ${name} in the root .env`);
    process.exit(2);
  }
  return value;
}

// Never print a presigned URL: its query string is a credential.
function redact(url: string): string {
  const u = new URL(url);
  return `${u.origin}${u.pathname}?<signature hidden>`;
}

const endpoint = env('AWS_ENDPOINT_URL_S3');
if (endpoint.includes('example.invalid')) {
  console.error('AWS_ENDPOINT_URL_S3 is still the .env.example placeholder.');
  process.exit(2);
}
// Same lookup order as the API (src/storage/config.ts): BUCKET_STORAGE_FILES, then BUCKET_STORAGE, then STORAGE_BUCKET.
const bucket =
  [process.env.BUCKET_STORAGE_FILES, process.env.BUCKET_STORAGE, process.env.STORAGE_BUCKET]
    .map((value) => value?.trim())
    .find(Boolean) ?? 'assets';
const origin = process.env.CORS_TEST_ORIGIN ?? 'http://localhost:5173';
const withExpiry = process.argv.includes('--expiry');

const s3 = new S3Client({
  region: env('AWS_REGION'),
  endpoint,
  forcePathStyle: true,
  requestChecksumCalculation: 'WHEN_REQUIRED',
  credentials: { accessKeyId: env('AWS_ACCESS_KEY_ID'), secretAccessKey: env('AWS_SECRET_ACCESS_KEY') },
});

// Smallest thing that starts like a PDF; the real upload route validates magic bytes the same way.
const body = Buffer.from('%PDF-1.4\n% SDO storage smoke test\n%%EOF\n', 'utf8');
const key = `smoke/${randomUUID()}.pdf`;

async function main(): Promise<void> {
  // 1. Upload
  await s3.send(
    new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: 'application/pdf' }),
  );
  const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
  record('upload', head.ContentLength === body.length, `${head.ContentLength} bytes stored at ${key}`);

  // 2. Direct read-back
  const got = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const direct = Buffer.from(await got.Body!.transformToByteArray());
  record('direct download', direct.equals(body), `${direct.length} bytes, content ${direct.equals(body) ? 'identical' : 'DIFFERENT'}`);

  // 3. Presigned GET (60 s), opened without credentials like a browser tab would
  const url = await getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: 60 });
  const viaUrl = await fetch(url);
  const urlBytes = Buffer.from(await viaUrl.arrayBuffer());
  record('presigned GET', viaUrl.status === 200 && urlBytes.equals(body), `${redact(url)} -> HTTP ${viaUrl.status}`);

  // 4. Anonymous access must be refused (bucket is private)
  const bare = await fetch(url.split('?')[0]);
  record('private bucket (no signature)', bare.status === 403 || bare.status === 401, `unsigned GET -> HTTP ${bare.status}`);

  // 5. CORS probe: what a browser would be told for a cross-origin GET and preflight
  const cors = await fetch(url, { headers: { Origin: origin } });
  const allow = cors.headers.get('access-control-allow-origin');
  record('CORS GET header', allow === origin || allow === '*', `Access-Control-Allow-Origin: ${allow ?? '(none)'} for Origin ${origin}`);
  const pre = await fetch(url, {
    method: 'OPTIONS',
    headers: { Origin: origin, 'Access-Control-Request-Method': 'GET' },
  });
  const preAllow = pre.headers.get('access-control-allow-origin');
  record('CORS preflight', pre.status < 300 && Boolean(preAllow), `OPTIONS -> HTTP ${pre.status}, allow-origin: ${preAllow ?? '(none)'}`);

  // 6. Optional: presigned URL must stop working after its expiry
  if (withExpiry) {
    console.log('waiting 65 s for the presigned URL to expire...');
    await new Promise((r) => setTimeout(r, 65_000));
    const late = await fetch(url);
    record('presigned expiry', late.status === 403, `after 65 s -> HTTP ${late.status}`);
  }
}

try {
  await main();
} catch (error) {
  record('unexpected error', false, error instanceof Error ? error.message : String(error));
} finally {
  // 7. Always delete the test object
  try {
    await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    const gone = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key })).then(
      () => false,
      () => true,
    );
    record('cleanup', gone, gone ? 'object deleted' : 'object STILL EXISTS, delete smoke/ manually');
  } catch (error) {
    record('cleanup', false, error instanceof Error ? error.message : String(error));
  }
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed.`);
console.log(
  'CORS failures are expected and fine: uploads go through Express and previews use the API route.\n' +
    'Browser check: on http://localhost:5173 run  fetch("<presigned url>")  in the console.',
);
// CORS rows are informational: they decide the DOCX-preview design, not pass/fail of storage.
const hardFailures = failed.filter((r) => !r.step.startsWith('CORS'));
process.exit(hardFailures.length === 0 ? 0 : 1);
