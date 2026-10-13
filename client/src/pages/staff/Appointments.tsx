import { useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { MasterDetail } from '@/components/layout/MasterDetail';
import { EmptyBlock } from '@/components/ui/EmptyBlock';
import { AppointmentList } from './appointments/AppointmentList';
import { AppointmentPane } from './appointments/AppointmentPane';
export { EditAppointmentPage, MakeAppointmentPage } from './AppointmentForm';

/** Staff Appointments (deck W36, W37): filtered list on the left, the selected appointment on the right. */
export function StaffAppointmentsPage() {
  const { id } = useParams();
  const appointmentId = /^\d+$/.test(id ?? '') ? Number(id) : null;
  const reloadList = useRef<(() => void) | null>(null);
  const [firstRow, setFirstRow] = useState<number | null>(null);

  return (
    <>
      <h1 className="sr-only">Appointments</h1>
      <MasterDetail
        ratio="appointments"
        detailKey={appointmentId}
        list={<AppointmentList selectedId={appointmentId} reloadRef={reloadList} onFirstRow={setFirstRow} />}
        detail={appointmentId === null ? null : <AppointmentPane key={appointmentId} appointmentId={appointmentId} onChanged={() => reloadList.current?.()} />}
        emptyDetail={
          firstRow === null ? (
            <div className="grid min-h-full place-items-center rounded-xl border border-line bg-white">
              <EmptyBlock icon="calendar_month" title="No appointment selected">
                Pick one from the list.
              </EmptyBlock>
            </div>
          ) : (
            <AppointmentPane key={firstRow} appointmentId={firstRow} onChanged={() => reloadList.current?.()} />
          )
        }
      />
    </>
  );
}
