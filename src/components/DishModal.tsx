import { useEffect, useState } from 'react';
import { Minus, Plus, X } from 'lucide-react';
import { formatKES } from '../data/menu.ts';
import type { DishOption, MenuItem, SpiceLevel } from '../types.ts';
import { DishImage } from './DishImage.tsx';

interface DishModalProps {
  dish: MenuItem | null;
  onClose: () => void;
  onAddToCart: (params: {
    dish: MenuItem;
    selectedOption?: DishOption;
    spiceLevel?: SpiceLevel;
    quantity: number;
    notes: string;
  }) => void;
}

const SPICE_LEVELS: SpiceLevel[] = ['Mild', 'Medium', 'Pilipili Hot'];

export function DishModal({ dish, onClose, onAddToCart }: DishModalProps) {
  const [selectedOption, setSelectedOption] = useState<DishOption | undefined>(undefined);
  const [spiceLevel, setSpiceLevel] = useState<SpiceLevel>('Medium');
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (dish) {
      setSelectedOption(dish.options?.[0]);
      setSpiceLevel('Medium');
      setQuantity(1);
      setNotes('');
    }
  }, [dish]);

  useEffect(() => {
    if (!dish) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [dish, onClose]);

  if (!dish) return null;

  const activeImage = selectedOption?.imageOverride || dish.image;
  const unitPrice = dish.price + (selectedOption?.priceDelta ?? 0);
  const lineTotal = unitPrice * quantity;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAddToCart({
      dish,
      selectedOption,
      spiceLevel: dish.supportsSpiceLevel ? spiceLevel : undefined,
      quantity,
      notes: notes.trim(),
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dish-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-[#191410] border border-[#2D241C] shadow-2xl flex flex-col"
      >
        {/* Top Photo */}
        <div className="relative aspect-[16/10] w-full bg-[#120E0B] shrink-0">
          <DishImage src={activeImage} alt={dish.name} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#191410] via-transparent to-black/30 pointer-events-none" />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dish details"
            className="absolute top-3 right-3 min-h-[44px] min-w-[44px] rounded-full bg-[#110E0B]/85 text-[#F6EFE4] flex items-center justify-center border border-[#352A21] hover:border-[#C99A4E] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Details & Customization */}
        <div className="p-6 space-y-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-[#9E8B73]">
              <span>{dish.category}</span>
              <span aria-hidden="true">·</span>
              <span>{dish.subLabel}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">{dish.prepMinutes} min</span>
            </div>

            <div className="flex items-baseline justify-between gap-4">
              <h2 id="dish-modal-title" className="font-display text-2xl font-semibold text-[#F6EFE4]">
                {dish.name}
              </h2>
              <span className="font-mono tabular-nums text-lg font-semibold text-[#E3BC78] whitespace-nowrap shrink-0">
                {formatKES(unitPrice)}
              </span>
            </div>

            <p className="text-sm text-[#B4A693] leading-relaxed">{dish.description}</p>
          </div>

          {/* Preparation / Variant Options */}
          {dish.options && dish.options.length > 0 && (
            <div className="space-y-2.5">
              <p className="text-xs font-semibold text-[#E6DAC8]">
                {dish.optionGroupName || 'Preparation Choice'}
              </p>
              <div className="space-y-2">
                {dish.options.map((opt) => {
                  const active = selectedOption?.id === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setSelectedOption(opt)}
                      className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border text-left flex items-center justify-between gap-3 transition-colors ${
                        active
                          ? 'bg-[#261E17] border-[#C99A4E] text-[#F6EFE4]'
                          : 'bg-[#14100C] border-[#2A2119] text-[#C8B9A6] hover:border-[#3E3125]'
                      }`}
                    >
                      <span className="text-sm font-medium">{opt.label}</span>
                      <span className="font-mono tabular-nums text-xs text-[#E3BC78] whitespace-nowrap shrink-0">
                        {opt.priceDelta === 0
                          ? 'Included'
                          : opt.priceDelta > 0
                            ? `+${formatKES(opt.priceDelta)}`
                            : formatKES(opt.priceDelta)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Spice Level */}
          {dish.supportsSpiceLevel && (
            <div className="space-y-2.5">
              <p className="text-xs font-semibold text-[#E6DAC8]">Chili &amp; Spice Level</p>
              <div className="grid grid-cols-3 gap-2">
                {SPICE_LEVELS.map((level) => {
                  const active = spiceLevel === level;
                  return (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setSpiceLevel(level)}
                      className={`min-h-[42px] px-3 py-2 rounded-xl border text-xs font-medium transition-colors whitespace-nowrap ${
                        active
                          ? 'bg-[#C99A4E] border-[#C99A4E] text-[#14100C] font-semibold'
                          : 'bg-[#14100C] border-[#2A2119] text-[#C8B9A6] hover:border-[#3E3125]'
                      }`}
                    >
                      {level}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Special Kitchen Notes */}
          <div className="space-y-2">
            <label htmlFor="dish-kitchen-notes" className="block text-xs font-semibold text-[#E6DAC8]">
              Kitchen Instructions (optional)
            </label>
            <input
              id="dish-kitchen-notes"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={160}
              placeholder="e.g., Extra kachumbari, no coriander, crispy edge..."
              className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[#14100C] border border-[#2A2119] text-sm text-[#F6EFE4] placeholder-[#7B6B58] focus:outline-none focus:border-[#C99A4E]"
            />
          </div>

          {/* Quantity & Add CTA */}
          <div className="pt-2 flex items-center gap-3">
            <div className="inline-flex items-center rounded-xl bg-[#14100C] border border-[#2D241C]">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                aria-label="Decrease quantity"
                className="min-h-[46px] min-w-[44px] flex items-center justify-center text-[#E3BC78] hover:bg-[#231C16] rounded-l-xl transition-colors"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="w-9 text-center font-mono tabular-nums text-sm font-semibold text-[#F6EFE4]">
                {quantity}
              </span>
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.min(20, q + 1))}
                aria-label="Increase quantity"
                className="min-h-[46px] min-w-[44px] flex items-center justify-center text-[#E3BC78] hover:bg-[#231C16] rounded-r-xl transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <button
              type="submit"
              className="flex-1 min-h-[46px] px-5 py-2.5 rounded-xl bg-[#C99A4E] text-[#14100C] text-sm font-semibold hover:bg-[#D7AA60] active:scale-[0.99] transition-all flex items-center justify-between gap-3"
            >
              <span>Add to Table Order</span>
              <span className="font-mono tabular-nums font-bold">{formatKES(lineTotal)}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
