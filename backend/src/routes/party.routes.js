const express = require("express");
const { requireAuth } = require("../middleware/auth");
const Party = require("../models/Party");

const router = express.Router();

router.get("/", requireAuth, async (req, res) => {
  try {
    const filter = req.query.type ? { partyType: req.query.type } : {};
    const parties = await Party.find(filter).sort({ name: 1 });
    return res.json({ parties });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post("/", requireAuth, async (req, res) => {
  try {
    const party = await Party.create({ ...req.body, createdBy: req.user.id });
    return res.status(201).json({ party });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

router.put("/:id", requireAuth, async (req, res) => {
  try {
    const party = await Party.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!party) return res.status(404).json({ error: "Party not found" });
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
