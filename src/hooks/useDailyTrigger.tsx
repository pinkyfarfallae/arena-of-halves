import { useEffect, useRef } from 'react';
import { getTodayDate } from '../utils/date';

export function useDailyTrigger(callback: () => void) {
  const callbackRef = useRef(callback);
  const lastDateRef = useRef(getTodayDate());

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    const checkDaily = () => {
      const today = getTodayDate();
      if (lastDateRef.current !== today) {
        lastDateRef.current = today;
        callbackRef.current();
      }
    };

    checkDaily();

    const interval = setInterval(checkDaily, 60 * 1000);

    return () => clearInterval(interval);
  }, []);
}