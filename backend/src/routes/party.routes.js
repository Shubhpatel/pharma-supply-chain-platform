const express = require("express");
const { requireAuth } = require("../middleware/auth");
const Party = require("../models/Party");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const filter = req.query.type ? { partyType: req.query.type } : {};
    const parties = await Party.find(filter).sort({ name: 1 });
    return res.json({ parties });
  } catch (err) {
    console.error("Server Error:", err); return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", requireAuth, async (req, res) => {
  try {
    const party = await Party.create({ ...req.body, createdBy: req.user.id });
    return res.status(201).json({ party });
  } catch (err) {
    console.error("Bad Request Error:", err); return res.status(400).json({ error: "Bad request" });
  }
});

router.put("/:id", requireAuth, async (req, res) => {
  try {
    const party = await Party.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!party) return res.status(404).json({ error: "Party not found" });
    return res.json({ party });
  } catch (err) {
    console.error("Bad Request Error:", err); return res.status(400).json({ error: "Bad request" });
  }
});

router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const party = await Party.findByIdAndDelete(req.params.id);
    if (!party) return res.status(404).json({ error: "Party not found" });
    return res.json({ message: "Party deleted" });
  } catch (err) {
    console.error("Server Error:", err); return res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
