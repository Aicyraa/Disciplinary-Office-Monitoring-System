import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { MasterDetail } from '@/components/layout/MasterDetail';
import { EmptyBlock } from '@/components/ui/EmptyBlock';
import { StudentList } from './students/StudentList';
import { StudentRecordPane } from './students/StudentRecordPane';

/** Staff Students (deck W30 to W32): searchable list, the student's record with tile tabs, reset password. */
export function StudentsPage() {
  const { id } = useParams();
  // With nothing selected, the wide layout shows the first student of the list (the deck always has one open).
  const [firstRow, setFirstRow] = useState<string | null>(null);
  return (
    <>
      <h1 className="sr-only">Students</h1>
      <MasterDetail
        ratio="students"
        detailKey={id}
        list={<StudentList selectedId={id ?? null} onFirstRow={setFirstRow} />}
        detail={id ? <StudentRecordPane key={id} studentId={id} /> : null}
        emptyDetail={
          firstRow === null ? (
            <div className="rounded-xl border border-line bg-white">
              <EmptyBlock icon="person_search" title="No student selected">
                Pick a student to see their cases, sanctions and clearance.
              </EmptyBlock>
            </div>
          ) : (
            <StudentRecordPane key={firstRow} studentId={firstRow} />
          )
        }
      />
    </>
  );
}
