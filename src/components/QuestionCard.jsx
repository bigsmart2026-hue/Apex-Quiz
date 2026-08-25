import { motion, AnimatePresence } from 'framer-motion';
import OptionButton from './OptionButton';

/**
 * @param {Object} props
 * @param {{ id: string, text: string, options: string[], correctAnswer: number }} props.question
 * @param {number|null} props.selectedAnswer
 * @param {(index: number) => void} props.onSelect
 * @param {number} props.questionNumber
 * @param {number} props.totalQuestions
 */
export default function QuestionCard({ question, selectedAnswer, onSelect, questionNumber, totalQuestions }) {
  const hasAnswered = selectedAnswer !== null;

  const variants = {
    enter: { x: 320, opacity: 0 },
    center: { x: 0, opacity: 1 },
    exit: { x: -320, opacity: 0 },
  };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={question.id}
        variants={variants}
        initial="enter"
        animate="center"
        exit="exit"
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className="space-y-6"
      >
        <div className="text-center space-y-2">
          <p className="text-slate-600 dark:text-slate-400 text-caption">
            Question {questionNumber} of {totalQuestions}
          </p>
          <h2 className="text-lg sm:text-xl text-slate-900 dark:text-slate-100 leading-relaxed px-2 font-heading">
            {question.text}
          </h2>
        </div>

        <div className="space-y-3">
          {question.options.map((option, index) => (
            <OptionButton
              key={index}
              text={option}
              index={index}
              isSelected={selectedAnswer === index}
              isCorrect={index === question.correctAnswer}
              showFeedback={hasAnswered}
              disabled={hasAnswered}
              onClick={() => onSelect(index)}
            />
          ))}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}