const { dateDaysAgo, makeItems, today, expiryDate } = require("./seedTestData");

describe("Seed Test Data Utilities", () => {
  describe("dateDaysAgo", () => {
    it("should return a date that is exactly 'days' ago from the script's 'today'", () => {
      const days = 10;
      const expectedDate = new Date(today);
      expectedDate.setDate(expectedDate.getDate() - days);

      const result = dateDaysAgo(days);

      expect(result).toBeInstanceOf(Date);
      expect(result.getTime()).toBe(expectedDate.getTime());
    });

    it("should handle 0 days ago (returning today)", () => {
      const result = dateDaysAgo(0);
      expect(result.getTime()).toBe(today.getTime());
    });
  });

  describe("makeItems", () => {
    const mockSkus = [
      { _id: "sku1", name: "Paracetamol", mrp: 100 },
      { _id: "sku2", name: "Amoxicillin", mrp: 250 },
    ];

    it("should correctly generate items for 'grn' type", () => {
      const index = 0;
      const type = "grn";
      const result = makeItems(mockSkus, index, type);

      expect(result).toHaveLength(2);

      // Verify the first item (skuIndex 0)
      expect(result[0].sku).toBe("sku1");
      expect(result[0].skuName).toBe("Paracetamol");
      expect(result[0].qty).toBe(50 + index * 10 + 0 * 5); // 50
      expect(result[0].qtyOrdered).toBe(100 + index * 20 + 0 * 10); // 100
      expect(result[0].qtyReceived).toBe(50);
      expect(result[0].batch).toBe("TEST-BATCH-01-1");
      expect(result[0].expiryDate).toBe(expiryDate);
      expect(result[0].mrp).toBe(100);
      expect(result[0].rate).toBe(60); // 100 * 0.6
      expect(result[0].amount).toBe(50 * 60);
      expect(result[0].gstRate).toBe(12);
      expect(result[0].gstAmount).toBe(50 * 60 * 0.12);

      // Verify the second item (skuIndex 1)
      expect(result[1].sku).toBe("sku2");
      expect(result[1].skuName).toBe("Amoxicillin");
      expect(result[1].qty).toBe(50 + index * 10 + 1 * 5); // 55
      expect(result[1].qtyOrdered).toBe(100 + index * 20 + 1 * 10); // 110
      expect(result[1].qtyReceived).toBe(55);
      expect(result[1].batch).toBe("TEST-BATCH-01-2");
      expect(result[1].rate).toBe(150); // 250 * 0.6
    });

    it("should correctly generate items for 'sale' type", () => {
      const index = 1;
      const type = "sale";
      const result = makeItems(mockSkus, index, type);

      expect(result).toHaveLength(2);

      // Verify the first item
      expect(result[0].qty).toBe(100 + index * 20 + 0 * 10); // 120
      expect(result[0].qtyOrdered).toBeUndefined();
      expect(result[0].qtyReceived).toBeUndefined();
      expect(result[0].batch).toBe("TEST-BATCH-02-1");
      expect(result[0].rate).toBe(90); // 100 * 0.9

      // Verify the second item
      expect(result[1].qty).toBe(100 + index * 20 + 1 * 10); // 130
      expect(result[1].qtyOrdered).toBeUndefined();
      expect(result[1].qtyReceived).toBeUndefined();
      expect(result[1].batch).toBe("TEST-BATCH-02-2");
      expect(result[1].rate).toBe(225); // 250 * 0.9
    });

    it("should correctly generate items for 'po' type", () => {
      const index = 2;
      const type = "po";
      const result = makeItems(mockSkus, index, type);

      expect(result).toHaveLength(2);

      // Verify the first item
      expect(result[0].qty).toBe(100 + index * 20 + 0 * 10); // 140
      expect(result[0].qtyOrdered).toBeUndefined();
      expect(result[0].qtyReceived).toBeUndefined();
      expect(result[0].batch).toBe("TEST-BATCH-03-1");
      expect(result[0].rate).toBe(60); // 100 * 0.6
    });

    it("should round the rate properly", () => {
      const oddSkus = [{ _id: "sku3", name: "Odd", mrp: 99.99 }];

      const grnResult = makeItems(oddSkus, 0, "grn");
      // 99.99 * 0.6 = 59.994 -> rounded to 59.99
      expect(grnResult[0].rate).toBe(59.99);

      const saleResult = makeItems(oddSkus, 0, "sale");
      // 99.99 * 0.9 = 89.991 -> rounded to 89.99
      expect(saleResult[0].rate).toBe(89.99);
    });
  });
});
