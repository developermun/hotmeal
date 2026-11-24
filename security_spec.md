# Jikoni Table Firestore Security Specification (Phase 0)

## 1. Data Invariants

1. **Order Initialization Integrity**: Any new document in `/orders/{orderId}` MUST begin with `status == 'Received'`, `tableNumber` between `1` and `99`, `1 <= items.size() <= 30`, server-enforced `createdAt == request.time`, and `updatedAt == request.time`. Diners cannot submit pre-approved (`Ready` / `Served`) orders or forge timestamps.
2. **Order Immutability & Admin-Only State Transitions**: Once created, `orderNumber`, `tableNumber`, `items`, `subtotal`, `guestName`, `serviceNote`, `estimatedMinutes`, and `createdAt` are immutable. Only verified staff admins (`isAdmin()`) can list all orders or update `status` and `updatedAt`.
3. **Zero Unscoped Collection Scraping**: Unauthenticated diners cannot `list` the `/orders` or `/serviceRequests` collections. Diners may only listen (`get`) to the specific unguessable order document IDs created on their table session.
4. **Service Request Integrity**: Any new document in `/serviceRequests/{requestId}` MUST begin with `status == 'Open'`, a valid `type` (`Waiter Call`, `Request Bill`, `Extra Napkins & Water`), valid `tableNumber` (`1..99`), and `createdAt == request.time`. Only verified admins can `list`, `get`, or mark `status = 'Resolved'`.
5. **Privilege Escalation Prevention**: Only verified admins (`emmanuelmunamo@gmail.com` with `email_verified == true` or existing `/admins/{uid}` members) can access `/admins` or create/delete admin records. Non-admins cannot self-assign roles.
6. **Path Variable Hardening**: Every single-document operation enforces `isValidId(id)` (`^[a-zA-Z0-9_\\-]+$`, `size() <= 128`) and strict `.size()` bounds on every string and array.

## 2. The "Dirty Dozen" Attack Payloads

1. **Ghost Field Injection on Order Create**: `{ ..., status: "Received", isFreeMeal: true }` -> Rejected by `hasOnly(...)` key allowlist.
2. **Status Forgery on Order Create**: `{ ..., status: "Served" }` -> Rejected because `create` requires `status == 'Received'`.
3. **Timestamp Spoofing on Order Create**: `{ ..., createdAt: "2020-01-01T00:00:00Z" }` -> Rejected because `createdAt == request.time` is enforced.
4. **Unauthenticated Admin List Scrape**: `getDocs(collection(db, 'orders'))` as guest -> Rejected (`allow list: if isAdmin()`).
5. **Diner Self-Updating Order Status**: `updateDoc(doc(db, 'orders', orderId), { status: 'Served' })` as guest -> Rejected (`allow update: if isAdmin() ...`).
6. **Negative Price / Subtotal Poisoning**: `{ ..., subtotal: -500 }` -> Rejected (`subtotal >= 0 && subtotal <= 500000`).
7. **Invalid Table Range**: `{ ..., tableNumber: 999 }` -> Rejected (`tableNumber >= 1 && tableNumber <= 99`).
8. **Empty or Oversized Items Array**: `{ ..., items: [] }` or 50-item payload -> Rejected (`items.size() >= 1 && items.size() <= 30`).
9. **Resource Exhaustion / 1MB String in ID or Notes**: `{ orderId: "a".repeat(200) }` or `serviceNote: "x".repeat(5000)` -> Rejected by `isValidId` and `serviceNote.size() <= 240`.
10. **Email Spoofing Without Verification**: Signed-in user with `email: "emmanuelmunamo@gmail.com"` and `email_verified: false` -> Rejected (`email_verified == true`).
11. **Self-Assigned Admin Role**: `setDoc(doc(db, 'admins', myUid), { email: 'x@y.com', role: 'admin', createdAt: serverTimestamp() })` as non-admin -> Rejected (`allow create: if isAdmin()`).
12. **Shadow Field Update by Compromised Admin Payload**: `updateDoc(doc(db, 'orders', orderId), { status: 'Ready', subtotal: 0, updatedAt: serverTimestamp() })` -> Rejected by `affectedKeys().hasOnly(['status', 'updatedAt'])`.
