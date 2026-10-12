import { useMemo, useState } from 'react';
import type { HandbookEntryView, Severity } from '@shared/types';
import { useAuth } from '../auth/AuthContext';
import { EmptyState, PageHeader, Resource, StatusPill, buttonClass, fieldClass } from '../components/ui';
import { api } from '../lib/api';
import { useApi } from '../lib/useApi';
import { ViolationForm, type SanctionChoice } from './HandbookAdmin';
import { TemplatesTab } from './SanctionTemplates';

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

function Entry({
  entry,
  choices,
  isStaff,
  onChanged,
}: {
  entry: HandbookEntryView;
  choices: SanctionChoice[];
  isStaff: boolean;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const offenses = [...new Set(entry.sanctions.map((s) => s.offenseNumber))];
  return (
    <li className="rounded-lg border border-line bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-medium text-ink">{entry.violation}</div>
          <div className="text-sm text-muted">
            Section {entry.section} · {entry.violationCode} / {entry.code}
            {isStaff && entry.usedInCases !== undefined
              ? ` · Used in ${entry.usedInCases} case${entry.usedInCases === 1 ? '' : 's'}`
              : ''}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusPill status={entry.severity} />
          {isStaff ? (
            <button
              type="button"
              aria-expanded={editing}
              aria-label={`Edit ${entry.violation}`}
              className="rounded-md border border-line-strong bg-white px-3 py-1 text-xs font-semibold text-ink hover:bg-page"
              onClick={() => setEditing((value) => !value)}
            >
              {editing ? 'Close' : 'Edit'}
            </button>
          ) : null}
        </div>
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
      {isStaff && editing ? (
        <ViolationForm
          key={`${entry.id}-${entry.description}-${entry.sanctions.length}`}
          entry={entry}
          choices={choices}
          onCancel={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            onChanged();
          }}
        />
      ) : null}
    </li>
  );
}

type Tab = 'violations' | 'templates';

export function HandbookPage() {
  const { state } = useAuth();
  const isStaff = state.status === 'authenticated' && state.user.role === 'staff';
  const resource = useApi(() => api.handbook(), []);
  // Staff need the list of sanctions to pick from; everyone else skips the request.
  const sanctions = useApi(() => (isStaff ? api.sanctionTemplates() : Promise.resolve({ templates: [] })), [isStaff]);
  const [tab, setTab] = useState<Tab>('violations');
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState('');
  const [severity, setSeverity] = useState<'all' | Severity>('all');

  const entries = resource.status === 'ready' ? resource.data.entries : null;
  const shown = useMemo(() => (entries ? filterEntries(entries, query, severity) : []), [entries, query, severity]);
  const choices: SanctionChoice[] =
    sanctions.status === 'ready'
      ? sanctions.data.templates.map((template) => ({ sanctionId: template.sanctionId, label: `${template.sanctionCode} · ${template.type}` }))
      : [];

  return (
    <>
      <PageHeader
        title={isStaff ? 'Handbook' : 'Student handbook'}
        subtitle="Violations, the sanctions the handbook allows for each offense, and the sanction templates."
        actions={
          isStaff && tab === 'violations' ? (
            <button type="button" className={buttonClass} onClick={() => setAdding((value) => !value)}>
              {adding ? 'Close' : 'Add violation'}
            </button>
          ) : undefined
        }
      />
      <div className="mb-4 flex gap-2" role="tablist" aria-label="Handbook sections">
        {(
          [
            ['violations', 'Violations'],
            ['templates', 'Sanction templates'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`rounded-full border px-3 py-1 text-sm font-medium ${
              tab === key ? 'border-primary bg-primary text-white' : 'border-line-strong bg-white text-ink'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'templates' ? (
        <TemplatesTab isStaff={isStaff} />
      ) : (
        <>
          {isStaff && adding ? (
            <div className="mb-4 rounded-lg border border-line bg-white p-4">
              <ViolationForm
                choices={choices}
                onCancel={() => setAdding(false)}
                onSaved={() => {
                  setAdding(false);
                  resource.reload();
                }}
              />
            </div>
          ) : null}
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
                    <Entry key={entry.id} entry={entry} choices={choices} isStaff={isStaff} onChanged={resource.reload} />
                  ))}
                </ul>
              )
            }
          </Resource>
        </>
      )}
    </>
  );
}
