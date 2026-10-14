import type { ReactNode } from 'react';
import hero from '@/assets/hero.png';
import seal from '@/assets/seal.png';
import { Icon } from '@/components/ui/Icon';

/**
 * Sign-in and "Set a new password": a split layout. The left panel is the campus photo under a navy gradient:
 * the seal and office name on top, the portal title with a gold rule and one line of description in the middle,
 * and the location and hours in a frosted card at the bottom, with a 6 px gold edge. On a phone it collapses to
 * a thin top bar (seal, 4 px gold bottom border). The form sits on the right, at most 400 px wide.
 */
export function PublicSplit({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-white min-[860px]:flex-row">
      <header className="flex items-center gap-2.5 border-b-4 border-gold bg-primary px-4 py-2.5 text-white min-[860px]:hidden">
        <img src={seal} alt="NU Fairview" className="size-8" />
        <span className="text-sm leading-tight font-semibold">Student Discipline Office</span>
      </header>

      <section
        className="relative hidden flex-[1_1_50%] flex-col justify-between gap-10 overflow-hidden border-r-[6px] border-gold bg-primary bg-cover bg-center p-10 text-white min-[860px]:flex xl:p-14"
        style={{ backgroundImage: `url(${hero})` }}
      >
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-br from-[rgba(38,47,115,0.9)] via-[rgba(38,47,115,0.78)] to-[rgba(20,25,66,0.96)]" />
        <div aria-hidden="true" className="absolute -right-32 -bottom-32 size-[420px] rounded-full border border-white/10" />
        <div aria-hidden="true" className="absolute -right-12 -bottom-12 size-[220px] rounded-full border border-gold/25" />

        <div className="relative flex items-center gap-3.5">
          <span className="grid size-14 shrink-0 place-items-center rounded-full bg-white/95 shadow-[0_6px_18px_rgba(0,0,0,0.25)]">
            <img src={seal} alt="NU Fairview" className="size-11" />
          </span>
          <div className="leading-tight">
            <p className="text-lg font-bold text-gold">Student Discipline Office</p>
            <p className="text-xs font-semibold tracking-[0.14em] text-white/70 uppercase">NU Fairview</p>
          </div>
        </div>

        <div className="relative max-w-[520px]">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold/15 px-3 py-1 text-xs font-bold tracking-wide text-gold uppercase">
            <Icon name="shield_person" className="!text-base" />
            Student portal
          </span>
          <h2 className="mt-5 text-[clamp(30px,3.6vw,48px)] leading-[1.08] font-extrabold text-balance">Student Discipline Office Portal</h2>
          <span aria-hidden="true" className="mt-5 block h-1 w-14 rounded-full bg-gold" />
          <p className="mt-5 max-w-[440px] text-base leading-relaxed text-pretty text-white/90">
            Follow your cases, sanctions, appointments and clearance in one place.
          </p>
        </div>

        <ul className="relative flex flex-col gap-3 rounded-2xl border border-white/15 bg-white/10 p-4 text-sm text-white/90 backdrop-blur-sm">
          <li className="flex items-center gap-3">
            <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full bg-gold/20 text-gold">
              <Icon name="location_on" className="!text-xl" />
            </span>
            NU Fairview · SDO Office, Room 204
          </li>
          <li className="flex items-center gap-3">
            <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full bg-gold/20 text-gold">
              <Icon name="schedule" className="!text-xl" />
            </span>
            Monday to Saturday, 7:00 AM to 5:00 PM
          </li>
        </ul>
      </section>

      <main className="flex flex-[1_1_50%] items-center justify-center px-6 py-10">
        <div className="w-full max-w-[400px]">{children}</div>
      </main>
    </div>
  );
}
