import crypto from 'crypto';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import type { OrderItemRecord, OrderStatus, ServiceRequest, ServiceRequestType, TableOrder } from './src/types.ts';

interface StoreState {
  orders: TableOrder[];
  serviceRequests: ServiceRequest[];
  nextOrderSeq: number;
}

interface AdminAuthConfig {
  salt: string;
  passwordHash: string;
  updatedAt: string;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const STORE_PATH = path.join(DATA_DIR, 'orders.json');
const ADMIN_AUTH_PATH = path.join(DATA_DIR, 'admin-auth.json');

const DEFAULT_STAFF_PIN = '2540';

function getConfiguredEnvPin(): string | null {
  let raw = (process.env.ADMIN_PIN || '').trim();
  if (
    (raw.startsWith('"') && raw.endsWith('"') && raw.length >= 2) ||
    (raw.startsWith("'") && raw.endsWith("'") && raw.length >= 2)
  ) {
    raw = raw.slice(1, -1).trim();
  }
  if (!raw || raw.startsWith('MY_')) return null;
  return raw;
}

function getTokenSecret(): string {
  const envSecret = (process.env.ADMIN_SECRET || '').trim();
  if (envSecret) return envSecret;
  const seedBase = getConfiguredEnvPin() || DEFAULT_STAFF_PIN;
  return crypto.createHash('sha256').update(`jikoni-staff-${seedBase}`).digest('hex');
}

function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 32).toString('hex');
}

