import type { ReactNode } from 'react';
import hero from '@/assets/hero.png';
import seal from '@/assets/seal.png';
import { Icon } from '@/components/ui/Icon';

/**
 * Sign-in and "Set a new password": a split layout. The left panel is the campus photo under a navy gradient
 * with the seal, the office name, the portal title, one line of description and the location and hours, with
 * a 6 px gold edge. On a phone it collapses to a thin top bar (seal, 4 px gold bottom border). The form sits
 * on the right, at most 400 px wide.
 */
export function PublicSplit({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-white min-[860px]:flex-row">
      <header className="flex items-center gap-2.5 border-b-4 border-gold bg-primary px-4 py-2.5 text-white min-[860px]:hidden">
        <img src={seal} alt="NU Fairview" className="size-8" />
        <span className="text-sm leading-tight font-semibold">Student Discipline Office</span>
      </header>

      <section
        className="relative hidden flex-[1_1_50%] flex-col justify-between overflow-hidden border-r-[6px] border-gold bg-primary bg-cover bg-center p-12 text-white min-[860px]:flex"
        style={{ backgroundImage: `url(${hero})` }}
      >
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-b from-[rgba(38,47,115,0.82)] via-[rgba(38,47,115,0.7)] to-[rgba(24,30,78,0.94)]" />
        <div className="relative flex items-center gap-3.5">
          <img src={seal} alt="NU Fairview" className="size-14 drop-shadow-[0_6px_16px_rgba(0,0,0,0.25)]" />
          <p className="text-lg font-semibold text-gold">Student Discipline Office</p>
        </div>
        <div className="relative max-w-[520px]">
          <p className="text-[44px] leading-[1.1] font-extrabold text-balance">Student Discipline Office Portal</p>
          <p className="mt-4 text-base text-pretty text-white/88">Follow your cases, sanctions, appointments and clearance in one place.</p>
        </div>
        <ul className="relative flex flex-col gap-2 text-sm text-white/88">
          <li className="flex items-center gap-2">
            <Icon name="location_on" className="!text-xl text-gold" />
            NU Fairview · SDO Office, Room 204
          </li>
          <li className="flex items-center gap-2">
            <Icon name="schedule" className="!text-xl text-gold" />
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
