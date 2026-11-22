import { useEffect, useState } from 'react';
import { Check, Copy, Download, ExternalLink, Plus, Printer } from 'lucide-react';
import QRCode from 'qrcode';

interface QrStudioViewProps {
  currentTable: number;
  onSimulateScan: (tableNumber: number) => void;
}

const DEFAULT_TABLES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export function QrStudioView({ currentTable, onSimulateScan }: QrStudioViewProps) {
  const [tables, setTables] = useState<number[]>(DEFAULT_TABLES);
  const [customTableInput, setCustomTableInput] = useState('');
  const [qrMap, setQrMap] = useState<Record<number, string>>({});
  const [copiedTable, setCopiedTable] = useState<number | null>(null);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  const getTableUrl = (tableNum: number) => `${origin}/?table=${tableNum}`;

  useEffect(() => {
    let cancelled = false;

    async function generateAll() {
      const nextMap: Record<number, string> = {};
      await Promise.all(
        tables.map(async (t) => {
          try {
            const url = getTableUrl(t);
            const dataUrl = await QRCode.toDataURL(url, {
              width: 320,
              margin: 2,
              color: {
                dark: '#14100C',
                light: '#F6EFE4',
              },
            });
            nextMap[t] = dataUrl;
          } catch {
            // Ignore failed QR generation for individual table
          }
        })
      );
      if (!cancelled) {
        setQrMap(nextMap);
      }
    }

    generateAll();
    return () => {
      cancelled = true;
    };
  }, [tables, origin]);

  const handleAddCustomTable = (e: React.FormEvent) => {
    e.preventDefault();
    const num = Number(customTableInput);
    if (!Number.isInteger(num) || num < 1 || num > 99) return;
    if (!tables.includes(num)) {
      setTables((prev) => [...prev, num].sort((a, b) => a - b));
    }
    setCustomTableInput('');
  };

  const handleCopyLink = async (tableNum: number) => {
    const url = getTableUrl(tableNum);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedTable(tableNum);
      setTimeout(() => setCopiedTable(null), 2000);
    } catch {
      // Clipboard API fallback ignored
    }
  };

  const handleDownloadQr = (tableNum: number) => {
    const dataUrl = qrMap[tableNum];
    if (!dataUrl) return;
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `jikoni-table-${String(tableNum).padStart(2, '0')}-qr.png`;
    link.click();
  };

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-8">
      {/* Header & Custom Table Creator */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-6 border-b border-[#2A2119]">
        <div className="space-y-1.5 max-w-2xl">
          <p className="text-xs font-mono tracking-wider text-[#C99A4E] uppercase">
            Table Tent &amp; QR Generator
          </p>
          <h1 className="font-display text-3xl font-semibold text-[#F6EFE4]">
            Printable Table QR Codes
          </h1>
          <p className="text-sm text-[#B4A693]">
            Every QR code encodes a direct table URL so guests scan with their phone camera and immediately order for that exact table. Use &ldquo;Simulate Scan&rdquo; on any card to preview the diner flow.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <form onSubmit={handleAddCustomTable} className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={99}
              value={customTableInput}
              onChange={(e) => setCustomTableInput(e.target.value)}
              placeholder="Table # (1-99)"
              aria-label="Custom table number"
              className="w-36 min-h-[42px] px-3 py-2 rounded-xl bg-[#191410] border border-[#2D241C] text-sm text-[#F6EFE4] placeholder-[#7B6B58] font-mono tabular-nums focus:outline-none focus:border-[#C99A4E]"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 min-h-[42px] px-4 py-2 rounded-xl bg-[#231C16] border border-[#352A21] text-xs font-semibold text-[#E6DAC8] hover:border-[#C99A4E] transition-colors whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5 text-[#C99A4E]" />
              <span>Add Table</span>
            </button>
          </form>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 min-h-[42px] px-4 py-2 rounded-xl bg-[#C99A4E] text-[#14100C] text-xs font-semibold hover:bg-[#D7AA60] transition-colors whitespace-nowrap print:hidden"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Table Cards</span>
          </button>
        </div>
      </div>

      {/* QR Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {tables.map((tableNum) => {
          const isCurrent = tableNum === currentTable;
          const qrSrc = qrMap[tableNum];
          const tableUrl = getTableUrl(tableNum);

          return (
            <article
              key={tableNum}
              className={`rounded-xl bg-[#191410] border p-5 flex flex-col justify-between gap-4 ${
                isCurrent ? 'border-[#C99A4E]' : 'border-[#2D241C]'
              }`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <div>
                  <span className="text-xs text-[#9E8B73] block">Jikoni Table</span>
                  <h2 className="font-display text-xl font-semibold text-[#F6EFE4] tabular-nums">
                    Table {String(tableNum).padStart(2, '0')}
                  </h2>
                </div>
                {isCurrent && (
                  <span className="text-xs font-mono text-[#E3BC78]">Current</span>
                )}
              </div>

              {/* Scannable QR Display */}
              <div className="rounded-xl bg-[#F6EFE4] p-4 flex items-center justify-center aspect-square">
                {qrSrc ? (
                  <img
                    src={qrSrc}
                    alt={`QR code for Table ${tableNum}`}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <span className="text-xs text-[#14100C]/60 font-mono">Generating QR...</span>
                )}
              </div>

              <div className="space-y-3">
                <p className="text-[11px] font-mono text-[#9E8B73] truncate" title={tableUrl}>
                  /?table={tableNum}
                </p>

                <div className="grid grid-cols-2 gap-2 print:hidden">
                  <button
                    type="button"
                    onClick={() => onSimulateScan(tableNum)}
                    className="col-span-2 inline-flex items-center justify-center gap-1.5 min-h-[40px] px-3 py-2 rounded-lg bg-[#C99A4E] text-[#14100C] text-xs font-semibold hover:bg-[#D7AA60] transition-colors whitespace-nowrap"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Simulate Scan</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCopyLink(tableNum)}
                    className="inline-flex items-center justify-center gap-1.5 min-h-[38px] px-2.5 py-1.5 rounded-lg bg-[#231C16] border border-[#352A21] text-xs font-medium text-[#E6DAC8] hover:border-[#C99A4E]/60 transition-colors whitespace-nowrap"
                  >
                    {copiedTable === tableNum ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-[#E3BC78]" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-[#9E8B73]" />
                        <span>Copy URL</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDownloadQr(tableNum)}
                    disabled={!qrSrc}
                    className="inline-flex items-center justify-center gap-1.5 min-h-[38px] px-2.5 py-1.5 rounded-lg bg-[#231C16] border border-[#352A21] text-xs font-medium text-[#E6DAC8] hover:border-[#C99A4E]/60 disabled:opacity-50 transition-colors whitespace-nowrap"
                  >
                    <Download className="w-3.5 h-3.5 text-[#9E8B73]" />
                    <span>Save PNG</span>
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
