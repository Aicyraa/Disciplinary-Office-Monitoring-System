import { useEffect, useState } from 'react';
import { initials } from '@/utils/nav';
import { cn } from '@/utils/cn';

/**
 * A person's picture, or their initials when there is none or the link no longer loads (the link is short-lived).
 * Decorative: the name is always written next to it, so it is hidden from screen readers.
 */
export function Avatar({
  firstName,
  lastName,
  url,
  className,
}: {
  firstName: string;
  lastName: string;
  url?: string | null;
  /** Size, colour and text size of the circle, for example `size-8 bg-gold text-xs`. */
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);

  return (
    <span
      aria-hidden="true"
      className={cn('grid shrink-0 place-items-center overflow-hidden rounded-full font-bold text-ink', className)}
    >
      {url && !failed ? (
        <img src={url} alt="" className="size-full object-cover" onError={() => setFailed(true)} />
      ) : (
        initials(firstName, lastName)
      )}
    </span>
  );
}
