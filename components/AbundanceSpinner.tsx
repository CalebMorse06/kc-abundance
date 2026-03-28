import React from 'react';

/**
 * Abundance-KC segmented ring spinner (style #3 — medium segmented donut).
 * 7 arc segments with brand palette colors, rotating clockwise.
 */

const C = 2 * Math.PI * 40; // circumference of r=40 circle ≈ 251.33

const segments = [
  { color: '#1B3A52', startDeg: 0,     lenDeg: 65  }, // navy
  { color: '#4A90C4', startDeg: 76.4,  lenDeg: 30  }, // sky blue
  { color: '#E8C98A', startDeg: 117.8, lenDeg: 40  }, // cream/gold
  { color: '#6BA87A', startDeg: 169.2, lenDeg: 15  }, // sage green
  { color: '#3D9E8C', startDeg: 195.6, lenDeg: 35  }, // mid teal
  { color: '#2D7D6F', startDeg: 242.0, lenDeg: 45  }, // dark teal
  { color: '#F5A623', startDeg: 298.4, lenDeg: 50  }, // orange
];

const toArc = (deg: number) => (deg / 360) * C;

interface Props {
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export function AbundanceSpinner({ size = 48, strokeWidth = 9, className = '' }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={`abundance-spinner ${className}`}
      aria-label="Loading"
      role="status"
    >
      {segments.map((seg, i) => (
        <circle
          key={i}
          cx={50}
          cy={50}
          r={40}
          fill="none"
          stroke={seg.color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${toArc(seg.lenDeg)} ${C}`}
          strokeDashoffset={-toArc(seg.startDeg)}
          transform="rotate(-90 50 50)"
        />
      ))}
    </svg>
  );
}

/** Full-page centered loading overlay */
export function AbundanceLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24">
      <AbundanceSpinner size={64} />
      <p className="text-sm text-[#1B3A52]/60 font-medium">{label}</p>
    </div>
  );
}
