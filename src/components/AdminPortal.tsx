import { useState } from 'react';
import { KeyRound, LogOut, X } from 'lucide-react';
import type { OrderStatus, ServiceRequest, TableOrder } from '../types.ts';
import { KitchenBoardView } from './KitchenBoardView.tsx';
import { QrStudioView } from './QrStudioView.tsx';

export type AdminSection = 'orders' | 'qr';

interface AdminPortalProps {
  section: AdminSection;
  onSelectSection: (section: AdminSection) => void;
  orders: TableOrder[];
  serviceRequests: ServiceRequest[];
  loadingOrders: boolean;
  onAdvanceOrderStatus: (orderId: string, nextStatus: OrderStatus) => Promise<void>;
  onResolveServiceRequest: (requestId: string) => Promise<void>;
  onRefresh: () => void;
  onSimulateScan: (tableNumber: number) => void;
  onChangePassword: (newPassword: string) => Promise<void>;
  onLockPortal: () => void;
  currentTable: number;
}

export function AdminPortal({
  section,
  onSelectSection,
  orders,
  serviceRequests,
  loadingOrders,
  onAdvanceOrderStatus,
  onResolveServiceRequest,
  onRefresh,
  onSimulateScan,
  onChangePassword,
  onLockPortal,
  currentTable,
}: AdminPortalProps) {
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPw, setSavingPw] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState<string | null>(null);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError(null);
    setPwSuccess(null);

    const trimmed = newPassword.trim();
    if (trimmed.length < 4) {
      setPwError('Passcode must be at least 4 characters.');
      return;
    }
    if (trimmed !== confirmPassword.trim()) {
      setPwError('Passcodes do not match.');
      return;
    }

    setSavingPw(true);
    try {
      await onChangePassword(trimmed);
      setPwSuccess('Staff passcode updated.');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setPasswordModalOpen(false);
        setPwSuccess(null);
      }, 1200);
    } catch (err) {
      setPwError(err instanceof Error ? err.message : 'Unable to update passcode.');
    } finally {
      setSavingPw(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#110E0B] text-[#F6EFE4]">
      {/* Dedicated Staff Admin Header (3-zone Top Bar Contract) */}
      <header className="sticky top-0 z-40 bg-[#110E0B]/95 backdrop-blur-md border-b border-[#2A2119]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          <span className="font-display text-xl sm:text-2xl font-semibold tracking-tight text-[#F6EFE4] whitespace-nowrap shrink-0">
            Jikoni Admin
          </span>

          <nav className="flex items-center gap-6 text-sm font-medium" aria-label="Staff navigation">
            <button
              type="button"
              onClick={() => onSelectSection('orders')}
              className={`relative py-1 whitespace-nowrap shrink-0 transition-colors ${
                section === 'orders' ? 'text-[#E3BC78]' : 'text-[#B4A693] hover:text-[#F6EFE4]'
              }`}
            >
              Orders &amp; Kitchen
              {section === 'orders' && (
                <span
                  aria-hidden="true"
                  className="absolute left-0 right-0 -bottom-0.5 h-0.5 bg-[#C99A4E] rounded-full"
                />
              )}
            </button>

            <button
              type="button"
              onClick={() => onSelectSection('qr')}
              className={`relative py-1 whitespace-nowrap shrink-0 transition-colors ${
                section === 'qr' ? 'text-[#E3BC78]' : 'text-[#B4A693] hover:text-[#F6EFE4]'
              }`}
            >
              Table QR Studio
              {section === 'qr' && (
                <span
                  aria-hidden="true"
                  className="absolute left-0 right-0 -bottom-0.5 h-0.5 bg-[#C99A4E] rounded-full"
                />
              )}
            </button>

            <button
              type="button"
              onClick={() => setPasswordModalOpen(true)}
              className="hidden sm:inline-flex items-center gap-1.5 py-1 text-[#B4A693] hover:text-[#F6EFE4] whitespace-nowrap shrink-0 transition-colors"
            >
              <KeyRound className="w-3.5 h-3.5 text-[#C99A4E]" />
              <span>Passcode</span>
            </button>
          </nav>

          <button
            type="button"
            onClick={onLockPortal}
            className="inline-flex items-center gap-2 min-h-[40px] px-4 py-2 rounded-lg bg-[#231C16] border border-[#352A21] text-xs font-semibold text-[#E6DAC8] hover:border-[#C99A4E] transition-colors whitespace-nowrap shrink-0"
          >
            <LogOut className="w-3.5 h-3.5 text-[#C99A4E]" />
            <span>Lock Portal</span>
          </button>
        </div>
      </header>

      <main className="flex-1 pb-12">
        {section === 'orders' ? (
          <KitchenBoardView
            orders={orders}
            serviceRequests={serviceRequests}
            loading={loadingOrders}
            onAdvanceOrderStatus={onAdvanceOrderStatus}
            onResolveServiceRequest={onResolveServiceRequest}
            onRefresh={onRefresh}
          />
        ) : (
          <QrStudioView
            currentTable={currentTable}
            onSimulateScan={onSimulateScan}
          />
        )}
      </main>

      {/* Change Staff Passcode Modal */}
      {passwordModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Update staff passcode"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPasswordModalOpen(false);
          }}
        >
          <form
            onSubmit={handlePasswordSubmit}
            className="w-full max-w-sm rounded-2xl bg-[#191410] border border-[#2D241C] p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-semibold text-[#F6EFE4]">
                Set Staff Passcode
              </h2>
              <button
                type="button"
                onClick={() => setPasswordModalOpen(false)}
                aria-label="Close"
                className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-[#9E8B73] hover:text-[#F6EFE4]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#B4A693]">
              Update the passcode required to open the Admin &amp; Kitchen Portal.
            </p>

            <div className="space-y-3">
              <div>
                <label htmlFor="new-staff-pw" className="block text-xs text-[#E6DAC8] mb-1">
                  New Passcode
                </label>
                <input
                  id="new-staff-pw"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 4 characters"
                  className="w-full min-h-[42px] px-3 py-2 rounded-xl bg-[#120E0B] border border-[#2D241C] font-mono text-sm text-[#F6EFE4] focus:outline-none focus:border-[#C99A4E]"
                  autoFocus
                />
              </div>

              <div>
                <label htmlFor="confirm-staff-pw" className="block text-xs text-[#E6DAC8] mb-1">
                  Confirm Passcode
                </label>
                <input
                  id="confirm-staff-pw"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new passcode"
                  className="w-full min-h-[42px] px-3 py-2 rounded-xl bg-[#120E0B] border border-[#2D241C] font-mono text-sm text-[#F6EFE4] focus:outline-none focus:border-[#C99A4E]"
                />
              </div>
            </div>

            {pwError && <p className="text-xs text-red-400">{pwError}</p>}
            {pwSuccess && <p className="text-xs text-[#E3BC78]">{pwSuccess}</p>}

            <button
              type="submit"
              disabled={savingPw}
              className="w-full min-h-[42px] px-4 py-2 rounded-xl bg-[#C99A4E] text-[#14100C] text-xs font-semibold hover:bg-[#D7AA60] disabled:opacity-50 transition-colors"
            >
              {savingPw ? 'Saving...' : 'Save New Passcode'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
