/** Previous / Next with "Page n of m". Renders nothing when everything fits on one page. */
export function Pagination({
  page,
  total,
  pageSize,
  onPage,
  noun = 'results',
}: {
  page: number;
  total: number;
  pageSize: number;
  onPage: (page: number) => void;
  /** What is being counted, for the caption: "cases", "messages". */
  noun?: string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages === 1) return null;
  const button =
    'min-h-11 rounded-md border border-line-strong bg-white px-3 font-medium disabled:opacity-50';
  return (
    <nav className="flex items-center justify-between gap-2 border-t border-line p-3 text-sm" aria-label="Pagination">
      <button type="button" className={button} disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Previous
      </button>
      <span className="text-muted">
        Page {page} of {pages} · {total} {noun}
      </span>
      <button type="button" className={button} disabled={page >= pages} onClick={() => onPage(page + 1)}>
        Next
      </button>
    </nav>
  );
}
