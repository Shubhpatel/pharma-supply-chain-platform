const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Stock = require('./src/models/Stock');

// The original implementation
async function deductStockOriginal(items) {
  for (const item of items) {
    const matchingStocks = await Stock.find({
      sku: item.sku,
      batch: item.batch,
      expiryDate: new Date(item.expiryDate),
      mrp: item.mrp,
    }).sort({ expiryDate: 1, rate: 1, mrp: 1 });
    let remaining = item.qty;
    for (const stock of matchingStocks) {
      if (remaining <= 0) break;
      const consumed = Math.min(remaining, stock.qty);
      await Stock.findByIdAndUpdate(stock._id, { $inc: { qty: -consumed } });
      remaining -= consumed;
    }
  }
}

// The optimized implementation
async function deductStockOptimized(items) {
  for (const item of items) {
    const matchingStocks = await Stock.find({
      sku: item.sku,
      batch: item.batch,
      expiryDate: new Date(item.expiryDate),
      mrp: item.mrp,
    }).sort({ expiryDate: 1, rate: 1, mrp: 1 });

    let remaining = item.qty;
    const bulkOps = [];

    for (const stock of matchingStocks) {
      if (remaining <= 0) break;
      const consumed = Math.min(remaining, stock.qty);

      bulkOps.push({
        updateOne: {
          filter: { _id: stock._id },
          update: { $inc: { qty: -consumed } }
        }
      });

      remaining -= consumed;
    }

    if (bulkOps.length > 0) {
      await Stock.bulkWrite(bulkOps);
    }
  }
}

// Alternatively, optimized by combining across items (though logic above works perfectly on a per-item basis too)
async function deductStockOptimizedBatchAll(items) {
  const bulkOps = [];
  for (const item of items) {
    const matchingStocks = await Stock.find({
      sku: item.sku,
      batch: item.batch,
      expiryDate: new Date(item.expiryDate),
      mrp: item.mrp,
    }).sort({ expiryDate: 1, rate: 1, mrp: 1 });

    let remaining = item.qty;

    for (const stock of matchingStocks) {
      if (remaining <= 0) break;
      const consumed = Math.min(remaining, stock.qty);

      bulkOps.push({
        updateOne: {
          filter: { _id: stock._id },
          update: { $inc: { qty: -consumed } }
        }
      });

      remaining -= consumed;
    }
  }

  if (bulkOps.length > 0) {
    await Stock.bulkWrite(bulkOps);
  }
}

async function runBenchmark() {
  const mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);

  const numItems = 20;
  const numStocksPerItem = 100; // This creates the N+1 problem, item qty is huge, distributed across many small stocks

  const dummySkuId = new mongoose.Types.ObjectId();

  const setupData = async () => {
    await Stock.deleteMany({});
    const stocksToInsert = [];
    for (let i = 0; i < numItems; i++) {
      for (let j = 0; j < numStocksPerItem; j++) {
        stocksToInsert.push({
          sku: dummySkuId,
          batch: `BATCH-${i}`,
          expiryDate: new Date('2025-12-31'),
          mrp: 100,
          rate: 50 + j, // varying rate to satisfy uniqueness requirement
          qty: 1
        });
      }
    }
    await Stock.insertMany(stocksToInsert);
  };

  const generateItems = () => {
    const items = [];
    for (let i = 0; i < numItems; i++) {
      items.push({
        sku: dummySkuId,
        batch: `BATCH-${i}`,
        expiryDate: new Date('2025-12-31'),
        mrp: 100,
        qty: 100 // consumes 100 stocks per item
      });
    }
    return items;
  };

  console.log("Setting up baseline data...");
  await setupData();
  const items1 = generateItems();

  console.log("Running original...");
  const startOriginal = process.hrtime.bigint();
  await deductStockOriginal(items1);
  const endOriginal = process.hrtime.bigint();
  const timeOriginal = Number(endOriginal - startOriginal) / 1e6;
  console.log(`Original: ${timeOriginal.toFixed(2)} ms`);

  console.log("Setting up optimized data...");
  await setupData();
  const items2 = generateItems();

  console.log("Running optimized (batch per item)...");
  const startOptimized = process.hrtime.bigint();
  await deductStockOptimized(items2);
  const endOptimized = process.hrtime.bigint();
  const timeOptimized = Number(endOptimized - startOptimized) / 1e6;
  console.log(`Optimized (per item): ${timeOptimized.toFixed(2)} ms`);

  console.log("Setting up optimized data (all)...");
  await setupData();
  const items3 = generateItems();

  console.log("Running optimized (batch all)...");
  const startOptimizedAll = process.hrtime.bigint();
  await deductStockOptimizedBatchAll(items3);
  const endOptimizedAll = process.hrtime.bigint();
  const timeOptimizedAll = Number(endOptimizedAll - startOptimizedAll) / 1e6;
  console.log(`Optimized (all items combined): ${timeOptimizedAll.toFixed(2)} ms`);

  const improvement = ((timeOriginal - timeOptimizedAll) / timeOriginal * 100).toFixed(2);
  console.log(`\nImprovement: ${improvement}% faster`);

  await mongoose.disconnect();
  await mongoServer.stop();
}

runBenchmark().catch(console.error);
