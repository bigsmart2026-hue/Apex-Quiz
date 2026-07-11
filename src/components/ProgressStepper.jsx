import { Stepper, Step, StepLabel } from '@mui/material';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

/**
 * @param {Object} props
 * @param {number} props.total
 * @param {number} props.current
 */
export default function ProgressStepper({ total, current }) {
  if (total === 0) return null;

  return (
    <div className="w-full">
      <div className="hidden sm:block">
        <Stepper activeStep={current} alternativeLabel>
          {Array.from({ length: total }, (_, i) => (
            <Step key={i} completed={i < current}>
              <StepLabel
                StepIconProps={{
                  icon: i < current ? (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center"
                    >
                      <Check className="w-4 h-4 text-white" />
                    </motion.div>
                  ) : (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                        ${i === current
                          ? 'bg-amber-500 text-white'
                          : 'bg-slate-200 dark:bg-slate-600 text-slate-500 dark:text-slate-400'
                        }`}
                    >
                      {i + 1}
                    </motion.div>
                  ),
                }}
              />
            </Step>
          ))}
        </Stepper>
      </div>

      <div className="flex sm:hidden items-center justify-center gap-2">
        {Array.from({ length: total }, (_, i) => (
          <motion.div
            key={i}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className={`w-2.5 h-2.5 rounded-full transition-colors duration-200
              ${i === current ? 'bg-amber-500' : i < current ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-600'}
            `}
          />
        ))}
      </div>
    </div>
  );
}
