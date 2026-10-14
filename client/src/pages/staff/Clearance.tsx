import { useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { PageError, Spinner } from '@/components/feedback/PageState';
import { MasterDetail } from '@/components/layout/MasterDetail';
import { ChipGroup } from '@/components/ui/ChipGroup';
import { EmptyBlock } from '@/components/ui/EmptyBlock';
import { api } from '@/api/client';
import { useApi } from '@/hooks/useApi';
import { parseTermParam, termParam } from '@/utils/clearance';
import { formatTerm } from '@/utils/format';
import { ClearancePane } from './clearance/ClearancePane';
import { StudentRoster } from './clearance/StudentRoster';

const STUDENT_ID = /^\d{4}-\d{7}$/;

/** Staff Clearance (deck W50 to W56): term chips, every student of the term, one student's checklist (D3, D8). */
export function StaffClearancePage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const studentId = STUDENT_ID.test(id ?? '') ? (id as string) : null;
  const terms = useApi(() => api.clearanceTerms(), []);
  const [firstRow, setFirstRow] = useState<string | null>(null);
  const rosterReload = useRef<(() => void) | null>(null);
  const reloadRoster = () => rosterReload.current?.();

  if (terms.status === 'loading') {
    return (
      <p role="status" className="flex items-center gap-2 text-[13px] text-muted">
        <Spinner />
        Loading terms…
      </p>
    );
  }
  if (terms.status === 'error') return <PageError page="Clearance" detail={terms.error.message} onRetry={terms.reload} />;

  const term = parseTermParam(params.get('term')) ?? terms.data.current;
  const options = [...terms.data.terms];
  if (!options.some((t) => termParam(t) === termParam(term))) options.unshift(term);
  const pickTerm = (value: string) => navigate(studentId ? `/clearance/${studentId}?term=${value}` : `/clearance?term=${value}`);

  return (
    <>
      <h1 className="sr-only">Clearance</h1>
      <div className="mb-5 flex flex-wrap items-center gap-2.5">
        <ChipGroup
          label="Term"
          options={options.map((t) => ({ value: termParam(t), label: formatTerm(t.academicYear, t.semester) }))}
          value={termParam(term)}
          onChange={pickTerm}
          className="gap-1.5"
        />
      </div>
      <MasterDetail
        ratio="clearance"
        detailKey={studentId}
        list={<StudentRoster term={term} selectedId={studentId} onFirstRow={setFirstRow} reloadRef={rosterReload} />}
        detail={studentId === null ? null : <ClearancePane key={`${studentId}-${termParam(term)}`} studentId={studentId} term={term} onChanged={reloadRoster} />}
        emptyDetail={
          firstRow === null ? (
            <div className="rounded-xl border border-line bg-white">
              <EmptyBlock icon="checklist" title="No student selected">
                Pick a student to see their checklist.
              </EmptyBlock>
            </div>
          ) : (
            <ClearancePane key={`${firstRow}-${termParam(term)}`} studentId={firstRow} term={term} onChanged={reloadRoster} />
          )
        }
      />
    </>
  );
}
