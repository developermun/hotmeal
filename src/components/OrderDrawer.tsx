import { useEffect, useState } from 'react';
import { ArrowRight, Minus, Plus, Trash2, X } from 'lucide-react';
import { formatKES } from '../data/menu.ts';
import type { CartItem } from '../types.ts';
import { DishImage } from './DishImage.tsx';

interface OrderDrawerProps {
  open: boolean;
  onClose: () => void;
  tableNumber: number;
  cart: CartItem[];
  onUpdateCartItemQty: (cartItemId: string, delta: number) => void;
  onRemoveCartItem: (cartItemId: string) => void;
  onClearCart: () => void;
  onPlaceOrder: (payload: { guestName: string; serviceNote: string }) => Promise<void>;
}

export function OrderDrawer({
  open,
  onClose,
  tableNumber,
  cart,
  onUpdateCartItemQty,
  onRemoveCartItem,
  onClearCart,
  onPlaceOrder,
}: OrderDrawerProps) {
  const [guestName, setGuestName] = useState('');
  const [serviceNote, setServiceNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [open, onClose]);

  if (!open) return null;

  const subtotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const totalCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0 || submitting) return;
    setSubmitting(true);
    setErrorMsg(null);
    try {
      await onPlaceOrder({ guestName: guestName.trim(), serviceNote: serviceNote.trim() });
      setServiceNote('');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to send order. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`Table ${tableNumber} order tray`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md bg-[#16120E] border-l border-[#2D241C] h-full flex flex-col shadow-2xl">
        {/* Drawer Header */}
        <div className="px-5 py-4 border-b border-[#2A2119] flex items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-semibold text-[#F6EFE4]">
              Table {String(tableNumber).padStart(2, '0')} Order Tray
            </h2>
            <p className="text-xs text-[#9E8B73] font-mono tabular-nums mt-0.5">
              {totalCount} {totalCount === 1 ? 'plate' : 'plates'} selected
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close order tray"
            className="min-h-[44px] min-w-[44px] rounded-lg flex items-center justify-center text-[#B4A693] hover:text-[#F6EFE4] hover:bg-[#231C16] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Itemized Cart Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          {cart.length === 0 ? (
            <div className="py-16 text-center space-y-2">
              <p className="font-display text-lg text-[#F6EFE4]">Your tray is empty</p>
              <p className="text-sm text-[#9E8B73] max-w-xs mx-auto">
                Tap any Kenyan or Swahili plate on the menu to add it directly to Table {tableNumber}.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[#9E8B73]">Selected Dishes</span>
                <button
                  type="button"
                  onClick={onClearCart}
                  className="text-xs text-[#B4A693] hover:text-[#E3BC78] transition-colors"
                >
                  Clear tray
                </button>
              </div>

              <ul className="divide-y divide-[#261E17]">
                {cart.map((item) => (
                  <li key={item.cartItemId} className="py-4 flex gap-3.5">
                    <div className="w-16 h-16 rounded-lg overflow-hidden bg-[#120E0B] shrink-0">
                      <DishImage
                        src={item.image}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-display text-base font-semibold text-[#F6EFE4] truncate">
                          {item.name}
                        </h3>
                        <span className="font-mono tabular-nums text-xs font-semibold text-[#E3BC78] shrink-0">
                          {formatKES(item.unitPrice * item.quantity)}
                        </span>
                      </div>

                      {(item.selectedOptionLabel || item.spiceLevel) && (
                        <p className="text-xs text-[#B4A693]">
                          {[item.selectedOptionLabel, item.spiceLevel].filter(Boolean).join(' · ')}
                        </p>
                      )}

                      {item.notes && (
                        <p className="text-xs text-[#9E8B73] italic">Note: {item.notes}</p>
                      )}

                      <div className="pt-2 flex items-center justify-between">
                        <div className="inline-flex items-center rounded-lg bg-[#1F1813] border border-[#2D241C]">
                          <button
                            type="button"
                            onClick={() => onUpdateCartItemQty(item.cartItemId, -1)}
                            aria-label={`Decrease ${item.name} quantity`}
                            className="min-h-[36px] min-w-[36px] flex items-center justify-center text-[#E3BC78] hover:bg-[#2B221A] rounded-l-lg"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="px-2.5 font-mono tabular-nums text-xs font-semibold text-[#F6EFE4]">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => onUpdateCartItemQty(item.cartItemId, 1)}
                            aria-label={`Increase ${item.name} quantity`}
                            className="min-h-[36px] min-w-[36px] flex items-center justify-center text-[#E3BC78] hover:bg-[#2B221A] rounded-r-lg"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => onRemoveCartItem(item.cartItemId)}
                          aria-label={`Remove ${item.name}`}
                          className="min-h-[36px] min-w-[36px] flex items-center justify-center text-[#9E8B73] hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        {/* Drawer Checkout Footer */}
        {cart.length > 0 && (
          <form onSubmit={handleSubmit} className="p-5 border-t border-[#2A2119] bg-[#191410] space-y-4">
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label htmlFor="guest-name-input" className="block text-xs text-[#B4A693] mb-1">
                  Your Name (optional)
                </label>
                <input
                  id="guest-name-input"
                  type="text"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  maxLength={50}
                  placeholder="e.g., Wanjiku"
                  className="w-full min-h-[40px] px-3 py-2 rounded-lg bg-[#120E0B] border border-[#2D241C] text-sm text-[#F6EFE4] placeholder-[#786855] focus:outline-none focus:border-[#C99A4E]"
                />
              </div>

              <div>
                <label htmlFor="table-note-input" className="block text-xs text-[#B4A693] mb-1">
                  Table Note (optional)
                </label>
                <input
                  id="table-note-input"
                  type="text"
                  value={serviceNote}
                  onChange={(e) => setServiceNote(e.target.value)}
                  maxLength={180}
                  placeholder="Allergies, serve starters first, extra lime..."
                  className="w-full min-h-[40px] px-3 py-2 rounded-lg bg-[#120E0B] border border-[#2D241C] text-sm text-[#F6EFE4] placeholder-[#786855] focus:outline-none focus:border-[#C99A4E]"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-[#261E17] space-y-1.5">
              <div className="flex items-center justify-between text-xs text-[#9E8B73]">
                <span>Dining Table</span>
                <span className="font-mono tabular-nums text-[#E6DAC8]">
                  Table {String(tableNumber).padStart(2, '0')}
                </span>
              </div>
              <div className="flex items-center justify-between text-base font-semibold text-[#F6EFE4]">
                <span>Order Total</span>
                <span className="font-mono tabular-nums text-[#E3BC78]">{formatKES(subtotal)}</span>
              </div>
            </div>

            {errorMsg && (
              <p className="text-xs text-red-400" role="alert">
                {errorMsg}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-[#C99A4E] text-[#14100C] text-sm font-semibold hover:bg-[#D7AA60] active:scale-[0.99] disabled:opacity-60 transition-all flex items-center justify-center gap-2"
            >
              <span>{submitting ? 'Sending to Kitchen...' : 'Send Order to Kitchen'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
