const Party = require("../models/Party");
const PurchaseOrder = require("../models/PurchaseOrder");
const Sku = require("../models/Sku");

const EXTRACTION_PROMPT = `You are an invoice extraction assistant for a pharmaceutical supply-chain system. Read the uploaded purchase invoice and return only valid JSON matching the provided schema. Extract only information that is visibly present in the document. Never guess, infer, or fabricate values. Use null for missing dates and numbers, and an empty string for missing text. Identify pharmaceutical product descriptions, SKU codes, batch numbers, expiry dates, quantities, free quantities, unit prices, taxes, vendor details, invoice number, invoice date, and purchase order number. Preserve the exact batch number and expiry date. Return a confidence score from 0 to 1 for every extracted field and an overall confidence score. Add clear warnings for unreadable, ambiguous, missing, or conflicting information.

Required JSON Schema:
{
  "vendor": {
    "name": "",
    "gstNumber": "",
    "address": "",
    "matchedPartyId": null,
    "confidence": 0
  },
  "invoice": {
    "number": "",
    "date": null,
    "dueDate": null,
    "currency": "",
    "subtotal": null,
    "taxAmount": null,
    "totalAmount": null,
    "confidence": 0
  },
  "purchaseOrder": {
    "number": "",
    "matchedPurchaseOrderId": null,
    "confidence": 0
  },
  "items": [
    {
      "description": "",
      "skuCode": "",
      "matchedSkuId": null,
      "batchNumber": "",
      "expiryDate": null,
      "quantity": null,
      "freeQuantity": 0,
      "unitPrice": null,
      "taxRate": null,
      "lineTotal": null,
      "confidence": 0
    }
  ],
  "warnings": [],
  "overallConfidence": 0
}`;

function normalizeDate(rawDate) {
  if (!rawDate) return null;
  const d = new Date(rawDate);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function normalizeNumber(val, defaultVal = null) {
  if (val === null || val === undefined || val === "") return defaultVal;
  const num = Number(val);
  return Number.isFinite(num) ? num : defaultVal;
}

function normalizeString(val) {
  if (val === null || val === undefined) return "";
  return String(val).trim();
}

function sanitizeConfidence(val) {
  const num = Number(val);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.min(1, num));
}

