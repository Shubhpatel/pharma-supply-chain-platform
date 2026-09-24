// Generates simple sequential document numbers like PO-000001, GRN-000001, INV-000001,
// based on how many documents of that type already exist. Fine for a project-scale app;
// for high concurrency you'd want an atomic counter document instead.
async function nextNumber(Model, field, prefix) {
  const count = await Model.countDocuments();
  const next = count + 1;
  return `${prefix}-${String(next).padStart(6, "0")}`;
}

module.exports = { nextNumber };
