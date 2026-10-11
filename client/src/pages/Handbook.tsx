import { useMemo, useState } from 'react';
import type { HandbookEntryView, Severity } from '../../../shared/types';
import { EmptyState, PageHeader, Resource, StatusPill, fieldClass } from '../components/ui';
import { api } from '../lib/api';
import { useApi } from '../lib/useApi';

/** Filter by free text (violation, section, code) and severity. Pure so it can be tested without a DOM. */
export function filterEntries(entries: HandbookEntryView[], query: string, severity: 'all' | Severity): HandbookEntryView[] {
  const needle = query.trim().toLowerCase();
  return entries.filter((entry) => {
    if (severity !== 'all' && entry.severity !== severity) return false;
    if (needle === '') return true;
    return [entry.violation, entry.section, entry.code, entry.description].some((text) =>
      text.toLowerCase().includes(needle),
    );
  });
}

function Entry({ entry }: { entry: HandbookEntryView }) {
  const offenses = [...new Set(entry.sanctions.map((s) => s.offenseNumber))];
  return (
    <li className="rounded-lg border border-line bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-medium text-ink">{entry.violation}</div>
          <div className="text-sm text-muted">
            Section {entry.section} · {entry.violationCode} / {entry.code}
          </div>
        </div>
        <StatusPill status={entry.severity} />
      </div>
      <p className="mt-2 text-sm">{entry.description}</p>
      {offenses.length > 0 ? (
        <dl className="mt-3 space-y-1 text-sm">
          {offenses.map((offense) => (
            <div key={offense} className="flex gap-2">
              <dt className="w-24 shrink-0 font-medium text-ink">Offense {offense}</dt>
              <dd>
                {entry.sanctions
                  .filter((s) => s.offenseNumber === offense)
                  .map((s) => s.type)
                  .join(', ')}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </li>
  );
}

export function HandbookPage() {
  const resource = useApi(() => api.handbook(), []);
  const [query, setQuery] = useState('');
  const [severity, setSeverity] = useState<'all' | Severity>('all');

  const entries = resource.status === 'ready' ? resource.data.entries : null;
  const shown = useMemo(() => (entries ? filterEntries(entries, query, severity) : []), [entries, query, severity]);

  return (
    <>
      <PageHeader title="Student handbook" subtitle="Violations and the sanctions the handbook allows for each offense." />
      <div className="mb-4 flex flex-wrap gap-3">
        <div className="min-w-0 flex-1">
          <label htmlFor="handbook-search" className="sr-only">
            Search the handbook
          </label>
          <input
            id="handbook-search"
            type="search"
            placeholder="Search violation, section or code"
            className={fieldClass}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div>
          <label htmlFor="handbook-severity" className="sr-only">
            Severity
          </label>
          <select
            id="handbook-severity"
            className={fieldClass}
            value={severity}
            onChange={(event) => setSeverity(event.target.value as 'all' | Severity)}
          >
            <option value="all">All severities</option>
            <option value="Minor">Minor</option>
            <option value="Major">Major</option>
          </select>
        </div>
      </div>
      <Resource resource={resource} onRetry={resource.reload}>
        {() =>
          shown.length === 0 ? (
            <EmptyState title="No handbook entries match." />
          ) : (
            <ul className="space-y-3">
              {shown.map((entry) => (
                <Entry key={entry.id} entry={entry} />
              ))}
            </ul>
          )
        }
      </Resource>
    </>
  );
}
