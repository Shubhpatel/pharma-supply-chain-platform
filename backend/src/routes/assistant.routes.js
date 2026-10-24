const express = require("express");
const crypto = require("crypto");
const { requireAuth } = require("../middleware/auth");
const AssistantDraft = require("../models/AssistantDraft");
const AssistantAuditLog = require("../models/AssistantAuditLog");
const AssistantChatMessage = require("../models/AssistantChatMessage");
const PurchaseOrder = require("../models/PurchaseOrder");
const SaleInvoice = require("../models/SaleInvoice");
const Grn = require("../models/Grn");
const DebitNote = require("../models/DebitNote");
const CreditNote = require("../models/CreditNote");
const Sku = require("../models/Sku");
const Party = require("../models/Party");
const { nextNumber } = require("../utils/idGenerator");
const {
  sanitizePromptText,
  loadControlledDatabaseContext,
  classifyIntent,
  validateActionPayload,
} = require("../utils/assistantHelpers");

const router = express.Router();

async function saveChatMessage(userId, role, text, source) {
  return AssistantChatMessage.create({ user: userId, role, text, source });
}

// GET /api/assistant/history - Return the current user's saved chat history
router.get("/history", requireAuth, async (req, res) => {
  try {
    const messages = await AssistantChatMessage.find({ user: req.user.id })
      .sort({ createdAt: 1 })
      .limit(200)
      .lean();
    return res.json({
      messages: messages.map((message) => ({
        id: message._id,
        from: message.role,
        text: message.text,
        source: message.source,
        createdAt: message.createdAt,
      })),
    });
  } catch (err) {
    console.error("Assistant history error:", err.message);
    return res.status(500).json({ error: "Unable to load assistant history." });
  }
});

// POST /api/assistant/history - Save client-side assistant events such as navigation and draft status
router.post("/history", requireAuth, async (req, res) => {
  const { role, text, source } = req.body || {};
  if (!["user", "assistant"].includes(role) || typeof text !== "string" || !text.trim()) {
    return res.status(400).json({ error: "role and a non-empty text are required" });
  }

  try {
    const message = await saveChatMessage(req.user.id, role, text.trim(), source || "Database analysis");
    return res.status(201).json({
      message: {
        id: message._id,
        from: message.role,
        text: message.text,
        source: message.source,
        createdAt: message.createdAt,
      },
    });
  } catch (err) {
    console.error("Assistant history save error:", err.message);
    return res.status(500).json({ error: "Unable to save assistant history." });
  }
});

function getSafeNavigation(question) {
  const text = question.toLowerCase();
  if (text.includes("slow-moving") || text.includes("slow moving")) return { path: "/reports?tab=slow-moving" };
  if (text.includes("expired") || text.includes("expiry")) return { path: "/reports?tab=near-expired" };
  if (text.includes("inventory") || text.includes("stock")) return { path: "/inventory" };
  if (text.includes("sales report")) return { path: "/reports?tab=sales" };
  if (text.includes("purchase order") || text.includes("new po")) return { path: "/purchase/new" };
  if (text.includes("sales invoice") || text.includes("new invoice")) return { path: "/sales/new" };
  if (text.includes("grn") || text.includes("goods receipt")) return { path: "/grn/new" };
  return null;
}

