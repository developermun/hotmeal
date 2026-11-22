import { useCallback, useEffect, useMemo, useState } from 'react';
import { ShoppingBag } from 'lucide-react';
import { DishModal } from './components/DishModal.tsx';
import { Header } from './components/Header.tsx';
import { HeroBanner } from './components/HeroBanner.tsx';
import { KitchenBoardView } from './components/KitchenBoardView.tsx';
import { MenuSection } from './components/MenuSection.tsx';
import { OrderDrawer } from './components/OrderDrawer.tsx';
import { QrStudioView } from './components/QrStudioView.tsx';
import { TableTrackerView } from './components/TableTrackerView.tsx';
import { formatKES } from './data/menu.ts';
import type {
  AppView,
  CartItem,
  DishOption,
  MenuItem,
  OrderStatus,
  ServiceRequest,
  ServiceRequestType,
  SpiceLevel,
  TableOrder,
} from './types.ts';

function parseTableFromUrl(): { table: number; fromQr: boolean } {
  if (typeof window === 'undefined') return { table: 4, fromQr: false };
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('table');
  if (raw) {
    const num = Number(raw);
    if (Number.isInteger(num) && num >= 1 && num <= 99) {
      return { table: num, fromQr: true };
    }
  }
  return { table: 4, fromQr: false };
}

