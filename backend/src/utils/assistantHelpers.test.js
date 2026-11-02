const { sanitizePromptText, classifyIntent, validateActionPayload, loadControlledDatabaseContext } = require('./assistantHelpers');
const Sku = require('../models/Sku');
const Party = require('../models/Party');
const Stock = require('../models/Stock');
const SaleInvoice = require('../models/SaleInvoice');
const PurchaseOrder = require('../models/PurchaseOrder');
const Grn = require('../models/Grn');
const DebitNote = require('../models/DebitNote');
const CreditNote = require('../models/CreditNote');

jest.mock('../models/Sku');
jest.mock('../models/Party');
jest.mock('../models/Stock');
jest.mock('../models/SaleInvoice');
jest.mock('../models/PurchaseOrder');
jest.mock('../models/Grn');
jest.mock('../models/DebitNote');
jest.mock('../models/CreditNote');

describe('assistantHelpers', () => {
  describe('sanitizePromptText', () => {
    it('returns an empty string if input is not a string', () => {
      expect(sanitizePromptText(null)).toBe('');
      expect(sanitizePromptText(undefined)).toBe('');
      expect(sanitizePromptText(123)).toBe('');
      expect(sanitizePromptText({})).toBe('');
      expect(sanitizePromptText([])).toBe('');
    });

    it('replaces all newline characters with a space', () => {
      const input = 'Hello\nWorld\r\nThis\ris\n\n\r\nGood';
      const expected = 'Hello World This is Good';
      expect(sanitizePromptText(input)).toBe(expected);
    });

    it('replaces all backticks with single quotes', () => {
      const input = 'This is a `test` string with `backticks`';
      const expected = "This is a 'test' string with 'backticks'";
      expect(sanitizePromptText(input)).toBe(expected);
    });

    it('truncates the string to 1000 characters', () => {
      const input = 'a'.repeat(1050);
      const result = sanitizePromptText(input);
      expect(result.length).toBe(1000);
      expect(result).toBe('a'.repeat(1000));
    });

    it('handles combinations of replacements and truncation', () => {
      const prefix = '`hello`\nworld\r\n';
      const input = prefix + 'a'.repeat(1000);
      const expectedPrefix = "'hello' world ";
      const expected = (expectedPrefix + 'a'.repeat(1000)).slice(0, 1000);
      expect(sanitizePromptText(input)).toBe(expected);
    });
  });

  describe('classifyIntent', () => {
    it('returns "approve_draft" for approve phrases', () => {
      expect(classifyIntent('please approve draft for me')).toBe('approve_draft');
      expect(classifyIntent('approve action now')).toBe('approve_draft');
    });

    it('returns "reject_draft" for reject phrases', () => {
      expect(classifyIntent('reject draft')).toBe('reject_draft');
      expect(classifyIntent('reject action please')).toBe('reject_draft');
    });

    it('returns "execute_draft" for execute phrases', () => {
      expect(classifyIntent('execute draft')).toBe('execute_draft');
      expect(classifyIntent('execute action now')).toBe('execute_draft');
    });

    it('returns "update_draft" for update phrases', () => {
      expect(classifyIntent('update draft with new value')).toBe('update_draft');
      expect(classifyIntent('change draft please')).toBe('update_draft');
    });

    it('returns "create_draft" for purchase order creation phrases', () => {
      expect(classifyIntent('prepare purchase order')).toBe('create_draft');
      expect(classifyIntent('create purchase order')).toBe('create_draft');
      expect(classifyIntent('prepare po')).toBe('create_draft');
      expect(classifyIntent('create po')).toBe('create_draft');
      expect(classifyIntent('need replenishment for stocks')).toBe('create_draft');
      expect(classifyIntent('replenish stock')).toBe('create_draft');
    });

    it('returns "create_draft" for sales invoice creation phrases', () => {
      expect(classifyIntent('prepare sales invoice')).toBe('create_draft');
      expect(classifyIntent('create sales invoice')).toBe('create_draft');
      expect(classifyIntent('create invoice')).toBe('create_draft');
      expect(classifyIntent('prepare invoice')).toBe('create_draft');
    });

    it('returns "database_question" for analytical/query phrases', () => {
      expect(classifyIntent('show low-stock items')).toBe('database_question');
      expect(classifyIntent('what is low stock')).toBe('database_question');
      expect(classifyIntent('which products are near expiry')).toBe('database_question');
      expect(classifyIntent('how many expired items')).toBe('database_question');
      expect(classifyIntent('slow-moving stock')).toBe('database_question');
      expect(classifyIntent('unpaid invoices')).toBe('database_question');
      expect(classifyIntent('pending orders')).toBe('database_question');
      expect(classifyIntent('analyze sales data')).toBe('database_question');
      expect(classifyIntent('show me everything')).toBe('database_question');
      expect(classifyIntent('list all products')).toBe('database_question');
    });

    it('returns "navigation" for navigation phrases', () => {
      expect(classifyIntent('go to dashboard')).toBe('navigation');
      expect(classifyIntent('open page inventory')).toBe('navigation');
      expect(classifyIntent('navigate to settings')).toBe('navigation');
    });

    it('returns "database_question" as the fallback intent', () => {
      expect(classifyIntent('hello there')).toBe('database_question');
      expect(classifyIntent('what is the meaning of life')).toBe('database_question');
      expect(classifyIntent('unknown gibberish')).toBe('database_question');
    });
  });

  describe('validateActionPayload', () => {
    it('returns invalid if payload is not an object', () => {
      const result = validateActionPayload('create_purchase_order', null);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Payload must be an object');
    });

    it('returns invalid for unsupported action type', () => {
      const result = validateActionPayload('unsupported_action', {});
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Unsupported action type: unsupported_action');
    });

    describe('create_purchase_order', () => {
      it('validates a correct payload', () => {
        const payload = {
          supplierId: 'sup1',
          orderDate: '2023-01-01',
          items: [{ sku: 'sku1', qty: 10, rate: 100 }],
        };
        const result = validateActionPayload('create_purchase_order', payload);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
        expect(result.warnings).toHaveLength(0);
      });

      it('returns errors for missing required fields', () => {
        const payload = {};
        const result = validateActionPayload('create_purchase_order', payload);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Supplier (vendor) is required');
        expect(result.errors).toContain('Order date is required');
        expect(result.errors).toContain('At least one item is required in purchase order');
      });

      it('returns warnings for invalid item values', () => {
        const payload = {
          supplierName: 'Vendor A',
          orderDate: '2023-01-01',
          items: [{ sku: 'sku1', qty: -5, rate: -10 }],
        };
        const result = validateActionPayload('create_purchase_order', payload);
        expect(result.isValid).toBe(true); // Warnings do not make it invalid
        expect(result.warnings).toContain('Item #1: Quantity should be greater than 0');
        expect(result.warnings).toContain('Item #1: Rate should be non-negative');
      });

      it('returns error if item is missing sku', () => {
        const payload = {
          supplierName: 'Vendor A',
          orderDate: '2023-01-01',
          items: [{ qty: 5, rate: 10 }],
        };
        const result = validateActionPayload('create_purchase_order', payload);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Item #1: SKU ID is required');
      });
    });

    describe('create_sales_invoice', () => {
      it('validates a correct payload', () => {
        const payload = {
          customerId: 'cust1',
          saleDate: '2023-01-01',
          items: [{ sku: 'sku1', qty: 10, batch: 'B1', expiryDate: '2024-01-01' }],
        };
        const result = validateActionPayload('create_sales_invoice', payload);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('returns errors for missing required fields', () => {
        const payload = {
          items: [],
        };
        const result = validateActionPayload('create_sales_invoice', payload);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Customer is required');
        expect(result.errors).toContain('Sale date is required');
        expect(result.errors).toContain('At least one item is required in sales invoice');
      });

      it('returns warnings for missing batch and expiry date', () => {
        const payload = {
          customerName: 'Customer A',
          saleDate: '2023-01-01',
          items: [{ sku: 'sku1', qty: 10 }],
        };
        const result = validateActionPayload('create_sales_invoice', payload);
        expect(result.isValid).toBe(true);
        expect(result.warnings).toContain('Item #1: Batch number is missing');
        expect(result.warnings).toContain('Item #1: Expiry date is missing');
      });
    });

    describe('create_grn', () => {
      it('returns errors for missing fields', () => {
        const payload = {};
        const result = validateActionPayload('create_grn', payload);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Purchase order ID is required');
        expect(result.errors).toContain('GRN date is required');
        expect(result.errors).toContain('At least one item is required');
      });
    });

    describe('create_debit_note', () => {
      it('returns errors for missing fields', () => {
        const payload = {};
        const result = validateActionPayload('create_debit_note', payload);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Supplier is required');
        expect(result.errors).toContain('Return date is required');
        expect(result.errors).toContain('At least one item is required');
      });
    });

    describe('create_credit_note', () => {
      it('returns errors for missing fields', () => {
        const payload = {};
        const result = validateActionPayload('create_credit_note', payload);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Customer is required');
        expect(result.errors).toContain('Return date is required');
        expect(result.errors).toContain('At least one item is required');
      });
    });

    describe('sku actions', () => {
      ['update_sku', 'toggle_sku', 'delete_sku'].forEach((actionType) => {
        it(`validates ${actionType}`, () => {
          const validResult = validateActionPayload(actionType, { skuId: 'sku1' });
          expect(validResult.isValid).toBe(true);

          const invalidResult = validateActionPayload(actionType, {});
          expect(invalidResult.isValid).toBe(false);
          expect(invalidResult.errors).toContain('SKU ID is required');
        });
      });
    });
  });

  describe('loadControlledDatabaseContext', () => {
    afterEach(() => {
      jest.clearAllMocks();
    });

    const mockQuery = (mockData) => ({
      select: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(mockData),
    });

    it('returns a properly structured context object', async () => {
      const mockSku = { _id: 'sku1', code: 'S1', name: 'Item 1', category: 'Cat 1', mrp: 100, minReorderLevel: 5 };
      const mockVendor = { _id: 'v1', name: 'Vendor 1' };
      const mockCustomer = { _id: 'c1', name: 'Customer 1' };
      const mockStock = { _id: 'st1', sku: mockSku, qty: 10, batch: 'B1', expiryDate: new Date('2024-01-01') };

      const mockSale = { invoiceNumber: 'INV1', customerName: 'Customer 1', saleDate: new Date('2023-11-01'), grandTotal: 1000, status: 'draft' };
      const mockPO = { poNumber: 'PO1', supplierName: 'Vendor 1', orderDate: new Date('2023-11-01'), grandTotal: 500, status: 'approved' };
      const mockGrn = { grnNumber: 'GRN1', supplierName: 'Vendor 1', grnDate: new Date('2023-11-05'), totalQty: 10, grandTotal: 500 };
      const mockDebit = { debitNoteNumber: 'DN1', supplierName: 'Vendor 1', returnDate: new Date('2023-11-06'), grandTotal: 100, status: 'approved' };
      const mockCredit = { creditNoteNumber: 'CN1', customerName: 'Customer 1', returnDate: new Date('2023-11-07'), grandTotal: 200, status: 'draft' };

      Sku.find.mockReturnValue(mockQuery([mockSku]));
      Party.find.mockImplementation((query) => {
        if (query.partyType === 'vendor') return mockQuery([mockVendor]);
        if (query.partyType === 'customer') return mockQuery([mockCustomer]);
        return mockQuery([]);
      });
      Stock.find.mockImplementation((query) => {
        if (query.expiryDate && query.expiryDate.$gte) return mockQuery([mockStock]); // Near expiry
        if (query.expiryDate && query.expiryDate.$lt) return mockQuery([mockStock]); // Expired
        return mockQuery([mockStock]); // All stock
      });
      SaleInvoice.find.mockReturnValue(mockQuery([mockSale]));
      PurchaseOrder.find.mockReturnValue(mockQuery([mockPO]));
      Grn.find.mockReturnValue(mockQuery([mockGrn]));
      DebitNote.find.mockReturnValue(mockQuery([mockDebit]));
      CreditNote.find.mockReturnValue(mockQuery([mockCredit]));

      const context = await loadControlledDatabaseContext();

      expect(context.summaryNote).toBe('Database context is filtered, capped, and read-only.');
      expect(context.skus).toEqual([{ id: 'sku1', code: 'S1', name: 'Item 1', category: 'Cat 1', mrp: 100 }]);
      expect(context.vendors).toEqual([{ id: 'v1', name: 'Vendor 1' }]);
      expect(context.customers).toEqual([{ id: 'c1', name: 'Customer 1' }]);
      expect(context.stockOnHand).toEqual([{ code: 'S1', name: 'Item 1', totalQty: 10 }]);
      expect(context.lowStockItems).toEqual([]); // 10 > 5 minReorderLevel

      expect(context.nearExpiryCount).toBe(1);
      expect(context.expiredCount).toBe(1);

      expect(context.recentSalesSummary).toHaveLength(1);
      expect(context.recentSalesSummary[0].invoiceNumber).toBe('INV1');
      expect(context.recentPurchaseOrders).toHaveLength(1);
      expect(context.unpaidOrPendingCount).toBe(1); // 1 sale draft, 0 PO draft
    });

    it('identifies low stock items properly', async () => {
      const mockSkuLow = { _id: 'sku2', code: 'S2', name: 'Item 2', minReorderLevel: 20 };
      const mockStockLow = { _id: 'st2', sku: mockSkuLow, qty: 5 }; // 5 <= 20, so low stock

      Sku.find.mockReturnValue(mockQuery([]));
      Party.find.mockReturnValue(mockQuery([]));
      Stock.find.mockImplementation((query) => {
        if (query.expiryDate) return mockQuery([]); // No expired/near expiry
        return mockQuery([mockStockLow]); // Returning a stock with qty 5
      });
      SaleInvoice.find.mockReturnValue(mockQuery([]));
      PurchaseOrder.find.mockReturnValue(mockQuery([]));
      Grn.find.mockReturnValue(mockQuery([]));
      DebitNote.find.mockReturnValue(mockQuery([]));
      CreditNote.find.mockReturnValue(mockQuery([]));

      const context = await loadControlledDatabaseContext();

      expect(context.lowStockItems).toEqual([
        { skuCode: 'S2', skuName: 'Item 2', currentQty: 5, reorderLevel: 20 }
      ]);
    });
  });
});
