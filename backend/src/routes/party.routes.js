const express = require("express");
const crypto = require("crypto");
const { requireAuth } = require("../middleware/auth");
const Party = require("../models/Party");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const filter = req.query.type ? { partyType: req.query.type } : {};
    const parties = await Party.find(filter).sort({ name: 1 });
    await Promise.all(parties.filter((party) => !party.uid).map(async (party) => {
      party.uid = crypto.randomUUID();
      await party.save();
    }));
    return res.json({ parties });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post("/", requireAuth, async (req, res) => {
  try {
    const payload = { ...req.body };
    delete payload.uid;
    delete payload._id;
    const party = await Party.create({ ...payload, createdBy: req.user.id });
    return res.status(201).json({ party });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

router.put("/:id", requireAuth, async (req, res) => {
  try {
    const party = await Party.findById(req.params.id);
    if (!party) return res.status(404).json({ error: "Party not found" });
    const changes = { ...req.body };
    delete changes.uid;
    delete changes._id;
    Object.assign(party, changes);
    if (!party.uid) party.uid = crypto.randomUUID();
    await party.save();
    return res.json({ party });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const party = await Party.findByIdAndDelete(req.params.id);
    if (!party) return res.status(404).json({ error: "Party not found" });
    return res.json({ message: "Party deleted" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
