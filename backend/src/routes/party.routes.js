const express = require("express");
const { requireAuth, requirePermission } = require("../middleware/auth");
const crypto = require("crypto");
const Party = require("../models/Party");
const { getPagination, paginationMeta } = require("../utils/pagination");

const router = express.Router();

router.get("/", requireAuth, requirePermission("masters", "po", "grn", "invoice", "sr", "pr"), async (req, res) => {
  try {
    const filter = req.query.type ? { partyType: req.query.type } : {};
    if (req.query.search) {
      const search = req.query.search.trim();
      if (search.length < 3) return res.json({ parties: [], pagination: paginationMeta(1, 20, 0) });
      if (search) {
        filter.$or = ["name", "uid", "gstNumber", "contactPerson", "phone", "city", "state"]
          .map((field) => ({ [field]: { $regex: search, $options: "i" } }));
      }
    }
    if (req.query.state) filter.state = { $regex: req.query.state.trim(), $options: "i" };
    if (req.query.city) filter.city = { $regex: req.query.city.trim(), $options: "i" };
    if (req.query.enabled !== undefined) filter.enabled = req.query.enabled === "true";
    const { page, limit, skip } = getPagination(req.query);
    const [parties, total] = await Promise.all([
      // ⚡ Bolt: Append .lean() to bypass document hydration for read-only endpoint
      Party.find(filter).sort({ name: 1 }).skip(skip).limit(limit).lean(),
      Party.countDocuments(filter),
    ]);
    await Promise.all(parties.filter((party) => !party.uid).map(async (party) => {
      party.uid = crypto.randomUUID();
      await Party.updateOne({ _id: party._id }, { $set: { uid: party.uid } });
    }));
    return res.json({ parties, pagination: paginationMeta(page, limit, total) });
  } catch (err) {
    console.error("Internal Server Error:", err.message);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", requireAuth, requirePermission("masters"), async (req, res) => {
  try {
    const payload = { ...req.body };
    delete payload.uid;
    delete payload._id;
    payload.name = typeof payload.name === "string" ? payload.name.trim() : payload.name;
    const duplicate = await Party.findOne({ partyType: payload.partyType, name: payload.name })
      .collation({ locale: "en", strength: 2 });
    if (duplicate) return res.status(409).json({ error: `A ${payload.partyType} with this name already exists` });
    const party = await Party.create({ ...payload, createdBy: req.user.id });
    return res.status(201).json({ party });
  } catch (err) {
    return res.status(err.code === 11000 ? 409 : 400).json({
      error: err.code === 11000 ? `A ${req.body.partyType} with this name already exists` : err.message,
    });
  }
});

router.put("/:id", requireAuth, requirePermission("masters"), async (req, res) => {
  try {
    const party = await Party.findById(req.params.id);
    if (!party) return res.status(404).json({ error: "Party not found" });
    const changes = { ...req.body };
    delete changes.uid;
    delete changes._id;
    if (changes.name !== undefined || changes.partyType !== undefined) {
      changes.name = changes.name === undefined ? party.name : changes.name.trim();
      changes.partyType = changes.partyType || party.partyType;
      const duplicate = await Party.findOne({
        partyType: changes.partyType,
        name: changes.name,
        _id: { $ne: party._id },
      }).collation({ locale: "en", strength: 2 });
      if (duplicate) return res.status(409).json({ error: `A ${changes.partyType} with this name already exists` });
    }
    Object.assign(party, changes);
    if (!party.uid) party.uid = crypto.randomUUID();
    await party.save();
    return res.json({ party });
  } catch (err) {
    return res.status(err.code === 11000 ? 409 : 400).json({
      error: err.code === 11000 ? `A ${req.body.partyType || "party"} with this name already exists` : err.message,
    });
  }
});

router.delete("/:id", requireAuth, requirePermission("masters"), async (req, res) => {
  try {
    const party = await Party.findByIdAndDelete(req.params.id);
    if (!party) return res.status(404).json({ error: "Party not found" });
    return res.json({ message: "Party deleted" });
  } catch (err) {
    console.error("Internal Server Error:", err.message);
    return res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
