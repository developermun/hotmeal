import { useState } from 'react';
import { BellRing, CheckCircle2, Clock, Flame, RefreshCw, Utensils } from 'lucide-react';
import { formatKES } from '../data/menu.ts';
import type { OrderStatus, ServiceRequest, TableOrder } from '../types.ts';

interface KitchenBoardViewProps {
  orders: TableOrder[];
  serviceRequests: ServiceRequest[];
  loading: boolean;
  onAdvanceOrderStatus: (orderId: string, nextStatus: OrderStatus) => Promise<void>;
  onResolveServiceRequest: (requestId: string) => Promise<void>;
  onRefresh: () => void;
}

type KitchenFilter = 'Active' | 'All' | 'Served';

const NEXT_STATUS_MAP: Partial<Record<OrderStatus, { next: OrderStatus; buttonLabel: string }>> = {
  Received: { next: 'Preparing', buttonLabel: 'Start Cooking' },
  Preparing: { next: 'Ready', buttonLabel: 'Mark Ready' },
  Ready: { next: 'Served', buttonLabel: 'Mark Served' },
};

function elapsedLabel(iso: string): string {
  const diffMin = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (diffMin < 1) return 'Just now';
  return `${diffMin}m ago`;
}

export function KitchenBoardView({
  orders,
  serviceRequests,
  loading,
  onAdvanceOrderStatus,
  onResolveServiceRequest,
  onRefresh,
}: KitchenBoardViewProps) {
  const [filter, setFilter] = useState<KitchenFilter>('Active');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const openRequests = serviceRequests.filter((r) => r.status === 'Open');

  const visibleOrders = orders.filter((order) => {
    if (filter === 'Active') return order.status !== 'Served';
    if (filter === 'Served') return order.status === 'Served';
    return true;
  });

  const receivedCount = orders.filter((o) => o.status === 'Received').length;
  const preparingCount = orders.filter((o) => o.status === 'Preparing').length;
  const readyCount = orders.filter((o) => o.status === 'Ready').length;

  const handleAdvance = async (orderId: string, nextStatus: OrderStatus) => {
    setUpdatingId(orderId);
    try {
      await onAdvanceOrderStatus(orderId, nextStatus);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-8">
      {/* Header & Summary Counts */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-6 border-b border-[#2A2119]">
        <div className="space-y-1.5">
          <p className="text-xs font-mono tracking-wider text-[#C99A4E] uppercase">
            Kitchen Display System
          </p>
          <h1 className="font-display text-3xl font-semibold text-[#F6EFE4]">
            Live Kitchen &amp; Floor Queue
          </h1>
          <p className="text-sm text-[#B4A693]">
            Orders placed via table QR codes appear here immediately. Update ticket stages to sync diner Table Trackers.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-4 px-4 py-2.5 rounded-xl bg-[#191410] border border-[#2D241C] text-xs font-mono tabular-nums">
            <span className="text-[#E6DAC8]">
              Queued: <strong className="text-[#E3BC78]">{receivedCount}</strong>
            </span>
            <span className="text-[#4A3C2F]" aria-hidden="true">|</span>
            <span className="text-[#E6DAC8]">
              Cooking: <strong className="text-[#E3BC78]">{preparingCount}</strong>
            </span>
            <span className="text-[#4A3C2F]" aria-hidden="true">|</span>
            <span className="text-[#E6DAC8]">
              Ready: <strong className="text-[#E3BC78]">{readyCount}</strong>
            </span>
          </div>

          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex items-center gap-1.5 min-h-[42px] px-4 py-2 rounded-xl bg-[#231C16] border border-[#352A21] text-xs font-semibold text-[#E6DAC8] hover:border-[#C99A4E] transition-colors whitespace-nowrap"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#C99A4E] ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Open Table Service Requests */}
      {openRequests.length > 0 && (
        <div className="rounded-xl bg-[#1C1611] border border-[#C99A4E]/50 p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-[#E3BC78] flex items-center gap-2">
              <BellRing className="w-4 h-4" />
              <span>Floor Assistance Requests ({openRequests.length})</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {openRequests.map((req) => (
              <div
                key={req.id}
                className="rounded-lg bg-[#14100C] border border-[#2D241C] px-4 py-3 flex items-center justify-between gap-3"
              >
                <div>
                  <p className="text-sm font-semibold text-[#F6EFE4] tabular-nums">
                    Table {String(req.tableNumber).padStart(2, '0')} · {req.type}
                  </p>
                  <p className="text-xs font-mono text-[#9E8B73]">{elapsedLabel(req.createdAt)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onResolveServiceRequest(req.id)}
                  className="min-h-[36px] px-3 py-1.5 rounded-lg bg-[#C99A4E] text-[#14100C] text-xs font-semibold hover:bg-[#D7AA60] transition-colors whitespace-nowrap"
                >
                  Acknowledge
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter Segmented Control */}
      <div className="flex items-center justify-between gap-4">
        <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#191410] border border-[#2D241C]">
          {(['Active', 'All', 'Served'] as KitchenFilter[]).map((tab) => {
            const active = filter === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setFilter(tab)}
                className={`min-h-[38px] px-4 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-[#C99A4E] text-[#14100C] font-semibold'
                    : 'text-[#C8B9A6] hover:text-[#F6EFE4]'
                }`}
              >
                {tab === 'Active' ? 'Active Tickets' : tab === 'All' ? 'All Tickets' : 'Served History'}
              </button>
            );
          })}
        </div>

        <span className="text-xs font-mono tabular-nums text-[#9E8B73]">
          {visibleOrders.length} {visibleOrders.length === 1 ? 'ticket' : 'tickets'}
        </span>
      </div>

      {/* Kitchen Tickets Grid */}
      {visibleOrders.length === 0 ? (
        <div className="rounded-xl bg-[#191410] border border-[#2D241C] p-12 text-center space-y-2">
          <p className="font-display text-xl text-[#F6EFE4]">No tickets in this view</p>
          <p className="text-sm text-[#9E8B73]">
            New orders submitted from any dining table QR menu will appear here automatically.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {visibleOrders.map((order) => {
            const transition = NEXT_STATUS_MAP[order.status];
            const isUpdating = updatingId === order.id;

            return (
              <article
                key={order.id}
                className="rounded-xl bg-[#191410] border border-[#2D241C] p-5 flex flex-col justify-between gap-5"
              >
                <div className="space-y-4">
                  {/* Ticket Header */}
                  <div className="flex items-start justify-between gap-3 pb-3 border-b border-[#261E17]">
                    <div>
                      <div className="flex items-center gap-2 text-xs font-mono text-[#9E8B73]">
                        <span className="text-[#E3BC78] font-semibold">{order.orderNumber}</span>
                        <span aria-hidden="true">·</span>
                        <span>{elapsedLabel(order.createdAt)}</span>
                      </div>
                      <h3 className="font-display text-xl font-semibold text-[#F6EFE4] mt-0.5 tabular-nums">
                        Table {String(order.tableNumber).padStart(2, '0')}
                        {order.guestName ? ` · ${order.guestName}` : ''}
                      </h3>
                    </div>

                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#E3BC78] whitespace-nowrap shrink-0">
                      {order.status === 'Received' && <Clock className="w-3.5 h-3.5" />}
                      {order.status === 'Preparing' && <Flame className="w-3.5 h-3.5" />}
                      {order.status === 'Ready' && <Utensils className="w-3.5 h-3.5" />}
                      {order.status === 'Served' && <CheckCircle2 className="w-3.5 h-3.5" />}
                      <span>{order.status}</span>
                    </span>
                  </div>

                  {/* Ticket Line Items */}
                  <ul className="space-y-3">
                    {order.items.map((item, idx) => (
                      <li key={`${item.menuItemId}-${idx}`} className="text-sm">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="font-medium text-[#F6EFE4]">
                            <span className="font-mono tabular-nums text-[#E3BC78] mr-2">
                              {item.quantity}×
                            </span>
                            {item.name}
                          </span>
                        </div>
                        {(item.selectedOptionLabel || item.spiceLevel) && (
                          <p className="text-xs text-[#B4A693] pl-6 mt-0.5">
                            {[item.selectedOptionLabel, item.spiceLevel].filter(Boolean).join(' · ')}
                          </p>
                        )}
                        {item.notes && (
                          <p className="text-xs text-[#E3BC78]/90 pl-6 mt-0.5">
                            Note: {item.notes}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>

                  {order.serviceNote && (
                    <div className="rounded-lg bg-[#14100C] border border-[#2A2119] px-3 py-2 text-xs text-[#D6C8B4]">
                      Table note: {order.serviceNote}
                    </div>
                  )}
                </div>

                {/* Ticket Footer Action */}
                <div className="pt-3 border-t border-[#261E17] flex items-center justify-between gap-3">
                  <span className="font-mono tabular-nums text-xs text-[#9E8B73]">
                    {formatKES(order.subtotal)}
                  </span>

                  {transition ? (
                    <button
                      type="button"
                      disabled={isUpdating}
                      onClick={() => handleAdvance(order.id, transition.next)}
                      className="min-h-[40px] px-4 py-2 rounded-lg bg-[#C99A4E] text-[#14100C] text-xs font-semibold hover:bg-[#D7AA60] disabled:opacity-50 transition-colors whitespace-nowrap"
                    >
                      {isUpdating ? 'Updating...' : transition.buttonLabel}
                    </button>
                  ) : (
                    <span className="text-xs font-medium text-[#9E8B73]">Completed</span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
