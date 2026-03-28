import React from 'react';
import { cn } from '@/lib/utils';

interface NeedScoreBadgeProps {
  score: number;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

function getScoreConfig(score: number): {
  label: string;
  barColor: string;
  textColor: string;
  bgColor: string;
} {
  if (score >= 70) {
    return {
      label: 'Critical Need',
      barColor: 'bg-red-500',
      textColor: 'text-red-700',
      bgColor: 'bg-red-50',
    };
  }
  if (score >= 50) {
    return {
      label: 'High Need',
      barColor: 'bg-orange-500',
      textColor: 'text-orange-700',
      bgColor: 'bg-orange-50',
    };
  }
  if (score >= 30) {
    return {
      label: 'Moderate Need',
      barColor: 'bg-yellow-500',
      textColor: 'text-yellow-700',
      bgColor: 'bg-yellow-50',
    };
  }
  return {
    label: 'Lower Need',
    barColor: 'bg-green-500',
    textColor: 'text-green-700',
    bgColor: 'bg-green-50',
  };
}

export function NeedScoreBadge({ score, showLabel = true, size = 'md', className }: NeedScoreBadgeProps) {
  const config = getScoreConfig(score);
  const clampedScore = Math.min(Math.max(score, 0), 100);

  const sizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  const barHeights = {
    sm: 'h-1',
    md: 'h-1.5',
    lg: 'h-2',
  };

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <div className={cn('flex items-center justify-between gap-2', sizeClasses[size])}>
        {showLabel && (
          <span className={cn('font-medium', config.textColor)}>{config.label}</span>
        )}
        <span className={cn('font-bold tabular-nums', config.textColor)}>
          {clampedScore.toFixed(0)}/100
        </span>
      </div>
      <div className={cn('w-full rounded-full bg-gray-200', barHeights[size])}>
        <div
          className={cn('rounded-full transition-all duration-500', barHeights[size], config.barColor)}
          style={{ width: `${clampedScore}%` }}
        />
      </div>
    </div>
  );
}

export function NeedScoreCircle({ score, size = 40 }: { score: number; size?: number }) {
  const config = getScoreConfig(score);
  const radius = (size - 4) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={4}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={4}
          strokeDasharray={`${progress} ${circumference}`}
          className={cn('transition-all duration-500', config.barColor.replace('bg-', 'stroke-'))}
        />
      </svg>
      <span className={cn('absolute text-xs font-bold', config.textColor)}>
        {Math.round(score)}
      </span>
    </div>
  );
}