// POST /api/assistant/chat - Read-only chat analysis and proposal generator
router.post("/chat", requireAuth, async (req, res) => {
  const rawQuestion = typeof req.body?.message === "string" ? req.body.message.trim() : "";
  if (!rawQuestion) return res.status(400).json({ error: "A message is required" });

  const question = sanitizePromptText(rawQuestion);

  try {
    await saveChatMessage(req.user.id, "user", question, "User message");
    const context = await loadControlledDatabaseContext();
    const intent = classifyIntent(question);
    const navigation = getSafeNavigation(question);

    let actionDraft = null;
    let replyText = "";

    // Record audit log for chat query
    await AssistantAuditLog.create({
      user: req.user.id,
      action: "chat_query",
      details: { question },
    }).catch(() => {});

    // Check if prompt injection is suspected (e.g. system override instructions in text)
    if (/ignore (all )?previous instructions|system prompt|admin mode/i.test(question)) {
      const response = {
        reply: "I am Pharma Buddy, a read-only operations assistant. I cannot modify prompt rules or run unauthorized database operations.",
        intent: "unsupported_request",
        source: "rule_engine",
        data: [],
        actionDraft: null,
        navigation: null,
      };
      await saveChatMessage(req.user.id, "assistant", response.reply, "Database analysis");
      return res.json(response);
    }

    // Auto-draft generation if user specifically asked to create/prepare a transaction
    if (intent === "create_draft") {
      const isPO = /purchase|po|replenish/i.test(question);
      const isInvoice = /sales|invoice|sale/i.test(question);

      if (isPO) {
        const vendor = context.vendors[0];
        const lowStock = context.lowStockItems;
        const items = lowStock.length > 0
          ? lowStock.map((ls) => {
              const matchedSku = context.skus.find((s) => s.code === ls.skuCode);
              return {
                sku: matchedSku?.id || "",
                skuName: ls.skuName,
                qty: Math.max(10, (ls.reorderLevel - ls.currentQty) + 10),
                rate: matchedSku?.mrp ? Math.round(matchedSku.mrp * 0.7) : 100,
                gstRate: 0,
              };
            }).filter((i) => i.sku)
          : context.skus.slice(0, 2).map((s) => ({
              sku: s.id,
              skuName: s.name,
              qty: 10,
              rate: s.mrp ? Math.round(s.mrp * 0.7) : 100,
              gstRate: 0,
            }));

        if (vendor && items.length > 0) {
          const draftId = `draft_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
          const proposedPayload = {
            supplierId: vendor.id,
            supplierName: vendor.name,
            orderDate: new Date().toISOString().slice(0, 10),
            paymentTerm: "30 days",
            expectedDeliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
            items,
          };

          const validation = validateActionPayload("create_purchase_order", proposedPayload);

          const draftDoc = await AssistantDraft.create({
            draftId,
            user: req.user.id,
            actionType: "create_purchase_order",
            summary: `Purchase Order draft for ${vendor.name} (${items.length} item(s))`,
            reason: lowStock.length > 0 ? "Replenishment for low-stock items" : "User request to prepare purchase order",
            affectedEntities: items.map((i) => ({ entityType: "SKU", entityId: i.sku, name: i.skuName })),
            proposedPayload,
            validationWarnings: validation.warnings,
            estimatedImpact: `Estimated total quantity: ${items.reduce((s, i) => s + i.qty, 0)} units`,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            status: "pending",
          });

          await AssistantAuditLog.create({
            user: req.user.id,
            action: "draft_created",
            draftId: draftDoc.draftId,
            actionType: draftDoc.actionType,
            affectedRecords: draftDoc.affectedEntities,
            details: { summary: draftDoc.summary },
          });

          actionDraft = {
            draftId: draftDoc.draftId,
            actionType: draftDoc.actionType,
            summary: draftDoc.summary,
            reason: draftDoc.reason,
            affectedEntities: draftDoc.affectedEntities,
            proposedPayload: draftDoc.proposedPayload,
            warnings: draftDoc.validationWarnings,
            estimatedImpact: draftDoc.estimatedImpact,
            requiresApproval: true,
            status: draftDoc.status,
          };

          replyText = `I have generated a Purchase Order draft for vendor ${vendor.name} with ${items.length} item(s). Please review the draft details and click Approve and Execute when ready.`;
        } else {
          replyText = "Could not automatically prepare a purchase order draft because valid vendors or active SKUs are missing in the database.";
        }
      } else if (isInvoice) {
        const customer = context.customers[0];
        const stockItems = context.stockOnHand.slice(0, 2);
        const items = stockItems.map((st) => {
          const matchedSku = context.skus.find((s) => s.code === st.code);
          return {
            sku: matchedSku?.id || "",
            skuName: st.name,
            batch: "BATCH-001",
            expiryDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
            mrp: matchedSku?.mrp || 100,
            qty: Math.min(st.totalQty, 5),
            rate: matchedSku?.mrp || 100,
            gstRate: 0,
          };
        }).filter((i) => i.sku && i.qty > 0);

        if (customer && items.length > 0) {
          const draftId = `draft_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
          const proposedPayload = {
            customerId: customer.id,
            customerName: customer.name,
            saleDate: new Date().toISOString().slice(0, 10),
            items,
          };

          const validation = validateActionPayload("create_sales_invoice", proposedPayload);

          const draftDoc = await AssistantDraft.create({
            draftId,
            user: req.user.id,
            actionType: "create_sales_invoice",
            summary: `Sales Invoice draft for ${customer.name} (${items.length} item(s))`,
            reason: "User request to prepare sales invoice",
            affectedEntities: items.map((i) => ({ entityType: "SKU", entityId: i.sku, name: i.skuName })),
            proposedPayload,
            validationWarnings: validation.warnings,
            estimatedImpact: `Estimated total quantity: ${items.reduce((s, i) => s + i.qty, 0)} units`,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            status: "pending",
          });

          await AssistantAuditLog.create({
            user: req.user.id,
            action: "draft_created",
            draftId: draftDoc.draftId,
            actionType: draftDoc.actionType,
            affectedRecords: draftDoc.affectedEntities,
            details: { summary: draftDoc.summary },
          });

          actionDraft = {
            draftId: draftDoc.draftId,
            actionType: draftDoc.actionType,
            summary: draftDoc.summary,
            reason: draftDoc.reason,
            affectedEntities: draftDoc.affectedEntities,
            proposedPayload: draftDoc.proposedPayload,
            warnings: draftDoc.validationWarnings,
            estimatedImpact: draftDoc.estimatedImpact,
            requiresApproval: true,
            status: draftDoc.status,
          };

          replyText = `I have generated a Sales Invoice draft for customer ${customer.name} with ${items.length} item(s). Please review and approve the draft before execution.`;
        } else {
          replyText = "Could not automatically prepare a sales invoice draft because valid customers or available stock items are missing.";
        }
      }
    }

    // Call Gemini AI model if available and no draft was generated
    if (!replyText && process.env.GEMINI_API_KEY) {
      const model = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
      const prompt = [
        "You are Pharma Buddy, an operations assistant for a pharmaceutical platform.",
        "Answer questions strictly based on the database context provided. Never invent SKUs, stock levels, dates, quantities, prices, or transaction IDs.",
        "If data is limited or absent, state it clearly.",
        "Provide direct answers with numbers, stock counts, and bullet points where helpful.",
        `User question: ${question}`,
        `Database context: ${JSON.stringify(context)}`,
      ].join("\n\n");

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.2, maxOutputTokens: 900 } }),
            signal: controller.signal,
          }
        );
        const result = await response.json().catch(() => ({}));
        replyText = result.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("").trim();
      } catch (e) {
        console.error("Gemini AI error:", e.message);
      } finally {
        clearTimeout(timeout);
      }
    }

    // Standard Fallback Answer Generation
    if (!replyText) {
      if (question.toLowerCase().includes("low-stock") || question.toLowerCase().includes("low stock")) {
        const items = context.lowStockItems;
        replyText = items.length > 0
          ? `Found ${items.length} low-stock item(s):\n` + items.map((i) => `• ${i.skuName} (${i.skuCode}): ${i.currentQty} on hand (Reorder level: ${i.reorderLevel})`).join("\n")
          : "There are currently no products below their minimum reorder level.";
      } else if (question.toLowerCase().includes("expiry") || question.toLowerCase().includes("expired")) {
        replyText = `Expiry Analysis:\n• Near expiry (next 30 days): ${context.nearExpiryCount} record(s)\n• Already expired: ${context.expiredCount} record(s)`;
      } else if (question.toLowerCase().includes("sales")) {
        replyText = `Recent Sales Summary:\n• Total recent invoices loaded: ${context.recentSalesSummary.length}\n• Pending/Draft invoices: ${context.recentSalesSummary.filter((s) => s.status === "draft").length}`;
      } else {
        replyText = `I analyzed the database context. Current active SKUs: ${context.skus.length}, Vendors: ${context.vendors.length}, Customers: ${context.customers.length}.`;
      }
    }

    const response = {
      reply: replyText,
      intent,
      source: process.env.GEMINI_API_KEY ? "gemini" : "database_analysis",
      data: context.lowStockItems,
      actionDraft,
      navigation,
    };
    await saveChatMessage(req.user.id, "assistant", response.reply, response.source === "gemini" ? "AI analysis" : "Database analysis");
    return res.json(response);
  } catch (err) {
    console.error("Assistant error:", err.message);
    return res.status(500).json({ error: "The assistant encountered an error processing your request." });
  }
});

