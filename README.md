# RestaurantOS — Multi-Tenant ERP Frontend

A clean, modular Next.js 14 ERP frontend for multi-tenant restaurant management, powered by Firebase Auth + Firestore.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Auth & DB | Firebase Auth + Firestore |
| Charts | Recharts |
| Icons | Lucide React |
| Toasts | React Hot Toast |

---

## Project Structure

```
restaurant-erp/
├── app/
│   ├── login/                    # Auth page (all roles)
│   ├── root-admin/               # Root admin pages
│   │   ├── page.tsx              # Restaurant CRUD + assign admin
│   │   └── users/page.tsx        # User management
│   ├── restaurant-admin/         # Restaurant admin pages
│   │   ├── page.tsx              # Dashboard + KPIs + revenue chart
│   │   ├── orders/page.tsx       # All orders with status filter
│   │   ├── queries/page.tsx      # All queries (QueryList reuse)
│   │   ├── managers/page.tsx     # Assign + monitor managers
│   │   └── performance/page.tsx  # Analytics + agent performance
│   ├── restaurant-manager/       # Manager pages
│   │   ├── page.tsx              # Assigned queries
│   │   ├── products/page.tsx     # Product CRUD (grid + list)
│   │   └── orders/page.tsx       # Order status updates
│   └── (customer)/               # Customer pages (route group)
│       ├── menu/page.tsx         # Browse menu by category
│       ├── cart/page.tsx         # Cart + checkout + dine-in booking
│       ├── orders/page.tsx       # Order history
│       ├── queries/page.tsx      # Raise + view queries
│       └── profile/page.tsx      # Account + change password
│
├── components/
│   ├── ui/                       # Primitive reusable UI
│   │   ├── Button.tsx            # Variants: primary/secondary/ghost/danger/success
│   │   ├── Badge.tsx             # Status badges with dot indicator
│   │   ├── Modal.tsx             # Accessible dialog with backdrop
│   │   ├── Input.tsx             # Input, Select, Textarea
│   │   ├── StatCard.tsx          # KPI cards with trend indicator
│   │   ├── EmptyState.tsx        # Consistent empty states
│   │   └── Loading.tsx           # Spinner, PageLoader, CardSkeleton
│   │
│   ├── product/                  # ★ REUSABLE PRODUCT MODULE
│   │   ├── ProductPage.tsx       # Full product detail — mode="customer" or mode="manager"
│   │   └── ProductCard.tsx       # Card for grid — adapts to customer/manager role
│   │
│   ├── query/                    # ★ REUSABLE QUERY MODULE
│   │   ├── QueryCard.tsx         # Structured query card with status + meta
│   │   ├── QueryDetailPanel.tsx  # Slide-in panel: remark timeline + status update
│   │   └── QueryList.tsx         # Filterable, searchable list (used by admin, manager, customer)
│   │
│   ├── order/                    # Order module
│   │   ├── OrderCard.tsx         # Order summary card
│   │   └── OrderDetailModal.tsx  # Full order: items, billing, status tracker, update
│   │
│   └── layout/
│       ├── Sidebar.tsx           # Role-aware navigation (all 4 roles)
│       └── DashboardShell.tsx    # Page shell: sidebar + topbar + content area
│
├── context/
│   ├── AuthContext.tsx           # Firebase Auth + Firestore user state
│   ├── CartContext.tsx           # Cart with localStorage persistence
│   └── RestaurantContext.tsx     # Active restaurant (slug-based)
│
├── lib/
│   ├── firebase/
│   │   ├── config.ts             # Firebase app init
│   │   └── services.ts           # All Firestore service functions
│   ├── types/index.ts            # TypeScript interfaces matching Firestore schema
│   └── utils/index.ts            # cn(), formatCurrency(), status configs, etc.
│
└── middleware.ts                 # Route protection
```

---

## Roles & Access

| Role | Access |
|---|---|
| `root_admin` | Restaurant CRUD, assign restaurant admins, create users |
| `restaurant_admin` | Dashboard, all orders, all queries, assign managers, analytics |
| `restaurant_manager` | Product CRUD, assigned queries + status updates, order status |
| `customer` | Menu, cart, place order/dine-in, order history, raise queries, change password |

---

## Reusable Modules

### `<ProductPage mode="customer" | "manager" />`
Single component renders differently based on `mode`:
- **customer**: Add-to-cart flow, quantity selector, availability notice
- **manager**: Edit form modal, delete, toggle availability inline

### `<QueryList />` + `<QueryDetailPanel />`
- `QueryList`: Filterable by status tabs + free-text search, works for admin/manager/customer
- `QueryDetailPanel`: Remark timeline (chat-bubble style), role-aware actions (customers reply, managers update status)

---

## Quick Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Configure Firebase
```bash
cp .env.local.example .env.local
# Fill in your Firebase project credentials
```

### 3. Firebase Setup
- Enable **Email/Password** authentication in Firebase console
- Create Firestore database in **production mode**
- Add Firestore Security Rules (see below)
- Add Storage bucket (for product images)

### 4. Run dev server
```bash
npm run dev
# Opens at http://localhost:3000
```

---

## Firestore Security Rules (recommended)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isAuth() { return request.auth != null; }
    function role() { return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role; }
    function isRootAdmin() { return role() == 'root_admin'; }
    function isRestaurantAdmin(rid) {
      return role() == 'restaurant_admin' &&
        get(/databases/$(database)/documents/restaurants/$(rid)).data.admin_uid == request.auth.uid;
    }
    function isManager(rid) {
      return role() == 'restaurant_manager' &&
        request.auth.uid in get(/databases/$(database)/documents/restaurants/$(rid)).data.manager_uids;
    }

    match /users/{uid} {
      allow read: if isAuth() && (request.auth.uid == uid || isRootAdmin());
      allow write: if isAuth() && (request.auth.uid == uid || isRootAdmin());
    }

    match /restaurants/{rid} {
      allow read: if isAuth();
      allow create, delete: if isAuth() && isRootAdmin();
      allow update: if isAuth() && (isRootAdmin() || isRestaurantAdmin(rid));

      match /menu_products/{pid} {
        allow read: if isAuth();
        allow write: if isAuth() && (isRootAdmin() || isRestaurantAdmin(rid) || isManager(rid));
      }

      match /orders/{oid} {
        allow read: if isAuth() && (isRootAdmin() || isRestaurantAdmin(rid) || isManager(rid) ||
          (role() == 'customer' && resource.data.customer_id == request.auth.uid));
        allow create: if isAuth() && role() == 'customer';
        allow update: if isAuth() && (isRestaurantAdmin(rid) || isManager(rid));
      }

      match /queries/{qid} {
        allow read: if isAuth() && (isRootAdmin() || isRestaurantAdmin(rid) || isManager(rid) ||
          (role() == 'customer' && resource.data.customer_id == request.auth.uid));
        allow create: if isAuth() && role() == 'customer';
        allow update: if isAuth() && (isRestaurantAdmin(rid) || isManager(rid) ||
          (role() == 'customer' && resource.data.customer_id == request.auth.uid));
      }
    }
  }
}
```

---

## Key Design Decisions

- **One page per concern** — each screen does exactly one job; no multipurpose panels
- **Role-aware reuse** — `ProductPage` and `QueryDetailPanel` read `mode` or `currentUser.role` to render different actions, not different components
- **Snapshot billing** — Order items are snapshot-copied at checkout; price changes don't corrupt history
- **Slug routing** — Customer context resolves via `url_slug → restaurant_id` query; branding is loaded per tenant
- **Cart persistence** — `CartContext` persists to `localStorage`; clears on successful order placement
