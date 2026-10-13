import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import hero from '@/assets/hero.png';
import seal from '@/assets/seal.png';
import { Icon } from '@/components/ui/Icon';

/**
 * Sign-in and "Set a new password" (deck W01 to W06, src 37 to 116): the brand hero on the left (a band on top on
 * a phone) with a gold edge, and the card on the right with the violation form link under it.
 */
export function PublicSplit({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-wrap bg-page">
      <section
        aria-hidden="true"
        className="relative flex min-h-[260px] flex-[1_1_420px] items-center justify-center border-b-[5px] border-gold bg-primary bg-cover bg-center px-6 py-10 min-[860px]:min-h-screen min-[860px]:border-r-[6px] min-[860px]:border-b-0"
        style={{ backgroundImage: `url(${hero})` }}
      >
        <div className="absolute inset-0 bg-[rgba(38,47,115,0.72)]" />
        <div className="relative flex flex-col items-center gap-2.5 text-center text-white">
          <img src={seal} alt="" className="h-auto w-[88px] drop-shadow-[0_6px_16px_rgba(0,0,0,0.25)] min-[860px]:w-32" />
          <p className="mt-2 text-[26px] font-bold tracking-[0.02em] min-[860px]:text-[34px]">NU FAIRVIEW</p>
          <p className="text-base font-semibold text-gold">Student Discipline Office</p>
          <p className="text-sm">Violations · Sanctions · Clearance</p>
        </div>
      </section>
      <main className="flex flex-[1_1_420px] flex-col items-center justify-center gap-3.5 px-4 py-8">
        <div className="w-full max-w-[420px] rounded-[14px] border border-line bg-white p-7 shadow-[0_1px_2px_rgba(28,36,69,0.04),0_8px_24px_rgba(28,36,69,0.06)]">
          {children}
        </div>
        <Link
          to="/report"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold text-primary hover:bg-info-soft focus-visible:ring-[3px] focus-visible:ring-primary/25 focus-visible:outline-none"
        >
          <Icon name="qr_code_scanner" className="!text-lg" />
          Open the violation form
        </Link>
      </main>
    </div>
  );
}
