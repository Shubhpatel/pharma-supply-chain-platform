require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const Stock = require("./models/Stock");
const SkuLocation = require("./models/SkuLocation");

const authRoutes = require("./routes/auth.routes");
const userRoutes = require("./routes/user.routes");
const skuRoutes = require("./routes/sku.routes");
const skuLocationRoutes = require("./routes/skuLocation.routes");
const purchaseOrderRoutes = require("./routes/purchaseOrder.routes");
const grnRoutes = require("./routes/grn.routes");
const inventoryRoutes = require("./routes/inventory.routes");
const salesRoutes = require("./routes/sales.routes");
const partyRoutes = require("./routes/party.routes");
const debitNoteRoutes = require("./routes/debitNote.routes");
const creditNoteRoutes = require("./routes/creditNote.routes");
const reportsRoutes = require("./routes/reports.routes");
const bulkUploadRoutes = require("./routes/bulkUpload.routes");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/skus", skuRoutes);
app.use("/api/sku-locations", skuLocationRoutes);
app.use("/api/purchase-orders", purchaseOrderRoutes);
app.use("/api/grn", grnRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/sales", salesRoutes);
app.use("/api/parties", partyRoutes);
app.use("/api/debit-notes", debitNoteRoutes);
app.use("/api/credit-notes", creditNoteRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/bulk-uploads", bulkUploadRoutes);

app.use((req, res) => res.status(404).json({ error: "Not found" }));

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  Promise.all([Stock.syncIndexes(), SkuLocation.syncIndexes()])
    .then(() => app.listen(PORT, () => console.log(`Backend listening on http://localhost:${PORT}`)))
    .catch((err) => {
      console.error("Index synchronization error:", err.message);
      process.exit(1);
    });
});
