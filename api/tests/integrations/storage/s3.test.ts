import { createServer, type IncomingHttpHeaders, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { HttpError } from '../../../src/lib/http.js';
import { createS3Storage } from '../../../src/integrations/storage/s3.js';
import { createUnavailableStorage } from '../../../src/integrations/storage/unavailable.js';

interface Captured {
  method: string | undefined;
  url: string | undefined;
  headers: IncomingHttpHeaders;
  body: Buffer;
}

/** A throwaway local server that answers like S3 and records what the SDK sent. Nothing leaves the machine. */
async function startFakeS3(
  reply: { status: number; body?: string } = { status: 200 },
): Promise<{ server: Server; requests: Captured[] }> {
  const requests: Captured[] = [];
  const server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => {
      requests.push({ method: request.method, url: request.url, headers: request.headers, body: Buffer.concat(chunks) });
      response.writeHead(reply.status, reply.body ? { 'Content-Type': 'application/xml' } : { ETag: '"fake"' });
      response.end(reply.body);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  vi.stubEnv('AWS_REGION', 'auto');
  vi.stubEnv('AWS_ENDPOINT_URL_S3', `http://127.0.0.1:${port}`);
  vi.stubEnv('AWS_ACCESS_KEY_ID', 'AKIAFAKEFAKEFAKE');
  vi.stubEnv('AWS_SECRET_ACCESS_KEY', 'fake-secret');
  return { server, requests };
}

describe('createS3Storage', () => {
  let running: Server | undefined;
  afterEach(() => {
    running?.close();
    running = undefined;
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  test('put sends the bytes as one plain body, with no streaming-signature or checksum headers', async () => {
    const fake = await startFakeS3();
    running = fake.server;
    const bytes = new Uint8Array(Buffer.from('%PDF-1.4\n' + 'x'.repeat(5000), 'utf8'));
    await createS3Storage('assets').put('proof/4/abc.pdf', bytes, 'application/pdf');

    expect(fake.requests).toHaveLength(1);
    const [sent] = fake.requests;
    expect(sent.method).toBe('PUT');
    expect(new URL(sent.url ?? '', 'http://x').pathname).toBe('/assets/proof/4/abc.pdf');
    expect(sent.headers['content-type']).toBe('application/pdf');
    expect(sent.headers['content-length']).toBe(String(bytes.length));
    expect(sent.headers['transfer-encoding']).toBeUndefined();
    expect(sent.headers['x-amz-decoded-content-length']).toBeUndefined();
    expect(sent.headers['x-amz-content-sha256']).not.toMatch(/STREAMING/);
    expect(Object.keys(sent.headers).filter((name) => name.startsWith('x-amz-checksum'))).toEqual([]);
    expect(sent.body.equals(Buffer.from(bytes))).toBe(true);
  });

  test('a storage refusal (wrong bucket, bad credentials) becomes a 503 storage_unavailable, not a 500', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const fake = await startFakeS3({
      status: 400,
      body: '<?xml version="1.0"?><Error><Code>InvalidArgument</Code><Message>Invalid argument.</Message></Error>',
    });
    running = fake.server;
    const storage = createS3Storage('sanction_templates');
    const failure = await storage.put('proof/4/abc.pdf', new Uint8Array([0x25]), 'application/pdf').catch((e: unknown) => e);

    expect(failure).toBeInstanceOf(HttpError);
    expect(failure).toMatchObject({ status: 503, code: 'storage_unavailable' });
    expect((failure as HttpError).message).not.toMatch(/InvalidArgument|sanction_templates/);
    // The real reason is logged for the person running the server.
    expect(log.mock.calls.flat().join(' ')).toMatch(/InvalidArgument|Invalid argument/);
  });
});

describe('createUnavailableStorage', () => {
  test('every file operation is a 503 storage_unavailable', async () => {
    const storage = createUnavailableStorage('set STORAGE_BUCKET_FILES');
    for (const operation of [
      () => storage.put('k', new Uint8Array([1]), 'application/pdf'),
      () => storage.delete('k'),
      () => storage.presignGet('k'),
    ]) {
      await expect(operation()).rejects.toMatchObject({ status: 503, code: 'storage_unavailable' });
    }
  });
});
