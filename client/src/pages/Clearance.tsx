import { useState } from 'react';
import { Card, EmptyState, Icon, PageHeader, Resource, StatusPill, fieldClass } from '../components/ui';
import { api } from '../lib/api';
import { formatDate, formatTerm } from '../lib/format';
import { useApi } from '../lib/useApi';

export function ClearancePage() {
  // `null` means "the newest term"; the API picks it.
  const [term, setTerm] = useState<{ academicYear: number; semester: number } | null>(null);
  const resource = useApi(() => api.myClearance(term ?? undefined), [term?.academicYear, term?.semester]);

  return (
    <>
      <PageHeader title="Clearance" subtitle="Requirements the office has set for each term. Staff mark them done." />
      <Resource resource={resource} onRetry={resource.reload}>
        {({ terms, clearance }) => {
          if (terms.length === 0) {
            return <EmptyState title="No clearance has been set up for you yet." />;
          }
          const selected = clearance ?? terms[0];
          return (
            <>
              <div className="mb-4">
                <label htmlFor="term" className="mb-1 block text-sm font-medium text-ink">
                  Term
                </label>
                <select
                  id="term"
                  className={`${fieldClass} max-w-xs`}
                  value={`${selected.academicYear}-${selected.semester}`}
                  onChange={(event) => {
                    const [year, semester] = event.target.value.split('-').map(Number);
                    setTerm({ academicYear: year, semester });
                  }}
                >
                  {terms.map((option) => (
                    <option key={`${option.academicYear}-${option.semester}`} value={`${option.academicYear}-${option.semester}`}>
                      {formatTerm(option.academicYear, option.semester)}
                    </option>
                  ))}
                </select>
              </div>
              {clearance ? (
                <Card>
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <span className="font-semibold text-ink">{formatTerm(clearance.academicYear, clearance.semester)}</span>
                    <StatusPill status={clearance.status} />
                  </div>
                  <ul className="divide-y divide-line">
                    {clearance.items.map((item) => (
                      <li key={item.requirementId} className="flex items-start gap-3 py-3">
                        <Icon
                          name={item.status === 'completed' ? 'check_circle' : 'radio_button_unchecked'}
                          className={item.status === 'completed' ? 'text-success' : 'text-muted'}
                        />
                        <div>
                          <div className="font-medium text-ink">{item.label}</div>
                          <div className="text-sm text-muted">
                            {item.status === 'completed' && item.dateCompleted
                              ? `Done ${formatDate(item.dateCompleted)}`
                              : 'Pending'}
                            {item.remarks ? ` · ${item.remarks}` : ''}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </Card>
              ) : (
                <EmptyState title="No clearance for this term." />
              )}
            </>
          );
        }}
      </Resource>
    </>
  );
}
