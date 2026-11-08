import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle2, XCircle } from 'lucide-react';
import Navbar from '../components/Navbar';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { useSubscriptionStore } from '../store/useSubscriptionStore';
import { verifyPremiumPayment } from '../services/backend/subscriptionService';

export default function PaymentCallbackPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const reference = params.get('reference') || params.get('trxref');
  const refresh = useSubscriptionStore((s) => s.refresh);
  const [status, setStatus] = useState('verifying');
  const [message, setMessage] = useState('');
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    if (!reference) {
      setStatus('error');
      setMessage('No payment reference was provided by Paystack.');
      return;
    }

    let cancelled = false;

    const verifyWithRetry = async () => {
      let lastError;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          return await verifyPremiumPayment(reference);
        } catch (err) {
          lastError = err;
          // Ownership/auth errors will not resolve by retrying.
          if (err?.status === 401 || err?.status === 403) break;
          if (attempt < 2) {
            await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
          }
        }
      }
      throw lastError;
    };

    verifyWithRetry()
      .then(async () => {
        await refresh();
        if (!cancelled) setStatus('success');
      })
      .catch((err) => {
        if (!cancelled) {
          setStatus('error');
          setMessage(err?.message || 'We could not verify this payment.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [reference, refresh]);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar showLeaderboard={false} />
      <main className="flex-1 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <Card className="p-8 text-center space-y-4">
            {status === 'verifying' && (
              <>
                <div className="w-12 h-12 mx-auto border-3 border-amber-500 border-t-transparent rounded-full animate-spin" />
                <h1 className="text-xl font-heading text-slate-900 dark:text-white">
                  Verifying your payment
                </h1>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Please wait while we confirm your Paystack transaction.
                </p>
              </>
            )}

            {status === 'success' && (
              <>
                <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-500" />
                <h1 className="text-xl font-heading text-slate-900 dark:text-white">
                  Premium activated
                </h1>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Your payment was confirmed. You can now generate up to 50 questions per quiz.
                </p>
                <Button fullWidth onClick={() => navigate('/create')}>
                  Start creating
                </Button>
              </>
            )}

            {status === 'error' && (
              <>
                <XCircle className="w-12 h-12 mx-auto text-rose-500" />
                <h1 className="text-xl font-heading text-slate-900 dark:text-white">
                  Payment not confirmed
                </h1>
                <p className="text-sm text-slate-600 dark:text-slate-400">{message}</p>
                <div className="flex flex-col gap-2">
                  <Button fullWidth onClick={() => navigate('/create')}>
                    Try again
                  </Button>
                  <Link
                    to="/"
                    className="text-sm font-semibold text-slate-600 dark:text-slate-400 hover:underline"
                  >
                    Back to home
                  </Link>
                </div>
              </>
            )}
          </Card>
        </motion.div>
      </main>
    </div>
  );
}
