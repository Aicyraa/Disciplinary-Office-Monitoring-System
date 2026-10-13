import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';
import { FilePreviewFrame } from '@/components/feedback/FilePreview';
import { canPreview, fileMeta } from '@/utils/files';

describe('fileMeta', () => {
  test('type, size and the Manila upload time, like the deck', () => {
    expect(fileMeta({ name: 'log.pdf', sizeBytes: 248_000, dateUploaded: '2026-10-07T06:28:00.000Z' })).toBe(
      'PDF · 242.2 KB · Uploaded Oct 7, 2:28 PM',
    );
  });
  test('a chosen file not sent yet', () => {
    expect(fileMeta({ name: 'letter.pdf', sizeBytes: 1024 })).toBe('PDF · 1.0 KB · Not submitted yet');
  });
});

describe('canPreview (files are PDF only, D7)', () => {
  test('a PDF previews; anything else (an old DOCX) only downloads', () => {
    expect(canPreview('proof.pdf')).toBe(true);
    expect(canPreview('PROOF.PDF')).toBe(true);
    expect(canPreview('letter.docx')).toBe(false);
  });
});

describe('FilePreviewFrame (deck W24, src 1952)', () => {
  const file = { name: 'S-019 community service log.pdf', meta: 'PDF · 242 KB · Uploaded Oct 7, 2:28 PM' };

  test('a dialog with the file tile, name, meta, Download and Close', () => {
    const html = renderToStaticMarkup(<FilePreviewFrame file={file} state={{ status: 'loading' }} onClose={() => undefined} onDownload={() => undefined} />);
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('>picture_as_pdf<');
    expect(html).toContain('S-019 community service log.pdf');
    expect(html).toContain('PDF · 242 KB · Uploaded Oct 7, 2:28 PM');
    expect(html).toContain('aria-label="Download S-019 community service log.pdf"');
    expect(html).toContain('aria-label="Close preview"');
    expect(html).toContain('Preparing preview…');
  });

  test('ready: the PDF shows in an iframe inside the app', () => {
    const html = renderToStaticMarkup(
      <FilePreviewFrame file={file} state={{ status: 'ready', url: 'https://bucket.example/x.pdf' }} onClose={() => undefined} onDownload={() => undefined} />,
    );
    expect(html).toMatch(/<iframe[^>]*src="https:\/\/bucket.example\/x.pdf"/);
    expect(html).toContain('title="S-019 community service log.pdf"');
  });

  test('a file that cannot be previewed says so and offers the download', () => {
    const html = renderToStaticMarkup(
      <FilePreviewFrame file={{ name: 'old.docx', meta: 'DOCX' }} state={{ status: 'error', message: 'This file could not be previewed here. Download it instead.' }} onClose={() => undefined} onDownload={() => undefined} />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain('>draft<');
    expect(html).toContain('This file could not be previewed here. Download it instead.');
    expect(html).not.toContain('<iframe');
  });

  test('staff footer: the hint and the Return / Verify actions', () => {
    const html = renderToStaticMarkup(
      <FilePreviewFrame
        file={file}
        state={{ status: 'loading' }}
        onClose={() => undefined}
        onDownload={() => undefined}
        footer={<span>Open the other files before you verify.</span>}
      />,
    );
    expect(html).toContain('Open the other files before you verify.');
  });
});

describe('files are reviewed in the app, never in another tab (UI-POLISH-SPEC 4.2b)', () => {
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      return statSync(path).isDirectory() ? walk(path) : /\.(ts|tsx)$/.test(name) ? [path] : [];
    });

  test('no source file calls window.open or uses target="_blank"', () => {
    const offenders = walk(join(process.cwd(), 'client/src')).filter((path) => {
      const text = readFileSync(path, 'utf8');
      return /window\.open\(/.test(text) || /target=["']_blank["']/.test(text);
    });
    expect(offenders).toEqual([]);
  });
});