function loadCartForTable(tableNumber: number): CartItem[] {
  try {
    const raw = localStorage.getItem(`jikoni_cart_table_${tableNumber}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function App() {
  const initialTable = useMemo(() => parseTableFromUrl(), []);
  const [tableNumber, setTableNumber] = useState<number>(initialTable.table);
  const [scannedViaQr, setScannedViaQr] = useState<boolean>(initialTable.fromQr);
  const [activeView, setActiveView] = useState<AppView>('menu');

  const [cart, setCart] = useState<CartItem[]>(() => loadCartForTable(initialTable.table));
  const [selectedDish, setSelectedDish] = useState<MenuItem | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [orders, setOrders] = useState<TableOrder[]>([]);
  const [serviceRequests, setServiceRequests] = useState<ServiceRequest[]>([]);
  const [loadingOrders, setLoadingOrders] = useState<boolean>(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3200);
  }, []);

  const fetchBackendState = useCallback(async (silent = false) => {
    if (!silent) setLoadingOrders(true);
    try {
      const [ordersRes, reqRes] = await Promise.all([
        fetch('/api/orders'),
        fetch('/api/service-requests'),
      ]);
      if (ordersRes.ok) {
        const data = (await ordersRes.json()) as { orders: TableOrder[] };
        setOrders(data.orders || []);
      }
      if (reqRes.ok) {
        const data = (await reqRes.json()) as { requests: ServiceRequest[] };
        setServiceRequests(data.requests || []);
      }
    } catch {
      // Network retry happens on next poll cycle
    } finally {
      if (!silent) setLoadingOrders(false);
    }
  }, []);

  useEffect(() => {
    fetchBackendState(false);
    const interval = window.setInterval(() => {
      fetchBackendState(true);
    }, 5000);
    return () => window.clearInterval(interval);
  }, [fetchBackendState]);

  useEffect(() => {
    try {
      localStorage.setItem(`jikoni_cart_table_${tableNumber}`, JSON.stringify(cart));
    } catch {
      // Ignore storage quota errors
    }
  }, [cart, tableNumber]);

  const handleChangeTable = (nextTable: number, fromQrScan = false) => {
    setTableNumber(nextTable);
    setScannedViaQr(fromQrScan);
    setCart(loadCartForTable(nextTable));
    const url = new URL(window.location.href);
    url.searchParams.set('table', String(nextTable));
    window.history.replaceState({}, '', url.toString());
    showToast(
      fromQrScan
        ? `QR scanned · Ordered items bound to Table ${String(nextTable).padStart(2, '0')}`
        : `Switched to Table ${String(nextTable).padStart(2, '0')}`
    );
  };

  const handleQuickAdd = (dish: MenuItem) => {
    const defaultOption = dish.options?.[0];
    const unitPrice = dish.price + (defaultOption?.priceDelta ?? 0);
    const spiceLevel: SpiceLevel | undefined = dish.supportsSpiceLevel ? 'Medium' : undefined;
    const cartItemId = `${dish.id}__${defaultOption?.id || 'default'}__${spiceLevel || 'none'}__`;

    setCart((prev) => {
      const existing = prev.find((c) => c.cartItemId === cartItemId);
      if (existing) {
        return prev.map((c) =>
          c.cartItemId === cartItemId ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      return [
        ...prev,
        {
          cartItemId,
          menuItemId: dish.id,
          name: dish.name,
          category: dish.category,
          unitPrice,
          quantity: 1,
          image: defaultOption?.imageOverride || dish.image,
          selectedOptionLabel: defaultOption?.label,
          spiceLevel,
        },
      ];
    });
    showToast(`Added ${dish.name} to Table ${tableNumber} tray`);
  };

  const handleAddCustomized = ({
    dish,
    selectedOption,
    spiceLevel,
    quantity,
    notes,
  }: {
    dish: MenuItem;
    selectedOption?: DishOption;
    spiceLevel?: SpiceLevel;
    quantity: number;
    notes: string;
  }) => {
    const unitPrice = dish.price + (selectedOption?.priceDelta ?? 0);
    const cartItemId = `${dish.id}__${selectedOption?.id || 'default'}__${spiceLevel || 'none'}__${notes}`;

    setCart((prev) => {
      const existing = prev.find((c) => c.cartItemId === cartItemId);
      if (existing) {
        return prev.map((c) =>
          c.cartItemId === cartItemId ? { ...c, quantity: c.quantity + quantity } : c
        );
      }
      return [
        ...prev,
        {
          cartItemId,
          menuItemId: dish.id,
          name: dish.name,
          category: dish.category,
          unitPrice,
          quantity,
          image: selectedOption?.imageOverride || dish.image,
          selectedOptionLabel: selectedOption?.label,
          spiceLevel,
          notes: notes || undefined,
        },
      ];
    });
    showToast(`Added ${quantity}× ${dish.name} to Table ${tableNumber} tray`);
  };

  const handleUpdateMenuDishQty = (menuItemId: string, delta: number) => {
    setCart((prev) => {
      const idx = prev.findIndex((c) => c.menuItemId === menuItemId);
      if (idx === -1) return prev;
      const target = prev[idx];
      const nextQty = target.quantity + delta;
      if (nextQty <= 0) {
        return prev.filter((_, i) => i !== idx);
      }
      return prev.map((item, i) => (i === idx ? { ...item, quantity: nextQty } : item));
    });
  };

  const handleUpdateCartItemQty = (cartItemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) => (c.cartItemId === cartItemId ? { ...c, quantity: c.quantity + delta } : c))
        .filter((c) => c.quantity > 0)
    );
  };

  const handleRemoveCartItem = (cartItemId: string) => {
    setCart((prev) => prev.filter((c) => c.cartItemId !== cartItemId));
  };

  const handlePlaceOrder = async ({
    guestName,
    serviceNote,
  }: {
    guestName: string;
    serviceNote: string;
  }) => {
    const estPrep = Math.max(
      10,
      ...cart.map((c) => (c.category === 'Supper' ? 22 : c.category === 'Lunch' ? 18 : 12))
    );

    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tableNumber,
        guestName: guestName || undefined,
        serviceNote: serviceNote || undefined,
        estimatedMinutes: estPrep,
        items: cart.map((c) => ({
          menuItemId: c.menuItemId,
          name: c.name,
          quantity: c.quantity,
          unitPrice: c.unitPrice,
          selectedOptionLabel: c.selectedOptionLabel,
          spiceLevel: c.spiceLevel,
          notes: c.notes,
        })),
      }),
    });

    if (!res.ok) {
      const errData = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(errData.error || 'Could not submit order to kitchen.');
    }

    const data = (await res.json()) as { order: TableOrder };
    setOrders((prev) => [data.order, ...prev]);
    setCart([]);
    setDrawerOpen(false);
    setActiveView('tracker');
    showToast(`Order ${data.order.orderNumber} sent to kitchen for Table ${tableNumber}`);
  };

  const handleRequestService = async (type: ServiceRequestType) => {
    const res = await fetch('/api/service-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tableNumber, type }),
    });
    if (res.ok) {
      const data = (await res.json()) as { request: ServiceRequest };
      setServiceRequests((prev) => [data.request, ...prev]);
    }
  };

  const handleAdvanceOrderStatus = async (orderId: string, nextStatus: OrderStatus) => {
    const res = await fetch(`/api/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus }),
    });
    if (res.ok) {
      const data = (await res.json()) as { order: TableOrder };
      setOrders((prev) => prev.map((o) => (o.id === orderId ? data.order : o)));
    }
  };

  const handleResolveServiceRequest = async (requestId: string) => {
    const res = await fetch(`/api/service-requests/${requestId}`, {
      method: 'PATCH',
    });
    if (res.ok) {
      const data = (await res.json()) as { request: ServiceRequest };
      setServiceRequests((prev) => prev.map((r) => (r.id === requestId ? data.request : r)));
    }
  };

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartSubtotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const activeTableOrdersCount = orders.filter(
    (o) => o.tableNumber === tableNumber && o.status !== 'Served'
  ).length;

  return (
    <div className="min-h-screen flex flex-col bg-[#110E0B] text-[#F6EFE4]">
      <Header
        activeView={activeView}
        onSelectView={setActiveView}
        cartCount={cartCount}
        onOpenCart={() => setDrawerOpen(true)}
      />

      <main className="flex-1 pb-20 md:pb-12">
        {activeView === 'menu' && (
          <>
            <HeroBanner
              tableNumber={tableNumber}
              scannedViaQr={scannedViaQr}
              onChangeTable={(t) => handleChangeTable(t, false)}
              onOpenQrView={() => setActiveView('qr')}
              onRequestService={handleRequestService}
              activeOrdersCount={activeTableOrdersCount}
              onViewTracker={() => setActiveView('tracker')}
            />
            <MenuSection
              cart={cart}
              onQuickAdd={handleQuickAdd}
              onUpdateItemQty={handleUpdateMenuDishQty}
              onSelectDish={setSelectedDish}
            />
          </>
        )}

        {activeView === 'tracker' && (
          <TableTrackerView
            tableNumber={tableNumber}
            orders={orders}
            loading={loadingOrders}
            onBackToMenu={() => setActiveView('menu')}
            onRequestService={handleRequestService}
          />
        )}

        {activeView === 'qr' && (
          <QrStudioView
            currentTable={tableNumber}
            onSimulateScan={(num) => {
              handleChangeTable(num, true);
              setActiveView('menu');
            }}
          />
        )}

        {activeView === 'kitchen' && (
          <KitchenBoardView
            orders={orders}
            serviceRequests={serviceRequests}
            loading={loadingOrders}
            onAdvanceOrderStatus={handleAdvanceOrderStatus}
            onResolveServiceRequest={handleResolveServiceRequest}
            onRefresh={() => fetchBackendState(false)}
          />
        )}
      </main>

      {/* Quiet Footer */}
      <footer className="border-t border-[#2A2119] bg-[#14100C] py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-[#9E8B73]">
          <div className="space-y-1">
            <p className="font-display text-sm font-semibold text-[#E6DAC8]">Jikoni Table</p>
            <p>Authentic Kenyan &amp; Swahili Kitchen · All prices inclusive of VAT (KES)</p>
          </div>
          <div className="flex flex-wrap items-center gap-5">
            <button
              type="button"
              onClick={() => setActiveView('menu')}
              className="hover:text-[#E3BC78] transition-colors"
            >
              Digital Menu
            </button>
            <button
              type="button"
              onClick={() => setActiveView('tracker')}
              className="hover:text-[#E3BC78] transition-colors"
            >
              Table Tracker
            </button>
            <button
              type="button"
              onClick={() => setActiveView('qr')}
              className="hover:text-[#E3BC78] transition-colors"
            >
              Table QR Studio
            </button>
            <button
              type="button"
              onClick={() => setActiveView('kitchen')}
              className="hover:text-[#E3BC78] transition-colors"
            >
              Kitchen Board
            </button>
          </div>
        </div>
      </footer>

      {/* Mobile Compact Bottom Tray Bar (only when cart > 0 on mobile, well within 15% sticky budget) */}
      {cartCount > 0 && activeView === 'menu' && !drawerOpen && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-30 p-3 bg-gradient-to-t from-[#110E0B] via-[#110E0B]/95 to-transparent">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="w-full h-12 px-4 rounded-xl bg-[#C99A4E] text-[#14100C] text-sm font-semibold shadow-xl flex items-center justify-between gap-3 active:scale-[0.99] transition-transform"
          >
            <span className="inline-flex items-center gap-2">
              <ShoppingBag className="w-4 h-4" />
              <span>
                Table {String(tableNumber).padStart(2, '0')} Tray ({cartCount})
              </span>
            </span>
            <span className="font-mono tabular-nums font-bold">{formatKES(cartSubtotal)}</span>
          </button>
        </div>
      )}

      {/* Subtle Feedback Toast */}
      {toastMessage && (
        <div
          role="status"
          className="fixed bottom-16 md:bottom-6 left-1/2 -translate-x-1/2 z-40 px-4 py-2.5 rounded-xl bg-[#231C16] border border-[#C99A4E]/60 text-xs font-medium text-[#F6EFE4] shadow-2xl whitespace-nowrap max-w-[90vw] truncate"
        >
          {toastMessage}
        </div>
      )}

      {/* Dish Customization Modal */}
      <DishModal
        dish={selectedDish}
        onClose={() => setSelectedDish(null)}
        onAddToCart={handleAddCustomized}
      />

      {/* Order Tray Drawer */}
      <OrderDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        tableNumber={tableNumber}
        cart={cart}
        onUpdateCartItemQty={handleUpdateCartItemQty}
        onRemoveCartItem={handleRemoveCartItem}
        onClearCart={() => setCart([])}
        onPlaceOrder={handlePlaceOrder}
      />
    </div>
  );
}
