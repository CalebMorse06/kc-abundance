'use client';

import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Clock } from 'lucide-react';

interface SpoilageTimerProps {
  deadline: string;
  className?: string;
  showIcon?: boolean;
  label?: string;
}

function formatDuration(ms: number): string {
  if (ms <= 0) return '00:00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function SpoilageTimer({ deadline, className, showIcon = true, label = 'Spoils in' }: SpoilageTimerProps) {
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const deadlineMs = new Date(deadline).getTime();

    const update = () => {
      const remaining = deadlineMs - Date.now();
      setTimeLeft(Math.max(0, remaining));
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [deadline]);

  if (!mounted) {
    return (
      <div className={cn('flex items-center gap-2 text-gray-400', className)}>
        <Clock className="h-4 w-4" />
        <span className="font-mono text-sm">--:--:--</span>
      </div>
    );
  }

  const hoursLeft = timeLeft / (1000 * 60 * 60);
  const isExpired = timeLeft <= 0;
  const isCritical = hoursLeft < 12;
  const isWarning = hoursLeft < 24;

  const colorClass = isExpired
    ? 'text-gray-400'
    : isCritical
    ? 'text-red-600'
    : isWarning
    ? 'text-orange-500'
    : 'text-green-600';

  const bgClass = isExpired
    ? 'bg-gray-100'
    : isCritical
    ? 'bg-red-50 border border-red-200'
    : isWarning
    ? 'bg-orange-50 border border-orange-200'
    : 'bg-green-50 border border-green-200';

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 rounded-lg px-3 py-2',
        bgClass,
        colorClass,
        isCritical && !isExpired && 'animate-pulse',
        className
      )}
    >
      {showIcon && <Clock className="h-4 w-4 flex-shrink-0" />}
      <div className="flex flex-col leading-tight">
        <span className="text-xs font-medium opacity-75">{isExpired ? 'Expired' : label}</span>
        <span className="font-mono text-lg font-bold tabular-nums tracking-wider">
          {isExpired ? 'EXPIRED' : formatDuration(timeLeft)}
        </span>
      </div>
    </div>
  );
}

export function SpoilageTimerCompact({ deadline, className }: { deadline: string; className?: string }) {
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const deadlineMs = new Date(deadline).getTime();
    const update = () => setTimeLeft(Math.max(0, deadlineMs - Date.now()));
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [deadline]);

  if (!mounted) return <span className="font-mono text-sm text-gray-400">--:--:--</span>;

  const hoursLeft = timeLeft / (1000 * 60 * 60);
  const colorClass = timeLeft <= 0 ? 'text-gray-400' : hoursLeft < 12 ? 'text-red-600' : hoursLeft < 24 ? 'text-orange-500' : 'text-green-600';

  return (
    <span className={cn('font-mono text-sm font-bold tabular-nums', colorClass, className)}>
      {timeLeft <= 0 ? 'EXPIRED' : formatDuration(timeLeft)}
    </span>
  );
}
