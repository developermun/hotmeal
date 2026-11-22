import { BellRing, ChevronDown, QrCode, ReceiptText } from 'lucide-react';
import { useState } from 'react';
import type { ServiceRequestType } from '../types.ts';

interface HeroBannerProps {
  tableNumber: number;
  scannedViaQr: boolean;
  onChangeTable: (table: number) => void;
  onOpenQrView: () => void;
  onRequestService: (type: ServiceRequestType) => Promise<void>;
  activeOrdersCount: number;
  onViewTracker: () => void;
}

const TABLE_OPTIONS = Array.from({ length: 12 }, (_, idx) => idx + 1);

export function HeroBanner({
  tableNumber,
  scannedViaQr,
  onChangeTable,
  onOpenQrView,
  onRequestService,
  activeOrdersCount,
  onViewTracker,
}: HeroBannerProps) {
  const [tablePickerOpen, setTablePickerOpen] = useState(false);
  const [sendingType, setSendingType] = useState<ServiceRequestType | null>(null);
  const [confirmMessage, setConfirmMessage] = useState<string | null>(null);

  const triggerService = async (type: ServiceRequestType) => {
    setSendingType(type);
    try {
      await onRequestService(type);
      setConfirmMessage(`${type} sent for Table ${tableNumber}`);
      setTimeout(() => setConfirmMessage(null), 4000);
    } finally {
      setSendingType(null);
    }
  };

  return (
    <section className="border-b border-[#2A2119] bg-gradient-to-b from-[#17120E] to-[#110E0B]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        <div className="grid lg:grid-cols-12 gap-8 items-center">
          {/* Editorial Headline & Kenyan Kitchen Intro */}
          <div className="lg:col-span-7 space-y-4">
            <p className="text-xs font-mono tracking-wider text-[#C99A4E] uppercase">
              Nairobi &amp; Swahili Kitchen · Direct Table Ordering
            </p>
            <h1 className="font-display text-3xl sm:text-4xl lg:text-[2.75rem] font-semibold leading-[1.12] tracking-tight text-[#F6EFE4] text-balance max-w-2xl">
              Kenyan hearth cooking, ordered straight from your table.
            </h1>
            <p className="text-sm sm:text-base text-[#B4A693] leading-relaxed max-w-xl">
              Explore freshly brewed tangawizi chai, coastal coconut stews, street-style snacks, and flame-grilled nyama choma. Customize your plate and send your order directly to the kitchen.
            </p>
          </div>

          {/* Active Table Session & Quick Table Controls */}
          <div className="lg:col-span-5">
            <div className="rounded-xl bg-[#191410] border border-[#2D241C] p-5 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs text-[#9E8B73]">
                    {scannedViaQr ? 'QR Checked-In Session' : 'Selected Dining Table'}
                  </p>
                  <div className="mt-1 flex items-baseline gap-3">
                    <span className="font-display text-2xl font-semibold text-[#F6EFE4] tabular-nums">
                      Table {String(tableNumber).padStart(2, '0')}
                    </span>
                    {activeOrdersCount > 0 && (
                      <button
                        type="button"
                        onClick={onViewTracker}
                        className="text-xs font-medium text-[#E3BC78] hover:underline whitespace-nowrap"
                      >
                        {activeOrdersCount} active {activeOrdersCount === 1 ? 'order' : 'orders'}
                      </button>
                    )}
                  </div>
                </div>

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setTablePickerOpen((prev) => !prev)}
                    className="inline-flex items-center gap-1.5 min-h-[40px] px-3 py-2 rounded-lg bg-[#231C16] border border-[#352A21] text-xs font-medium text-[#E6DAC8] hover:border-[#C99A4E]/60 transition-colors whitespace-nowrap shrink-0"
                  >
                    <span>Switch Table</span>
                    <ChevronDown className="w-3.5 h-3.5 text-[#C99A4E]" />
                  </button>

                  {tablePickerOpen && (
                    <div
                      className="absolute right-0 mt-2 w-56 rounded-xl bg-[#1E1813] border border-[#352A21] shadow-2xl p-2 z-30"
                      role="listbox"
                      aria-label="Select dining table"
                    >
                      <p className="px-2 py-1 text-[11px] font-medium text-[#9E8B73]">
                        Choose your table number
                      </p>
                      <div className="grid grid-cols-4 gap-1.5 mt-1">
                        {TABLE_OPTIONS.map((num) => (
                          <button
                            key={num}
                            type="button"
                            onClick={() => {
                              onChangeTable(num);
                              setTablePickerOpen(false);
                            }}
                            className={`h-9 rounded-lg font-mono text-xs tabular-nums font-medium transition-colors ${
                              num === tableNumber
                                ? 'bg-[#C99A4E] text-[#14100C] font-bold'
                                : 'bg-[#261E17] text-[#E6DAC8] hover:bg-[#32281F]'
                            }`}
                          >
                            {num}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="h-px bg-[#2A2119]" />

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  disabled={sendingType !== null}
                  onClick={() => triggerService('Waiter Call')}
                  className="flex-1 min-w-[130px] inline-flex items-center justify-center gap-2 min-h-[40px] px-3 py-2 rounded-lg bg-[#231C16] border border-[#352A21] text-xs font-medium text-[#E6DAC8] hover:border-[#C99A4E]/60 hover:text-[#F6EFE4] disabled:opacity-50 transition-colors whitespace-nowrap"
                >
                  <BellRing className="w-3.5 h-3.5 text-[#C99A4E]" />
                  <span>{sendingType === 'Waiter Call' ? 'Calling...' : 'Call Waiter'}</span>
                </button>

                <button
                  type="button"
                  disabled={sendingType !== null}
                  onClick={() => triggerService('Request Bill')}
                  className="flex-1 min-w-[130px] inline-flex items-center justify-center gap-2 min-h-[40px] px-3 py-2 rounded-lg bg-[#231C16] border border-[#352A21] text-xs font-medium text-[#E6DAC8] hover:border-[#C99A4E]/60 hover:text-[#F6EFE4] disabled:opacity-50 transition-colors whitespace-nowrap"
                >
                  <ReceiptText className="w-3.5 h-3.5 text-[#C99A4E]" />
                  <span>{sendingType === 'Request Bill' ? 'Sending...' : 'Request Bill'}</span>
                </button>

                <button
                  type="button"
                  onClick={onOpenQrView}
                  className="inline-flex items-center justify-center gap-1.5 min-h-[40px] px-3 py-2 rounded-lg bg-[#231C16] border border-[#352A21] text-xs font-medium text-[#C99A4E] hover:border-[#C99A4E] transition-colors whitespace-nowrap"
                  title="View printable QR codes for all tables"
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>Table QRs</span>
                </button>
              </div>

              {confirmMessage && (
                <p className="text-xs text-[#E3BC78] font-medium pt-1" role="status">
                  {confirmMessage}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
