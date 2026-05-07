import { useSyncExternalStore } from "react";

interface CountdownTimerProps {
  targetDate: string;
  className?: string;
}

const CountdownTimer = ({ targetDate, className = "" }: CountdownTimerProps) => {
  const now = useMinuteNow();
  const diff = new Date(targetDate).getTime() - now;
  const timeLeft =
    diff <= 0
      ? { days: 0, hours: 0, mins: 0 }
      : {
          days: Math.floor(diff / 86400000),
          hours: Math.floor((diff % 86400000) / 3600000),
          mins: Math.floor((diff % 3600000) / 60000),
        };

  const totalHours = timeLeft.days * 24 + timeLeft.hours;
  const urgencyClass = totalHours < 2 ? "text-cusp-red animate-pulse-red" : totalHours < 48 ? "text-cusp-amber" : "text-muted-foreground";

  return (
    <span className={`font-mono text-xs ${urgencyClass} ${className}`}>
      {timeLeft.days > 0 && `${timeLeft.days}d `}{timeLeft.hours}h {timeLeft.mins}m
    </span>
  );
};

export default CountdownTimer;

let minuteNow = Date.now();
let interval: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!interval) {
    interval = setInterval(() => {
      minuteNow = Date.now();
      listeners.forEach((fn) => fn());
    }, 60000);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && interval) {
      clearInterval(interval);
      interval = null;
    }
  };
}

function getSnapshot() {
  return minuteNow;
}

function useMinuteNow() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
