import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { StaffStudentRecord } from '@shared/types';
import { ConfirmModal } from '@/components/feedback';
import { PageError, Spinner } from '@/components/feedback/PageState';
import { StatusPill } from '@/components/ui';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Tag } from '@/components/ui/Tag';
import { api, toApiError } from '@/api/client';
import { useApi } from '@/hooks/useApi';
import { ordinalYear } from '@/utils/account';
import { cn } from '@/utils/cn';
import { formatTerm } from '@/utils/format';
import { defaultRecordTab, isActiveCase, recordCaseRow, recordSanctionRow, recordTiles, type RecordTab, type RecordTile } from '@/utils/studentRecord';

const ACCENT: Record<RecordTile['accent'], string> = {
  bad: 'bg-bad-ink',
  green: 'bg-success-strong',
  gold: 'bg-gold-line',
  primary: 'bg-primary',
};

/** One of the four tiles that act as tabs (src 952). The Clearance tile opens that student's clearance. */
function RecordTileButton({ tile, selected, onPick }: { tile: RecordTile; selected: boolean; onPick: () => void }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onPick}
      className={cn(
        '@container relative flex min-h-[120px] min-w-0 flex-col items-start justify-center gap-1.5 rounded-xl border-[1.5px] bg-white py-4 pr-[18px] pl-[22px] text-left text-ink outline-none hover:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/30',
        selected ? 'border-primary' : 'border-line',
      )}
    >
      <span aria-hidden="true" className={cn('absolute top-3.5 -left-[1.5px] h-[34px] w-[5px] rounded-r-[3px]', ACCENT[tile.accent])} />
      <span className="text-[clamp(12px,7cqi,14px)] font-semibold text-muted">{tile.label}</span>
      <span className="text-[clamp(32px,22cqi,48px)] leading-none font-extrabold tracking-[-0.02em]">{tile.value}</span>
      <span className={cn('text-[clamp(11px,6cqi,12px)] font-medium', tile.warn ? 'text-bad-ink' : 'text-muted')}>{tile.sub}</span>
    </button>
  );
}

function ListBox({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden rounded-[10px] border border-line-soft">
      <div className="flex items-center justify-between gap-2 border-b border-line-soft bg-surface-2 px-4 py-2.5">
        <span className="text-sm font-bold text-ink">{title}</span>
        <span className="text-xs text-muted">{sub}</span>
      </div>
      {children}
    </div>
  );
}

function RecordLists({ data, tab }: { data: StaffStudentRecord; tab: RecordTab }) {
  if (tab === 'san') {
    return (
      <ListBox title="Sanctions" sub={`${data.sanctions.length} total`}>
        {data.sanctions.length === 0 ? <p className="px-4 py-5 text-center text-[13px] text-muted">No sanctions on record.</p> : null}
        {data.sanctions.map((sanction) => {
          const row = recordSanctionRow(sanction);
          return (
            <Link
              key={row.key}
              to={row.href}
              aria-label={`Open case ${row.caseCode}`}
              className="flex items-center gap-3.5 border-b border-line-soft px-4 py-3 outline-none hover:bg-tint-soft focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
            >
              <span className="w-[104px] shrink-0 leading-snug">
                <span className="block text-xs font-bold text-ink">{row.code}</span>
                <span className="block text-xs whitespace-nowrap text-muted">{row.due}</span>
              </span>
              <span className="min-w-0 flex-1 leading-snug">
                <span className="block font-semibold text-pretty text-ink">{row.title}</span>
                <span className="block text-xs font-semibold text-primary">Case {row.caseCode}</span>
              </span>
              <StatusPill status={sanction.status} kind="sanction" />
            </Link>
          );
        })}
      </ListBox>
    );
  }
  const history = tab === 'history';
  const shown = data.cases.filter((item) => (history ? !isActiveCase(item) : isActiveCase(item)));
  return (
    <ListBox title={history ? 'Resolved cases' : 'Active cases'} sub={`${shown.length} case${shown.length === 1 ? '' : 's'}`}>
      {shown.length === 0 ? <p className="px-4 py-5 text-center text-[13px] text-muted">{history ? 'No resolved cases yet.' : 'No active cases.'}</p> : null}
      {shown.map((item) => {
        const row = recordCaseRow(item, data.sanctions);
        return (
          <Link
            key={row.key}
            to={row.href}
            className="flex min-h-16 items-center gap-3.5 border-b border-line-soft bg-white px-4 py-2.5 outline-none hover:bg-tint-soft focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
          >
            <span className="w-[104px] shrink-0 leading-snug">
              <span className="block text-xs font-bold whitespace-nowrap text-ink">{row.code}</span>
              <span className="block text-xs whitespace-nowrap text-muted">{row.date}</span>
            </span>
            <span className="min-w-0 flex-1 leading-snug">
              <span className="flex flex-wrap items-center gap-1.5">
                <span className="font-semibold text-ink">{item.violation}</span>
                <StatusPill status={item.severity} />
                {row.tag ? <Tag>{row.tag}</Tag> : null}
              </span>
              <span className="mt-0.5 block text-xs text-muted">{row.line}</span>
            </span>
            <StatusPill status={item.status} kind="case" />
          </Link>
        );
      })}
    </ListBox>
  );
}