function readCustomAdminAuth(): AdminAuthConfig | null {
  try {
    if (!fs.existsSync(ADMIN_AUTH_PATH)) return null;
    const raw = fs.readFileSync(ADMIN_AUTH_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as AdminAuthConfig;
    if (parsed && typeof parsed.salt === 'string' && typeof parsed.passwordHash === 'string') {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function saveCustomAdminAuth(newPassword: string): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = hashPassword(newPassword, salt);
  const payload: AdminAuthConfig = {
    salt,
    passwordHash,
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(ADMIN_AUTH_PATH, JSON.stringify(payload, null, 2), 'utf-8');
}

function timingSafeMatch(aStr: string, bStr: string): boolean {
  const a = Buffer.from(aStr);
  const b = Buffer.from(bStr);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function verifyAdminPin(inputPin: string): boolean {
  const cleaned = String(inputPin).trim();
  if (!cleaned) return false;

  const customAuth = readCustomAdminAuth();
  if (customAuth) {
    const candidateHash = hashPassword(cleaned, customAuth.salt);
    return timingSafeMatch(candidateHash, customAuth.passwordHash);
  }

  const envPin = getConfiguredEnvPin();
  if (envPin) {
    return timingSafeMatch(cleaned, envPin);
  }

  return timingSafeMatch(cleaned, DEFAULT_STAFF_PIN);
}

function issueAdminToken(): string {
  const payload = `staff:${Date.now()}`;
  const sig = crypto.createHmac('sha256', getTokenSecret()).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

function verifyAdminToken(token: string | undefined): boolean {
  if (!token || !token.includes('.')) return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [payload, sig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', getTokenSecret())
    .update(payload)
    .digest('hex');
  return timingSafeMatch(sig, expectedSig);
}

function requireAdmin(req: express.Request, res: express.Response): boolean {
  const token = req.header('x-admin-token');
  if (!verifyAdminToken(token)) {
    res.status(401).json({ error: 'Staff authentication required.' });
    return false;
  }
  return true;
}

function createInitialSeed(): StoreState {
  const now = Date.now();
  return {
    nextOrderSeq: 104,
    orders: [
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
    ],
    serviceRequests: [
      {
        id: 'srv-1',
        tableNumber: 2,
        type: 'Extra Napkins & Water',
        status: 'Open',
        createdAt: new Date(now - 2 * 60 * 1000).toISOString(),
      },
    ],
  };
}

function readStore(): StoreState {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(STORE_PATH)) {
      const seed = createInitialSeed();
      fs.writeFileSync(STORE_PATH, JSON.stringify(seed, null, 2), 'utf-8');
      return seed;
    }
    const raw = fs.readFileSync(STORE_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as StoreState;
    return {
      orders: Array.isArray(parsed.orders) ? parsed.orders : [],
      serviceRequests: Array.isArray(parsed.serviceRequests) ? parsed.serviceRequests : [],
      nextOrderSeq: typeof parsed.nextOrderSeq === 'number' ? parsed.nextOrderSeq : 104,
    };
  } catch {
    return createInitialSeed();
  }
}

function writeStore(state: StoreState): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(STORE_PATH, JSON.stringify(state, null, 2), 'utf-8');
}

const VALID_STATUSES: OrderStatus[] = ['Received', 'Preparing', 'Ready', 'Served'];
const VALID_REQUEST_TYPES: ServiceRequestType[] = ['Waiter Call', 'Request Bill', 'Extra Napkins & Water'];

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'jikoni-table' });
  });

  // Staff Admin PIN / Password verification
  app.post('/api/admin/verify', (req, res) => {
    const { pin } = req.body as { pin?: string };
    if (!pin || !verifyAdminPin(pin)) {
      res.status(401).json({ error: 'Incorrect staff passcode. Please try again.' });
      return;
    }
    res.json({ ok: true, token: issueAdminToken() });
  });

  // Update staff admin password (requires valid current session token)
  app.post('/api/admin/password', (req, res) => {
    if (!requireAdmin(req, res)) return;
    const { newPassword } = req.body as { newPassword?: string };
    const cleaned = String(newPassword || '').trim();
    if (cleaned.length < 4 || cleaned.length > 64) {
      res.status(400).json({ error: 'Password must be between 4 and 64 characters.' });
      return;
    }
    saveCustomAdminAuth(cleaned);
    res.json({ ok: true, token: issueAdminToken() });
  });

  // Customer table orders (requires ?table=N) OR full restaurant orders (requires staff admin token)
  app.get('/api/orders', (req, res) => {
    const state = readStore();
    const tableParam = req.query.table;
    if (tableParam !== undefined && tableParam !== '') {
      const tableNum = Number(tableParam);
      if (!Number.isInteger(tableNum) || tableNum < 1 || tableNum > 99) {
        res.status(400).json({ error: 'Invalid table number' });
        return;
      }
      const filtered = state.orders
        .filter((o) => o.tableNumber === tableNum)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      res.json({ orders: filtered });
      return;
    }

    if (!requireAdmin(req, res)) return;

    const sorted = [...state.orders].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    res.json({ orders: sorted });
  });

  app.post('/api/orders', (req, res) => {
    const body = req.body as {
      tableNumber?: number;
      guestName?: string;
      items?: OrderItemRecord[];
      serviceNote?: string;
      estimatedMinutes?: number;
    };

    const tableNumber = Number(body.tableNumber);
    if (!Number.isInteger(tableNumber) || tableNumber < 1 || tableNumber > 99) {
      res.status(400).json({ error: 'Please provide a valid table number (1–99).' });
      return;
    }

    if (!Array.isArray(body.items) || body.items.length === 0) {
      res.status(400).json({ error: 'Your order tray is empty.' });
      return;
    }

    const sanitizedItems: OrderItemRecord[] = [];
    let subtotal = 0;

    for (const rawItem of body.items) {
      const qty = Number(rawItem.quantity);
      const unitPrice = Number(rawItem.unitPrice);
      if (
        !rawItem.menuItemId ||
        !rawItem.name ||
        !Number.isInteger(qty) ||
        qty < 1 ||
        qty > 50 ||
        !Number.isFinite(unitPrice) ||
        unitPrice < 0
      ) {
        res.status(400).json({ error: 'Invalid dish item in order.' });
        return;
      }
      subtotal += qty * unitPrice;
      sanitizedItems.push({
        menuItemId: String(rawItem.menuItemId).slice(0, 80),
        name: String(rawItem.name).slice(0, 120),
        quantity: qty,
        unitPrice,
        selectedOptionLabel: rawItem.selectedOptionLabel
          ? String(rawItem.selectedOptionLabel).slice(0, 120)
          : undefined,
        spiceLevel: rawItem.spiceLevel,
        notes: rawItem.notes ? String(rawItem.notes).trim().slice(0, 200) : undefined,
      });
    }

    const state = readStore();
    const seq = state.nextOrderSeq;
    state.nextOrderSeq += 1;

    const nowIso = new Date().toISOString();
    const newOrder: TableOrder = {
      id: `ord-${seq}-${Date.now().toString(36)}`,
      orderNumber: `JK-${seq}`,
      tableNumber,
      guestName: body.guestName ? String(body.guestName).trim().slice(0, 60) : undefined,
      items: sanitizedItems,
      subtotal,
      serviceNote: body.serviceNote ? String(body.serviceNote).trim().slice(0, 240) : undefined,
      status: 'Received',
      createdAt: nowIso,
      updatedAt: nowIso,
      estimatedMinutes:
        typeof body.estimatedMinutes === 'number' && body.estimatedMinutes > 0
          ? Math.min(60, Math.round(body.estimatedMinutes))
          : 18,
    };

    state.orders.unshift(newOrder);
    writeStore(state);

    res.status(201).json({ order: newOrder });
  });

  app.patch('/api/orders/:id/status', (req, res) => {
    if (!requireAdmin(req, res)) return;

    const { id } = req.params;
    const { status } = req.body as { status?: OrderStatus };

    if (!status || !VALID_STATUSES.includes(status)) {
      res.status(400).json({ error: 'Invalid order status.' });
      return;
    }

    const state = readStore();
    const idx = state.orders.findIndex((o) => o.id === id);
    if (idx === -1) {
      res.status(404).json({ error: 'Order not found.' });
      return;
    }

    state.orders[idx] = {
      ...state.orders[idx],
      status,
      updatedAt: new Date().toISOString(),
    };
    writeStore(state);
    res.json({ order: state.orders[idx] });
  });

  app.get('/api/service-requests', (req, res) => {
    if (!requireAdmin(req, res)) return;

    const state = readStore();
    const sorted = [...state.serviceRequests].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    res.json({ requests: sorted });
  });

  app.post('/api/service-requests', (req, res) => {
    const { tableNumber, type } = req.body as { tableNumber?: number; type?: ServiceRequestType };
    const tableNum = Number(tableNumber);

    if (!Number.isInteger(tableNum) || tableNum < 1 || tableNum > 99) {
      res.status(400).json({ error: 'Valid table number is required.' });
      return;
    }
    if (!type || !VALID_REQUEST_TYPES.includes(type)) {
      res.status(400).json({ error: 'Valid service request type is required.' });
      return;
    }

    const state = readStore();
    const created: ServiceRequest = {
      id: `srv-${Date.now().toString(36)}`,
      tableNumber: tableNum,
      type,
      status: 'Open',
      createdAt: new Date().toISOString(),
    };
    state.serviceRequests.unshift(created);
    writeStore(state);
    res.status(201).json({ request: created });
  });

  app.patch('/api/service-requests/:id', (req, res) => {
    if (!requireAdmin(req, res)) return;

    const { id } = req.params;
    const state = readStore();
    const idx = state.serviceRequests.findIndex((r) => r.id === id);
    if (idx === -1) {
      res.status(404).json({ error: 'Service request not found.' });
      return;
    }
    state.serviceRequests[idx] = {
      ...state.serviceRequests[idx],
      status: 'Resolved',
    };
    writeStore(state);
    res.json({ request: state.serviceRequests[idx] });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Jikoni Table server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
