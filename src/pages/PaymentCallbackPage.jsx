import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, XCircle, Loader2, Crown } from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { useSubscriptionStore } from '../store/useSubscriptionStore';

/**
 * Paystack redirect fallback. The popup normally handles verification, but
 * when it is unavailable Paystack redirects here with ?reference=...
 */
export default function PaymentCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const reference = searchParams.get('reference') || searchParams.get('trxref');
  const verifyPayment = useSubscriptionStore((s) => s.verifyPayment);
  const openUpgrade = useSubscriptionStore((s) => s.openUpgrade);
  const [state, setState] = useState(reference ? 'verifying' : 'missing');
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (!reference) {
      setState('missing');
      return;
    }
    let active = true;
    verifyPayment(reference).then((ok) => {
      if (active) setState(ok ? 'success' : 'failed');
    });
    return () => {
      active = false;
    };
  }, [reference, verifyPayment]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 text-center space-y-5">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
          <Crown className="w-7 h-7 text-amber-600 dark:text-amber-400" />
        </div>

        {state === 'verifying' && (
          <>
            <h1 className="font-heading text-2xl text-slate-900 dark:text-white">
              Verifying your payment
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Please wait — don&apos;t close this page.
            </p>
          </>
        )}

        {state === 'success' && (
          <>
            <CheckCircle2 className="mx-auto w-10 h-10 text-emerald-500" />
            <h1 className="font-heading text-2xl text-slate-900 dark:text-white">
              Premium activated
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Your subscription is active. You can now generate up to 50 questions per quiz.
            </p>
            <div className="flex gap-2">
              <Link to="/" className="flex-1">
                <Button fullWidth variant="outline">Home</Button>
              </Link>
              <Link to="/profile" className="flex-1">
                <Button fullWidth>View profile</Button>
              </Link>
            </div>
          </>
        )}

        {(state === 'failed' || state === 'missing') && (
          <>
            <XCircle className="mx-auto w-10 h-10 text-rose-500" />
            <h1 className="font-heading text-2xl text-slate-900 dark:text-white">
              Payment not verified
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {state === 'missing'
                ? 'No payment reference was found in this link.'
                : 'We could not confirm this payment. If you were charged, contact support with your Paystack reference.'}
            </p>
            <div className="flex gap-2">
              <Link to="/" className="flex-1">
                <Button fullWidth variant="outline">Home</Button>
              </Link>
              <Button
                fullWidth
                onClick={() => {
                  openUpgrade('Try checkout again to complete your upgrade.');
                  navigate('/');
                }}
              >
                Try again
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
