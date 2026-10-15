import { describe, expect, test } from 'vitest';
import { flowUrlsFromEnv, readServerEnv, requireEnv, s3Configured } from '../../src/config/env.js';

describe('env reading', () => {
  test('port falls back from SERVER_PORT to PORT to 3000', () => {
    expect(readServerEnv({ SERVER_PORT: '4000', PORT: '5000' }).port).toBe(4000);
    expect(readServerEnv({ PORT: '5000' }).port).toBe(5000);
    expect(readServerEnv({}).port).toBe(3000);
  });

  test('production is exactly NODE_ENV=production', () => {
    expect(readServerEnv({ NODE_ENV: 'production' }).isProduction).toBe(true);
    expect(readServerEnv({ NODE_ENV: 'development' }).isProduction).toBe(false);
  });

  test('an empty flow URL counts as not configured', () => {
    expect(flowUrlsFromEnv({ PA_NOTIFY_URL: '', PA_GATE_URL: 'https://flow.example/g' })).toEqual({
      notify: undefined,
      gate: 'https://flow.example/g',
    });
  });

  test('storage is configured only with endpoint and key id', () => {
    expect(s3Configured({ AWS_ENDPOINT_URL_S3: 'https://s3.example' })).toBe(false);
    expect(s3Configured({ AWS_ENDPOINT_URL_S3: 'https://s3.example', AWS_ACCESS_KEY_ID: 'k' })).toBe(true);
  });

  test('requireEnv names the missing variable', () => {
    expect(() => requireEnv('AWS_REGION', {})).toThrow(/AWS_REGION/);
    expect(requireEnv('AWS_REGION', { AWS_REGION: 'x' })).toBe('x');
  });
});