// POST /api/assistant/drafts - Save proposed draft
router.post("/drafts", requireAuth, async (req, res) => {
  try {
    const { actionType, summary, reason, affectedEntities, proposedPayload, estimatedImpact } = req.body;
    if (!actionType || !summary || !proposedPayload) {
      return res.status(400).json({ error: "actionType, summary, and proposedPayload are required" });
    }

    const validation = validateActionPayload(actionType, proposedPayload);
    if (!validation.isValid) {
      return res.status(400).json({ error: "Invalid action payload", details: validation.errors });
    }

    const draftId = `draft_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
    const draft = await AssistantDraft.create({
      draftId,
      user: req.user.id,
      actionType,
      summary,
      reason: reason || "",
      affectedEntities: affectedEntities || [],
      proposedPayload,
      validationWarnings: validation.warnings,
      estimatedImpact: estimatedImpact || "",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      status: "pending",
    });

    await AssistantAuditLog.create({
      user: req.user.id,
      action: "draft_created",
      draftId: draft.draftId,
      actionType: draft.actionType,
      affectedRecords: draft.affectedEntities,
      details: { summary: draft.summary },
    });

    return res.status(201).json({ draft });
  } catch (err) {
    return res.status(500).json({ error: "Could not create action draft" });
  }
});

// GET /api/assistant/drafts - List drafts for user
router.get("/drafts", requireAuth, async (req, res) => {
  try {
    const drafts = await AssistantDraft.find({ user: req.user.id }).sort({ createdAt: -1 }).limit(50);
    const now = new Date();
    // Update expired drafts
    for (const draft of drafts) {
      if (draft.status === "pending" && draft.expiresAt < now) {
        draft.status = "expired";
        await draft.save();
      }
    }
    return res.json({ drafts });
  } catch (err) {
    return res.status(500).json({ error: "Could not retrieve drafts" });
  }
});

// GET /api/assistant/drafts/:draftId - Get single draft
router.get("/drafts/:draftId", requireAuth, async (req, res) => {
  try {
    const draft = await AssistantDraft.findOne({ draftId: req.params.draftId });
    if (!draft) return res.status(404).json({ error: "Draft not found" });
    if (String(draft.user) !== req.user.id) return res.status(403).json({ error: "Unauthorized access to draft" });
    return res.json({ draft });
  } catch (err) {
    return res.status(500).json({ error: "Could not retrieve draft" });
  }
});

// POST /api/assistant/drafts/:draftId/approve - Explicit approval step
router.post("/drafts/:draftId/approve", requireAuth, async (req, res) => {
  try {
    const draft = await AssistantDraft.findOne({ draftId: req.params.draftId });
    if (!draft) return res.status(404).json({ error: "Draft not found" });
    if (String(draft.user) !== req.user.id) return res.status(403).json({ error: "Unauthorized access to draft" });

    if (draft.status !== "pending") {
      return res.status(400).json({ error: `Cannot approve draft in ${draft.status} status` });
    }
    if (draft.expiresAt < new Date()) {
      draft.status = "expired";
      await draft.save();
      return res.status(400).json({ error: "Draft has expired" });
    }

    draft.status = "approved";
    draft.approvalMetadata = {
      approvedAt: new Date(),
      approvedBy: req.user.id,
    };
    await draft.save();

    await AssistantAuditLog.create({
      user: req.user.id,
      action: "draft_approved",
      draftId: draft.draftId,
      actionType: draft.actionType,
      affectedRecords: draft.affectedEntities,
      details: { summary: draft.summary },
    });

    return res.json({ message: "Draft approved successfully", draft });
  } catch (err) {
    return res.status(500).json({ error: "Could not approve draft" });
  }
});

// POST /api/assistant/drafts/:draftId/reject - Explicit rejection step
router.post("/drafts/:draftId/reject", requireAuth, async (req, res) => {
  try {
    const draft = await AssistantDraft.findOne({ draftId: req.params.draftId });
    if (!draft) return res.status(404).json({ error: "Draft not found" });
    if (String(draft.user) !== req.user.id) return res.status(403).json({ error: "Unauthorized access to draft" });

    draft.status = "rejected";
    await draft.save();

    await AssistantAuditLog.create({
      user: req.user.id,
      action: "draft_rejected",
      draftId: draft.draftId,
      actionType: draft.actionType,
      affectedRecords: draft.affectedEntities,
      details: { summary: draft.summary },
    });

    return res.json({ message: "Draft rejected", draft });
  } catch (err) {
    return res.status(500).json({ error: "Could not reject draft" });
  }
});

// POST /api/assistant/drafts/:draftId/execute - Execution step (only approved drafts)
router.post("/drafts/:draftId/execute", requireAuth, async (req, res) => {
  try {
    const draft = await AssistantDraft.findOne({ draftId: req.params.draftId });
    if (!draft) return res.status(404).json({ error: "Draft not found" });
    if (String(draft.user) !== req.user.id) return res.status(403).json({ error: "Unauthorized access to draft" });

    // Idempotency check: if already executed, return result directly
    if (draft.status === "executed") {
      return res.json({ message: "Draft has already been executed", draft, executed: true });
    }

    if (draft.status !== "approved") {
      return res.status(400).json({ error: `Cannot execute draft in '${draft.status}' status. Draft must be approved first.` });
    }

    if (draft.expiresAt < new Date()) {
      draft.status = "expired";
      await draft.save();
      return res.status(400).json({ error: "Draft has expired and cannot be executed" });
    }

    let requiredPermission = null;
    if (draft.actionType === "create_purchase_order") {
      requiredPermission = "po";
    } else if (draft.actionType === "create_sales_invoice") {
      requiredPermission = "invoice";
    } else if (draft.actionType === "toggle_sku") {
      requiredPermission = "masters";
    }

    if (requiredPermission && req.user.role !== "ADMIN") {
      const userPermissions = req.user.permissions || [];
      if (!userPermissions.includes(requiredPermission)) {
        return res.status(403).json({ error: "Access denied: insufficient permissions for this action" });
      }
    }

    const payload = draft.proposedPayload;
    let resultRecord = null;

    if (draft.actionType === "create_purchase_order") {
      const { supplierId, supplierName, orderDate, paymentTerm, expectedDeliveryDate, items } = payload;
      const supplier = supplierId ? await Party.findOne({ _id: supplierId, partyType: "vendor" }) : null;
      const itemsWithAmount = items.map((i) => {
        const itemGstRate = Number(i.gstRate || 0);
        const amount = Number(i.qty) * Number(i.rate);
        return { ...i, gstRate: itemGstRate, amount, gstAmount: amount * itemGstRate / 100 };
      });
      const totalQty = itemsWithAmount.reduce((sum, i) => sum + i.qty, 0);
      const totalPrice = itemsWithAmount.reduce((sum, i) => sum + i.amount, 0);
      const gstAmount = itemsWithAmount.reduce((sum, i) => sum + i.gstAmount, 0);
      const poNumber = await nextNumber(PurchaseOrder, "poNumber", "PO");

      resultRecord = await PurchaseOrder.create({
        poNumber,
        supplier: supplier?._id,
        supplierName: supplier?.name || supplierName,
        orderDate,
        paymentTerm: paymentTerm || "30 days",
        expectedDeliveryDate,
        items: itemsWithAmount,
        totalQty,
        totalPrice,
        gstRate: 0,
        gstAmount,
        grandTotal: totalPrice + gstAmount,
        createdBy: req.user.id,
      });
    } else if (draft.actionType === "create_sales_invoice") {
      const { customerId, customerName, saleDate, items } = payload;
      const customer = customerId ? await Party.findOne({ _id: customerId, partyType: "customer" }) : null;
      const itemsWithAmount = items.map((i) => ({
        ...i,
        batch: String(i.batch || "").trim(),
        qty: Number(i.qty),
        rate: Number(i.rate),
        mrp: Number(i.mrp),
        amount: Number(i.qty) * Number(i.rate),
        gstRate: Number(i.gstRate || 0),
        gstAmount: (Number(i.qty) * Number(i.rate)) * Number(i.gstRate || 0) / 100,
      }));
      const totalQty = itemsWithAmount.reduce((sum, i) => sum + i.qty, 0);
      const totalAmount = itemsWithAmount.reduce((sum, i) => sum + i.amount, 0);
      const gstAmount = itemsWithAmount.reduce((sum, i) => sum + i.gstAmount, 0);
      const invoiceNumber = await nextNumber(SaleInvoice, "invoiceNumber", "INV");

      resultRecord = await SaleInvoice.create({
        invoiceNumber,
        customer: customer?._id,
        customerName: customer?.name || customerName,
        saleDate,
        items: itemsWithAmount,
        totalQty,
        totalAmount,
        gstRate: 0,
        gstAmount,
        grandTotal: totalAmount + gstAmount,
        createdBy: req.user.id,
      });
    } else if (draft.actionType === "toggle_sku") {
      const sku = await Sku.findById(payload.skuId);
      if (!sku) throw new Error("SKU not found");
      sku.enabled = !sku.enabled;
      await sku.save();
      resultRecord = sku;
    } else {
      throw new Error(`Execution for action type ${draft.actionType} is not supported directly in assistant execution engine.`);
    }

    draft.status = "executed";
    draft.executionMetadata = {
      executedAt: new Date(),
      executedBy: req.user.id,
      resultRecordId: resultRecord?._id ? String(resultRecord._id) : "",
    };
    await draft.save();

    await AssistantAuditLog.create({
      user: req.user.id,
      action: "draft_executed",
      draftId: draft.draftId,
      actionType: draft.actionType,
      affectedRecords: draft.affectedEntities,
      details: { resultRecordId: resultRecord?._id },
    });

    return res.json({
      message: "Draft successfully executed",
      draft,
      resultRecord,
    });
  } catch (err) {
    console.error("Draft execution error:", err.message);
    if (req.params.draftId) {
      await AssistantDraft.updateOne(
        { draftId: req.params.draftId },
        {
          status: "failed",
          "executionMetadata.executedAt": new Date(),
          "executionMetadata.executedBy": req.user.id,
          "executionMetadata.errorDetails": err.message,
        }
      ).catch(() => {});

      await AssistantAuditLog.create({
        user: req.user.id,
        action: "draft_execution_failed",
        draftId: req.params.draftId,
        details: { error: err.message },
      }).catch(() => {});
    }
    return res.status(500).json({ error: "Draft execution failed" });
  }
});

module.exports = router;
