import { useEffect, useState } from 'react';

export function useMinuteClock() {
  const [, setMinute] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setMinute((value) => value + 1), 60_000);
    return () => clearInterval(timer);
  }, []);
}
