import { useEffect, useState } from "react";

interface CountdownTimerProps {
  targetDate: string;
  className?: string;
}

const CountdownTimer = ({ targetDate, className = "" }: CountdownTimerProps) => {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, mins: 0 });

  useEffect(() => {
    const calc = () => {
      const diff = new Date(targetDate).getTime() - Date.now();
      if (diff <= 0) return { days: 0, hours: 0, mins: 0 };
      return {
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        mins: Math.floor((diff % 3600000) / 60000),
      };
    };

    setTimeLeft(calc());
    const interval = setInterval(() => setTimeLeft(calc()), 60000);
    return () => clearInterval(interval);
  }, [targetDate]);

  const totalHours = timeLeft.days * 24 + timeLeft.hours;
  const urgencyClass = totalHours < 2 ? "text-cusp-red animate-pulse-red" : totalHours < 48 ? "text-cusp-amber" : "text-muted-foreground";

  return (
    <span className={`font-mono text-xs ${urgencyClass} ${className}`}>
      {timeLeft.days > 0 && `${timeLeft.days}d `}{timeLeft.hours}h {timeLeft.mins}m
    </span>
  );
};

export default CountdownTimer;
