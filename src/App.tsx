import { useCallback, useEffect, useMemo, useState } from 'react';
import { ShoppingBag } from 'lucide-react';
import { AdminLoginGate } from './components/AdminLoginGate.tsx';
import { AdminPortal, type AdminSection } from './components/AdminPortal.tsx';
import { DishModal } from './components/DishModal.tsx';
import { Header, type CustomerView } from './components/Header.tsx';
import { HeroBanner } from './components/HeroBanner.tsx';
import { MenuSection } from './components/MenuSection.tsx';
import { OrderDrawer } from './components/OrderDrawer.tsx';
import { TableTrackerView } from './components/TableTrackerView.tsx';
import { formatKES } from './data/menu.ts';
import type {
  CartItem,
  DishOption,
  MenuItem,
  OrderItemRecord,
  OrderStatus,
  ServiceRequest,
  ServiceRequestType,
  SpiceLevel,
  TableOrder,
} from './types.ts';

type RouteZone =
  | { zone: 'customer'; view: CustomerView }
  | { zone: 'admin'; section: AdminSection };

function parseRouteFromUrl(): { route: RouteZone; table: number; fromQr: boolean } {
  if (typeof window === 'undefined') {
    return { route: { zone: 'customer', view: 'menu' }, table: 4, fromQr: false };
  }

  const pathname = window.location.pathname.toLowerCase().replace(/\/+$/, '') || '/';
  const params = new URLSearchParams(window.location.search);
  const viewParam = params.get('view')?.toLowerCase();

  let route: RouteZone = { zone: 'customer', view: 'menu' };
  if (pathname === '/admin' || pathname === '/kitchen' || viewParam === 'admin' || viewParam === 'kitchen') {
    route = { zone: 'admin', section: 'orders' };
  } else if (pathname === '/qr-codes' || pathname === '/qr' || viewParam === 'qr') {
    route = { zone: 'admin', section: 'qr' };
  } else if (pathname === '/tracker' || viewParam === 'tracker') {
    route = { zone: 'customer', view: 'tracker' };
  }

  let table = 4;
  let fromQr = false;
  const rawTable = params.get('table');
  if (rawTable) {
    const num = Number(rawTable);
    if (Number.isInteger(num) && num >= 1 && num <= 99) {
      table = num;
      fromQr = true;
    }
  }

  return { route, table, fromQr };
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

const ADMIN_TOKEN_STORAGE_KEY = 'jikoni_admin_token';
const FALLBACK_ORDERS_KEY = 'jikoni_static_orders_v1';
const FALLBACK_REQUESTS_KEY = 'jikoni_static_requests_v1';
const STATIC_FALLBACK_PIN = '2540';

function getStaticFallbackOrders(): TableOrder[] {
  try {
    const raw = localStorage.getItem(FALLBACK_ORDERS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // Ignore storage read errors
  }
  const now = Date.now();
  const seed: TableOrder[] = [
    {
      id: 'ord-102',
      orderNumber: 'JK-102',
      tableNumber: 2,
      guestName: 'Amina W.',
      items: [
        {
          menuItemId: 'wali-nazi-samaki',
          name: 'Wali wa Nazi & Samaki',
          quantity: 1,
          unitPrice: 980,
          selectedOptionLabel: 'Tamarind-Coconut Glaze',
          spiceLevel: 'Medium',
        },
        {
          menuItemId: 'mahamri-mbaazi',
          name: 'Mahamri & Mbaazi',
          quantity: 1,
          unitPrice: 380,
          selectedOptionLabel: '3 Mahamri + Mbaazi Bowl',
        },
      ],
      subtotal: 1360,
      serviceNote: 'Please bring extra lime wedges.',
      status: 'Preparing',
      createdAt: new Date(now - 9 * 60 * 1000).toISOString(),
      updatedAt: new Date(now - 4 * 60 * 1000).toISOString(),
      estimatedMinutes: 22,
    },
    {
      id: 'ord-103',
      orderNumber: 'JK-103',
      tableNumber: 6,
      guestName: 'David K.',
      items: [
        {
          menuItemId: 'ugali-nyama-choma',
          name: 'Ugali & Nyama Choma',
          quantity: 2,
          unitPrice: 1150,
          selectedOptionLabel: 'Charcoal-Roasted Goat (Mbuzi)',
          spiceLevel: 'Pilipili Hot',
        },
        {
          menuItemId: 'samosa',
          name: 'Samosa',
          quantity: 1,
          unitPrice: 220,
          selectedOptionLabel: 'Spiced Minced Beef (2 pcs)',
          spiceLevel: 'Medium',
        },
      ],
      subtotal: 2520,
      status: 'Received',
      createdAt: new Date(now - 3 * 60 * 1000).toISOString(),
      updatedAt: new Date(now - 3 * 60 * 1000).toISOString(),
      estimatedMinutes: 25,
    },
  ];
  try {
    localStorage.setItem(FALLBACK_ORDERS_KEY, JSON.stringify(seed));
  } catch {
    // Ignore storage write errors
  }
  return seed;
}

function getStaticFallbackRequests(): ServiceRequest[] {
  try {
    const raw = localStorage.getItem(FALLBACK_REQUESTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // Ignore storage read errors
  }
  return [];
}

async function parseJsonIfAvailable<T>(res: Response): Promise<T | null> {
  const ct = res.headers.get('content-type') || '';
  if (!res.ok || !ct.includes('application/json')) return null;
  return (await res.json()) as T;
}

export default function App() {
  const initialState = useMemo(() => parseRouteFromUrl(), []);
  const [route, setRoute] = useState<RouteZone>(initialState.route);
  const [tableNumber, setTableNumber] = useState<number>(initialState.table);
  const [scannedViaQr, setScannedViaQr] = useState<boolean>(initialState.fromQr);

  // Staff admin session token (kept only in sessionStorage)
  const [adminToken, setAdminToken] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(ADMIN_TOKEN_STORAGE_KEY);
    } catch {
      return null;
    }
  });

  // Customer cart & UI state
  const [cart, setCart] = useState<CartItem[]>(() => loadCartForTable(initialState.table));
  const [selectedDish, setSelectedDish] = useState<MenuItem | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Scoped order state (customer gets ONLY their table; admin gets all tables)
  const [tableOrders, setTableOrders] = useState<TableOrder[]>([]);
  const [adminOrders, setAdminOrders] = useState<TableOrder[]>([]);
  const [serviceRequests, setServiceRequests] = useState<ServiceRequest[]>([]);
  const [loadingOrders, setLoadingOrders] = useState<boolean>(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [usingStaticFallback, setUsingStaticFallback] = useState<boolean>(false);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3200);
  }, []);

  // Fetch customer table-scoped orders
  const fetchCustomerTableOrders = useCallback(
    async (silent = false) => {
      if (!silent) setLoadingOrders(true);
      try {
        const res = await fetch(`/api/orders?table=${tableNumber}`);
        const json = await parseJsonIfAvailable<{ orders: TableOrder[] }>(res);
        if (json) {
          setUsingStaticFallback(false);
          setTableOrders(json.orders || []);
        } else {
          setUsingStaticFallback(true);
          setTableOrders(getStaticFallbackOrders().filter((o) => o.tableNumber === tableNumber));
        }
      } catch {
        setUsingStaticFallback(true);
        setTableOrders(getStaticFallbackOrders().filter((o) => o.tableNumber === tableNumber));
      } finally {
        if (!silent) setLoadingOrders(false);
      }
    },
    [tableNumber]
  );

  // Fetch staff admin orders & service requests (authenticated)
  const fetchAdminState = useCallback(
    async (silent = false) => {
      if (!adminToken) return;
      if (!silent) setLoadingOrders(true);
      try {
        const headers = { 'x-admin-token': adminToken };
        const [ordersRes, reqRes] = await Promise.all([
          fetch('/api/orders', { headers }),
          fetch('/api/service-requests', { headers }),
        ]);

        if (ordersRes.status === 401 || reqRes.status === 401) {
          setAdminToken(null);
          try {
            sessionStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
          } catch {
            // Ignore storage removal errors
          }
          return;
        }

        const ordersJson = await parseJsonIfAvailable<{ orders: TableOrder[] }>(ordersRes);
        const reqJson = await parseJsonIfAvailable<{ requests: ServiceRequest[] }>(reqRes);

        if (ordersJson && reqJson) {
          setUsingStaticFallback(false);
          setAdminOrders(ordersJson.orders || []);
          setServiceRequests(reqJson.requests || []);
        } else {
          setUsingStaticFallback(true);
          setAdminOrders(getStaticFallbackOrders());
          setServiceRequests(getStaticFallbackRequests());
        }
      } catch {
        setUsingStaticFallback(true);
        setAdminOrders(getStaticFallbackOrders());
        setServiceRequests(getStaticFallbackRequests());
      } finally {
        if (!silent) setLoadingOrders(false);
      }
    },
    [adminToken]
  );

  useEffect(() => {
    if (route.zone === 'customer') {
      fetchCustomerTableOrders(false);
      const interval = window.setInterval(() => fetchCustomerTableOrders(true), 5000);
      return () => window.clearInterval(interval);
    }
    if (adminToken) {
      fetchAdminState(false);
      const interval = window.setInterval(() => fetchAdminState(true), 5000);
      return () => window.clearInterval(interval);
    }
    setLoadingOrders(false);
    return undefined;
  }, [route.zone, adminToken, fetchCustomerTableOrders, fetchAdminState]);

  useEffect(() => {
    const onPopState = () => {
      const next = parseRouteFromUrl();
      setRoute(next.route);
      setTableNumber(next.table);
      setScannedViaQr(next.fromQr);
      setCart(loadCartForTable(next.table));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(`jikoni_cart_table_${tableNumber}`, JSON.stringify(cart));
    } catch {
      // Ignore storage quota errors
    }
  }, [cart, tableNumber]);

  const navigateCustomerView = (view: CustomerView, nextTable?: number) => {
    const targetTable = nextTable ?? tableNumber;
    setRoute({ zone: 'customer', view });
    const params = new URLSearchParams(window.location.search);
    params.delete('view');
    if (view === 'tracker') {
      params.set('table', String(targetTable));
      window.history.pushState({}, '', `/tracker?${params.toString()}`);
    } else if (params.has('table')) {
      params.set('table', String(targetTable));
      window.history.pushState({}, '', `/?${params.toString()}`);
    } else {
      window.history.pushState({}, '', '/');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navigateAdminSection = (section: AdminSection) => {
    setRoute({ zone: 'admin', section });
    window.history.pushState({}, '', section === 'qr' ? '/qr-codes' : '/admin');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleChangeTable = (nextTable: number, fromQrScan = false) => {
    setTableNumber(nextTable);
    setScannedViaQr(fromQrScan);
    setCart(loadCartForTable(nextTable));
    const url = new URL(window.location.href);
    url.pathname = '/';
    url.searchParams.delete('view');
    url.searchParams.set('table', String(nextTable));
    window.history.replaceState({}, '', url.toString());
    showToast(
      fromQrScan
        ? `QR scanned · Ordered items bound to Table ${String(nextTable).padStart(2, '0')}`
        : `Switched to Table ${String(nextTable).padStart(2, '0')}`
    );
  };

  const handleVerifyAdminPin = async (pin: string) => {
    try {
      const res = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });

      const ct = res.headers.get('content-type') || '';
      if (res.status === 401) {
        const data = ct.includes('application/json')
          ? ((await res.json()) as { error?: string })
          : {};
        throw new Error(data.error || 'Incorrect staff passcode.');
      }

      if (res.ok && ct.includes('application/json')) {
        const data = (await res.json()) as { ok?: boolean; token?: string };
        if (data.token) {
          setAdminToken(data.token);
          try {
            sessionStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, data.token);
          } catch {
            // Ignore storage errors
          }
          return;
        }
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes('passcode')) {
        throw err;
      }
    }

    // Static hosting fallback when Express /api/admin/verify is unavailable (404/405)
    let expectedStaticPin = STATIC_FALLBACK_PIN;
    try {
      const savedPin = localStorage.getItem('jikoni_static_admin_pin');
      if (savedPin) expectedStaticPin = savedPin;
    } catch {
      // Ignore storage read errors
    }

    if (pin !== expectedStaticPin) {
      throw new Error('Incorrect staff passcode.');
    }
    const localToken = `static-staff-${Date.now()}`;
    setUsingStaticFallback(true);
    setAdminToken(localToken);
    try {
      sessionStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, localToken);
    } catch {
      // Ignore storage errors
    }
  };

  const handleChangeAdminPassword = async (newPassword: string) => {
    if (!adminToken) return;

    if (!usingStaticFallback) {
      try {
        const res = await fetch('/api/admin/password', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-admin-token': adminToken,
          },
          body: JSON.stringify({ newPassword }),
        });
        const ct = res.headers.get('content-type') || '';
        if (res.ok && ct.includes('application/json')) {
          const data = (await res.json()) as { ok?: boolean; token?: string };
          if (data.token) {
            setAdminToken(data.token);
            try {
              sessionStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, data.token);
            } catch {
              // Ignore storage errors
            }
          }
          return;
        }
        if (res.status >= 400 && res.status < 500 && res.status !== 404 && res.status !== 405) {
          const data = ct.includes('application/json') ? ((await res.json()) as { error?: string }) : {};
          throw new Error(data.error || 'Unable to update passcode.');
        }
      } catch (err) {
        if (err instanceof Error && err.message !== 'Failed to fetch') {
          throw err;
        }
      }
    }

    try {
      localStorage.setItem('jikoni_static_admin_pin', newPassword);
    } catch {
      // Ignore storage errors
    }
  };

  const handleLockAdminPortal = () => {
    setAdminToken(null);
    setAdminOrders([]);
    setServiceRequests([]);
    try {
      sessionStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
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

    const orderItems: OrderItemRecord[] = cart.map((c) => ({
      menuItemId: c.menuItemId,
      name: c.name,
      quantity: c.quantity,
      unitPrice: c.unitPrice,
      selectedOptionLabel: c.selectedOptionLabel,
      spiceLevel: c.spiceLevel,
      notes: c.notes,
    }));

    let createdOrder: TableOrder | null = null;

    if (!usingStaticFallback) {
      try {
        const res = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tableNumber,
            guestName: guestName || undefined,
            serviceNote: serviceNote || undefined,
            estimatedMinutes: estPrep,
            items: orderItems,
          }),
        });
        const data = await parseJsonIfAvailable<{ order: TableOrder; error?: string }>(res);
        if (data?.order) {
          createdOrder = data.order;
        } else if (res.status >= 400 && res.status < 500 && res.status !== 404) {
          const errData = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(errData.error || 'Could not submit order to kitchen.');
        }
      } catch (err) {
        if (err instanceof Error && err.message !== 'Failed to fetch') {
          throw err;
        }
      }
    }

    if (!createdOrder) {
      const existingAll = getStaticFallbackOrders();
      const subtotal = orderItems.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
      const seq = 104 + existingAll.length;
      const nowIso = new Date().toISOString();
      createdOrder = {
        id: `ord-${seq}-${Date.now().toString(36)}`,
        orderNumber: `JK-${seq}`,
        tableNumber,
        guestName: guestName || undefined,
        items: orderItems,
        subtotal,
        serviceNote: serviceNote || undefined,
        status: 'Received',
        createdAt: nowIso,
        updatedAt: nowIso,
        estimatedMinutes: estPrep,
      };
      try {
        localStorage.setItem(FALLBACK_ORDERS_KEY, JSON.stringify([createdOrder, ...existingAll]));
      } catch {
        // Ignore storage write error
      }
    }

    setTableOrders((prev) => [createdOrder as TableOrder, ...prev]);
    setCart([]);
    setDrawerOpen(false);
    navigateCustomerView('tracker', tableNumber);
    showToast(`Order ${createdOrder.orderNumber} sent to kitchen for Table ${tableNumber}`);
  };

  const handleRequestService = async (type: ServiceRequestType) => {
    let created: ServiceRequest | null = null;

    if (!usingStaticFallback) {
      try {
        const res = await fetch('/api/service-requests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tableNumber, type }),
        });
        const data = await parseJsonIfAvailable<{ request: ServiceRequest }>(res);
        if (data?.request) created = data.request;
      } catch {
        // Fall through to local fallback
      }
    }

    if (!created) {
      const existingReqs = getStaticFallbackRequests();
      created = {
        id: `srv-${Date.now().toString(36)}`,
        tableNumber,
        type,
        status: 'Open',
        createdAt: new Date().toISOString(),
      };
      try {
        localStorage.setItem(FALLBACK_REQUESTS_KEY, JSON.stringify([created, ...existingReqs]));
      } catch {
        // Ignore storage write error
      }
    }
  };

  const handleAdvanceOrderStatus = async (orderId: string, nextStatus: OrderStatus) => {
    if (!adminToken) return;
    let updatedOrder: TableOrder | null = null;

    if (!usingStaticFallback) {
      try {
        const res = await fetch(`/api/orders/${orderId}/status`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'x-admin-token': adminToken,
          },
          body: JSON.stringify({ status: nextStatus }),
        });
        const data = await parseJsonIfAvailable<{ order: TableOrder }>(res);
        if (data?.order) updatedOrder = data.order;
      } catch {
        // Fall through to local fallback
      }
    }

    setAdminOrders((prev) => {
      const next = prev.map((o) =>
        o.id === orderId
          ? updatedOrder || { ...o, status: nextStatus, updatedAt: new Date().toISOString() }
          : o
      );
      if (!updatedOrder) {
        try {
          localStorage.setItem(FALLBACK_ORDERS_KEY, JSON.stringify(next));
        } catch {
          // Ignore storage write error
        }
      }
      return next;
    });
  };

  const handleResolveServiceRequest = async (requestId: string) => {
    if (!adminToken) return;
    let updatedReq: ServiceRequest | null = null;

    if (!usingStaticFallback) {
      try {
        const res = await fetch(`/api/service-requests/${requestId}`, {
          method: 'PATCH',
          headers: { 'x-admin-token': adminToken },
        });
        const data = await parseJsonIfAvailable<{ request: ServiceRequest }>(res);
        if (data?.request) updatedReq = data.request;
      } catch {
        // Fall through to local fallback
      }
    }

    setServiceRequests((prev) => {
      const next = prev.map((r) =>
        r.id === requestId ? updatedReq || { ...r, status: 'Resolved' as const } : r
      );
      if (!updatedReq) {
        try {
          localStorage.setItem(FALLBACK_REQUESTS_KEY, JSON.stringify(next));
        } catch {
          // Ignore storage write error
        }
      }
      return next;
    });
  };

  // ==================== ISOLATED ADMIN PORTAL ROUTE ====================
  if (route.zone === 'admin') {
    if (!adminToken) {
      return (
        <AdminLoginGate
          onVerifyPin={handleVerifyAdminPin}
          onReturnToMenu={() => navigateCustomerView('menu')}
        />
      );
    }

    return (
      <AdminPortal
        section={route.section}
        onSelectSection={navigateAdminSection}
        orders={adminOrders}
        serviceRequests={serviceRequests}
        loadingOrders={loadingOrders}
        onAdvanceOrderStatus={handleAdvanceOrderStatus}
        onResolveServiceRequest={handleResolveServiceRequest}
        onRefresh={() => fetchAdminState(false)}
        onSimulateScan={(num) => {
          handleChangeTable(num, true);
          setRoute({ zone: 'customer', view: 'menu' });
        }}
        onChangePassword={handleChangeAdminPassword}
        onLockPortal={handleLockAdminPortal}
        currentTable={tableNumber}
      />
    );
  }

  // ==================== CUSTOMER DINE-IN ROUTE ====================
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartSubtotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const activeTableOrdersCount = tableOrders.filter((o) => o.status !== 'Served').length;

  return (
    <div className="min-h-screen flex flex-col bg-[#110E0B] text-[#F6EFE4]">
      <Header
        activeView={route.view}
        onSelectView={(v) => navigateCustomerView(v)}
        cartCount={cartCount}
        onOpenCart={() => setDrawerOpen(true)}
      />

      <main className="flex-1 pb-20 md:pb-12">
        {route.view === 'menu' && (
          <>
            <HeroBanner
              tableNumber={tableNumber}
              scannedViaQr={scannedViaQr}
              onChangeTable={(t) => handleChangeTable(t, false)}
              onRequestService={handleRequestService}
              activeOrdersCount={activeTableOrdersCount}
              onViewTracker={() => navigateCustomerView('tracker')}
            />
            <MenuSection
              cart={cart}
              onQuickAdd={handleQuickAdd}
              onUpdateItemQty={handleUpdateMenuDishQty}
              onSelectDish={setSelectedDish}
            />
          </>
        )}

        {route.view === 'tracker' && (
          <TableTrackerView
            tableNumber={tableNumber}
            orders={tableOrders}
            loading={loadingOrders}
            onBackToMenu={() => navigateCustomerView('menu')}
            onRequestService={handleRequestService}
          />
        )}
      </main>

      {/* Customer-Only Footer (Zero Admin/QR links exposed) */}
      <footer className="border-t border-[#2A2119] bg-[#14100C] py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-[#9E8B73]">
          <div className="space-y-1">
            <p className="font-display text-sm font-semibold text-[#E6DAC8]">Jikoni Table</p>
            <p>Authentic Kenyan &amp; Swahili Kitchen · All prices inclusive of VAT (KES)</p>
          </div>
          <div className="flex flex-wrap items-center gap-5">
            <button
              type="button"
              onClick={() => navigateCustomerView('menu')}
              className="hover:text-[#E3BC78] transition-colors"
            >
              Digital Menu
            </button>
            <button
              type="button"
              onClick={() => navigateCustomerView('tracker')}
              className="hover:text-[#E3BC78] transition-colors"
            >
              Table {String(tableNumber).padStart(2, '0')} Orders
            </button>
          </div>
        </div>
      </footer>

      {/* Mobile Compact Bottom Tray Bar */}
      {cartCount > 0 && route.view === 'menu' && !drawerOpen && (
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
