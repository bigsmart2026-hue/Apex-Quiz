import { useMemo } from 'react';
import { motion } from 'framer-motion';

const CONFETTI_COLORS = ['#f59e0b', '#fbbf24', '#34d399', '#38bdf8', '#f472b6', '#a78bfa'];

const generatePieces = () =>
  Array.from({ length: 60 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: -20 - Math.random() * 40,
    rotation: Math.random() * 360,
    size: 6 + Math.random() * 8,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    duration: 2.5 + Math.random() * 2,
    delay: Math.random() * 0.6,
    drift: (Math.random() - 0.5) * 40,
  }));

/**
 * Full-screen confetti burst, used for top scores.
 */
export default function Confetti() {
  const pieces = useMemo(generatePieces, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-40 overflow-hidden" aria-hidden="true">
      {pieces.map((piece) => (
        <motion.span
          key={piece.id}
          initial={{ x: `${piece.x}vw`, y: `${piece.y}vh`, rotate: 0, opacity: 1 }}
          animate={{
            y: '110vh',
            x: `calc(${piece.x}vw + ${piece.drift}px)`,
            rotate: piece.rotation * 3,
            opacity: [1, 1, 0.6, 0],
          }}
          transition={{ duration: piece.duration, delay: piece.delay, ease: 'easeIn' }}
          className="absolute"
          style={{
            width: piece.size,
            height: piece.size * 0.6,
            backgroundColor: piece.color,
            borderRadius: 2,
          }}
        />
      ))}
    </div>
  );
}