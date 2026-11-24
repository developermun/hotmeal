import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, type User } from 'firebase/auth';
import {
  doc,
  getDoc,
  getDocFromServer,
  getFirestore,
  serverTimestamp,
  Timestamp,
  type DocumentData,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import type { OrderItemRecord, OrderStatus, ServiceRequest, ServiceRequestType, TableOrder } from './types.ts';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export const BOOTSTRAP_ADMIN_EMAIL = 'emmanuelmunamo@gmail.com';

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
void testConnection();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function checkIsStaffAdmin(user: User | null): Promise<boolean> {
  if (!user) return false;
  if (
    user.email?.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL &&
    user.emailVerified
  ) {
    return true;
  }
  const path = `admins/${user.uid}`;
  try {
    const snap = await getDoc(doc(db, 'admins', user.uid));
    return snap.exists();
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes('permission')) {
      return false;
    }
    handleFirestoreError(error, OperationType.GET, path);
  }
}

function toIsoString(val: unknown): string {
  if (val instanceof Timestamp) {
    return val.toDate().toISOString();
  }
  if (typeof val === 'string') {
    return val;
  }
  return new Date().toISOString();
}

export function mapDocToTableOrder(id: string, data: DocumentData): TableOrder {
  return {
    id,
    orderNumber: String(data.orderNumber || 'JK-100'),
    tableNumber: Number(data.tableNumber || 1),
    guestName: typeof data.guestName === 'string' && data.guestName ? data.guestName : undefined,
    items: Array.isArray(data.items) ? (data.items as OrderItemRecord[]) : [],
    subtotal: Number(data.subtotal || 0),
    serviceNote: typeof data.serviceNote === 'string' && data.serviceNote ? data.serviceNote : undefined,
    status: (data.status as OrderStatus) || 'Received',
    estimatedMinutes: Number(data.estimatedMinutes || 18),
    createdAt: toIsoString(data.createdAt),
    updatedAt: toIsoString(data.updatedAt),
  };
}

export function mapDocToServiceRequest(id: string, data: DocumentData): ServiceRequest {
  return {
    id,
    tableNumber: Number(data.tableNumber || 1),
    type: (data.type as ServiceRequestType) || 'Waiter Call',
    status: data.status === 'Resolved' ? 'Resolved' : 'Open',
    createdAt: toIsoString(data.createdAt),
  };
}

export function buildFirestoreOrderPayload({
  orderNumber,
  tableNumber,
  guestName,
  items,
  serviceNote,
  estimatedMinutes,
}: {
  orderNumber: string;
  tableNumber: number;
  guestName?: string;
  items: OrderItemRecord[];
  serviceNote?: string;
  estimatedMinutes: number;
}) {
  const sanitizedItems = items.slice(0, 30).map((item) => {
    const record: Record<string, unknown> = {
      menuItemId: String(item.menuItemId).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80) || 'dish',
      name: String(item.name).trim().slice(0, 120),
      quantity: Math.max(1, Math.min(50, Math.round(Number(item.quantity) || 1))),
      unitPrice: Math.max(0, Math.min(100000, Number(item.unitPrice) || 0)),
    };
    if (item.selectedOptionLabel) {
      record.selectedOptionLabel = String(item.selectedOptionLabel).trim().slice(0, 120);
    }
    if (item.spiceLevel && ['Mild', 'Medium', 'Pilipili Hot'].includes(item.spiceLevel)) {
      record.spiceLevel = item.spiceLevel;
    }
    if (item.notes && item.notes.trim()) {
      record.notes = item.notes.trim().slice(0, 200);
    }
    return record;
  });

  const subtotal = sanitizedItems.reduce(
    (sum, item) => sum + Number(item.unitPrice) * Number(item.quantity),
    0
  );

  const payload: Record<string, unknown> = {
    orderNumber: orderNumber.slice(0, 20),
    tableNumber: Math.max(1, Math.min(99, Math.round(tableNumber))),
    items: sanitizedItems,
    subtotal: Math.max(0, Math.min(500000, subtotal)),
    status: 'Received',
    estimatedMinutes: Math.max(1, Math.min(120, Math.round(estimatedMinutes || 18))),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const trimmedGuest = guestName?.trim();
  if (trimmedGuest) {
    payload.guestName = trimmedGuest.slice(0, 60);
  }

  const trimmedNote = serviceNote?.trim();
  if (trimmedNote) {
    payload.serviceNote = trimmedNote.slice(0, 240);
  }

  return { payload, subtotal, sanitizedItems: sanitizedItems as unknown as OrderItemRecord[] };
}
