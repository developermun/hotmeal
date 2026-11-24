import { LogOut } from 'lucide-react';
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
  onLockPortal,
  currentTable,
}: AdminPortalProps) {
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
    </div>
  );
}
