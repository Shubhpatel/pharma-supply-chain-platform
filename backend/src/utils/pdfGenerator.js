const PDFDocument = require("pdfkit");

/**
 * Generates a clean, professional PDF for documents (PO, GRN, Debit Note, Credit Note, Sales Invoice)
 * with a standardized invoice theme and Pharma Buddy branding.
 *
 * @param {string} docType - One of: "PO", "GRN", "DN", "CN", "INV"
 * @param {object} data - Document payload from Mongoose model (lean or object)
 * @returns {Promise<Buffer>} - Resolves to PDF Buffer
 */
function generateDocumentPdf(docType, data) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 36 });
    const buffers = [];

    doc.on("data", (chunk) => buffers.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(buffers)));
    doc.on("error", (err) => reject(err));

    // Define Theme Palette
    const primaryColor = "#0f766e"; // Teal-700
    const primaryDark = "#115e59"; // Teal-800
    const textDark = "#1f2937"; // Gray-800
    const textMuted = "#4b5563"; // Gray-600
    const borderColor = "#e5e7eb"; // Gray-200
    const lightBg = "#f8fafc"; // Slate-50

    // Header Branding & Title
    // Draw Logo Icon Box
    doc.rect(36, 36, 40, 40).fill(primaryColor);
    doc.fillColor("#ffffff").fontSize(22).font("Helvetica-Bold").text("P", 48, 45);

    // Title & Subtitle
    doc.fillColor(primaryDark).fontSize(18).font("Helvetica-Bold").text("Pharma Buddy", 86, 38);
    doc.fillColor(textMuted).fontSize(9).font("Helvetica").text("Pharmaceutical Inventory & Billing System", 86, 58);

    // Document Type Banner
    const docTitles = {
      PO: "PURCHASE ORDER",
      GRN: "GOODS RECEIVED NOTE",
      DN: "DEBIT NOTE (PURCHASE RETURN)",
      CN: "CREDIT NOTE (SALES RETURN)",
      INV: "TAX INVOICE",
    };
    const titleText = docTitles[docType] || "DOCUMENT";

    doc.rect(380, 36, 179, 40).fill(primaryColor);
    doc.fillColor("#ffffff").fontSize(11).font("Helvetica-Bold").text(titleText, 385, 50, { width: 169, align: "center" });

    // Header Divider line
    doc.moveTo(36, 88).lineTo(559, 88).strokeColor(primaryColor).lineWidth(1.5).stroke();

    // Document Metadata & Party Info Section
    let y = 98;

    // Left Column: Company Info
    doc.fillColor(textDark).fontSize(10).font("Helvetica-Bold").text("Pharma Buddy Operations", 36, y);
    doc.fillColor(textMuted).fontSize(8.5).font("Helvetica");
    doc.text("123 Healthcare Blvd, Medical Hub", 36, y + 14);
    doc.text("GSTIN: 27AAAAA0000A1Z5 | License: 20B/21B-102938", 36, y + 26);
    doc.text("Email: support@pharmabuddy.com | Phone: +91 98765 43210", 36, y + 38);

    // Right Column: Document Details Box
    doc.rect(340, y, 219, 60).fillAndStroke(lightBg, borderColor);
    doc.fillColor(textDark).fontSize(9).font("Helvetica-Bold");

    const getDocNumber = () => {
      if (docType === "PO") return data.poNumber;
      if (docType === "GRN") return data.grnNumber;
      if (docType === "DN") return data.debitNoteNumber;
      if (docType === "CN") return data.creditNoteNumber;
      if (docType === "INV") return data.invoiceNumber;
      return "-";
    };

    const getDate = () => {
      const d = data.orderDate || data.grnDate || data.returnDate || data.saleDate || data.createdAt;
      return d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "-";
    };

    doc.text(`Doc No: ${getDocNumber()}`, 350, y + 8);
    doc.text(`Date: ${getDate()}`, 350, y + 22);
    doc.text(`Status: ${(data.status || "CONFIRMED").toUpperCase()}`, 350, y + 36);

    y += 72;

    // Party Information (Vendor / Customer)
    const partyLabel = ["PO", "GRN", "DN"].includes(docType) ? "VENDOR / SUPPLIER" : "CUSTOMER / PARTY";
    const partyName = data.supplierName || data.customerName || data.supplier?.name || data.customer?.name || "N/A";
    const partyObj = data.supplier || data.customer || {};

    doc.rect(36, y, 523, 50).fillAndStroke("#ffffff", borderColor);
    doc.rect(36, y, 523, 16).fill(primaryColor);
    doc.fillColor("#ffffff").fontSize(8.5).font("Helvetica-Bold").text(partyLabel, 44, y + 3);

    doc.fillColor(textDark).fontSize(9.5).font("Helvetica-Bold").text(partyName, 44, y + 20);

    const partyDetails = [];
    if (partyObj.gstNumber) partyDetails.push(`GSTIN: ${partyObj.gstNumber}`);
    if (partyObj.contactPerson) partyDetails.push(`Contact: ${partyObj.contactPerson}`);
    if (partyObj.phone) partyDetails.push(`Phone: ${partyObj.phone}`);
    if (partyObj.email) partyDetails.push(`Email: ${partyObj.email}`);

    const addressParts = [partyObj.addressLine1, partyObj.addressLine2, partyObj.city, partyObj.state, partyObj.postalCode].filter(Boolean);
    if (addressParts.length > 0) partyDetails.push(`Address: ${addressParts.join(", ")}`);

    doc.fillColor(textMuted).fontSize(8).font("Helvetica").text(partyDetails.join(" | ") || "No additional party details provided", 44, y + 34, { width: 507, height: 12 });

    y += 60;

    // Additional Reference Notes for specific document types
    const refNotes = [];
    if (docType === "GRN" && data.poNumber) refNotes.push(`Against PO #: ${data.poNumber}`);
    if (docType === "GRN" && data.purchaseInvoiceNumber) refNotes.push(`Vendor Invoice #: ${data.purchaseInvoiceNumber}`);
    if (docType === "DN" && data.grnNumber) refNotes.push(`Against GRN #: ${data.grnNumber}`);
    if (docType === "CN" && data.invoiceNumber) refNotes.push(`Against Sales Invoice #: ${data.invoiceNumber}`);
    if (data.reason) refNotes.push(`Reason: ${data.reason}`);

    if (refNotes.length > 0) {
      doc.fillColor(textMuted).fontSize(8.5).font("Helvetica-Oblique").text(refNotes.join(" | "), 36, y);
      y += 16;
    }

    // Items Table Setup
    const tableTop = y + 5;
    doc.rect(36, tableTop, 523, 20).fill(primaryDark);
    doc.fillColor("#ffffff").fontSize(8.5).font("Helvetica-Bold");

    // Columns config
    const cols = [
      { id: "sno", label: "#", x: 40, width: 20, align: "left" },
      { id: "sku", label: "SKU / Description", x: 62, width: 145, align: "left" },
      { id: "batch", label: "Batch", x: 210, width: 55, align: "left" },
      { id: "exp", label: "Expiry", x: 268, width: 52, align: "left" },
      { id: "qty", label: "Qty", x: 323, width: 35, align: "right" },
      { id: "rate", label: "Rate (₹)", x: 361, width: 50, align: "right" },
      { id: "gst", label: "GST %", x: 414, width: 40, align: "right" },
      { id: "amount", label: "Amount (₹)", x: 457, width: 97, align: "right" },
    ];

    cols.forEach((col) => {
      doc.text(col.label, col.x, tableTop + 5, { width: col.width, align: col.align });
    });

    let currentY = tableTop + 20;
    const items = data.items || [];

    doc.font("Helvetica").fontSize(8).fillColor(textDark);

    items.forEach((item, idx) => {
      // Row background zebra striping
      if (idx % 2 === 1) {
        doc.rect(36, currentY, 523, 18).fill("#f8fafc");
        doc.fillColor(textDark);
      }

      const qtyVal = item.qtyReceived ?? item.qty ?? 0;
      const rateVal = Number(item.rate || 0).toFixed(2);
      const gstVal = `${item.gstRate || 0}%`;
      const amountVal = Number(item.amount || qtyVal * Number(item.rate || 0)).toFixed(2);
      const expDate = item.expiryDate ? new Date(item.expiryDate).toLocaleDateString("en-IN", { month: "2-digit", year: "2-digit" }) : "-";

      doc.text(String(idx + 1), cols[0].x, currentY + 4, { width: cols[0].width, align: cols[0].align });
      doc.text(item.skuName || "Item", cols[1].x, currentY + 4, { width: cols[1].width, align: cols[1].align });
      doc.text(item.batch || "-", cols[2].x, currentY + 4, { width: cols[2].width, align: cols[2].align });
      doc.text(expDate, cols[3].x, currentY + 4, { width: cols[3].width, align: cols[3].align });
      doc.text(String(qtyVal), cols[4].x, currentY + 4, { width: cols[4].width, align: cols[4].align });
      doc.text(rateVal, cols[5].x, currentY + 4, { width: cols[5].width, align: cols[5].align });
      doc.text(gstVal, cols[6].x, currentY + 4, { width: cols[6].width, align: cols[6].align });
      doc.text(amountVal, cols[7].x, currentY + 4, { width: cols[7].width, align: cols[7].align });

      doc.moveTo(36, currentY + 18).lineTo(559, currentY + 18).strokeColor(borderColor).lineWidth(0.5).stroke();
      currentY += 18;
    });

    // Totals & Summary Breakdown
    currentY += 10;

    const subtotal = data.totalPrice ?? data.totalValue ?? data.totalAmount ?? items.reduce((acc, i) => acc + (i.amount || 0), 0);
    const gstTotal = data.gstAmount ?? items.reduce((acc, i) => acc + (i.gstAmount || 0), 0);
    const grandTotal = data.grandTotal ?? subtotal + gstTotal;
    const totalQty = data.totalQty ?? items.reduce((acc, i) => acc + (i.qtyReceived ?? i.qty ?? 0), 0);

    // Summary Box
    const summaryX = 340;
    doc.rect(summaryX, currentY, 219, 65).fillAndStroke("#ffffff", borderColor);

    doc.fontSize(8.5).font("Helvetica").fillColor(textDark);
    doc.text("Total Items / Qty:", summaryX + 10, currentY + 8);
    doc.text(`${items.length} / ${totalQty}`, summaryX + 120, currentY + 8, { width: 89, align: "right" });

    doc.text("Subtotal:", summaryX + 10, currentY + 22);
    doc.text(`₹ ${Number(subtotal).toFixed(2)}`, summaryX + 120, currentY + 22, { width: 89, align: "right" });

    doc.text("Total GST:", summaryX + 10, currentY + 36);
    doc.text(`₹ ${Number(gstTotal).toFixed(2)}`, summaryX + 120, currentY + 36, { width: 89, align: "right" });

    doc.rect(summaryX, currentY + 48, 219, 17).fill(primaryColor);
    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(9);
    doc.text("Grand Total:", summaryX + 10, currentY + 52);
    doc.text(`₹ ${Number(grandTotal).toFixed(2)}`, summaryX + 120, currentY + 52, { width: 89, align: "right" });

    // Terms & Conditions / Signatures
    currentY += 80;
    doc.fillColor(textMuted).fontSize(7.5).font("Helvetica");
    doc.text("Terms & Conditions:", 36, currentY);
    doc.text("1. All disputes subject to local jurisdiction only.", 36, currentY + 10);
    doc.text("2. Goods once sold will not be taken back unless compliant with return rules.", 36, currentY + 18);

    doc.text("For Pharma Buddy Operations", 410, currentY);
    doc.text("Authorized Signatory", 410, currentY + 30);

    // Footer Page Number / Stamp
    doc.fillColor(textMuted).fontSize(8).font("Helvetica");
    doc.text("Computer Generated Document - Powered by Pharma Buddy", 36, 800, { align: "center", width: 523 });

    doc.end();
  });
}

module.exports = {
  generateDocumentPdf,
};
