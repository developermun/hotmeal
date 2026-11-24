import { useState } from 'react';
import { ArrowLeft, Eye, EyeOff, Lock } from 'lucide-react';

interface AdminLoginGateProps {
  onVerifyPin: (pin: string) => Promise<void>;
  onReturnToMenu: () => void;
}

export function AdminLoginGate({ onVerifyPin, onReturnToMenu }: AdminLoginGateProps) {
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim() || submitting) return;
    setSubmitting(true);
    setErrorMsg(null);
    try {
      await onVerifyPin(pin.trim());
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Incorrect staff passcode.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#110E0B] text-[#F6EFE4] flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-2xl bg-[#191410] border border-[#2D241C] p-6 sm:p-8 space-y-6 shadow-2xl">
        <div className="space-y-2 text-center">
          <div className="w-11 h-11 rounded-xl bg-[#231C16] border border-[#352A21] flex items-center justify-center mx-auto">
            <Lock className="w-5 h-5 text-[#C99A4E]" />
          </div>
          <p className="text-xs font-mono tracking-wider text-[#C99A4E] uppercase pt-2">
            Staff Portal
          </p>
          <h1 className="font-display text-2xl font-semibold text-[#F6EFE4]">
            Kitchen &amp; Admin Access
          </h1>
          <p className="text-sm text-[#B4A693]">
            Enter the restaurant staff passcode to view incoming table orders and manage QR stations.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="staff-pin-input" className="block text-xs font-medium text-[#E6DAC8]">
              Staff Passcode
            </label>
            <div className="relative">
              <input
                id="staff-pin-input"
                type={showPin ? 'text' : 'password'}
                autoComplete="current-password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Enter staff passcode"
                className="w-full min-h-[46px] pl-4 pr-12 py-2.5 rounded-xl bg-[#120E0B] border border-[#2D241C] font-mono text-base tracking-widest text-[#F6EFE4] placeholder-[#7B6B58] placeholder:tracking-normal placeholder:font-sans focus:outline-none focus:border-[#C99A4E]"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPin((prev) => !prev)}
                aria-label={showPin ? 'Hide passcode' : 'Show passcode'}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg text-[#9E8B73] hover:text-[#F6EFE4]"
              >
                {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {errorMsg && (
            <p className="text-xs text-red-400" role="alert">
              {errorMsg}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || !pin.trim()}
            className="w-full min-h-[46px] px-5 py-2.5 rounded-xl bg-[#C99A4E] text-[#14100C] text-sm font-semibold hover:bg-[#D7AA60] disabled:opacity-50 transition-colors"
          >
            {submitting ? 'Verifying...' : 'Unlock Admin Dashboard'}
          </button>
        </form>

        <div className="pt-4 border-t border-[#261E17] text-center">
          <button
            type="button"
            onClick={onReturnToMenu}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#B4A693] hover:text-[#E3BC78] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Customer Dine-In Menu</span>
          </button>
        </div>
      </div>
    </div>
  );
}
