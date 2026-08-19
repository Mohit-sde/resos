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

## Roles & Access

| Role | Access |
|---|---|
| `root_admin` | Restaurant CRUD, assign restaurant admins, create users |
| `restaurant_admin` | Dashboard, all orders, all queries, assign managers, analytics |
| `restaurant_manager` | Product CRUD, assigned queries + status updates, order status |
| `customer` | Menu, cart, place order/dine-in, order history, raise queries, change password |

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
