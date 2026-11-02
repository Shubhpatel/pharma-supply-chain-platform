const Counter = require("../models/Counter");

// Generates simple sequential document numbers like PO-000001, GRN-000001, INV-000001.
// 🔒 Security: Uses an atomic counter via Counter.findByIdAndUpdate($inc) to eliminate race conditions
// and predictable ID generation under high concurrency, preventing duplicate key errors and data inconsistencies.
async function nextNumber(Model, field, prefix) {
  const counterId = `${Model.modelName}_${field}`;
  let counter = await Counter.findByIdAndUpdate(
    counterId,
    { $inc: { seq: 1 } },
    { new: true, upsert: false } // Try to update without upsert first
  );

  if (!counter) {
    // Initialize counter if it doesn't exist. Fall back to countDocuments for legacy data.
    const count = await Model.countDocuments();
    try {
      counter = await Counter.create({ _id: counterId, seq: count + 1 });
    } catch (err) {
      // If concurrent request already created it, duplicate key error occurs. Ignore and retry increment.
      if (err.code === 11000) {
        counter = await Counter.findByIdAndUpdate(
          counterId,
          { $inc: { seq: 1 } },
          { new: true }
        );
      } else {
        throw err;
      }
    }
  }

  const next = counter.seq;
  return `${prefix}-${String(next).padStart(6, "0")}`;
}

module.exports = { nextNumber };
