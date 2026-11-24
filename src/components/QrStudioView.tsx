import { useEffect, useState } from 'react';
import { Check, Copy, Download, ExternalLink, Plus, Printer } from 'lucide-react';
import QRCode from 'qrcode';

interface QrStudioViewProps {
  currentTable: number;
  onSimulateScan: (tableNumber: number) => void;
}

const DEFAULT_TABLES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const VERCEL_DINE_IN_URL = 'https://hotmeal-olive.vercel.app';

export function QrStudioView({ currentTable, onSimulateScan }: QrStudioViewProps) {
  const [tables, setTables] = useState<number[]>(DEFAULT_TABLES);
  const [customTableInput, setCustomTableInput] = useState('');
  const [baseUrl, setBaseUrl] = useState<string>(() =>
    typeof window !== 'undefined' ? window.location.origin : VERCEL_DINE_IN_URL
  );
  const [qrMap, setQrMap] = useState<Record<number, string>>({});
  const [copiedTable, setCopiedTable] = useState<number | null>(null);
  const [copiedAdmin, setCopiedAdmin] = useState(false);

  const normalizedBaseUrl = baseUrl.trim().replace(/\/+$/, '') || VERCEL_DINE_IN_URL;
  const getTableUrl = (tableNum: number) => `${normalizedBaseUrl}/?table=${tableNum}`;
  const adminUrl = `${normalizedBaseUrl}/admin`;

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
  }, [tables, normalizedBaseUrl]);

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

  const handleCopyAdmin = async () => {
    try {
      await navigator.clipboard.writeText(adminUrl);
      setCopiedAdmin(true);
      setTimeout(() => setCopiedAdmin(false), 2000);
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
            Every QR code encodes a direct table URL so guests scan with their phone camera and immediately order for that exact table.
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

      {/* Deployment Base URL & Matching Admin Link */}
      <div className="rounded-xl bg-[#191410] border border-[#2D241C] p-5 grid grid-cols-1 lg:grid-cols-12 gap-5 items-end print:hidden">
        <div className="lg:col-span-7 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label htmlFor="qr-base-url" className="text-xs font-semibold text-[#E6DAC8]">
              QR Dine-In Domain Base URL
            </label>
            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => setBaseUrl(VERCEL_DINE_IN_URL)}
                className="text-[#C99A4E] hover:underline font-mono"
              >
                Use {VERCEL_DINE_IN_URL}
              </button>
              {typeof window !== 'undefined' && window.location.origin !== VERCEL_DINE_IN_URL && (
                <>
                  <span className="text-[#4A3C2F]" aria-hidden="true">·</span>
                  <button
                    type="button"
                    onClick={() => setBaseUrl(window.location.origin)}
                    className="text-[#9E8B73] hover:text-[#F6EFE4]"
                  >
                    Use Current Host
                  </button>
                </>
              )}
            </div>
          </div>
          <input
            id="qr-base-url"
            type="url"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://hotmeal-olive.vercel.app"
            className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#120E0B] border border-[#2D241C] font-mono text-xs sm:text-sm text-[#F6EFE4] focus:outline-none focus:border-[#C99A4E]"
          />
        </div>

        <div className="lg:col-span-5 flex items-center justify-between gap-3 rounded-xl bg-[#14100C] border border-[#2A2119] px-4 py-2.5 min-h-[42px]">
          <div className="min-w-0">
            <span className="text-[11px] font-mono text-[#9E8B73] block">
              Matching Admin / Kitchen Link
            </span>
            <span className="text-xs font-mono text-[#E3BC78] truncate block">{adminUrl}</span>
          </div>
          <button
            type="button"
            onClick={handleCopyAdmin}
            className="inline-flex items-center gap-1.5 min-h-[36px] px-3 py-1.5 rounded-lg bg-[#231C16] border border-[#352A21] text-xs font-medium text-[#E6DAC8] hover:border-[#C99A4E] transition-colors whitespace-nowrap shrink-0"
          >
            {copiedAdmin ? (
              <>
                <Check className="w-3.5 h-3.5 text-[#E3BC78]" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-[#9E8B73]" />
                <span>Copy</span>
              </>
            )}
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
                  {tableUrl}
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
