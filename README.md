# Pharma Inventory Management System

A simplified, single-role pharma inventory system covering:

- **Purchase** — create purchase orders (SKU, qty, rate, payment term, delivery date), view full detail
- **GRN** — receive goods against a purchase order, updates stock and the PO's status
- **Inventory** — live stock on hand per SKU
- **Sales** — create invoices, which deduct from stock
- **Masters** — add/edit SKUs; only **enabled** SKUs appear in the Purchase/Sales product dropdowns
- **Pharma Buddy AI Assistant** — read-only operations chatbot with structured proposal drafts and explicit approval workflows

There's just one type of account — anyone who registers can use every module.
No admin/supplier/customer split.

## Stack

- **Backend:** Node.js + Express + MongoDB (Mongoose) — `/backend`
- **Frontend:** Next.js (React) + Tailwind — `/frontend`

## Prerequisites

- Node.js 18+ and npm
- MongoDB — running locally, or a free MongoDB Atlas cluster

## AI Assistant ("Pharma Buddy") Architecture & Safety Rules

"Pharma Buddy" is an operations chatbot designed with strict safety boundaries:
- **Read-Only by Default:** Querying database context or analyzing trends/reports does not modify MongoDB records.
- **Structured Action Drafts:** When write operations (e.g. creating a Purchase Order or Sales Invoice) are requested in natural language, the assistant produces a structured action draft with `status: pending`.
- **Explicit Approval & Execution Workflow:** Drafts must be explicitly reviewed, approved (`POST /api/assistant/drafts/:draftId/approve`), and executed (`POST /api/assistant/drafts/:draftId/execute`).
- **Idempotency & Audit Logging:** Executing a draft records approval/execution metadata and creates an audit log entry (`AssistantAuditLog`). Re-executing an already executed draft is idempotent.
- **Backend Authorization Enforcement:** Authorization and draft validation are strictly enforced on backend routes using JWT authentication.

### Supported Intent Categories
- `database_question`
- `report_analysis`
- `navigation`
- `create_draft`
- `update_draft`
- `approve_draft`
- `reject_draft`
- `execute_draft`
- `clarification_required`
- `unsupported_request`

### Assistant API Endpoints
- `POST /api/assistant/chat` — Safe query analysis & draft proposal generation (read-only)
- `POST /api/assistant/drafts` — Store proposed action draft
- `GET /api/assistant/drafts` — List user's action drafts
- `GET /api/assistant/drafts/:draftId` — Fetch single draft
- `POST /api/assistant/drafts/:draftId/approve` — Approve a pending draft
- `POST /api/assistant/drafts/:draftId/reject` — Reject a draft
- `POST /api/assistant/drafts/:draftId/execute` — Execute an approved draft using business logic

### Environment Variables for AI
- `GEMINI_API_KEY` (Optional): API key for Gemini LLM generation. If not configured, fallback database query analysis is used.
- `GEMINI_MODEL` (Optional): AI model identifier (defaults to `gemini-3.5-flash-lite`).

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

To add repeatable bulk data for manually testing the complete workflow
(using existing enabled SKU, vendor, and customer masters), run:
```bash
npm run seed:test
```
The command reads the first 3 enabled SKUs and the first enabled vendor and
customer from Masters. It does not create, delete, or modify master records.
It creates dated transactional records for six purchase orders and GRNs,
inventory lots, four confirmed sales invoices, one credit note, one debit
note, and the existing draft examples. Records use `TEST-` identifiers and
are created only when missing, so the command is safe to run more than once.
At least 2 enabled SKUs, one vendor, and one customer must exist.
The test login defaults to `test@pharma.local` / `test123`; set
`TEST_SEED_EMAIL` and `TEST_SEED_PASSWORD` in `.env` to override them.

Start the backend:
```bash
npm run dev
```
Runs on `http://localhost:5000`. Check `http://localhost:5000/api/health`.

### Testing Backend
```bash
cd backend
npx jest assistant.test.js bulkUploadMock.test.js
```

## 2. Frontend setup

```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```
Runs on `http://localhost:3000`.

### Testing / Building Frontend
```bash
cd frontend
npm run build
npm run lint
```

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
    models/AssistantDraft.js    Structured action draft schema
    models/AssistantAuditLog.js Audit log schema
    routes/auth.routes.js       register / login
    routes/sku.routes.js         Masters CRUD + enable/disable toggle
    routes/purchaseOrder.routes.js
    routes/grn.routes.js         creating a GRN updates Stock + PO status
    routes/inventory.routes.js  read-only stock-on-hand view
    routes/sales.routes.js       creating an invoice deducts Stock
    routes/assistant.routes.js  Pharma Buddy chat & draft approval/execution routes
    utils/assistantHelpers.js   Controlled query context & payload validators
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
    components/PlatformChatbot.js   Pharma Buddy floating chatbot UI
    context/AppContext.js           auth state (JWT in localStorage)
    lib/api.js                       backend API calls
```
