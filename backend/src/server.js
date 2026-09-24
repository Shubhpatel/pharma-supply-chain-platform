require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const Stock = require("./models/Stock");

const authRoutes = require("./routes/auth.routes");
const skuRoutes = require("./routes/sku.routes");
const purchaseOrderRoutes = require("./routes/purchaseOrder.routes");
const grnRoutes = require("./routes/grn.routes");
const inventoryRoutes = require("./routes/inventory.routes");
const salesRoutes = require("./routes/sales.routes");
const partyRoutes = require("./routes/party.routes");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

app.use("/api/auth", authRoutes);
app.use("/api/skus", skuRoutes);
app.use("/api/purchase-orders", purchaseOrderRoutes);
app.use("/api/grn", grnRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/sales", salesRoutes);
app.use("/api/parties", partyRoutes);

app.use((req, res) => res.status(404).json({ error: "Not found" }));

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  Stock.syncIndexes()
    .then(() => app.listen(PORT, () => console.log(`Backend listening on http://localhost:${PORT}`)))
    .catch((err) => {
      console.error("Stock index synchronization error:", err.message);
      process.exit(1);
    });
});
