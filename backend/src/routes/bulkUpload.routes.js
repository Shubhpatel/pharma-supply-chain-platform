const express = require("express");
const multer = require("multer");
const XLSX = require("xlsx");
const { requireAuth } = require("../middleware/auth");
const BulkUpload = require("../models/BulkUpload");
const Sku = require("../models/Sku");
const Party = require("../models/Party");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

const MASTER_COLUMNS = {
  sku: ["Name", "HSN Code", "Category", "Sub Category", "Manufacturer", "UOM", "MRP"],
  vendor: ["Name", "GST Number", "Contact Person", "Phone", "Email", "Address Line 1", "Address Line 2", "City", "State", "Postal Code"],
  customer: ["Name", "GST Number", "Contact Person", "Phone", "Email", "Address Line 1", "Address Line 2", "City", "State", "Postal Code"],
};

const SAMPLE_DATA = {
  sku: [
    { "Name": "Paracetamol 500mg", "HSN Code": "300490", "Category": "Tablet", "Sub Category": "Analgesic", "Manufacturer": "PharmaCorp", "UOM": "STRIP", "MRP": 25.5 },
    { "Name": "Amoxicillin 250mg", "HSN Code": "300410", "Category": "Capsule", "Sub Category": "Antibiotic", "Manufacturer": "HealthMed", "UOM": "BOX", "MRP": 120.0 },
  ],
  vendor: [
    { "Name": "Apex Healthcare Pvt Ltd", "GST Number": "27AAAAA0000A1Z5", "Contact Person": "John Doe", "Phone": "9876543210", "Email": "apex@example.com", "Address Line 1": "Plot 12, Industrial Area", "Address Line 2": "Phase 1", "City": "Mumbai", "State": "Maharashtra", "Postal Code": "400001" },
  ],
  customer: [
    { "Name": "City Hospital Pharmacy", "GST Number": "27BBBBB1111B1Z2", "Contact Person": "Jane Smith", "Phone": "9123456789", "Email": "cityhosp@example.com", "Address Line 1": "123 Healthcare Blvd", "Address Line 2": "", "City": "Pune", "State": "Maharashtra", "Postal Code": "411001" },
  ],
};

