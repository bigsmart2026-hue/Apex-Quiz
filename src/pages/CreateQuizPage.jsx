import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, FileUp, FileText, X, Check, Sparkles, Play, Trash2,
  Crown, RefreshCw, ServerOff, ChevronDown, Clock, ListChecks, TriangleAlert,
} from 'lucide-react';
import useQuizStore from '../store/useQuizStore';
import { useSubscriptionStore } from '../store/useSubscriptionStore';
import Navbar from '../components/Navbar';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import { PDF_MAX_MB } from '../utils/constants';
import { isUnavailable } from '../services/backend/subscriptionService';
import {
  generateQuizFromPdf, generateQuizFromText, getQuizHistory,
  getGeneratedQuiz, deleteGeneratedQuiz,
} from '../services/backend/pdfQuizService';

const SOURCE_TABS = [
  { id: 'pdf', label: 'PDF upload', icon: FileUp },
  { id: 'text', label: 'Paste text', icon: FileText },
];

const DIFFICULTIES = [
  { id: null, label: 'Any' },
  { id: 'easy', label: 'Easy' },
  { id: 'medium', label: 'Medium' },
  { id: 'hard', label: 'Hard' },
];

const GENERATION_STEPS = ['Uploading', 'Extracting content', 'Generating questions'];

const MAX_FILE_BYTES = PDF_MAX_MB * 1024 * 1024;

