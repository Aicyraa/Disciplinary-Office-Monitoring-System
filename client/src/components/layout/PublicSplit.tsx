import type { ReactNode } from 'react';
import hero from '@/assets/hero.png';
import seal from '@/assets/seal.png';
import { Icon } from '@/components/ui/Icon';

const PLACES = [
  { icon: 'location_on', text: 'NU Fairview · SDO Office, Room 204' },
  { icon: 'schedule', text: 'Monday to Saturday, 7:00 AM to 5:00 PM' },
] as const;

/**
 * Sign-in and "Set a new password": a split layout. The left panel is the campus photo under a navy gradient:
 * the seal and office name on top, the portal title with a gold rule and one line of description in the middle,
 * and the location and hours in a frosted card at the bottom, with a 6 px gold edge. The form sits on the right,
 * at most 400 px wide.
 *
 * On a phone it reads like an app instead of a website: a navy hero with the big seal and the portal title, the
 * form on a white sheet with rounded top corners pulled up over it, and the office location and hours under it.
 */
export function PublicSplit({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-primary min-[860px]:flex-row min-[860px]:bg-white">
      <header
        className="relative overflow-hidden bg-primary bg-cover bg-center px-6 pt-[calc(36px+env(safe-area-inset-top))] pb-16 text-center text-white min-[860px]:hidden"
        style={{ backgroundImage: `url(${hero})` }}
      >
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-b from-[rgba(38,47,115,0.88)] via-[rgba(38,47,115,0.82)] to-[rgba(20,25,66,0.96)]" />
        <div aria-hidden="true" className="absolute -top-20 -right-24 size-64 rounded-full border border-white/10" />
        <div aria-hidden="true" className="absolute -bottom-10 -left-16 size-44 rounded-full border border-gold/25" />
        <div className="relative flex flex-col items-center">
          <img src={seal} alt="NU Fairview" className="size-[84px] drop-shadow-[0_8px_20px_rgba(0,0,0,0.3)]" />
          <p className="mt-4 text-xs font-semibold tracking-[0.16em] text-white/70 uppercase">NU Fairview</p>
          <h2 className="mt-1 text-2xl leading-tight font-extrabold text-balance">Student Discipline Office Portal</h2>
          <span aria-hidden="true" className="mt-3 block h-1 w-12 rounded-full bg-gold" />
          <p className="mt-3 max-w-[300px] text-sm leading-relaxed text-pretty text-white/85">
            Follow your cases, sanctions, appointments and clearance in one place.
          </p>
        </div>
      </header>

      <section
        className="relative hidden flex-[1_1_50%] flex-col justify-between gap-10 overflow-hidden border-r-[6px] border-gold bg-primary bg-cover bg-center p-10 text-white min-[860px]:flex xl:p-14"
        style={{ backgroundImage: `url(${hero})` }}
      >
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-br from-[rgba(38,47,115,0.9)] via-[rgba(38,47,115,0.78)] to-[rgba(20,25,66,0.96)]" />
        <div aria-hidden="true" className="absolute -right-32 -bottom-32 size-[420px] rounded-full border border-white/10" />
        <div aria-hidden="true" className="absolute -right-12 -bottom-12 size-[220px] rounded-full border border-gold/25" />

        <div className="relative flex items-center gap-3.5">
          <img src={seal} alt="NU Fairview" className="size-14 shrink-0 drop-shadow-[0_6px_16px_rgba(0,0,0,0.25)]" />
          <div className="leading-tight">
            <p className="text-lg font-bold text-gold">Student Discipline Office</p>
            <p className="text-xs font-semibold tracking-[0.14em] text-white/70 uppercase">NU Fairview</p>
          </div>
        </div>

        <div className="relative max-w-[520px]">
          <h2 className="text-[clamp(30px,3.6vw,48px)] leading-[1.08] font-extrabold text-balance">Student Discipline Office Portal</h2>
          <span aria-hidden="true" className="mt-5 block h-1 w-14 rounded-full bg-gold" />
          <p className="mt-5 max-w-[440px] text-base leading-relaxed text-pretty text-white/90">
            Follow your cases, sanctions, appointments and clearance in one place.
          </p>
        </div>

        <ul className="relative flex flex-col gap-3 rounded-2xl border border-white/15 bg-white/10 p-4 text-sm text-white/90 backdrop-blur-sm">
          {PLACES.map((place) => (
            <li key={place.icon} className="flex items-center gap-3">
              <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full bg-gold/20 text-gold">
                <Icon name={place.icon} className="!text-xl" />
              </span>
              {place.text}
            </li>
          ))}
        </ul>
      </section>

      <main className="relative z-10 -mt-8 flex flex-1 flex-col items-center rounded-t-[28px] bg-white px-6 pt-8 pb-[calc(24px+env(safe-area-inset-bottom))] shadow-[0_-12px_32px_rgba(16,22,52,0.18)] min-[860px]:mt-0 min-[860px]:flex-[1_1_50%] min-[860px]:justify-center min-[860px]:rounded-none min-[860px]:py-10 min-[860px]:shadow-none">
        <span aria-hidden="true" className="mb-6 block h-1 w-10 rounded-full bg-line min-[860px]:hidden" />
        <div className="w-full max-w-[400px] pb-8 min-[860px]:pb-0">{children}</div>

        <ul className="mt-auto flex w-full max-w-[400px] flex-col gap-2.5 border-t border-line-soft pt-5 text-[13px] text-muted min-[860px]:hidden">
          {PLACES.map((place) => (
            <li key={place.icon} className="flex items-center gap-2.5">
              <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full bg-info-soft text-primary">
                <Icon name={place.icon} className="!text-lg" />
              </span>
              {place.text}
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
