const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const SaleInvoice = require('./src/models/SaleInvoice');
const Stock = require('./src/models/Stock');
const Party = require('./src/models/Party');
const express = require('express');
const app = express();
app.use(express.json());

// Mock requireAuth and requirePermission middlewares by redefining them before requiring sales.routes
const authModule = require('./src/middleware/auth');
authModule.requireAuth = (req, res, next) => {
  req.user = { id: new mongoose.Types.ObjectId(), role: 'ADMIN' };
  next();
};
authModule.requirePermission = () => (req, res, next) => next();

const salesRoutes = require('./src/routes/sales.routes');
app.use('/api/sales', salesRoutes);

const request = require('supertest');

async function run() {
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri);

  // Clean db
  await SaleInvoice.deleteMany({});
  await Stock.deleteMany({});
  await Party.deleteMany({});

  // Create a customer
  const customer = await Party.create({
    name: 'Test Customer',
    partyType: 'customer',
    email: 'test@example.com',
    phone: '1234567890'
  });

  // Create N items
  const N = 500; // 500 items to show N+1 clearly
  const items = [];
  for(let i=0; i<N; i++) {
    items.push({
      sku: new mongoose.Types.ObjectId(),
      skuName: `Item ${i}`,
      batch: `B${i}`,
      expiryDate: new Date('2025-12-31'),
      qty: 1,
      mrp: 100,
      rate: 90,
      amount: 90,
      gstRate: 10,
      gstAmount: 9
    });

    // create stock
    await Stock.create({
      sku: items[i].sku,
      batch: items[i].batch,
      expiryDate: items[i].expiryDate,
      qty: 10,
      mrp: 100,
      rate: 90,
      location: 'A1'
    });
  }

  // Create draft invoice
  const invoice = await SaleInvoice.create({
    invoiceNumber: 'INV001',
    customer: customer._id,
    customerName: customer.name,
    saleDate: new Date(),
    items: items,
    totalQty: N,
    totalAmount: N * 90,
    gstRate: 0,
    gstAmount: N * 9,
    grandTotal: N * 99,
    status: 'draft',
    createdBy: new mongoose.Types.ObjectId()
  });

  const start = performance.now();
  const res = await request(app)
    .patch(`/api/sales/${invoice._id}/confirm`);
  const end = performance.now();

  console.log(`Time taken: ${(end - start).toFixed(2)} ms`);
  console.log('Response:', res.status, res.body.error);

  await mongoose.disconnect();
  await mongod.stop();
  process.exit(0);
}

run().catch(console.error);
