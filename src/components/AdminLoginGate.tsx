import { useState } from 'react';
import { ArrowLeft, Check, Copy, Lock, LogOut, ShieldCheck } from 'lucide-react';
import { BOOTSTRAP_ADMIN_EMAIL } from '../firebase.ts';

interface AdminLoginGateProps {
  authLoading: boolean;
  signedInEmail: string | null;
  signedInUid: string | null;
  unauthorizedAccount: boolean;
  onSignInWithGoogle: () => Promise<void>;
  onSignOut: () => Promise<void>;
  onReturnToMenu: () => void;
}

export function AdminLoginGate({
  authLoading,
  signedInEmail,
  signedInUid,
  unauthorizedAccount,
  onSignInWithGoogle,
  onSignOut,
  onReturnToMenu,
}: AdminLoginGateProps) {
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedUid, setCopiedUid] = useState(false);

  const handleGoogleLogin = async () => {
    if (submitting) return;
    setSubmitting(true);
    setErrorMsg(null);
    try {
      await onSignInWithGoogle();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Unable to sign in with Google. Please allow popups and retry.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyUid = async () => {
    if (!signedInUid) return;
    try {
      await navigator.clipboard.writeText(signedInUid);
      setCopiedUid(true);
      setTimeout(() => setCopiedUid(false), 2000);
    } catch {
      // Ignore clipboard failure
    }
  };

  return (
    <div className="min-h-screen bg-[#110E0B] text-[#F6EFE4] flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-2xl bg-[#191410] border border-[#2D241C] p-6 sm:p-8 space-y-6 shadow-2xl">
        <div className="space-y-2 text-center">
          <div className="w-11 h-11 rounded-xl bg-[#231C16] border border-[#352A21] flex items-center justify-center mx-auto">
            {unauthorizedAccount ? (
              <ShieldCheck className="w-5 h-5 text-red-400" />
            ) : (
              <Lock className="w-5 h-5 text-[#C99A4E]" />
            )}
          </div>
          <p className="text-xs font-mono tracking-wider text-[#C99A4E] uppercase pt-2">
            Staff Portal
          </p>
          <h1 className="font-display text-2xl font-semibold text-[#F6EFE4]">
            Kitchen &amp; Admin Access
          </h1>
          <p className="text-sm text-[#B4A693]">
            Sign in with an authorized restaurant Google account to view live incoming orders and manage table QR stations.
          </p>
        </div>

        {authLoading ? (
          <div className="py-6 text-center text-xs text-[#9E8B73]">
            Checking staff session...
          </div>
        ) : unauthorizedAccount && signedInEmail ? (
          <div className="space-y-4">
            <div className="rounded-xl bg-[#120E0B] border border-red-400/30 p-4 space-y-2 text-left">
              <p className="text-xs font-semibold text-red-300">
                Account Not Authorized
              </p>
              <p className="text-xs text-[#B4A693] leading-relaxed">
                Signed in as <span className="text-[#F6EFE4] font-medium">{signedInEmail}</span>. Only{' '}
                <span className="text-[#E3BC78] font-mono">{BOOTSTRAP_ADMIN_EMAIL}</span> or staff accounts added in Staff Access can view kitchen orders.
              </p>
              {signedInUid && (
                <div className="pt-2 flex items-center justify-between gap-2 border-t border-[#261E17]">
                  <span className="text-[11px] font-mono text-[#9E8B73] truncate">
                    UID: {signedInUid}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyUid}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#231C16] border border-[#352A21] text-[11px] text-[#E6DAC8] hover:border-[#C99A4E] shrink-0"
                  >
                    {copiedUid ? (
                      <>
                        <Check className="w-3 h-3 text-[#E3BC78]" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy UID</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => void onSignOut()}
              className="w-full min-h-[46px] px-5 py-2.5 rounded-xl bg-[#C99A4E] text-[#14100C] text-sm font-semibold hover:bg-[#D7AA60] transition-colors inline-flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              <span>Switch Google Account</span>
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {errorMsg && (
              <p className="text-xs text-red-400 text-center" role="alert">
                {errorMsg}
              </p>
            )}

            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={submitting}
              className="w-full min-h-[48px] px-5 py-2.5 rounded-xl bg-[#C99A4E] text-[#14100C] text-sm font-semibold hover:bg-[#D7AA60] disabled:opacity-50 transition-colors inline-flex items-center justify-center gap-2.5"
            >
              <span>{submitting ? 'Signing in...' : 'Sign in with Google'}</span>
            </button>

            <p className="text-[11px] text-center text-[#8C7A64]">
              Primary owner access: <span className="font-mono text-[#B4A693]">{BOOTSTRAP_ADMIN_EMAIL}</span>
            </p>
          </div>
        )}

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
