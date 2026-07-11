/**
 * Graduation cap and rolled diploma logo — self-explanatory education icon.
 *
 * @param {{ size?: number, className?: string }} props
 */
export default function GraduationLogo({ size = 40, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Graduation cap and diploma"
    >
      <defs>
        <linearGradient id="capGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#2563EB" />
          <stop offset="100%" stopColor="#1D4ED8" />
        </linearGradient>
        <linearGradient id="diplomaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F1F5F9" />
          <stop offset="100%" stopColor="#CBD5E1" />
        </linearGradient>
      </defs>

      {/* Graduation cap — board */}
      <polygon
        points="16,47 42,33 72,47 42,61"
        fill="url(#capGrad)"
      />
      <polygon
        points="12,50 38,36 68,50 38,64"
        fill="#0F172A"
        opacity="0.15"
      />

      {/* Cap bottom curve */}
      <path
        d="M14,54 C14,76 24,86 42,88 C60,86 70,76 70,54"
        fill="url(#capGrad)"
      />
      <path
        d="M14,54 C14,76 24,86 42,88 C60,86 70,76 70,54"
        fill="#0F172A"
        opacity="0.08"
      />

      {/* Cap rim line */}
      <path
        d="M11,50 C11,52 24,62 42,62 C60,62 73,52 73,50"
        stroke="#E2E8F0"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
        opacity="0.5"
      />

      {/* Tassel thread */}
      <path
        d="M42,88 C40,96 34,100 30,102"
        stroke="#E2E8F0"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />

      {/* Tassel knot */}
      <circle cx="29" cy="103" r="4" fill="#f59e0b" />

      {/* Tassel strands */}
      <path
        d="M29,107 C28,109 27,110 26,111"
        stroke="#E2E8F0"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M30,107 C31,109 32,110 33,111"
        stroke="#E2E8F0"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M28,107 C27,108 26,109 25,110"
        stroke="#f59e0b"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />

      {/* Diploma scroll — body */}
      <rect
        x="78"
        y="18"
        width="18"
        height="78"
        rx="9"
        fill="url(#diplomaGrad)"
        stroke="#94A3B8"
        strokeWidth="1.5"
      />

      {/* Scroll curl top */}
      <path
        d="M78,24 C78,18 96,18 96,24"
        stroke="#94A3B8"
        strokeWidth="1.5"
        fill="none"
      />

      {/* Scroll curl bottom */}
      <path
        d="M78,96 C78,102 96,102 96,96"
        stroke="#94A3B8"
        strokeWidth="1.5"
        fill="none"
      />

      {/* Ribbon wrap */}
      <rect
        x="77"
        y="50"
        width="20"
        height="18"
        rx="3"
        fill="url(#capGrad)"
      />

      {/* Ribbon detail */}
      <line
        x1="87"
        y1="50"
        x2="87"
        y2="68"
        stroke="#0F172A"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.2"
      />
    </svg>
  );
}
