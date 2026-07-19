import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface Step {
  id: string;
  label: string;
  icon: React.ElementType;
}

interface StepperProps {
  steps: Step[];
  currentStep: string;
  onStepClick: (stepId: string) => void;
  className?: string;
  lineWidths?: string[];
}

const LINE_DURATION = 0.25;

const Stepper: React.FC<StepperProps> = ({ steps, currentStep, onStepClick, className, lineWidths }) => {
  const currentIndex = steps.findIndex((s) => s.id === currentStep);

  const getStepStatus = (index: number): 'completed' | 'current' | 'upcoming' => {
    if (index < currentIndex) return 'completed';
    if (index === currentIndex) return 'current';
    return 'upcoming';
  };

  return (
    <div className={cn('w-full', className)}>
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const status = getStepStatus(index);
          const Icon = step.icon;
          const isClickable = status !== 'upcoming';

          return (
            <React.Fragment key={step.id}>
              <div className="flex flex-col items-center flex-1">
                <motion.button
                  onClick={() => isClickable && onStepClick(step.id)}
                  disabled={!isClickable}
                  className={cn(
                    'relative flex flex-col items-center gap-2 cursor-pointer transition-all',
                    !isClickable && 'cursor-not-allowed'
                  )}
                  whileHover={isClickable ? { scale: 1.05 } : {}}
                  whileTap={isClickable ? { scale: 0.95 } : {}}
                >
                  <div
                    className={cn(
                      'relative w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300',
                      status === 'completed' && 'bg-emerald-500 shadow-lg shadow-emerald-500/30',
                      status === 'current' && 'bg-primary shadow-lg shadow-primary/30 ring-4 ring-primary/20',
                      status === 'upcoming' && 'bg-white/5 border border-white/10'
                    )}
                  >
                    <Icon
                      className={cn(
                        'w-5 h-5',
                        status === 'upcoming' ? 'text-white/30' : 'text-white'
                      )}
                    />
                  </div>
                  <span
                    className={cn(
                      'text-xs font-medium transition-colors text-center max-w-[100px]',
                      status === 'completed' && 'text-emerald-400',
                      status === 'current' && 'text-white',
                      status === 'upcoming' && 'text-white/40'
                    )}
                  >
                    {step.label}
                  </span>
                </motion.button>
              </div>

              {index < steps.length - 1 && (
                <div className="flex-1 px-2">
                  <div className="relative h-0.5 bg-white/10 rounded-full overflow-hidden">
                    <motion.div
                      className={cn(
                        'absolute left-0 top-0 h-full rounded-full',
                        index < currentIndex ? 'bg-emerald-500' : 'bg-primary'
                      )}
                      initial={false}
                      animate={{ width: lineWidths?.[index] ?? (index < currentIndex ? '100%' : index === currentIndex ? '50%' : '0%') }}
                      transition={{ duration: LINE_DURATION, ease: 'easeInOut' }}
                    />
                  </div>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

export default Stepper;