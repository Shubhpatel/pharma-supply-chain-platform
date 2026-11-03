const mongoose = require("mongoose");
const logger = require("../utils/logger");

async function connectDB() {
  const uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/pharma-inventory";
  try {
    await mongoose.connect(uri);
    logger.info("MongoDB connected:", uri);
  } catch (err) {
    logger.error("MongoDB connection error:", err.message);
    process.exit(1);
  }
}

module.exports = connectDB;
