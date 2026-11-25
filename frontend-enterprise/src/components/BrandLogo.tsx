import { cn } from '@/lib/utils';

export type BrandLogoProps = {
  /** Hide the "三省六部" wordmark and only render the seal mark. */
  markOnly?: boolean;
  /** Size of the square seal in pixels. */
  markSize?: number;
  className?: string;
  /** Extra classes applied to the wordmark wrapper (e.g. to hide it responsively). */
  wordmarkClassName?: string;
};

/** 三省六部 · 朱砂方印 + 宋体字标 */
export default function BrandLogo({
  markOnly = false,
  markSize = 28,
  className,
  wordmarkClassName,
}: BrandLogoProps) {
  return (
    <span className={cn('flex items-center gap-[9px] overflow-hidden p-[4px]', className)}>
      <svg
        width={markSize}
        height={markSize}
        viewBox="0 0 36 36"
        className="shrink-0"
        role="img"
        aria-label="三省六部"
      >
        <rect x="0.5" y="0.5" width="35" height="35" rx="2" fill="var(--accent)" />
        <rect
          x="3.5"
          y="3.5"
          width="29"
          height="29"
          fill="none"
          stroke="var(--accent-foreground)"
          strokeWidth="0.8"
          opacity="0.55"
        />
        <text
          x="18"
          y="19"
          textAnchor="middle"
          dominantBaseline="central"
          fontFamily="'Songti SC','STSong','SimSun',serif"
          fontSize="18"
          fill="var(--accent-foreground)"
        >
          枢
        </text>
      </svg>
      {!markOnly && (
        <span className={cn('flex flex-col items-center gap-[2px] leading-none', wordmarkClassName)}>
          <strong
            className="text-[16px] font-semibold leading-none tracking-[0.16em] text-[#1c1b17]"
            style={{ fontFamily: 'var(--font-song)' }}
          >
            三省六部
          </strong>
        </span>
      )}
    </span>
  );
}
