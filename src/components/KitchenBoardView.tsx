import { useMemo, useState } from 'react';
import {
  BellRing,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  Flame,
  LayoutGrid,
  ListOrdered,
  RefreshCw,
  Search,
  Utensils,
  X,
} from 'lucide-react';
import { formatKES } from '../data/menu.ts';
import type { OrderStatus, ServiceRequest, TableOrder } from '../types.ts';

interface KitchenBoardViewProps {
  orders: TableOrder[];
  serviceRequests: ServiceRequest[];
  loading: boolean;
  onAdvanceOrderStatus: (orderId: string, nextStatus: OrderStatus) => Promise<void>;
  onResolveServiceRequest: (requestId: string) => Promise<void>;
  onRefresh: () => void;
  onNavigateToMenuTable?: (tableNumber: number) => void;
}

type KitchenFilter = 'Active' | 'Received' | 'Preparing' | 'Ready' | 'Served' | 'All';
type DisplayMode = 'cards' | 'table';

const NEXT_STATUS_MAP: Partial<Record<OrderStatus, { next: OrderStatus; buttonLabel: string }>> = {
  Received: { next: 'Preparing', buttonLabel: 'Start Cooking' },
  Preparing: { next: 'Ready', buttonLabel: 'Mark Ready' },
  Ready: { next: 'Served', buttonLabel: 'Mark Served' },
};

const ALL_STATUSES: OrderStatus[] = ['Received', 'Preparing', 'Ready', 'Served'];
const FLOOR_TABLES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

function elapsedLabel(iso: string): string {
  const diffMin = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const hrs = Math.floor(diffMin / 60);
  return `${hrs}h ${diffMin % 60}m ago`;
}

function formatShortTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function KitchenBoardView({
  orders,
  serviceRequests,
  loading,
  onAdvanceOrderStatus,
  onResolveServiceRequest,
  onRefresh,
  onNavigateToMenuTable,
}: KitchenBoardViewProps) {
  const [filter, setFilter] = useState<KitchenFilter>('Active');
  const [displayMode, setDisplayMode] = useState<DisplayMode>('cards');
  const [selectedTableFilter, setSelectedTableFilter] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<'admin' | 'dinein' | null>(null);

  const origin =
    typeof window !== 'undefined' ? window.location.origin : 'https://hotmeal-olive.vercel.app';
  const dineInLink = `${origin}/`;
  const adminLink = `${origin}/admin`;

  const openRequests = useMemo(
    () => serviceRequests.filter((r) => r.status === 'Open'),
    [serviceRequests]
  );

  // Real computed KPIs from live order records
  const kpis = useMemo(() => {
    const activeOrders = orders.filter((o) => o.status !== 'Served');
    const activeTables = new Set(activeOrders.map((o) => o.tableNumber)).size;
    const totalRevenue = orders.reduce((sum, o) => sum + o.subtotal, 0);
    const totalPlates = orders.reduce(
      (sum, o) => sum + o.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
      0
    );
    return {
      activeCount: activeOrders.length,
      activeTables,
      totalRevenue,
      totalPlates,
    };
  }, [orders]);

  // Per-table floor summary
  const tableSummaries = useMemo(() => {
    return FLOOR_TABLES.map((tableNum) => {
      const tableOrders = orders.filter((o) => o.tableNumber === tableNum);
      const activeTableOrders = tableOrders.filter((o) => o.status !== 'Served');
      const hasOpenAlert = openRequests.some((r) => r.tableNumber === tableNum);
      const hasReady = activeTableOrders.some((o) => o.status === 'Ready');
      const totalAmount = activeTableOrders.reduce((sum, o) => sum + o.subtotal, 0);

      let stateLabel = 'Available';
      if (hasOpenAlert) stateLabel = 'Needs Waiter';
      else if (hasReady) stateLabel = 'Food Ready';
      else if (activeTableOrders.length > 0) stateLabel = `${activeTableOrders.length} Active`;

      return {
        tableNum,
        activeCount: activeTableOrders.length,
        hasOpenAlert,
        hasReady,
        totalAmount,
        stateLabel,
      };
    });
  }, [orders, openRequests]);

  const visibleOrders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return orders.filter((order) => {
      if (selectedTableFilter !== null && order.tableNumber !== selectedTableFilter) return false;
      if (filter === 'Active' && order.status === 'Served') return false;
      if (
        filter !== 'Active' &&
        filter !== 'All' &&
        order.status !== filter
      ) {
        return false;
      }
      if (q) {
        const itemsText = order.items.map((i) => i.name).join(' ');
        const hay = `${order.orderNumber} table ${order.tableNumber} ${order.guestName || ''} ${itemsText}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [orders, filter, selectedTableFilter, searchQuery]);

  const handleAdvance = async (orderId: string, nextStatus: OrderStatus) => {
    setUpdatingId(orderId);
    try {
      await onAdvanceOrderStatus(orderId, nextStatus);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleCopy = async (key: 'admin' | 'dinein', value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      // Ignore clipboard failure
    }
  };

  const handleExportCsv = () => {
    const headers = ['Order Number', 'Table', 'Guest', 'Status', 'Items', 'Subtotal (KES)', 'Created At'];
    const rows = visibleOrders.map((o) => [
      o.orderNumber,
      `Table ${o.tableNumber}`,
      o.guestName || 'Guest',
      o.status,
      o.items.map((i) => `${i.quantity}x ${i.name}`).join('; '),
      String(o.subtotal),
      o.createdAt,
    ]);
    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `jikoni-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-8">
      {/* Top Admin Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-6 border-b border-[#2A2119]">
        <div className="space-y-1.5">
          <p className="text-xs font-mono tracking-wider text-[#C99A4E] uppercase">
            Admin &amp; Kitchen Operations
          </p>
          <h1 className="font-display text-3xl font-semibold text-[#F6EFE4]">
            Restaurant Order Command
          </h1>
          <p className="text-sm text-[#B4A693] max-w-2xl">
            Monitor incoming table QR orders, track table totals, respond to waiter calls, and advance kitchen tickets in real time.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={visibleOrders.length === 0}
            className="inline-flex items-center gap-1.5 min-h-[42px] px-4 py-2 rounded-xl bg-[#191410] border border-[#2D241C] text-xs font-semibold text-[#E6DAC8] hover:border-[#C99A4E] disabled:opacity-40 transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5 text-[#C99A4E]" />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex items-center gap-1.5 min-h-[42px] px-4 py-2 rounded-xl bg-[#C99A4E] text-[#14100C] text-xs font-semibold hover:bg-[#D7AA60] transition-colors whitespace-nowrap"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Queue</span>
          </button>
        </div>
      </div>

      {/* Direct Dine-In & Admin Links Strip */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl bg-[#191410] border border-[#2D241C] px-4 py-3.5 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <span className="text-[11px] font-mono uppercase tracking-wider text-[#9E8B73] block">
              Customer Dine-In Link
            </span>
            <span className="text-xs sm:text-sm font-mono text-[#E6DAC8] truncate block">
              {dineInLink}
            </span>
          </div>
          <button
            type="button"
            onClick={() => handleCopy('dinein', dineInLink)}
            className="inline-flex items-center gap-1.5 min-h-[36px] px-3 py-1.5 rounded-lg bg-[#231C16] border border-[#352A21] text-xs font-medium text-[#E6DAC8] hover:border-[#C99A4E] transition-colors whitespace-nowrap shrink-0"
          >
            {copiedKey === 'dinein' ? (
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

        <div className="rounded-xl bg-[#191410] border border-[#C99A4E]/40 px-4 py-3.5 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <span className="text-[11px] font-mono uppercase tracking-wider text-[#C99A4E] block">
              Admin &amp; Kitchen Direct Link
            </span>
            <span className="text-xs sm:text-sm font-mono text-[#F6EFE4] truncate block">
              {adminLink}
            </span>
          </div>
          <button
            type="button"
            onClick={() => handleCopy('admin', adminLink)}
            className="inline-flex items-center gap-1.5 min-h-[36px] px-3 py-1.5 rounded-lg bg-[#C99A4E] text-[#14100C] text-xs font-semibold hover:bg-[#D7AA60] transition-colors whitespace-nowrap shrink-0"
          >
            {copiedKey === 'admin' ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Admin URL</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 4-Column Computed KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl bg-[#191410] border border-[#2D241C] p-4 space-y-1">
          <span className="text-xs text-[#9E8B73]">Active Kitchen Tickets</span>
          <p className="font-mono tabular-nums text-2xl font-semibold text-[#F6EFE4]">
            {kpis.activeCount}
          </p>
        </div>
        <div className="rounded-xl bg-[#191410] border border-[#2D241C] p-4 space-y-1">
          <span className="text-xs text-[#9E8B73]">Tables with Open Orders</span>
          <p className="font-mono tabular-nums text-2xl font-semibold text-[#F6EFE4]">
            {kpis.activeTables} <span className="text-sm font-normal text-[#9E8B73]">/ 12</span>
          </p>
        </div>
        <div className="rounded-xl bg-[#191410] border border-[#2D241C] p-4 space-y-1">
          <span className="text-xs text-[#9E8B73]">Total Plates Ordered</span>
          <p className="font-mono tabular-nums text-2xl font-semibold text-[#F6EFE4]">
            {kpis.totalPlates}
          </p>
        </div>
        <div className="rounded-xl bg-[#191410] border border-[#2D241C] p-4 space-y-1">
          <span className="text-xs text-[#9E8B73]">Gross Order Value</span>
          <p className="font-mono tabular-nums text-2xl font-semibold text-[#E3BC78]">
            {formatKES(kpis.totalRevenue)}
          </p>
        </div>
      </div>

      {/* Open Table Service Requests */}
      {openRequests.length > 0 && (
        <div className="rounded-xl bg-[#1C1611] border border-[#C99A4E]/50 p-5 space-y-3">
          <h2 className="text-sm font-semibold text-[#E3BC78] flex items-center gap-2">
            <BellRing className="w-4 h-4" />
            <span>Floor Assistance Requests ({openRequests.length})</span>
          </h2>

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

      {/* Dining Floor Overview (Click a table to filter orders) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-sm font-semibold text-[#E6DAC8]">
            Dining Floor Status
          </h2>
          {selectedTableFilter !== null && (
            <button
              type="button"
              onClick={() => setSelectedTableFilter(null)}
              className="text-xs font-medium text-[#E3BC78] hover:underline"
            >
              Clear Table {selectedTableFilter} filter
            </button>
          )}
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2.5">
          {tableSummaries.map((tbl) => {
            const isSelected = selectedTableFilter === tbl.tableNum;
            const isOccupied = tbl.activeCount > 0 || tbl.hasOpenAlert;
            return (
              <button
                key={tbl.tableNum}
                type="button"
                onClick={() =>
                  setSelectedTableFilter((prev) => (prev === tbl.tableNum ? null : tbl.tableNum))
                }
                className={`rounded-xl border p-3 text-left transition-colors ${
                  isSelected
                    ? 'bg-[#261E17] border-[#C99A4E]'
                    : isOccupied
                      ? 'bg-[#191410] border-[#423428] hover:border-[#C99A4E]/60'
                      : 'bg-[#15110E] border-[#261E17] hover:border-[#3A2E24]'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="font-mono tabular-nums text-xs font-semibold text-[#F6EFE4]">
                    T{String(tbl.tableNum).padStart(2, '0')}
                  </span>
                  <span
                    className={`text-[11px] font-medium truncate ${
                      tbl.hasOpenAlert || tbl.hasReady
                        ? 'text-[#E3BC78]'
                        : tbl.activeCount > 0
                          ? 'text-[#D6C8B4]'
                          : 'text-[#736454]'
                    }`}
                  >
                    {tbl.stateLabel}
                  </span>
                </div>
                <p className="font-mono tabular-nums text-xs text-[#9E8B73] mt-1.5">
                  {tbl.totalAmount > 0 ? formatKES(tbl.totalAmount) : '—'}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Filter, Search & Layout Mode Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pt-2">
        <div className="flex items-center gap-1 p-1 rounded-xl bg-[#191410] border border-[#2D241C] overflow-x-auto">
          {(['Active', 'Received', 'Preparing', 'Ready', 'Served', 'All'] as KitchenFilter[]).map(
            (tab) => {
              const active = filter === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setFilter(tab)}
                  className={`min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-[#C99A4E] text-[#14100C] font-semibold'
                      : 'text-[#C8B9A6] hover:text-[#F6EFE4]'
                  }`}
                >
                  {tab === 'Active' ? 'Active Queue' : tab === 'All' ? 'All Orders' : tab}
                </button>
              );
            }
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-[#9E8B73] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search JK-103, table, dish..."
              aria-label="Search orders"
              className="w-full min-h-[40px] pl-9 pr-8 py-1.5 rounded-xl bg-[#191410] border border-[#2D241C] text-xs text-[#F6EFE4] placeholder-[#7B6B58] focus:outline-none focus:border-[#C99A4E]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear order search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9E8B73] hover:text-[#F6EFE4]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Ticket Cards vs Order Ledger Table Switcher */}
          <div className="inline-flex items-center p-1 rounded-xl bg-[#191410] border border-[#2D241C]">
            <button
              type="button"
              onClick={() => setDisplayMode('cards')}
              className={`inline-flex items-center gap-1.5 min-h-[34px] px-3 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                displayMode === 'cards'
                  ? 'bg-[#261E17] text-[#E3BC78]'
                  : 'text-[#9E8B73] hover:text-[#F6EFE4]'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Tickets</span>
            </button>
            <button
              type="button"
              onClick={() => setDisplayMode('table')}
              className={`inline-flex items-center gap-1.5 min-h-[34px] px-3 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                displayMode === 'table'
                  ? 'bg-[#261E17] text-[#E3BC78]'
                  : 'text-[#9E8B73] hover:text-[#F6EFE4]'
              }`}
            >
              <ListOrdered className="w-3.5 h-3.5" />
              <span>Ledger</span>
            </button>
          </div>
        </div>
      </div>

      {/* Orders Output */}
      {visibleOrders.length === 0 ? (
        <div className="rounded-xl bg-[#191410] border border-[#2D241C] p-12 text-center space-y-3">
          <p className="font-display text-xl text-[#F6EFE4]">No matching orders</p>
          <p className="text-sm text-[#9E8B73] max-w-md mx-auto">
            {selectedTableFilter !== null
              ? `Table ${selectedTableFilter} has no orders matching this filter.`
              : 'New orders submitted from any dining table QR menu will appear here automatically.'}
          </p>
          {(selectedTableFilter !== null || filter !== 'All' || searchQuery) && (
            <button
              type="button"
              onClick={() => {
                setSelectedTableFilter(null);
                setFilter('All');
                setSearchQuery('');
              }}
              className="mt-2 inline-flex items-center justify-center min-h-[40px] px-4 py-2 rounded-lg bg-[#C99A4E] text-[#14100C] text-xs font-semibold hover:bg-[#D7AA60] transition-colors"
            >
              Show All Orders
            </button>
          )}
        </div>
      ) : displayMode === 'cards' ? (
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
                          <span className="font-mono tabular-nums text-xs text-[#9E8B73] shrink-0">
                            {formatKES(item.unitPrice * item.quantity)}
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
                  <div>
                    <span className="font-mono tabular-nums text-sm font-semibold text-[#E3BC78] block">
                      {formatKES(order.subtotal)}
                    </span>
                    {onNavigateToMenuTable && (
                      <button
                        type="button"
                        onClick={() => onNavigateToMenuTable(order.tableNumber)}
                        className="text-[11px] text-[#9E8B73] hover:text-[#F6EFE4] transition-colors"
                      >
                        Open Table {order.tableNumber} Menu
                      </button>
                    )}
                  </div>

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
      ) : (
        /* High-Density Admin Order Ledger Table */
        <div className="rounded-xl bg-[#191410] border border-[#2D241C] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#2A2119] text-[11px] font-mono uppercase tracking-wider text-[#9E8B73]">
                  <th className="py-3 px-4">Order</th>
                  <th className="py-3 px-4">Table</th>
                  <th className="py-3 px-4">Guest</th>
                  <th className="py-3 px-4">Dishes</th>
                  <th className="py-3 px-4">Time</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Total</th>
                  <th className="py-3 px-4 text-right">Stage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#261E17] text-sm">
                {visibleOrders.map((order) => {
                  const isUpdating = updatingId === order.id;
                  return (
                    <tr key={order.id} className="hover:bg-[#1E1813] transition-colors">
                      <td className="py-3 px-4 font-mono tabular-nums text-xs font-semibold text-[#E3BC78] whitespace-nowrap">
                        {order.orderNumber}
                      </td>
                      <td className="py-3 px-4 font-mono tabular-nums text-xs text-[#F6EFE4] whitespace-nowrap">
                        Table {String(order.tableNumber).padStart(2, '0')}
                      </td>
                      <td className="py-3 px-4 text-xs text-[#C8B9A6] whitespace-nowrap">
                        {order.guestName || 'Walk-in'}
                      </td>
                      <td className="py-3 px-4 text-xs text-[#E6DAC8] max-w-xs">
                        <span className="line-clamp-2">
                          {order.items.map((i) => `${i.quantity}× ${i.name}`).join(', ')}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono tabular-nums text-xs text-[#9E8B73] whitespace-nowrap">
                        {formatShortTime(order.createdAt)}
                      </td>
                      <td className="py-3 px-4 text-xs font-medium text-[#E3BC78] whitespace-nowrap">
                        {order.status}
                      </td>
                      <td className="py-3 px-4 font-mono tabular-nums text-xs font-semibold text-[#F6EFE4] text-right whitespace-nowrap">
                        {formatKES(order.subtotal)}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <select
                          aria-label={`Change status for ${order.orderNumber}`}
                          value={order.status}
                          disabled={isUpdating}
                          onChange={(e) => handleAdvance(order.id, e.target.value as OrderStatus)}
                          className="min-h-[34px] px-2.5 py-1 rounded-lg bg-[#14100C] border border-[#352A21] text-xs text-[#F6EFE4] focus:outline-none focus:border-[#C99A4E]"
                        >
                          {ALL_STATUSES.map((st) => (
                            <option key={st} value={st}>
                              {st}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