export function StudentRecordPane({ studentId }: { studentId: string }) {
  const navigate = useNavigate();
  const record = useApi(() => api.student(studentId), [studentId]);
  // The Clearance tile reads this student's row of the current term (D3).
  const clearance = useApi(async () => {
    const { current } = await api.clearanceTerms();
    const roster = await api.clearanceRoster(current.academicYear, current.semester, { q: studentId });
    return { term: current, row: roster.students.find((row) => row.studentId === studentId) ?? null };
  }, [studentId]);
  const [tab, setTab] = useState<RecordTab | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [temp, setTemp] = useState<string | null>(null);

  if (record.status === 'loading') {
    return (
      <div role="status" className="flex min-h-40 items-center justify-center gap-2 rounded-xl border border-line bg-white text-[13px] text-muted">
        <Spinner />
        Loading the record…
      </div>
    );
  }
  if (record.status === 'error') {
    return (
      <div className="rounded-xl border border-line bg-white">
        <PageError page="this student" detail={record.error.message} onRetry={record.reload} />
      </div>
    );
  }
  const data = record.data;
  const { profile } = data;
  const name = `${profile.firstName} ${profile.lastName}`;
  const current = tab ?? defaultRecordTab(data);
  const termInfo =
    clearance.status === 'ready' && clearance.data.row?.clearance
      ? { done: clearance.data.row.clearance.done, total: clearance.data.row.clearance.total, term: formatTerm(clearance.data.term.academicYear, clearance.data.term.semester) }
      : null;
  const tiles = recordTiles(data, termInfo);

  return (
    <section aria-label={`${name}, student record`} className="@container flex min-h-full flex-col gap-5 rounded-xl border border-line bg-white p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-2xl leading-tight font-bold text-ink">{name}</h2>
          <p className="text-muted">
            {profile.studentId} · {profile.program} · {ordinalYear(profile.yearLevel)}
          </p>
          <p className="text-xs text-muted">{profile.email}</p>
          {!profile.isActive ? <p className="mt-1 text-xs font-semibold text-danger">Account is inactive</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="md" className="min-h-11 px-3.5 rail:min-h-[42px]" onClick={() => setConfirming(true)}>
            <Icon name="key" className="!text-xl" />
            Reset password
          </Button>
        </div>
      </header>

      <div role="tablist" aria-label="Student record" className="grid grid-cols-2 gap-3 @min-[760px]:grid-cols-4">
        {tiles.map((tile) => (
          <RecordTileButton
            key={tile.key}
            tile={tile}
            selected={tile.key === current}
            onPick={() => {
              if (tile.key !== 'clr') {
                setTab(tile.key);
                return;
              }
              const term = clearance.status === 'ready' ? `${clearance.data.term.academicYear}-${clearance.data.term.semester}` : '';
              navigate(`/clearance/${profile.studentId}${term ? `?term=${term}` : ''}`);
            }}
          />
        ))}
      </div>

      <RecordLists data={data} tab={current} />

      <ConfirmModal
        open={confirming}
        title={`Reset password for ${name}?`}
        description="This creates a one-time temporary password. Their current password stops working, and they must choose a new one at next sign-in."
        confirmLabel="Create temporary password"
        onClose={() => setConfirming(false)}
        onConfirm={async () => {
          try {
            const result = await api.resetStudentPassword(profile.studentId);
            setConfirming(false);
            setTemp(result.tempPassword);
          } catch (error) {
            throw new Error(toApiError(error).message);
          }
        }}
      />
      <ConfirmModal
        open={temp !== null}
        tone="ok"
        title="Temporary password created"
        description={`Give this to ${name} in person. It works once and is not shown again.`}
        code={temp ?? undefined}
        confirmLabel="Done"
        hideCancel
        onClose={() => setTemp(null)}
        onConfirm={() => setTemp(null)}
      />
    </section>
  );
}
