# Pharma Inventory Management System

A simplified, single-role pharma inventory system covering:

- **Purchase** — create purchase orders (SKU, qty, rate, payment term, delivery date), view full detail
- **GRN** — receive goods against a purchase order, updates stock and the PO's status
- **Inventory** — live stock on hand per SKU
- **Sales** — create invoices, which deduct from stock
- **Masters** — add/edit SKUs; only **enabled** SKUs appear in the Purchase/Sales product dropdowns

There's just one type of account — anyone who registers can use every module.
No admin/supplier/customer split.

## Stack

- **Backend:** Node.js + Express + MongoDB (Mongoose) — `/backend`
- **Frontend:** Next.js (React) + Tailwind — `/frontend`

## Prerequisites

- Node.js 18+ and npm
- MongoDB — running locally, or a free MongoDB Atlas cluster

## 1. Backend setup

```bash
cd backend
npm install
cp .env.example .env
```
Edit `.env`: set `MONGO_URI` (local default is fine, or paste an Atlas
connection string) and `JWT_SECRET` (any long random string).

Seed a login user and a few sample SKUs:
```bash
npm run seed
```
This prints a login email/password to the console, and adds 3 sample SKUs
so the Purchase/Sales dropdowns aren't empty.

Start the backend:
```bash
npm run dev
```
Runs on `http://localhost:5000`. Check `http://localhost:5000/api/health`.

## 2. Frontend setup

```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```
Runs on `http://localhost:3000`.

## Typical flow to try it out

1. Log in with the credentials `npm run seed` printed (or register a new account).
2. Go to **Masters** → add a couple more SKUs if you like (or use the 3 seeded ones).
   Only "Enabled" SKUs will appear as options in Purchase/Sales forms.
3. Go to **Purchase** → **+ Add Purchase Order** → pick a supplier name, order
   date, payment term, delivery date, and add one or more SKU line items with
   qty and rate. Save it, then click into it to see the full detail view.
4. Go to **GRN** → **+ Add GRN** → pick the PO you just created, adjust
   quantities received if it's a partial delivery, and confirm. This adds
   the received quantity to stock and marks the PO received/partially received.
5. Go to **Inventory** to see the stock that just came in.
6. Go to **Sales** → **+ Add Invoice** → pick a customer, SKUs, and quantities
   (can't exceed what's in stock) → save. Check **Inventory** again — the
   sold quantity is now deducted.

## Project structure

```
backend/
  src/
    config/db.js               MongoDB connection
    models/User.js             login accounts (single role)
    models/Sku.js               master SKUs (name, category, gst, mrp, enabled flag, etc.)
    models/PurchaseOrder.js     PO header + line items
    models/Grn.js                GRN header + line items (received qty)
    models/Stock.js             current qty on hand per SKU
    models/SaleInvoice.js       invoice header + line items
    routes/auth.routes.js       register / login
    routes/sku.routes.js         Masters CRUD + enable/disable toggle
    routes/purchaseOrder.routes.js
    routes/grn.routes.js         creating a GRN updates Stock + PO status
    routes/inventory.routes.js  read-only stock-on-hand view
    routes/sales.routes.js       creating an invoice deducts Stock
    utils/idGenerator.js        PO-000001 / GRN-000001 / INV-000001 numbering
    utils/seedUser.js           first login + sample SKUs
    server.js

frontend/
  src/
    app/
      purchase/ (list, new, [id] detail)
      grn/ (list, new, [id] detail)
      inventory/ (stock on hand)
      sales/ (list, new, [id] detail)
      masters/ (SKU management)
      login/, register/
    components/LineItemsEditor.js   shared SKU/qty/rate line-item table
    context/AppContext.js           auth state (JWT in localStorage)
    lib/api.js                       backend API calls
```

## Notes

- `npm run build` (frontend) passes cleanly across all 15 routes, and all
  backend modules were require-tested without errors. I could not run this
  end-to-end against a live MongoDB instance in the sandbox that generated
  it, so do a first run-through yourself.
- Purchase order numbers, GRN numbers, and invoice numbers are generated as
  simple sequential IDs (`PO-000001`, etc.) based on document count — fine
  for a project, not meant for high concurrency.
- Deleting a SKU from Masters doesn't touch past POs/GRNs/invoices (they keep
  a snapshot of the SKU name at the time), but it will disappear from the
  Inventory list. Prefer disabling a SKU over deleting it if it has order
  history.
