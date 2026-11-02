const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const Stock = require("./src/models/Stock");
const Grn = require("./src/models/Grn");
const PurchaseOrder = require("./src/models/PurchaseOrder");
const Sku = require("./src/models/Sku");
const Party = require("./src/models/Party");

async function run() {
  const mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);

  // create some dummy items
  const items = [];
  for (let i = 0; i < 50; i++) {
    items.push({
      sku: new mongoose.Types.ObjectId(),
      skuName: "Item " + i,
      qtyOrdered: 10,
      qtyReceived: 10,
      batch: "B" + i,
      expiryDate: new Date(),
      mrp: 100,
      rate: 90,
      amount: 900
    });
  }

  const grn = { items };

  const startNPlusOne = process.hrtime.bigint();
  for (const item of grn.items) {
    await Stock.findOneAndUpdate(
      { sku: item.sku, batch: item.batch, expiryDate: item.expiryDate, mrp: item.mrp, rate: item.rate },
      { $inc: { qty: item.qtyReceived } },
      { upsert: true }
    );
  }
  const endNPlusOne = process.hrtime.bigint();

  await Stock.deleteMany({});

  const startBulk = process.hrtime.bigint();
  const bulkOps = grn.items.map(item => ({
    updateOne: {
      filter: { sku: item.sku, batch: item.batch, expiryDate: item.expiryDate, mrp: item.mrp, rate: item.rate },
      update: { $inc: { qty: item.qtyReceived } },
      upsert: true
    }
  }));
  await Stock.bulkWrite(bulkOps);
  const endBulk = process.hrtime.bigint();

  console.log(`N+1 Query took: ${Number(endNPlusOne - startNPlusOne) / 1000000} ms`);
  console.log(`Bulk Write took: ${Number(endBulk - startBulk) / 1000000} ms`);

  await mongoose.disconnect();
  await mongoServer.stop();
}

run().catch(console.error);