function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function CreateQuizPage() {
  const navigate = useNavigate();
  const startCustomQuiz = useQuizStore((s) => s.startCustomQuiz);

  const tier = useSubscriptionStore((s) => s.tier);
  const questionLimit = useSubscriptionStore((s) => s.questionLimit);
  const questionMin = useSubscriptionStore((s) => s.questionMin);
  const usedThisMonth = useSubscriptionStore((s) => s.usedThisMonth);
  const refreshSubscription = useSubscriptionStore((s) => s.refresh);
  const openUpgrade = useSubscriptionStore((s) => s.openUpgrade);
  const isPremium = tier === 'premium';

  const [source, setSource] = useState('pdf');
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [text, setText] = useState('');
  const [count, setCount] = useState(5);
  const [difficulty, setDifficulty] = useState(null);
  const [topics, setTopics] = useState('');
  const [wantMcq, setWantMcq] = useState(true);
  const [wantTf, setWantTf] = useState(false);

  const [phase, setPhase] = useState('idle'); // idle | working | done
  const [stepIdx, setStepIdx] = useState(0);
  const [error, setError] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [result, setResult] = useState(null);
  const [resultMeta, setResultMeta] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const [backendDown, setBackendDown] = useState(false);

  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [playingId, setPlayingId] = useState(null);
  const stepTimer = useRef(null);

  useEffect(() => {
    refreshSubscription();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setCount((c) => Math.min(Math.max(c, questionMin), questionLimit));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionLimit, questionMin]);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      setHistory(await getQuizHistory({ limit: 10 }));
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => () => clearInterval(stepTimer.current), []);

  const pickFile = (f) => {
    setError(null);
    setSuggestions([]);
    if (!f) return;
    if (!/\.pdf$/i.test(f.name)) {
      setError('Only PDF files are supported.');
      return;
    }
    if (f.size > MAX_FILE_BYTES) {
      setError(`PDF is too large (${formatBytes(f.size)}). Maximum is ${PDF_MAX_MB} MB.`);
      return;
    }
    setFile(f);
    setResult(null);
  };

  // Free tier is locked to multiple-choice only; premium can toggle both.
  const effectiveWantMcq = isPremium ? wantMcq : true;
  const effectiveWantTf = isPremium ? wantTf : false;

  const questionTypes = [
    ...(effectiveWantMcq ? ['multiple_choice'] : []),
    ...(effectiveWantTf ? ['true_false'] : []),
  ];

  const canGenerate = !(
    phase === 'working' ||
    questionTypes.length === 0 ||
    (source === 'pdf' && !file) ||
    (source === 'text' && text.trim().length < 100)
  );

  const handleGenerate = async () => {
    setError(null);
    setSuggestions([]);
    setResult(null);
    setShowAll(false);
    setPhase('working');
    setStepIdx(0);
    stepTimer.current = setInterval(() => setStepIdx((i) => Math.min(i + 1, GENERATION_STEPS.length - 1)), 8000);

    const topicList = topics.split(',').map((t) => t.trim()).filter(Boolean);
    try {
      const res = source === 'pdf'
        ? await generateQuizFromPdf(file, {
            questionCount: count,
            difficulty,
            topics: topicList.length ? topicList : undefined,
            questionTypes,
          })
        : await generateQuizFromText({
            text: text.trim(),
            questionCount: count,
            difficulty,
            topics: topicList.length ? topicList : undefined,
            questionTypes,
          });

      setBackendDown(false);
      setResult(res.questions);
      setResultMeta({
        quizId: res.quizId,
        totalGenerated: res.totalGenerated,
        requestedCount: res.requestedCount,
        generationTimeMs: res.generationTimeMs,
        warnings: res.warnings,
        skipped: res.skipped,
        sourceName: source === 'pdf' ? file.name : 'Pasted text',
      });
      setPhase('done');
      refreshSubscription();
      loadHistory();
    } catch (err) {
      if (isUnavailable(err)) {
        setBackendDown(true);
        setError(null);
      } else if (err?.code === 'TIER_LIMIT_EXCEEDED') {
        setError(err.message);
        openUpgrade(`Free plans allow up to ${questionLimit} questions — upgrade for up to 50.`);
      } else if (err?.code === 'RATE_LIMIT') {
        setError('Daily free-tier limit reached (20 requests/day). Try again tomorrow or enable billing for unlimited access.');
        setSuggestions(['Enable billing in Google AI Studio', 'Try text input instead', 'Wait until tomorrow']);
      } else {
        setError(err.message || 'Generation failed. Please try again.');
        setSuggestions(err.suggestions || []);
      }
      setPhase('idle');
    } finally {
      clearInterval(stepTimer.current);
    }
  };

  const handleStart = () => {
    if (!result?.length) return;
    startCustomQuiz(
      { id: 'custom', name: resultMeta?.sourceName || 'Custom Quiz' },
      result
    );
    navigate('/quiz');
  };

  const handlePlayHistory = async (quizId) => {
    setPlayingId(quizId);
    setError(null);
    try {
      const quiz = await getGeneratedQuiz(quizId);
      if (!quiz.questions.length) {
        setError('That quiz has no playable questions.');
        return;
      }
      startCustomQuiz({ id: 'custom', name: quiz.sourceFilename || 'Custom Quiz' }, quiz.questions);
      navigate('/quiz');
    } catch (err) {
      setError(isUnavailable(err) ? null : err.message || 'Could not load that quiz.');
      if (isUnavailable(err)) setBackendDown(true);
    } finally {
      setPlayingId(null);
    }
  };

  const handleDeleteHistory = async (quizId) => {
    try {
      await deleteGeneratedQuiz(quizId);
      setHistory((h) => h.filter((item) => item.quizId !== quizId));
    } catch {
      // history is best-effort
    }
  };

  const visibleQuestions = showAll ? result : result?.slice(0, 5);

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
              Create a Quiz
            </h1>
            <p className="text-slate-600 dark:text-slate-400 text-sm">
              Turn any PDF or text into a playable quiz with AI
            </p>
            <div className="flex items-center justify-center gap-2 pt-1">
              <Badge variant={isPremium ? 'amber' : 'slate'}>
                {isPremium ? 'Premium' : 'Free plan'}
              </Badge>
              <span className="text-xs text-slate-600 dark:text-slate-400">
                {usedThisMonth} generated · up to {questionLimit} questions
              </span>
              {!isPremium && (
                <button
                  onClick={() => openUpgrade()}
                  className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                >
                  Upgrade
                </button>
              )}
            </div>
          </motion.div>

          {backendDown && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-xl bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 text-sm space-y-2"
            >
              <p className="flex items-center gap-2 font-semibold text-rose-700 dark:text-rose-300">
                <ServerOff className="w-4 h-4" />
                Quiz backend is not running
              </p>
              <p className="text-rose-700/80 dark:text-rose-300/80">
                AI generation needs the backend. Start it, then retry:
              </p>
              <code className="block px-3 py-2 rounded-lg bg-slate-900 text-slate-100 text-xs overflow-x-auto">
                uvicorn app.main:app --reload
              </code>
              <Button size="sm" variant="outline" onClick={() => setBackendDown(false)} icon={<RefreshCw className="w-3.5 h-3.5" />}>
                Retry
              </Button>
            </motion.div>
          )}

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-xl bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-sm text-center space-y-1"
            >
              <p>{error}</p>
              {suggestions.map((s) => (
                <p key={s} className="text-xs opacity-80">{s}</p>
              ))}
            </motion.div>
          )}

          {/* Source tabs */}
          <div className="flex justify-center" role="tablist" aria-label="Quiz source">
            <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              {SOURCE_TABS.map((tab) => (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={source === tab.id}
                  onClick={() => { setSource(tab.id); setError(null); setResult(null); setPhase('idle'); }}
                  className={`flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
                    source === tab.id
                      ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-300'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Source input */}
          {source === 'pdf' ? (
            <Card className="p-5 sm:p-6">
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); pickFile(e.dataTransfer.files?.[0]); }}
                className={`rounded-xl border-2 border-dashed transition-colors px-6 py-10 text-center cursor-pointer ${
                  dragOver
                    ? 'border-amber-400 bg-amber-50/60 dark:bg-amber-900/20'
                    : 'border-slate-200 dark:border-slate-600 hover:border-amber-300 dark:hover:border-amber-700'
                }`}
                onClick={() => document.getElementById('pdf-input')?.click()}
              >
                <input
                  id="pdf-input"
                  type="file"
                  accept="application/pdf,.pdf"
                  className="hidden"
                  onChange={(e) => pickFile(e.target.files?.[0])}
                />
                <FileUp className="w-8 h-8 mx-auto text-amber-500 mb-2" />
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  Drop your PDF here or click to browse
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                  PDF only · max {PDF_MAX_MB} MB
                </p>
              </div>

              {file && (
                <div className="mt-3 flex items-center gap-2 px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-700/40 border border-slate-200 dark:border-slate-600">
                  <FileText className="w-4 h-4 text-amber-500 flex-shrink-0" />
                  <span className="flex-1 min-w-0 truncate text-sm text-slate-900 dark:text-white">{file.name}</span>
                  <span className="text-xs text-slate-600 dark:text-slate-400 tabular-nums">{formatBytes(file.size)}</span>
                  <button
                    onClick={() => setFile(null)}
                    className="p-1 rounded-lg text-slate-500 hover:text-rose-500 transition-colors cursor-pointer"
                    title="Remove file"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </Card>
          ) : (
            <Card className="p-5 sm:p-6 space-y-2">
              <label htmlFor="source-text" className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                Source text (min 100 characters)
              </label>
              <textarea
                id="source-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={8}
                placeholder="Paste study notes, an article, or any text to quiz on…"
                className="w-full px-4 py-3 rounded-xl bg-white/80 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 resize-y"
              />
              <p className={`text-xs text-right tabular-nums ${text.trim().length >= 100 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}>
                {text.trim().length} / 100 min
              </p>
            </Card>
          )}

          {/* Options */}
          <Card className="p-5 sm:p-6 space-y-5">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="q-count" className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                  Questions
                </label>
                <span className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">{count}</span>
              </div>
              <input
                id="q-count"
                type="range"
                min={questionMin}
                max={questionLimit}
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer"
              />
              <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>{questionMin} min</span>
                <span>
                  {questionLimit} max{!isPremium && (
                    <> · <button onClick={() => openUpgrade(`Free plans allow up to ${questionLimit} questions — upgrade for up to 50.`)} className="font-bold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer">50 with Premium</button></>
                  )}
                </span>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-2">
                Difficulty
              </p>
              <div className="flex flex-wrap gap-2">
                {DIFFICULTIES.map((d) => (
                  <button
                    key={d.label}
                    onClick={() => setDifficulty(d.id)}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-colors cursor-pointer ${
                      difficulty === d.id
                        ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                        : 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-2">
                Question types
              </p>
              <div className="flex flex-wrap gap-2">
                {isPremium ? (
                  <>
                    <button
                      key="Multiple choice"
                      onClick={() => setWantMcq(!wantMcq)}
                      aria-pressed={wantMcq}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-colors cursor-pointer ${
                        wantMcq
                          ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                          : 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                      }`}
                    >
                      <span className={`w-4 h-4 rounded border-2 flex items-center justify-center ${wantMcq ? 'border-amber-500 bg-amber-500' : 'border-slate-300 dark:border-slate-500'}`}>
                        {wantMcq && <Check className="w-3 h-3 text-white" />}
                      </span>
                      Multiple choice
                    </button>
                    <button
                      key="True / False"
                      onClick={() => setWantTf(!wantTf)}
                      aria-pressed={wantTf}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-colors cursor-pointer ${
                        wantTf
                          ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                          : 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                      }`}
                    >
                      <span className={`w-4 h-4 rounded border-2 flex items-center justify-center ${wantTf ? 'border-amber-500 bg-amber-500' : 'border-slate-300 dark:border-slate-500'}`}>
                        {wantTf && <Check className="w-3 h-3 text-white" />}
                      </span>
                      True / False
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      key="Multiple choice"
                      onClick={() => setWantMcq(true)}
                      aria-pressed={true}
                      disabled
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border-2 cursor-pointer border-amber-500 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
                    >
                      <span className="w-4 h-4 rounded border-2 flex items-center justify-center border-amber-500 bg-amber-500">
                        <Check className="w-3 h-3 text-white" />
                      </span>
                      Multiple choice
                    </button>
                  </>
                )}
              </div>
            </div>

            <div>
              <label htmlFor="topics" className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                Topics <span className="normal-case font-normal">(optional, comma-separated)</span>
              </label>
              <input
                id="topics"
                value={topics}
                onChange={(e) => setTopics(e.target.value)}
                placeholder="e.g. photosynthesis, cell structure"
                className="mt-1 w-full px-4 py-2.5 rounded-xl bg-white/80 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              />
            </div>

            <Button fullWidth loading={phase === 'working'} disabled={!canGenerate} onClick={handleGenerate} icon={<Sparkles className="w-4 h-4" />}>
              {phase === 'working' ? `${GENERATION_STEPS[stepIdx]}…` : 'Generate quiz'}
            </Button>

            {phase === 'working' && (
              <ol className="space-y-2">
                {GENERATION_STEPS.map((label, i) => (
                  <li key={label} className="flex items-center gap-2 text-sm">
                    {i < stepIdx ? (
                      <Check className="w-4 h-4 text-emerald-500" />
                    ) : i === stepIdx ? (
                      <span className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <span className="w-4 h-4 rounded-full border-2 border-slate-300 dark:border-slate-600" />
                    )}
                    <span className={i <= stepIdx ? 'text-slate-900 dark:text-white font-medium' : 'text-slate-500 dark:text-slate-400'}>
                      {label}…
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </Card>

          {/* Result */}
          {phase === 'done' && resultMeta && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="p-5 sm:p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <ListChecks className="w-5 h-5 text-emerald-500" />
                  <h2 className="font-heading text-slate-900 dark:text-white">
                    {result.length} questions ready
                  </h2>
                </div>

                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-semibold">
                    <Clock className="w-3.5 h-3.5" />
                    {(resultMeta.generationTimeMs / 1000).toFixed(1)}s
                  </span>
                  {resultMeta.skipped > 0 && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 font-semibold">
                      {resultMeta.skipped} non-multiple-choice skipped
                    </span>
                  )}
                </div>

                {resultMeta.warnings.length > 0 && (
                  <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-sm text-amber-700 dark:text-amber-300 space-y-1">
                    {resultMeta.warnings.map((w) => (
                      <p key={w} className="flex items-start gap-2">
                        <TriangleAlert className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        {w}
                      </p>
                    ))}
                  </div>
                )}

                {result.length === 0 ? (
                  <p className="text-sm text-slate-600 dark:text-slate-400 text-center py-4">
                    No playable questions came back. Try a clearer PDF or paste the text directly.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {visibleQuestions.map((q, i) => (
                      <details
                        key={q.id}
                        className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden"
                      >
                        <summary className="px-4 py-3 text-sm font-medium text-slate-900 dark:text-white cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/40 list-none flex items-center gap-2">
                          <span className="text-slate-400 tabular-nums">{i + 1}.</span>
                          <span className="flex-1 min-w-0 truncate">{q.text}</span>
                          <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        </summary>
                        <div className="px-4 pb-3 space-y-1.5">
                          {q.options.map((opt, oi) => (
                            <p
                              key={oi}
                              className={`text-xs px-3 py-1.5 rounded-lg ${
                                oi === q.correctAnswer
                                  ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 font-semibold'
                                  : 'bg-slate-50 dark:bg-slate-700/40 text-slate-600 dark:text-slate-300'
                              }`}
                            >
                              {opt}
                            </p>
                          ))}
                          {q.explanation && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 italic pt-1">{q.explanation}</p>
                          )}
                        </div>
                      </details>
                    ))}
                    {result.length > 5 && (
                      <button
                        onClick={() => setShowAll((s) => !s)}
                        className="w-full text-center text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer py-1"
                      >
                        {showAll ? 'Show fewer' : `Show all ${result.length}`}
                      </button>
                    )}
                  </div>
                )}

                {result.length > 0 && (
                  <Button fullWidth onClick={handleStart} icon={<Play className="w-4 h-4" />}>
                    Start quiz
                  </Button>
                )}
              </Card>
            </motion.div>
          )}

          {/* History */}
          <Card className="p-5 sm:p-6 space-y-3">
            <h2 className="font-heading text-slate-900 dark:text-white">Your generated quizzes</h2>
            {historyLoading ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
            ) : history.length === 0 ? (
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Nothing here yet — generated quizzes are saved automatically.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-700">
                {history.map((item) => (
                  <div key={item.quizId} className="flex items-center gap-3 py-2.5">
                    <FileText className="w-4 h-4 text-amber-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                        {item.sourceFilename || 'Untitled'}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {item.questionCount} questions
                        {item.createdAt ? ` · ${new Date(item.createdAt).toLocaleDateString()}` : ''}
                      </p>
                    </div>
                    <button
                      onClick={() => handlePlayHistory(item.quizId)}
                      disabled={playingId === item.quizId}
                      className="p-2 rounded-lg text-slate-500 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors cursor-pointer disabled:opacity-50"
                      title="Play this quiz"
                    >
                      <Play className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteHistory(item.quizId)}
                      className="p-2 rounded-lg text-slate-500 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors cursor-pointer"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Premium nudge */}
          {!isPremium && (
            <Card className="p-5 sm:p-6 flex flex-col sm:flex-row items-center gap-4 bg-gradient-to-br from-amber-50 to-white dark:from-amber-900/20 dark:to-slate-800">
              <div className="w-11 h-11 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center flex-shrink-0">
                <Crown className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1 text-center sm:text-left">
                <p className="font-semibold text-slate-900 dark:text-white">Need longer quizzes?</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Premium generates up to 50 questions per quiz instead of {questionLimit}.
                </p>
              </div>
              <Button variant="outline" onClick={() => openUpgrade()}>
                See plans
              </Button>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