// GET /api/bulk-uploads/sample?masterType=sku&format=csv|excel
router.get("/sample", (req, res) => {
  try {
    const masterType = (req.query.masterType || "sku").toLowerCase();
    const format = (req.query.format || "csv").toLowerCase();

    if (!MASTER_COLUMNS[masterType]) {
      return res.status(400).json({ error: "Invalid master type" });
    }

    const rows = SAMPLE_DATA[masterType] || [];
    const worksheet = XLSX.utils.json_to_sheet(rows, { header: MASTER_COLUMNS[masterType] });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sample");

    if (format === "xlsx" || format === "excel") {
      const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="sample_${masterType}.xlsx"`);
      return res.send(buffer);
    } else {
      const csvString = XLSX.utils.sheet_to_csv(worksheet);
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="sample_${masterType}.csv"`);
      return res.send(csvString);
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/bulk-uploads - List all bulk upload history
router.get("/", requireAuth, async (req, res) => {
  try {
    const history = await BulkUpload.find()
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 });
    return res.json({ history });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/bulk-uploads/:id/error-file?format=csv|excel
router.get("/:id/error-file", requireAuth, async (req, res) => {
  try {
    const uploadJob = await BulkUpload.findById(req.params.id);
    if (!uploadJob) return res.status(404).json({ error: "Upload job not found" });

    if (!uploadJob.errorDetails || uploadJob.errorDetails.length === 0) {
      return res.status(400).json({ error: "No error details available for this job" });
    }

    const format = (req.query.format || "csv").toLowerCase();

    // Map error rows to include original row data + Error Details column
    const errorRows = uploadJob.errorDetails.map((item) => {
      const rowObj = { ...item.data };
      rowObj["Row Number"] = item.rowNumber;
      rowObj["Error Details"] = (item.errorList || item.errors || []).join("; ");
      return rowObj;
    });

    const worksheet = XLSX.utils.json_to_sheet(errorRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Errors");

    if (format === "xlsx" || format === "excel") {
      const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="errors_${uploadJob.fileName}.xlsx"`);
      return res.send(buffer);
    } else {
      const csvString = XLSX.utils.sheet_to_csv(worksheet);
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="errors_${uploadJob.fileName}.csv"`);
      return res.send(csvString);
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/bulk-uploads
router.post("/", requireAuth, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const masterType = (req.body.masterType || "sku").toLowerCase();
    if (!["sku", "vendor", "customer"].includes(masterType)) {
      return res.status(400).json({ error: "Invalid master type specified" });
    }

    // Parse CSV / Excel
    let workbook;
    try {
      workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    } catch (e) {
      return res.status(400).json({ error: "Could not parse uploaded file. Please ensure it is a valid CSV or Excel file." });
    }

    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      return res.status(400).json({ error: "Uploaded file is empty" });
    }

    const worksheet = workbook.Sheets[firstSheetName];
    const rawRows = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

    if (!rawRows || rawRows.length === 0) {
      return res.status(400).json({ error: "Uploaded file contains no rows" });
    }

    const totalRecords = rawRows.length;
    const validatedRecords = [];
    const errorDetails = [];

    // Helper function to get row value case-insensitively
    const getVal = (row, fieldName) => {
      const key = Object.keys(row).find((k) => k.trim().toLowerCase() === fieldName.toLowerCase());
      return key !== undefined ? String(row[key]).trim() : "";
    };

    // Validate every row
    rawRows.forEach((row, idx) => {
      const rowNumber = idx + 2; // header is row 1
      const rowErrors = [];

      if (masterType === "sku") {
        const name = getVal(row, "name");
        const hsnCode = getVal(row, "hsn code") || getVal(row, "hsncode") || getVal(row, "hsn");
        const category = getVal(row, "category");
        const subCategory = getVal(row, "sub category") || getVal(row, "subcategory");
        const manufacturer = getVal(row, "manufacturer");
        const uom = getVal(row, "uom") || "UNIT";
        const mrpStr = getVal(row, "mrp");
        const mrp = mrpStr !== "" ? Number(mrpStr) : 0;

        if (!name) rowErrors.push("Name is required");
        if (mrpStr !== "" && isNaN(mrp)) rowErrors.push("MRP must be a valid number");

        if (rowErrors.length === 0) {
          validatedRecords.push({ name, hsnCode, category, subCategory, manufacturer, uom, mrp });
        }
      } else if (masterType === "vendor" || masterType === "customer") {
        const name = getVal(row, "name");
        const gstNumber = getVal(row, "gst number") || getVal(row, "gstnumber") || getVal(row, "gstin") || getVal(row, "gst");
        const contactPerson = getVal(row, "contact person") || getVal(row, "contactperson");
        const phone = getVal(row, "phone") || getVal(row, "mobile");
        const email = getVal(row, "email");
        const addressLine1 = getVal(row, "address line 1") || getVal(row, "addressline1") || getVal(row, "address");
        const addressLine2 = getVal(row, "address line 2") || getVal(row, "addressline2");
        const city = getVal(row, "city");
        const state = getVal(row, "state");
        const postalCode = getVal(row, "postal code") || getVal(row, "postalcode") || getVal(row, "zip") || getVal(row, "pincode");

        if (!name) rowErrors.push("Name is required");

        if (rowErrors.length === 0) {
          validatedRecords.push({
            partyType: masterType,
            name,
            gstNumber,
            contactPerson,
            phone,
            email,
            addressLine1,
            addressLine2,
            city,
            state,
            postalCode,
            createdBy: req.user._id,
          });
        }
      }

      errorDetails.push({
        rowNumber,
        data: row,
        errorList: rowErrors,
      });
    });

    const failedRows = errorDetails.filter((item) => item.errorList.length > 0);
    const hasErrors = failedRows.length > 0;

    let bulkRecord;
    if (hasErrors) {
      // If ANY row has error -> do NOT save any data, record status as 'error'
      bulkRecord = await BulkUpload.create({
        fileName: req.file.originalname,
        masterType,
        status: "error",
        totalRecords,
        successRecords: 0,
        errorRecords: failedRows.length,
        errorDetails,
        createdBy: req.user._id,
      });

      return res.status(400).json({
        error: `Validation failed for ${failedRows.length} out of ${totalRecords} rows. No records were saved.`,
        bulkUploadId: bulkRecord._id,
        upload: bulkRecord,
      });
    } else {
      // Save all records
      if (masterType === "sku") {
        await Sku.insertMany(validatedRecords);
      } else {
        await Party.insertMany(validatedRecords);
      }

      bulkRecord = await BulkUpload.create({
        fileName: req.file.originalname,
        masterType,
        status: "done",
        totalRecords,
        successRecords: totalRecords,
        errorRecords: 0,
        errorDetails: [],
        createdBy: req.user._id,
      });

      return res.status(201).json({
        message: `Successfully imported ${totalRecords} ${masterType} records.`,
        upload: bulkRecord,
      });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
