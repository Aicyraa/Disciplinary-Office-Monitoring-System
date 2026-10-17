import { useEffect, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import type { Severity } from '@shared/types';
import { PageError, PageNotFound } from '@/components/feedback/PageState';
import { SkeletonList } from '@/components/feedback/Skeleton';
import { MasterDetail } from '@/components/layout/MasterDetail';
import { ClassTiles } from '@/components/student/ClassTiles';
import { ChipGroup } from '@/components/ui/ChipGroup';
import { meApi } from '@/api/me';
import { useApi } from '@/hooks/useApi';
import { hiddenByFilters, matchesSanctionChip, sanctionChips, type ClassKey, type SanctionChip } from '@/utils/studentView';
import { SanctionDetail } from './sanctions/SanctionDetail';
import { SanctionTable } from './sanctions/SanctionTable';

/** My sanctions (deck W65 to W67): class tiles, status chips, the table and the selected sanction. */
export function SanctionsPage() {
  const { id } = useParams();
  const location = useLocation();
  const selectedId = /^\d+$/.test(id ?? '') ? Number(id) : null;
  const sanctions = useApi(() => meApi.mySanctions(), []);
  // The violation name and section of each sanction's case.
  const cases = useApi(() => meApi.myCases(), []);
  const [cls, setCls] = useState<ClassKey>('all');
  const [chip, setChip] = useState<SanctionChip>('all');

  // Arriving from elsewhere resets the filters so the sanction is in the list (5.4b).
  const fromList = (location.state as { fromList?: boolean } | null)?.fromList;
  useEffect(() => {
    if (selectedId === null || fromList) return;
    setCls('all');
    setChip('all');
  }, [selectedId, location.key, fromList]);

  if (sanctions.status === 'loading') {
    return (
      <SkeletonList label="Loading your sanctions…" className="px-0" />
    );
  }
  if (sanctions.status === 'error') return <PageError page="My sanctions" detail={sanctions.error.message} onRetry={sanctions.reload} />;

  const all = sanctions.data.sanctions;
  const byClass = all.filter((item) => cls === 'all' || item.severity === (cls as Severity));
  const rows = byClass.filter((item) => matchesSanctionChip(item, chip));
  const caseRows = cases.status === 'ready' ? cases.data.cases : [];
  // A selected sanction the filters hide is not shown beside a list that no longer holds it.
  const hidden = hiddenByFilters(selectedId, all, rows);
  const current = selectedId === null || hidden ? rows[0] : all.find((item) => item.id === selectedId);
  const detail = current ? (
    <SanctionDetail key={current.id} sanction={current} caseRow={caseRows.find((c) => c.id === current.caseId)} onChanged={sanctions.reload} />
  ) : selectedId !== null && !hidden ? (
    <PageNotFound what="sanction" backTo="/sanctions" backLabel="Back to my sanctions" />
  ) : null;

  return (
    <>
      <h1 className="sr-only">My sanctions</h1>
      <MasterDetail
        ratio="student"
        detailKey={selectedId}
        list={
          <div className="flex h-full min-h-0 flex-col gap-4">
            <ClassTiles
              label="Classification"
              tiles={[
                { key: 'all', label: 'All sanctions', count: all.length },
                { key: 'Minor', label: 'Minor offense', count: all.filter((s) => s.severity === 'Minor').length },
                { key: 'Major', label: 'Major offense', count: all.filter((s) => s.severity === 'Major').length },
              ]}
              value={cls}
              onChange={setCls}
            />
            <ChipGroup
              label="Filter sanctions"
              options={sanctionChips(byClass)}
              value={chip}
              onChange={(value) => setChip(value as SanctionChip)}
              className="justify-center [&>button]:min-h-11 rail:[&>button]:min-h-[38px]"
            />
            <SanctionTable rows={rows} selectedId={current?.id ?? null} emptyText={all.length === 0 ? 'You have no sanctions.' : undefined} />
          </div>
        }
        detail={selectedId === null || hidden ? null : detail}
        emptyDetail={detail}
      />
    </>
  );
}
