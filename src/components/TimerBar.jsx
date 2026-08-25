import LinearProgress from '@mui/material/LinearProgress';
import { Timer as TimerIcon } from 'lucide-react';
import { TIMER_DURATION } from '../utils/constants';

/**
 * @param {Object} props
 * @param {number} props.timer - Current timer value in seconds
 */
export default function TimerBar({ timer }) {
  const value = (timer / TIMER_DURATION) * 100;
  const isLow = timer <= 5;

  return (
    <div className="w-full space-y-1">
      <div className="flex items-center justify-between text-xs sm:text-sm">
        <div className="flex items-center gap-1.5">
          <TimerIcon className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
          <span className="text-slate-600 dark:text-slate-400 text-caption">Time remaining</span>
        </div>
        <span className={`font-semibold tabular-nums ${isLow ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-slate-300'}`}>
          {timer}s
        </span>
      </div>
      <LinearProgress
        variant="determinate"
        value={value}
        color={isLow ? 'error' : 'primary'}
        sx={{
          height: 6,
          borderRadius: 3,
          backgroundColor: 'rgba(203, 213, 225, 0.3)',
        }}
      />
    </div>
  );
}
