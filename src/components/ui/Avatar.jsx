/**
 * Avatar — photo when available, initials otherwise.
 * @param {{ src?: string, name?: string, size?: number, className?: string }} props
 */
export default function Avatar({ src, name = '?', size = 36, className = '' }) {
  const initials = name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  if (src) {
    return (
      <img
        src={src}
        alt={`${name}'s avatar`}
        style={{ width: size, height: size }}
        className={`rounded-full object-cover ${className}`}
      />
    );
  }

  return (
    <div
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      className={`rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 font-bold flex items-center justify-center ${className}`}
      aria-hidden="true"
    >
      {initials}
    </div>
  );
}