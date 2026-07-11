import { motion } from 'framer-motion';

export default function Logo({ size = 56, className = '', showWordmark = true, animate = false }) {
  const imgSize = Math.round(size);

  const Symbol = (
    <div
      className="flex items-center justify-center rounded-xl bg-white dark:bg-slate-800 shadow-sm"
      style={{ width: size, height: size }}
    >
      <img
        src="/images-removebg-preview.png"
        width={imgSize}
        height={imgSize}
        alt="Apex Quiz logo"
        style={{ objectFit: 'contain' }}
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
    <div className={`flex items-center gap-3 ${className}`}>
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
      <span className="text-2xl font-bold tracking-tight text-amber-500 dark:text-amber-400 hidden sm:block font-heading">
        APEX QUIZ
      </span>
    </div>
  );
}
