import { useState } from 'react';
import { Menu, ShoppingBag, X } from 'lucide-react';

export type CustomerView = 'menu' | 'tracker';

interface HeaderProps {
  activeView: CustomerView;
  onSelectView: (view: CustomerView) => void;
  cartCount: number;
  onOpenCart: () => void;
}

const NAV_ITEMS: { id: CustomerView; label: string }[] = [
  { id: 'menu', label: 'Menu' },
  { id: 'tracker', label: 'Table Tracker' },
];

export function Header({ activeView, onSelectView, cartCount, onOpenCart }: HeaderProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const handleNavClick = (view: CustomerView) => {
    onSelectView(view);
    setMobileNavOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 bg-[#110E0B]/95 backdrop-blur-md border-b border-[#2A2119]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single-line brand wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setMobileNavOpen((prev) => !prev)}
            className="md:hidden min-h-[44px] min-w-[44px] -ml-2 flex items-center justify-center text-[#D6C8B4] hover:text-[#F6EFE4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C99A4E] rounded-lg"
            aria-label={mobileNavOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileNavOpen}
          >
            {mobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <button
            type="button"
            onClick={() => handleNavClick('menu')}
            className="font-display text-xl sm:text-2xl font-semibold tracking-tight text-[#F6EFE4] whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C99A4E] rounded"
          >
            Jikoni Table
          </button>
        </div>

        {/* Zone 2: Clean single-line customer navigation links */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium" aria-label="Customer navigation">
          {NAV_ITEMS.map((item) => {
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavClick(item.id)}
                className={`relative py-1 whitespace-nowrap shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C99A4E] rounded ${
                  isActive
                    ? 'text-[#E3BC78]'
                    : 'text-[#B4A693] hover:text-[#F6EFE4]'
                }`}
              >
                {item.label}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute left-0 right-0 -bottom-0.5 h-0.5 bg-[#C99A4E] rounded-full"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Single primary action */}
        <div className="shrink-0">
          <button
            type="button"
            onClick={onOpenCart}
            className="inline-flex items-center gap-2.5 min-h-[40px] px-4 py-2 rounded-lg bg-[#C99A4E] text-[#14100C] text-sm font-semibold hover:bg-[#D7AA60] active:scale-[0.98] transition-all whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6EFE4]"
          >
            <ShoppingBag className="w-4 h-4 shrink-0" />
            <span>Order Tray</span>
            {cartCount > 0 && (
              <span className="font-mono tabular-nums text-xs font-bold px-1.5 py-0.5 rounded bg-[#14100C]/15 text-[#14100C]">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Mobile navigation dropdown */}
      {mobileNavOpen && (
        <nav
          className="md:hidden border-t border-[#2A2119] bg-[#16120E] px-4 py-3 space-y-1"
          aria-label="Mobile customer navigation"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavClick(item.id)}
                className={`w-full text-left px-3 min-h-[44px] rounded-lg text-sm font-medium flex items-center justify-between transition-colors ${
                  isActive
                    ? 'bg-[#261E17] text-[#E3BC78]'
                    : 'text-[#C8B9A6] hover:bg-[#1E1813] hover:text-[#F6EFE4]'
                }`}
              >
                <span>{item.label}</span>
                {isActive && <span className="text-xs font-mono text-[#C99A4E]">Active</span>}
              </button>
            );
          })}
        </nav>
      )}
    </header>
  );
}
