import { BellRing, CheckCircle2, Clock, Flame, ReceiptText, Utensils, UtensilsCrossed } from 'lucide-react';
import { useState } from 'react';
import { formatKES } from '../data/menu.ts';
import type { OrderStatus, ServiceRequestType, TableOrder } from '../types.ts';

interface TableTrackerViewProps {
  tableNumber: number;
  orders: TableOrder[];
  loading: boolean;
  onBackToMenu: () => void;
  onRequestService: (type: ServiceRequestType) => Promise<void>;
}

const ORDER_STEPS: { status: OrderStatus; label: string }[] = [
  { status: 'Received', label: 'Received' },
  { status: 'Preparing', label: 'Preparing' },
  { status: 'Ready', label: 'Ready' },
  { status: 'Served', label: 'Served' },
];

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function TableTrackerView({
  tableNumber,
  orders,
  loading,
  onBackToMenu,
  onRequestService,
}: TableTrackerViewProps) {
  const [sendingType, setSendingType] = useState<ServiceRequestType | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const tableOrders = orders.filter((o) => o.tableNumber === tableNumber);
  const cumulativeTotal = tableOrders.reduce((sum, o) => sum + o.subtotal, 0);

  const handleService = async (type: ServiceRequestType) => {
    setSendingType(type);
    try {
      await onRequestService(type);
      setFeedback(`${type} has been sent to the floor team for Table ${tableNumber}.`);
      setTimeout(() => setFeedback(null), 4500);
    } finally {
      setSendingType(null);
    }
  };

  return (
    <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-8">
      {/* Header Summary */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-[#2A2119]">
        <div className="space-y-1.5">
          <p className="text-xs font-mono tracking-wider text-[#C99A4E] uppercase">
            Live Table Status
          </p>
          <h1 className="font-display text-3xl font-semibold text-[#F6EFE4]">
            Table {String(tableNumber).padStart(2, '0')} Orders
          </h1>
          <p className="text-sm text-[#B4A693]">
            Track preparation progress in real time or call your server at any point.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="px-4 py-2 rounded-xl bg-[#191410] border border-[#2D241C]">
            <span className="text-xs text-[#9E8B73] block">Table Running Total</span>
            <span className="font-mono tabular-nums text-base font-semibold text-[#E3BC78]">
              {formatKES(cumulativeTotal)}
            </span>
          </div>
          <button
            type="button"
            onClick={onBackToMenu}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-[#C99A4E] text-[#14100C] text-xs font-semibold hover:bg-[#D7AA60] transition-colors whitespace-nowrap"
          >
            Add More Plates
          </button>
        </div>
      </div>

      {/* Quick Service Requests */}
      <div className="rounded-xl bg-[#191410] border border-[#2D241C] p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-[#F6EFE4]">Table Assistance</h2>
            <p className="text-xs text-[#9E8B73]">
              Send an instant ping to your server without leaving your seat.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(['Waiter Call', 'Extra Napkins & Water', 'Request Bill'] as ServiceRequestType[]).map(
              (type) => (
                <button
                  key={type}
                  type="button"
                  disabled={sendingType !== null}
                  onClick={() => handleService(type)}
                  className="inline-flex items-center gap-2 min-h-[40px] px-3.5 py-2 rounded-lg bg-[#231C16] border border-[#352A21] text-xs font-medium text-[#E6DAC8] hover:border-[#C99A4E] disabled:opacity-50 transition-colors whitespace-nowrap"
                >
                  {type === 'Request Bill' ? (
                    <ReceiptText className="w-3.5 h-3.5 text-[#C99A4E]" />
                  ) : (
                    <BellRing className="w-3.5 h-3.5 text-[#C99A4E]" />
                  )}
                  <span>{sendingType === type ? 'Sending...' : type}</span>
                </button>
              )
            )}
          </div>
        </div>

        {feedback && (
          <p className="text-xs text-[#E3BC78] font-medium" role="status">
            {feedback}
          </p>
        )}
      </div>

      {/* Orders List */}
      {loading && tableOrders.length === 0 ? (
        <div className="rounded-xl bg-[#191410] border border-[#2D241C] p-10 text-center text-sm text-[#9E8B73]">
          Loading Table {tableNumber} orders...
        </div>
      ) : tableOrders.length === 0 ? (
        <div className="rounded-xl bg-[#191410] border border-[#2D241C] p-12 text-center space-y-3">
          <UtensilsCrossed className="w-8 h-8 text-[#C99A4E]/70 mx-auto" strokeWidth={1.5} />
          <h2 className="font-display text-xl text-[#F6EFE4]">No orders yet for Table {tableNumber}</h2>
          <p className="text-sm text-[#B4A693] max-w-md mx-auto">
            Browse Breakfast, Lunch, Snacks, or Supper and send your first order straight to the kitchen.
          </p>
          <button
            type="button"
            onClick={onBackToMenu}
            className="mt-2 inline-flex items-center justify-center min-h-[44px] px-5 py-2.5 rounded-xl bg-[#C99A4E] text-[#14100C] text-xs font-semibold hover:bg-[#D7AA60] transition-colors"
          >
            Browse Digital Menu
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {tableOrders.map((order) => {
            const currentStepIdx = ORDER_STEPS.findIndex((s) => s.status === order.status);

            return (
              <article
                key={order.id}
                className="rounded-xl bg-[#191410] border border-[#2D241C] p-6 space-y-6"
              >
                {/* Order Top Metadata */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#261E17]">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5 text-xs text-[#9E8B73]">
                      <span className="font-mono tabular-nums font-semibold text-[#E3BC78]">
                        {order.orderNumber}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">Sent {formatTime(order.createdAt)}</span>
                      {order.guestName && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{order.guestName}</span>
                        </>
                      )}
                    </div>
                    <h3 className="font-display text-lg font-semibold text-[#F6EFE4]">
                      {order.status === 'Received' && 'Received by Kitchen'}
                      {order.status === 'Preparing' && 'Cooking in Progress'}
                      {order.status === 'Ready' && 'Plated & Heading to Your Table'}
                      {order.status === 'Served' && 'Served at Table'}
                    </h3>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span className="text-xs text-[#9E8B73] block">Est. Prep</span>
                      <span className="font-mono tabular-nums text-sm text-[#E6DAC8]">
                        ~{order.estimatedMinutes} min
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-[#9E8B73] block">Order Total</span>
                      <span className="font-mono tabular-nums text-base font-semibold text-[#E3BC78]">
                        {formatKES(order.subtotal)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Progress Stepper */}
                <div className="grid grid-cols-4 gap-2" aria-label="Order progress">
                  {ORDER_STEPS.map((step, idx) => {
                    const completed = idx <= currentStepIdx;
                    const active = idx === currentStepIdx;
                    return (
                      <div key={step.status} className="space-y-2">
                        <div
                          className={`h-1.5 rounded-full transition-colors ${
                            completed ? 'bg-[#C99A4E]' : 'bg-[#2B221A]'
                          }`}
                        />
                        <div className="flex items-center gap-1.5 text-xs">
                          {step.status === 'Received' && (
                            <Clock
                              className={`w-3.5 h-3.5 shrink-0 ${
                                completed ? 'text-[#C99A4E]' : 'text-[#6E5F4F]'
                              }`}
                            />
                          )}
                          {step.status === 'Preparing' && (
                            <Flame
                              className={`w-3.5 h-3.5 shrink-0 ${
                                completed ? 'text-[#C99A4E]' : 'text-[#6E5F4F]'
                              }`}
                            />
                          )}
                          {step.status === 'Ready' && (
                            <Utensils
                              className={`w-3.5 h-3.5 shrink-0 ${
                                completed ? 'text-[#C99A4E]' : 'text-[#6E5F4F]'
                              }`}
                            />
                          )}
                          {step.status === 'Served' && (
                            <CheckCircle2
                              className={`w-3.5 h-3.5 shrink-0 ${
                                completed ? 'text-[#C99A4E]' : 'text-[#6E5F4F]'
                              }`}
                            />
                          )}
                          <span
                            className={`truncate ${
                              active
                                ? 'text-[#F6EFE4] font-semibold'
                                : completed
                                  ? 'text-[#C8B9A6]'
                                  : 'text-[#6E5F4F]'
                            }`}
                          >
                            {step.label}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Itemized Dishes */}
                <ul className="divide-y divide-[#261E17] border-t border-[#261E17]">
                  {order.items.map((item, idx) => (
                    <li key={`${item.menuItemId}-${idx}`} className="py-3 flex items-start justify-between gap-4">
                      <div className="space-y-0.5">
                        <p className="text-sm font-medium text-[#F6EFE4]">
                          <span className="font-mono tabular-nums text-[#E3BC78] mr-2">
                            {item.quantity}×
                          </span>
                          {item.name}
                        </p>
                        {(item.selectedOptionLabel || item.spiceLevel || item.notes) && (
                          <p className="text-xs text-[#9E8B73]">
                            {[item.selectedOptionLabel, item.spiceLevel, item.notes]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                        )}
                      </div>
                      <span className="font-mono tabular-nums text-xs text-[#C8B9A6] shrink-0">
                        {formatKES(item.unitPrice * item.quantity)}
                      </span>
                    </li>
                  ))}
                </ul>

                {order.serviceNote && (
                  <p className="text-xs text-[#B4A693] pt-1">
                    Table note: <span className="text-[#E6DAC8]">{order.serviceNote}</span>
                  </p>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
