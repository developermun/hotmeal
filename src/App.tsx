import { useCallback, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import { ShoppingBag } from 'lucide-react';
import { AdminLoginGate } from './components/AdminLoginGate.tsx';
import { AdminPortal, type AdminSection, type StaffAdminRecord } from './components/AdminPortal.tsx';
import { DishModal } from './components/DishModal.tsx';
import { Header, type CustomerView } from './components/Header.tsx';
import { HeroBanner } from './components/HeroBanner.tsx';
import { MenuSection } from './components/MenuSection.tsx';
import { OrderDrawer } from './components/OrderDrawer.tsx';
import { TableTrackerView } from './components/TableTrackerView.tsx';
import { formatKES } from './data/menu.ts';
import {
  auth,
  buildFirestoreOrderPayload,
  checkIsStaffAdmin,
  db,
  googleProvider,
  handleFirestoreError,
  mapDocToServiceRequest,
  mapDocToTableOrder,
  OperationType,
} from './firebase.ts';
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

const TABLE_ORDER_IDS_PREFIX = 'jikoni_fs_order_ids_table_';

function loadOrderIdsForTable(tableNumber: number): string[] {
  try {
    const raw = localStorage.getItem(`${TABLE_ORDER_IDS_PREFIX}${tableNumber}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(id))
      : [];
  } catch {
    return [];
  }
}

function saveOrderIdsForTable(tableNumber: number, ids: string[]): void {
  try {
    localStorage.setItem(`${TABLE_ORDER_IDS_PREFIX}${tableNumber}`, JSON.stringify(ids.slice(0, 30)));
  } catch {
    // Ignore storage write errors
  }
}

export default function App() {
  const initialState = useMemo(() => parseRouteFromUrl(), []);
  const [route, setRoute] = useState<RouteZone>(initialState.route);
  const [tableNumber, setTableNumber] = useState<number>(initialState.table);
  const [scannedViaQr, setScannedViaQr] = useState<boolean>(initialState.fromQr);

  // Firebase Auth state for Staff Admin Portal
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [isAdminAuthorized, setIsAdminAuthorized] = useState<boolean>(false);

  // Customer cart & tracked order IDs for current table
  const [cart, setCart] = useState<CartItem[]>(() => loadCartForTable(initialState.table));
  const [tableOrderIds, setTableOrderIds] = useState<string[]>(() => loadOrderIdsForTable(initialState.table));
  const [selectedDish, setSelectedDish] = useState<MenuItem | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Live Firestore synced state
  const [tableOrdersById, setTableOrdersById] = useState<Record<string, TableOrder>>({});
  const [adminOrders, setAdminOrders] = useState<TableOrder[]>([]);
  const [serviceRequests, setServiceRequests] = useState<ServiceRequest[]>([]);
  const [staffAdmins, setStaffAdmins] = useState<StaffAdminRecord[]>([]);
  const [loadingOrders, setLoadingOrders] = useState<boolean>(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [syncNonce, setSyncNonce] = useState(0);

  const tableOrders = useMemo(
    () =>
      Object.values(tableOrdersById)
        .filter((o) => o.tableNumber === tableNumber)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [tableOrdersById, tableNumber]
  );

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3200);
  }, []);

  // Watch Firebase Auth state (only triggers admin verification when on admin route or signed in)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setAuthUser(user);
      if (!user) {
        setIsAdminAuthorized(false);
        setAuthLoading(false);
        return;
      }
      setAuthLoading(true);
      try {
        const allowed = await checkIsStaffAdmin(user);
        setIsAdminAuthorized(allowed);
      } catch {
        setIsAdminAuthorized(false);
      } finally {
        setAuthLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // Customer real-time Firestore listeners for each order ID placed on this table
  useEffect(() => {
    if (route.zone !== 'customer') return undefined;

    setTableOrdersById({});
    if (tableOrderIds.length === 0) {
      setLoadingOrders(false);
      return undefined;
    }

    setLoadingOrders(true);
    let pendingInitial = tableOrderIds.length;
    const unsubscribes: Unsubscribe[] = tableOrderIds.map((orderId) => {
      const path = `orders/${orderId}`;
      return onSnapshot(
        doc(db, 'orders', orderId),
        (snapshot) => {
          if (snapshot.exists()) {
            const mapped = mapDocToTableOrder(snapshot.id, snapshot.data({ serverTimestamps: 'estimate' }));
            setTableOrdersById((prev) => ({ ...prev, [snapshot.id]: mapped }));
          }
          pendingInitial = Math.max(0, pendingInitial - 1);
          if (pendingInitial === 0) setLoadingOrders(false);
        },
        (error) => {
          setLoadingOrders(false);
          handleFirestoreError(error, OperationType.GET, path);
        }
      );
    });

    return () => {
      for (const unsub of unsubscribes) {
        unsub();
      }
    };
  }, [route.zone, tableNumber, tableOrderIds]);

  // Cross-tab sync of tableOrderIds in the same browser
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === `${TABLE_ORDER_IDS_PREFIX}${tableNumber}`) {
        setTableOrderIds(loadOrderIdsForTable(tableNumber));
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [tableNumber]);

  // Admin real-time Firestore collection listeners (only attached once auth is verified)
  useEffect(() => {
    if (route.zone !== 'admin') return undefined;
    if (authLoading || !authUser || !isAdminAuthorized) {
      setAdminOrders([]);
      setServiceRequests([]);
      setStaffAdmins([]);
      setLoadingOrders(false);
      return undefined;
    }

    setLoadingOrders(true);
    const ordersPath = 'orders';
    const requestsPath = 'serviceRequests';
    const adminsPath = 'admins';

    const unsubOrders = onSnapshot(
      query(collection(db, ordersPath), orderBy('createdAt', 'desc')),
      (snap) => {
        const list = snap.docs.map((d) =>
          mapDocToTableOrder(d.id, d.data({ serverTimestamps: 'estimate' }))
        );
        setAdminOrders(list);
        setLoadingOrders(false);
      },
      (error) => {
        setLoadingOrders(false);
        handleFirestoreError(error, OperationType.LIST, ordersPath);
      }
    );

    const unsubRequests = onSnapshot(
      query(collection(db, requestsPath), orderBy('createdAt', 'desc')),
      (snap) => {
        const list = snap.docs.map((d) =>
          mapDocToServiceRequest(d.id, d.data({ serverTimestamps: 'estimate' }))
        );
        setServiceRequests(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, requestsPath);
      }
    );

    const unsubAdmins = onSnapshot(
      query(collection(db, adminsPath), orderBy('createdAt', 'desc')),
      (snap) => {
        const list: StaffAdminRecord[] = snap.docs.map((d) => {
          const data = d.data({ serverTimestamps: 'estimate' });
          return {
            uid: d.id,
            email: String(data.email || ''),
            role: 'admin',
            createdAt:
              data.createdAt && typeof data.createdAt.toDate === 'function'
                ? data.createdAt.toDate().toISOString()
                : new Date().toISOString(),
          };
        });
        setStaffAdmins(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, adminsPath);
      }
    );

    return () => {
      unsubOrders();
      unsubRequests();
      unsubAdmins();
    };
  }, [route.zone, authLoading, authUser, isAdminAuthorized, syncNonce]);

  useEffect(() => {
    const onPopState = () => {
      const next = parseRouteFromUrl();
      setRoute(next.route);
      setTableNumber(next.table);
      setScannedViaQr(next.fromQr);
      setCart(loadCartForTable(next.table));
      setTableOrderIds(loadOrderIdsForTable(next.table));
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
    setTableOrderIds(loadOrderIdsForTable(nextTable));
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

  const handleSignInWithGoogle = async () => {
    await signInWithPopup(auth, googleProvider);
  };

  const handleSignOutAdmin = async () => {
    await signOut(auth);
    setAdminOrders([]);
    setServiceRequests([]);
    setStaffAdmins([]);
    setIsAdminAuthorized(false);
  };

  const handleAddStaffAdmin = async (uid: string, email: string) => {
    const path = `admins/${uid}`;
    try {
      await setDoc(doc(db, 'admins', uid), {
        email: email.trim().slice(0, 120),
        role: 'admin',
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  };

  const handleRemoveStaffAdmin = async (uid: string) => {
    const path = `admins/${uid}`;
    try {
      await deleteDoc(doc(db, 'admins', uid));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
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

    const orderRef = doc(collection(db, 'orders'));
    const randomSuffix = String(Math.floor(1000 + Math.random() * 9000));
    const orderNumber = `JK-${tableNumber}${randomSuffix}`;
    const { payload } = buildFirestoreOrderPayload({
      orderNumber,
      tableNumber,
      guestName,
      items: orderItems,
      serviceNote,
      estimatedMinutes: estPrep,
    });

    const path = `orders/${orderRef.id}`;
    try {
      await setDoc(orderRef, payload);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }

    const nextIds = [orderRef.id, ...tableOrderIds.filter((id) => id !== orderRef.id)];
    saveOrderIdsForTable(tableNumber, nextIds);
    setTableOrderIds(nextIds);
    setCart([]);
    setDrawerOpen(false);
    navigateCustomerView('tracker', tableNumber);
    showToast(`Order ${orderNumber} sent to kitchen for Table ${tableNumber}`);
  };

  const handleRequestService = async (type: ServiceRequestType) => {
    const reqRef = doc(collection(db, 'serviceRequests'));
    const path = `serviceRequests/${reqRef.id}`;
    try {
      await setDoc(reqRef, {
        tableNumber: Math.max(1, Math.min(99, Math.round(tableNumber))),
        type,
        status: 'Open',
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  };

  const handleAdvanceOrderStatus = async (orderId: string, nextStatus: OrderStatus) => {
    const path = `orders/${orderId}`;
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        status: nextStatus,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const handleResolveServiceRequest = async (requestId: string) => {
    const path = `serviceRequests/${requestId}`;
    try {
      await updateDoc(doc(db, 'serviceRequests', requestId), {
        status: 'Resolved',
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  // ==================== ISOLATED ADMIN PORTAL ROUTE ====================
  if (route.zone === 'admin') {
    if (authLoading || !authUser || !isAdminAuthorized) {
      return (
        <AdminLoginGate
          authLoading={authLoading}
          signedInEmail={authUser?.email || null}
          signedInUid={authUser?.uid || null}
          unauthorizedAccount={Boolean(!authLoading && authUser && !isAdminAuthorized)}
          onSignInWithGoogle={handleSignInWithGoogle}
          onSignOut={handleSignOutAdmin}
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
        staffAdmins={staffAdmins}
        adminEmail={authUser.email}
        loadingOrders={loadingOrders}
        onAdvanceOrderStatus={handleAdvanceOrderStatus}
        onResolveServiceRequest={handleResolveServiceRequest}
        onRefresh={() => setSyncNonce((n) => n + 1)}
        onSimulateScan={(num) => {
          handleChangeTable(num, true);
          setRoute({ zone: 'customer', view: 'menu' });
        }}
        onAddStaffAdmin={handleAddStaffAdmin}
        onRemoveStaffAdmin={handleRemoveStaffAdmin}
        onLockPortal={handleSignOutAdmin}
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
