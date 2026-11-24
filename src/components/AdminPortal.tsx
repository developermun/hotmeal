import { useState } from 'react';
import { LogOut, Trash2, UserPlus, Users, X } from 'lucide-react';
import type { OrderStatus, ServiceRequest, TableOrder } from '../types.ts';
import { KitchenBoardView } from './KitchenBoardView.tsx';
import { QrStudioView } from './QrStudioView.tsx';

export type AdminSection = 'orders' | 'qr';

export interface StaffAdminRecord {
  uid: string;
  email: string;
  role: 'admin';
  createdAt: string;
}

interface AdminPortalProps {
  section: AdminSection;
  onSelectSection: (section: AdminSection) => void;
  orders: TableOrder[];
  serviceRequests: ServiceRequest[];
  staffAdmins: StaffAdminRecord[];
  adminEmail: string | null;
  loadingOrders: boolean;
  onAdvanceOrderStatus: (orderId: string, nextStatus: OrderStatus) => Promise<void>;
  onResolveServiceRequest: (requestId: string) => Promise<void>;
  onRefresh: () => void;
  onSimulateScan: (tableNumber: number) => void;
  onAddStaffAdmin: (uid: string, email: string) => Promise<void>;
  onRemoveStaffAdmin: (uid: string) => Promise<void>;
  onLockPortal: () => Promise<void>;
  currentTable: number;
}

export function AdminPortal({
  section,
  onSelectSection,
  orders,
  serviceRequests,
  staffAdmins,
  adminEmail,
  loadingOrders,
  onAdvanceOrderStatus,
  onResolveServiceRequest,
  onRefresh,
  onSimulateScan,
  onAddStaffAdmin,
  onRemoveStaffAdmin,
  onLockPortal,
  currentTable,
}: AdminPortalProps) {
  const [staffModalOpen, setStaffModalOpen] = useState(false);
  const [newStaffUid, setNewStaffUid] = useState('');
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [savingStaff, setSavingStaff] = useState(false);
  const [staffError, setStaffError] = useState<string | null>(null);
  const [staffSuccess, setStaffSuccess] = useState<string | null>(null);

  const handleAddStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStaffError(null);
    setStaffSuccess(null);

    const uid = newStaffUid.trim();
    const email = newStaffEmail.trim();
    if (!uid || !/^[a-zA-Z0-9_-]{4,128}$/.test(uid)) {
      setStaffError('Enter a valid Firebase User UID (alphanumeric, at least 4 characters).');
      return;
    }
    if (!email || !email.includes('@')) {
      setStaffError('Enter the staff member Google email address.');
      return;
    }

    setSavingStaff(true);
    try {
      await onAddStaffAdmin(uid, email);
      setStaffSuccess(`Added ${email} as kitchen staff.`);
      setNewStaffUid('');
      setNewStaffEmail('');
    } catch (err) {
      setStaffError(err instanceof Error ? err.message : 'Unable to add staff account.');
    } finally {
      setSavingStaff(false);
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
              onClick={() => setStaffModalOpen(true)}
              className="hidden sm:inline-flex items-center gap-1.5 py-1 text-[#B4A693] hover:text-[#F6EFE4] whitespace-nowrap shrink-0 transition-colors"
            >
              <Users className="w-3.5 h-3.5 text-[#C99A4E]" />
              <span>Staff Access</span>
            </button>
          </nav>

          <button
            type="button"
            onClick={() => void onLockPortal()}
            className="inline-flex items-center gap-2 min-h-[40px] px-4 py-2 rounded-lg bg-[#231C16] border border-[#352A21] text-xs font-semibold text-[#E6DAC8] hover:border-[#C99A4E] transition-colors whitespace-nowrap shrink-0"
          >
            <LogOut className="w-3.5 h-3.5 text-[#C99A4E]" />
            <span>Sign Out</span>
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

      {/* Staff Access Management Modal */}
      {staffModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Manage authorized staff"
          onClick={(e) => {
            if (e.target === e.currentTarget) setStaffModalOpen(false);
          }}
        >
          <div className="w-full max-w-md rounded-2xl bg-[#191410] border border-[#2D241C] p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-xl font-semibold text-[#F6EFE4]">
                  Authorized Kitchen Staff
                </h2>
                {adminEmail && (
                  <p className="text-[11px] font-mono text-[#9E8B73] mt-0.5">
                    Signed in: {adminEmail}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setStaffModalOpen(false)}
                aria-label="Close"
                className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-[#9E8B73] hover:text-[#F6EFE4]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddStaffSubmit} className="space-y-3 pt-1 border-t border-[#261E17]">
              <p className="text-xs text-[#B4A693]">
                Add another kitchen tablet or staff member by entering their Firebase UID (shown if they sign in at /admin) and Google email.
              </p>
              <div>
                <label htmlFor="staff-uid-input" className="block text-xs text-[#E6DAC8] mb-1">
                  Staff Firebase UID
                </label>
                <input
                  id="staff-uid-input"
                  type="text"
                  value={newStaffUid}
                  onChange={(e) => setNewStaffUid(e.target.value)}
                  placeholder="Paste staff UID"
                  className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-[#120E0B] border border-[#2D241C] font-mono text-xs text-[#F6EFE4] focus:outline-none focus:border-[#C99A4E]"
                />
              </div>

              <div>
                <label htmlFor="staff-email-input" className="block text-xs text-[#E6DAC8] mb-1">
                  Google Email
                </label>
                <input
                  id="staff-email-input"
                  type="email"
                  value={newStaffEmail}
                  onChange={(e) => setNewStaffEmail(e.target.value)}
                  placeholder="kitchen@example.com"
                  className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-[#120E0B] border border-[#2D241C] text-xs text-[#F6EFE4] focus:outline-none focus:border-[#C99A4E]"
                />
              </div>

              {staffError && <p className="text-xs text-red-400">{staffError}</p>}
              {staffSuccess && <p className="text-xs text-[#E3BC78]">{staffSuccess}</p>}

              <button
                type="submit"
                disabled={savingStaff}
                className="w-full min-h-[40px] px-4 py-2 rounded-xl bg-[#C99A4E] text-[#14100C] text-xs font-semibold hover:bg-[#D7AA60] disabled:opacity-50 transition-colors inline-flex items-center justify-center gap-1.5"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>{savingStaff ? 'Granting Access...' : 'Grant Kitchen Access'}</span>
              </button>
            </form>

            {staffAdmins.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-[#261E17] max-h-40 overflow-y-auto">
                <p className="text-[11px] font-mono uppercase tracking-wider text-[#9E8B73]">
                  Added Staff Accounts
                </p>
                {staffAdmins.map((staff) => (
                  <div
                    key={staff.uid}
                    className="flex items-center justify-between gap-2 rounded-lg bg-[#14100C] border border-[#2A2119] px-3 py-2 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="text-[#F6EFE4] truncate">{staff.email}</p>
                      <p className="text-[10px] font-mono text-[#8C7A64] truncate">{staff.uid}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void onRemoveStaffAdmin(staff.uid)}
                      aria-label={`Remove ${staff.email}`}
                      className="p-1.5 rounded-lg text-[#9E8B73] hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
