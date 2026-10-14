import { useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { StaffAppointmentView } from '@shared/types';
import { MasterDetail } from '@/components/layout/MasterDetail';
import { usePageAction } from '@/components/layout/PageAction';
import { EmptyBlock } from '@/components/ui/EmptyBlock';
import { AppointmentList } from './appointments/AppointmentList';
import { AppointmentModal } from './appointments/AppointmentModal';
import { AppointmentPane } from './appointments/AppointmentPane';

/** The dialog over this page: nothing, a new appointment, or the one being edited. */
type FormState = { mode: 'new' } | { mode: 'edit'; appointment: StaffAppointmentView } | null;

/** Staff Appointments (deck W36, W37): filtered list on the left, the selected appointment on the right. */
export function StaffAppointmentsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const appointmentId = /^\d+$/.test(id ?? '') ? Number(id) : null;
  const reloadList = useRef<(() => void) | null>(null);
  const [firstRow, setFirstRow] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(null);
  // Bumped after an edit so the pane for the same appointment loads again.
  const [version, setVersion] = useState(0);
  usePageAction('Make appointment', 'edit_calendar', () => setForm({ mode: 'new' }));

  const pane = (selected: number) => (
    <AppointmentPane
      key={`${selected}-${version}`}
      appointmentId={selected}
      onChanged={() => reloadList.current?.()}
      onEdit={(appointment) => setForm({ mode: 'edit', appointment })}
    />
  );

  return (
    <>
      <h1 className="sr-only">Appointments</h1>
      {form ? (
        <AppointmentModal
          key={form.mode === 'edit' ? form.appointment.id : 'new'}
          editing={form.mode === 'edit' ? form.appointment : null}
          onClose={() => setForm(null)}
          onSaved={(savedId) => {
            setForm(null);
            setVersion((current) => current + 1);
            reloadList.current?.();
            navigate(`/appointments/${savedId}`);
          }}
        />
      ) : null}
      <MasterDetail
        ratio="appointments"
        detailKey={appointmentId}
        list={<AppointmentList selectedId={appointmentId} reloadRef={reloadList} onFirstRow={setFirstRow} />}
        detail={appointmentId === null ? null : pane(appointmentId)}
        emptyDetail={
          firstRow === null ? (
            <div className="grid min-h-full place-items-center rounded-xl border border-line bg-white">
              <EmptyBlock icon="calendar_month" title="No appointment selected">
                Pick one from the list.
              </EmptyBlock>
            </div>
          ) : (
            pane(firstRow)
          )
        }
      />
    </>
  );
}
