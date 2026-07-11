import { useEffect } from 'react';
import useQuizStore from '../store/useQuizStore';

/**
 * Custom hook that manages the countdown timer for the current question.
 * Automatically advances to the next question when the timer reaches zero.
 * The timer only runs while no answer has been selected for the current question.
 *
 * @param {boolean} isActive - Whether the timer should be running
 * @returns {number} The current timer value
 */
export function useTimer(isActive) {
  const timer = useQuizStore((s) => s.timer);
  const decrementTimer = useQuizStore((s) => s.decrementTimer);
  const goToNext = useQuizStore((s) => s.goToNext);

  useEffect(() => {
    if (!isActive) return;

    const interval = setInterval(() => {
      const state = useQuizStore.getState();
      if (state.timer <= 0) {
        clearInterval(interval);
        state.goToNext();
      } else {
        state.decrementTimer();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive, decrementTimer, goToNext]);

  return timer;
}
