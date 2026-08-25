import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Swords, Copy, Check, Link2, ArrowLeft } from 'lucide-react';
import useQuizStore from '../store/useQuizStore';
import Navbar from '../components/Navbar';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import EmptyState from '../components/ui/EmptyState';
import { categories } from '../utils/categories';
import { questionBank } from '../utils/questionBank';
import { createChallenge, joinChallenge } from '../services/challenge.service';
import { challengeShareUrl } from '../utils/challengeCode';
import { seededSample } from '../utils/dates';

const QUESTION_COUNTS = [5, 10, 20];

const CATEGORY_TO_BANK = {
  frontend: 'frontend',
  backend: 'backend',
  'current-affairs': 'currentAffairs',
  relationships: 'relationships',
  cybersecurity: 'cybersecurity',
  'digital-marketing': 'digitalMarketing',
  'product-design': 'productDesign',
  'data-analytics': 'dataAnalytics',
  'mobile-app-dev': 'mobileAppDev',
};

const bankCategories = categories.filter((c) => CATEGORY_TO_BANK[c.id]);

export default function ChallengesPage() {
  const navigate = useNavigate();
  const user = useQuizStore((s) => s.user);
  const startChallenge = useQuizStore((s) => s.startChallenge);
  const [searchParams] = useSearchParams();

  const [selectedCategory, setSelectedCategory] = useState(bankCategories[0]?.id || 'frontend');
  const [questionCount, setQuestionCount] = useState(10);
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState(null);
  const [createdCode, setCreatedCode] = useState(null);
  const [copied, setCopied] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [shareModalOpen, setShareModalOpen] = useState(false);

  const joinCode = searchParams.get('code');

  useEffect(() => {
    if (joinCode && user) {
      handleJoin(joinCode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joinCode, user]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const category = bankCategories.find((c) => c.id === selectedCategory);
      const bankKey = CATEGORY_TO_BANK[category.id];
      const pool = questionBank[bankKey];
      if (!pool?.length) throw new Error('No question bank for this category');

      const questions = seededSample(pool, questionCount, Date.now());
      const { code } = await createChallenge({
        creator: user,
        category,
        questions,
        total: questionCount,
      });
      setCreatedCode(code);
      setShareModalOpen(true);
    } catch (err) {
      setJoinError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = async (code) => {
    setJoining(true);
    setJoinError(null);
    try {
      const challenge = await joinChallenge(code.toUpperCase(), user);
      startChallenge(challenge, challenge.questions);
      navigate('/quiz');
    } catch (err) {
      setJoinError(err.message);
    } finally {
      setJoining(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(challengeShareUrl(createdCode));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setJoinError('Could not copy link — share the code manually.');
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar showLeaderboard={false} />

      <main className="flex-1 flex flex-col items-center p-4 sm:p-6">
        <div className="w-full max-w-2xl py-6 sm:py-8 space-y-6">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-300 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="text-center space-y-1"
          >
            <h1 className="text-3xl sm:text-4xl text-slate-900 dark:text-white font-heading">
              Friend Challenges
            </h1>
            <p className="text-slate-600 dark:text-slate-400 text-sm">
              Challenge a friend and see who knows more
            </p>
          </motion.div>

          {joinError && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3 rounded-xl bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-sm text-center"
            >
              {joinError}
            </motion.div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Create */}
            <Card className="p-5 sm:p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Swords className="w-5 h-5 text-amber-500" />
                <h2 className="font-heading text-slate-900 dark:text-white">Create a challenge</h2>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                  Category
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="mt-1 w-full px-3 py-2.5 rounded-xl bg-white/80 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 cursor-pointer"
                >
                  {bankCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                  Questions
                </label>
                <div className="flex gap-2 mt-1">
                  {QUESTION_COUNTS.map((count) => (
                    <button
                      key={count}
                      onClick={() => setQuestionCount(count)}
                      className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold border-2 transition-colors cursor-pointer ${
                        questionCount === count
                          ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                          : 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                      }`}
                    >
                      {count}
                    </button>
                  ))}
                </div>
              </div>

              <Button fullWidth loading={creating} onClick={handleCreate}>
                Generate Challenge
              </Button>
            </Card>

            {/* Join */}
            <Card className="p-5 sm:p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Link2 className="w-5 h-5 text-amber-500" />
                <h2 className="font-heading text-slate-900 dark:text-white">Join a challenge</h2>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Enter the 6-character code from a friend.
              </p>
              <input
                value={joinCodeInput}
                onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                placeholder="e.g. AX7K92"
                maxLength={6}
                aria-label="Challenge code"
                className="w-full px-4 py-3 rounded-xl bg-white/80 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-center text-lg font-bold tracking-[0.3em] focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              />
              <Button
                fullWidth
                variant="outline"
                loading={joining}
                disabled={joinCodeInput.length !== 6}
                onClick={() => handleJoin(joinCodeInput)}
              >
                Join Challenge
              </Button>
            </Card>
          </div>

          {!joinCode && (
            <EmptyState
              icon={<Swords className="w-6 h-6" />}
              title="No active challenges"
              description="Create a challenge above and share the code with a friend."
            />
          )}
        </div>
      </main>

      {/* Share modal */}
      <Modal open={shareModalOpen} onClose={() => setShareModalOpen(false)} title="Challenge created!">
        <div className="text-center space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Share this code or link with a friend:
          </p>
          <div className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-amber-50 dark:bg-amber-900/30 border-2 border-amber-300 dark:border-amber-700 font-bold text-2xl tracking-[0.35em] text-slate-900 dark:text-white">
            {createdCode}
          </div>
          <div className="flex justify-center gap-2">
            <Button onClick={handleCopy} icon={copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}>
              {copied ? 'Copied!' : 'Copy Link'}
            </Button>
            <Button variant="outline" onClick={() => setShareModalOpen(false)}>
              Done
            </Button>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            The challenge expires in 7 days. Winner takes the bragging rights.
          </p>
        </div>
      </Modal>
    </div>
  );
}