async function matchEntities(extractedData) {
  const result = {
    ...extractedData,
    warnings: [...(extractedData.warnings || [])],
  };

  // Vendor matching
  const vendorName = normalizeString(result.vendor?.name);
  const vendorGst = normalizeString(result.vendor?.gstNumber);
  const parties = await Party.find({ type: "supplier" }).lean();

  let matchedParty = null;
  const possibleVendors = [];

  if (vendorGst) {
    matchedParty = parties.find(
      (p) => p.gstin && p.gstin.trim().toUpperCase() === vendorGst.toUpperCase()
    );
  }

  if (!matchedParty && vendorName) {
    const exactNameMatches = parties.filter(
      (p) => p.name && p.name.trim().toLowerCase() === vendorName.toLowerCase()
    );
    if (exactNameMatches.length === 1) {
      matchedParty = exactNameMatches[0];
    } else if (exactNameMatches.length > 1) {
      possibleVendors.push(...exactNameMatches);
    } else {
      // Normalized name matching
      const normVendorName = vendorName.toLowerCase().replace(/[^a-z0-9]/g, "");
      const fuzzyMatches = parties.filter((p) => {
        const normPName = (p.name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        return normPName && (normPName.includes(normVendorName) || normVendorName.includes(normPName));
      });
      if (fuzzyMatches.length === 1) {
        matchedParty = fuzzyMatches[0];
      } else if (fuzzyMatches.length > 1) {
        possibleVendors.push(...fuzzyMatches);
      }
    }
  }

  if (matchedParty) {
    result.vendor.matchedPartyId = matchedParty._id.toString();
    result.vendor.matchedPartyName = matchedParty.name;
  } else {
    result.vendor.matchedPartyId = null;
    if (possibleVendors.length > 0) {
      result.vendor.possibleMatches = possibleVendors.map((p) => ({ id: p._id.toString(), name: p.name }));
      result.warnings.push(`Multiple possible vendor matches found for "${vendorName}". Please select one.`);
    } else if (vendorName || vendorGst) {
      result.warnings.push(`Vendor "${vendorName || vendorGst}" could not be matched to an existing supplier master.`);
    } else {
      result.warnings.push("Vendor details could not be detected in the invoice.");
    }
  }

  // PO matching
  const poNumber = normalizeString(result.purchaseOrder?.number);
  if (poNumber) {
    const poQuery = { poNumber: new RegExp(`^${poNumber}$`, "i") };
    const matchedPo = await PurchaseOrder.findOne(poQuery).lean();
    if (matchedPo) {
      result.purchaseOrder.matchedPurchaseOrderId = matchedPo._id.toString();
      result.purchaseOrder.matchedPoNumber = matchedPo.poNumber;
    } else {
      result.purchaseOrder.matchedPurchaseOrderId = null;
      result.warnings.push(`Purchase Order "${poNumber}" was not found in the system.`);
    }
  } else {
    result.purchaseOrder.matchedPurchaseOrderId = null;
    result.warnings.push("Purchase Order number was not detected in the invoice.");
  }

  // SKU matching
  const skus = await Sku.find().lean();
  if (Array.isArray(result.items)) {
    result.items = result.items.map((item) => {
      const skuCode = normalizeString(item.skuCode);
      const desc = normalizeString(item.description);
      let matchedSku = null;
      const possibleSkus = [];

      if (skuCode) {
        matchedSku = skus.find((s) => s.code && s.code.trim().toUpperCase() === skuCode.toUpperCase());
      }

      if (!matchedSku && desc) {
        const exactMatches = skus.filter((s) => s.name && s.name.trim().toLowerCase() === desc.toLowerCase());
        if (exactMatches.length === 1) {
          matchedSku = exactMatches[0];
        } else if (exactMatches.length > 1) {
          possibleSkus.push(...exactMatches);
        } else {
          const normDesc = desc.toLowerCase().replace(/[^a-z0-9]/g, "");
          const fuzzy = skus.filter((s) => {
            const normSName = (s.name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
            return normSName && (normSName.includes(normDesc) || normDesc.includes(normSName));
          });
          if (fuzzy.length === 1) {
            matchedSku = fuzzy[0];
          } else if (fuzzy.length > 1) {
            possibleSkus.push(...fuzzy);
          }
        }
      }

      const itemResult = {
        ...item,
        description: desc,
        skuCode: skuCode,
        matchedSkuId: matchedSku ? matchedSku._id.toString() : null,
        matchedSkuName: matchedSku ? matchedSku.name : null,
        batchNumber: normalizeString(item.batchNumber),
        expiryDate: normalizeDate(item.expiryDate),
        quantity: normalizeNumber(item.quantity, null),
        freeQuantity: normalizeNumber(item.freeQuantity, 0),
        unitPrice: normalizeNumber(item.unitPrice, null),
        taxRate: normalizeNumber(item.taxRate, null),
        lineTotal: normalizeNumber(item.lineTotal, null),
        confidence: sanitizeConfidence(item.confidence),
      };

      if (!matchedSku) {
        if (possibleSkus.length > 0) {
          itemResult.possibleMatches = possibleSkus.map((s) => ({ id: s._id.toString(), name: s.name, code: s.code }));
          result.warnings.push(`Multiple SKU matches found for item "${desc || skuCode}". Please select one.`);
        } else {
          result.warnings.push(`Item "${desc || skuCode || 'Unnamed Item'}" could not be matched to an existing SKU.`);
        }
      }

      if (!itemResult.batchNumber) {
        result.warnings.push(`Batch number missing for item "${desc || skuCode || 'Unnamed Item'}".`);
      }
      if (!itemResult.expiryDate) {
        result.warnings.push(`Expiry date missing or invalid for item "${desc || skuCode || 'Unnamed Item'}".`);
      }

      return itemResult;
    });
  } else {
    result.items = [];
    result.warnings.push("No line items were detected in the invoice.");
  }

  // Sanitize top-level invoice dates & numbers
  const vendorObj = result.vendor || {};
  result.vendor = {
    name: vendorName,
    gstNumber: vendorGst,
    address: normalizeString(vendorObj.address),
    matchedPartyId: vendorObj.matchedPartyId || null,
    matchedPartyName: vendorObj.matchedPartyName || null,
    possibleMatches: vendorObj.possibleMatches || undefined,
    confidence: sanitizeConfidence(vendorObj.confidence),
  };

  result.invoice = {
    number: normalizeString(result.invoice?.number),
    date: normalizeDate(result.invoice?.date),
    dueDate: normalizeDate(result.invoice?.dueDate),
    currency: normalizeString(result.invoice?.currency),
    subtotal: normalizeNumber(result.invoice?.subtotal, null),
    taxAmount: normalizeNumber(result.invoice?.taxAmount, null),
    totalAmount: normalizeNumber(result.invoice?.totalAmount, null),
    confidence: sanitizeConfidence(result.invoice?.confidence),
  };

  result.purchaseOrder = {
    number: poNumber,
    matchedPurchaseOrderId: result.purchaseOrder?.matchedPurchaseOrderId || null,
    matchedPoNumber: result.purchaseOrder?.matchedPoNumber || null,
    confidence: sanitizeConfidence(result.purchaseOrder?.confidence),
  };

  result.overallConfidence = sanitizeConfidence(result.overallConfidence);

  if (!result.invoice.number) {
    result.warnings.push("Invoice number could not be detected.");
  }
  if (!result.invoice.date) {
    result.warnings.push("Invoice date could not be detected or is invalid.");
  }

  return result;
}

async function parseInvoiceDocument({ fileBuffer, mimeType }) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("AI provider is not configured (GEMINI_API_KEY is missing).");
  }

  const model = process.env.GEMINI_MODEL || "gemini-1.5-flash";
  const apiKey = process.env.GEMINI_API_KEY;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const body = {
    contents: [
      {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: fileBuffer.toString("base64"),
            },
          },
          { text: EXTRACTION_PROMPT },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: "application/json",
    },
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === "AbortError") {
      throw new Error("AI invoice parsing request timed out after 30 seconds.");
    }
    throw new Error(`AI service request failed: ${err.message}`);
  } finally {
    clearTimeout(timeout);
  }

  const responseData = await response.json().catch(() => ({}));

  if (!response.ok) {
    console.error("AI Provider error response:", responseData);
    throw new Error(responseData.error?.message || `AI service returned error HTTP ${response.status}`);
  }

  const candidateText = responseData.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("").trim();
  if (!candidateText) {
    throw new Error("AI service returned an empty output.");
  }

  let extractedRawJson;
  try {
    const cleanedText = candidateText.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
    extractedRawJson = JSON.parse(cleanedText);
  } catch (err) {
    console.error("Failed to parse JSON response from AI:", candidateText);
    throw new Error("AI service returned invalid or malformed JSON.");
  }

  return await matchEntities(extractedRawJson);
}

module.exports = {
  parseInvoiceDocument,
  matchEntities,
  EXTRACTION_PROMPT,
};
