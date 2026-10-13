import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { HandbookEntryView, SanctionTemplateView, Severity } from '@shared/types';
import { TemplateFileLinks, hasTemplateContent } from '../components/TemplateDownloads';
import { useAuth } from '../auth/AuthContext';
import { MasterDetail } from '../components/MasterDetail';
import { Card, EmptyState, ErrorState, Icon, LoadingState, PageHeader, StatusPill, buttonClass, fieldClass } from '../components/ui';
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

function EntryPane({ entry, templates }: { entry: HandbookEntryView; templates: Map<number, SanctionTemplateView> }) {
  const offenses = [...new Set(entry.sanctions.map((s) => s.offenseNumber))];
  const posted = [...new Map(entry.sanctions.map((s) => [s.sanctionId, templates.get(s.sanctionId)])).values()].filter(
    (template): template is SanctionTemplateView => template !== undefined && template.files.length > 0 && hasTemplateContent(template),
  );
  return (
    <article aria-label={entry.violation} className="rounded-lg border border-line bg-white p-4">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-ink">{entry.violation}</h2>
          <p className="text-sm text-muted">
            Sec. {entry.section} · {entry.violationCode} / {entry.code}
          </p>
        </div>
        <StatusPill status={entry.severity} />
      </header>
      <p className="mt-3 text-sm text-body">{entry.description}</p>
      <h3 className="mt-4 text-sm font-semibold text-ink">Sanction per offense</h3>
      {offenses.length === 0 ? (
        <p className="mt-1 text-sm text-muted">The handbook lists no sanction for this violation.</p>
      ) : (
        <dl className="mt-2 rounded-lg border border-line">
          {offenses.map((offense) => (
            <div key={offense} className="grid grid-cols-[6rem_1fr] gap-2 border-b border-line px-3 py-2 last:border-0">
              <dt className="text-sm font-medium text-ink">Offense {offense}</dt>
              <dd className="text-sm">
                {entry.sanctions
                  .filter((s) => s.offenseNumber === offense)
                  .map((s) => s.type)
                  .join(', ')}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {posted.length > 0 ? (
        <div className="mt-4 rounded-lg bg-page px-3 py-3 text-sm">
          <p className="font-semibold text-ink">Template posted</p>
          {posted.map((template) => (
            <div key={template.sanctionId} className="mt-1">
              <p className="text-xs text-muted">{template.type}</p>
              <TemplateFileLinks template={template} />
            </div>
          ))}
        </div>
      ) : null}
      <p className="mt-4 text-xs text-muted">
        Sanction templates are posted on the{' '}
        <Link to="/handbook?tab=templates" className="font-medium text-primary underline">
          Sanction templates
        </Link>{' '}
        page.
      </p>
    </article>
  );
}

function EntryList({
  entries,
  selectedId,
  isStaff,
}: {
  entries: HandbookEntryView[];
  selectedId: number | null;
  isStaff: boolean;
}) {
  const [query, setQuery] = useState('');
  const [severity, setSeverity] = useState<'all' | Severity>('all');
  const shown = useMemo(() => filterEntries(entries, query, severity), [entries, query, severity]);
  const counts = {
    all: entries.length,
    Minor: entries.filter((e) => e.severity === 'Minor').length,
    Major: entries.filter((e) => e.severity === 'Major').length,
  };

  return (
    <section aria-label="Handbook violations" className="rounded-lg border border-line bg-white">
      <div className="space-y-3 border-b border-line p-3">
        <div>
          <h2 className="text-base font-bold text-ink">Handbook violations</h2>
          <p className="text-xs text-muted">
            {counts.all} violations · {counts.Major} major
          </p>
        </div>
        <label className="relative block">
          <span className="sr-only">Search the handbook</span>
          <Icon name="search" className="absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
          <input
            type="search"
            placeholder="Search a violation or section"
            className={`${fieldClass} min-h-11 pl-10`}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Category">
          {(
            [
              ['all', `All ${counts.all}`],
              ['Minor', `Minor ${counts.Minor}`],
              ['Major', `Major ${counts.Major}`],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={severity === value}
              onClick={() => setSeverity(value)}
              className={`min-h-11 rounded-full border px-4 text-sm font-medium ${
                severity === value ? 'border-primary bg-primary text-white' : 'border-line-strong bg-white text-ink'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {shown.length === 0 ? (
        <div className="p-3">
          <EmptyState title="No handbook entries match." />
        </div>
      ) : (
        <ul>
          {shown.map((entry) => (
            <li key={entry.id}>
              <Link
                to={`/handbook/${entry.id}`}
                aria-current={entry.id === selectedId ? 'page' : undefined}
                className={`flex min-h-16 items-start justify-between gap-3 border-b border-line px-3 py-2 hover:bg-page ${
                  entry.id === selectedId ? 'bg-primary/10' : ''
                }`}
              >
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-ink">{entry.violation}</span>
                  <span className="block truncate text-xs text-muted">
                    Sec. {entry.section} · {entry.description}
                  </span>
                  {isStaff && entry.usedInCases ? (
                    <span className="text-[11px] text-muted">Used in {entry.usedInCases} case{entry.usedInCases === 1 ? '' : 's'}</span>
                  ) : null}
                </span>
                <StatusPill status={entry.severity} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

type Tab = 'violations' | 'templates';

export function HandbookPage() {
  const { state } = useAuth();
  const { id } = useParams();
  const isStaff = state.status === 'authenticated' && state.user.role === 'staff';
  const resource = useApi(() => api.handbook(), []);
  // Staff need the list of sanctions to pick from; everyone else skips the request.
  const sanctions = useApi(() => api.sanctionTemplates().catch(() => ({ templates: [] as SanctionTemplateView[] })), []);
  const templateBySanction = new Map((sanctions.status === 'ready' ? sanctions.data.templates : []).map((t) => [t.sanctionId, t]));
  const [params, setParams] = useSearchParams();
  const tab: Tab = params.get('tab') === 'templates' ? 'templates' : 'violations';
  const setTab = (next: Tab) => setParams(next === 'templates' ? { tab: 'templates' } : {}, { replace: true });
  const selectedId = /^\d+$/.test(id ?? '') ? Number(id) : null;

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
            <Link to="/handbook/new" className={`${buttonClass} min-h-11`}>
              Add violation
            </Link>
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
            className={`min-h-11 rounded-full border px-4 text-sm font-medium ${
              tab === key ? 'border-primary bg-primary text-white' : 'border-line-strong bg-white text-ink'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'templates' ? (
        <TemplatesTab isStaff={isStaff} />
      ) : resource.status === 'loading' ? (
        <LoadingState label="Loading the handbook…" />
      ) : resource.status === 'error' ? (
        <ErrorState message={resource.error.message} onRetry={resource.reload} />
      ) : (
        <MasterDetail
          list={<EntryList entries={resource.data.entries} selectedId={selectedId} isStaff={isStaff} />}
          detail={(() => {
            if (selectedId === null) return null;
            const entry = resource.data.entries.find((candidate) => candidate.id === selectedId);
            if (!entry) return <ErrorState message="That handbook entry was not found." />;
            return isStaff ? (
              <ViolationForm
                key={`${entry.id}-${entry.description}-${entry.violation}-${entry.sanctions.length}`}
                entry={entry}
                choices={choices}
                onCancel={() => undefined}
                onSaved={resource.reload}
              />
            ) : (
              <EntryPane entry={entry} templates={templateBySanction} />
            );
          })()}
          emptyDetail={<EmptyState title="Select a violation" hint="Its section, wording and sanction per offense appear here." />}
          backTo="/handbook"
          backLabel="All violations"
        />
      )}
    </>
  );
}

/** Staff: add a violation on its own page (deck W46). */
export function AddViolationPage() {
  const navigate = useNavigate();
  const sanctions = useApi(() => api.sanctionTemplates(), []);
  const choices: SanctionChoice[] =
    sanctions.status === 'ready'
      ? sanctions.data.templates.map((template) => ({ sanctionId: template.sanctionId, label: `${template.sanctionCode} · ${template.type}` }))
      : [];
  return (
    <>
      <PageHeader title="Add violation" subtitle="A new handbook violation with the sanction allowed for each offense." />
      {sanctions.status === 'loading' ? <LoadingState label="Loading sanctions…" cards={1} /> : null}
      {sanctions.status === 'error' ? <ErrorState message={sanctions.error.message} onRetry={sanctions.reload} /> : null}
      {sanctions.status === 'ready' ? (
        <Card className="max-w-3xl p-0">
          <ViolationForm choices={choices} onCancel={() => navigate('/handbook')} onSaved={() => navigate('/handbook')} />
        </Card>
      ) : null}
    </>
  );
}
