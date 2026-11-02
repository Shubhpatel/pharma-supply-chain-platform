const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const AssistantDraft = require('./src/models/AssistantDraft');

async function runBenchmark() {
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri);

  const userId = new mongoose.Types.ObjectId();
  const now = new Date();
  const past = new Date(now.getTime() - 10000);

  const draftsToInsert = Array.from({ length: 50 }, (_, i) => ({
    draftId: `test-draft-${i}-${Date.now()}`,
    user: userId,
    actionType: "create_purchase_order",
    summary: "test",
    proposedPayload: { amount: 100 },
    status: "pending",
    expiresAt: past
  }));

  await AssistantDraft.insertMany(draftsToInsert);

  let drafts = await AssistantDraft.find({ user: userId }).sort({ createdAt: -1 }).limit(50);
  const start = process.hrtime.bigint();
  for (const draft of drafts) {
    if (draft.status === "pending" && draft.expiresAt < now) {
      draft.status = "expired";
      await draft.save();
    }
  }
  const end = process.hrtime.bigint();
  const baselineMs = Number(end - start) / 1000000;
  console.log(`N+1 Save Time: ${baselineMs.toFixed(2)}ms`);

  await AssistantDraft.deleteMany({ user: userId });
  await AssistantDraft.insertMany(draftsToInsert);

  drafts = await AssistantDraft.find({ user: userId }).sort({ createdAt: -1 }).limit(50);
  const start2 = process.hrtime.bigint();
  const draftIdsToUpdate = drafts
    .filter(draft => draft.status === "pending" && draft.expiresAt < now)
    .map(draft => draft._id);

  if (draftIdsToUpdate.length > 0) {
    await AssistantDraft.updateMany(
      { _id: { $in: draftIdsToUpdate } },
      { $set: { status: "expired" } }
    );
  }
  const end2 = process.hrtime.bigint();
  const bulkMs = Number(end2 - start2) / 1000000;
  console.log(`Bulk Update Time: ${bulkMs.toFixed(2)}ms`);
  console.log(`Improvement: ${((baselineMs - bulkMs) / baselineMs * 100).toFixed(2)}% faster`);

  await mongoose.disconnect();
  await mongod.stop();
  process.exit(0);
}

runBenchmark().catch(err => { console.error(err); process.exit(1); });
