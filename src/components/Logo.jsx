import { motion } from 'framer-motion';

export default function Logo({ size = 108, className = '', showWordmark = true, animate = false }) {
  const Symbol = (
    <div
      className="relative flex items-center justify-center select-none"
      style={{ width: size, height: size }}
    >
      <span
        aria-hidden="true"
        className="absolute inset-1 rounded-full bg-amber-400/20 blur-lg dark:bg-amber-400/25"
      />
      <img
        src="/logo-emblem-192.png"
        width={size}
        height={size}
        alt="Apex Quiz logo"
        draggable={false}
        decoding="async"
        fetchPriority="high"
        className="relative h-full w-full object-contain drop-shadow-[0_2px_7px_rgba(245,158,11,0.35)]"
      />
    </div>
  );

  if (!showWordmark) {
    if (animate) {
      return (
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className={className}
        >
          {Symbol}
        </motion.div>
      );
    }
    return <div className={className}>{Symbol}</div>;
  }

  return (
    <div className={`flex items-center gap-2 sm:gap-3 ${className}`}>
      {animate ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          {Symbol}
        </motion.div>
      ) : (
        Symbol
      )}
      <span className="whitespace-nowrap font-heading text-lg sm:text-3xl font-semibold tracking-tight bg-gradient-to-b from-[#FFE06A] via-[#F5B301] to-[#B26A00] bg-clip-text text-transparent drop-shadow-[0_1px_1px_rgba(146,64,14,0.3)] dark:from-[#FFF0B3] dark:via-[#FFD24A] dark:to-[#D99A00] dark:drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]">
        APEX QUIZ
      </span>
    </div>
  );
}
