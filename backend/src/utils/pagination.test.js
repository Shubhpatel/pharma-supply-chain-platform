const { getPagination, paginationMeta } = require('./pagination');

describe('Pagination Utils', () => {
  describe('getPagination', () => {
    it('should return default pagination when query is empty', () => {
      const result = getPagination({});
      expect(result).toEqual({ page: 1, limit: 25, skip: 0 });
    });

    it('should parse valid page and limit', () => {
      const result = getPagination({ page: '2', limit: '10' });
      expect(result).toEqual({ page: 2, limit: 10, skip: 10 });
    });

    it('should fallback to defaults when page and limit are invalid strings', () => {
      const result = getPagination({ page: 'abc', limit: 'xyz' });
      expect(result).toEqual({ page: 1, limit: 25, skip: 0 });
    });

    it('should handle negative page values by defaulting to 1', () => {
      const result = getPagination({ page: '-5' });
      expect(result).toEqual({ page: 1, limit: 25, skip: 0 });
    });

    it('should handle 0 limit by defaulting to DEFAULT_PAGE_SIZE', () => {
      const result = getPagination({ limit: '0' });
      expect(result.limit).toBe(25);
    });

    it('should cap limit at MAX_PAGE_SIZE (100)', () => {
      const result = getPagination({ limit: '150' });
      expect(result.limit).toBe(100);
    });

    it('should handle negative limit values by defaulting to 1', () => {
      // Number.parseInt("-5") is -5. -5 || 25 is -5. Math.max(-5, 1) is 1. Math.min(1, 100) is 1.
      // Wait, let's trace this carefully:
      // Number.parseInt("-5") = -5. (-5 || 25) = -5 (since -5 is truthy).
      // Math.max(-5, 1) = 1.
      // Math.min(1, 100) = 1.
      // So limit should be 1, not DEFAULT_PAGE_SIZE.
      const result = getPagination({ limit: '-5' });
      expect(result.limit).toBe(1);
    });
  });

  describe('paginationMeta', () => {
    it('should correctly calculate meta for the first page', () => {
      const result = paginationMeta(1, 10, 25);
      expect(result).toEqual({
        page: 1,
        limit: 10,
        total: 25,
        totalPages: 3,
        hasNextPage: true,
        hasPreviousPage: false,
      });
    });

    it('should correctly calculate meta for a middle page', () => {
      const result = paginationMeta(2, 10, 25);
      expect(result).toEqual({
        page: 2,
        limit: 10,
        total: 25,
        totalPages: 3,
        hasNextPage: true,
        hasPreviousPage: true,
      });
    });

    it('should correctly calculate meta for the last page', () => {
      const result = paginationMeta(3, 10, 25);
      expect(result).toEqual({
        page: 3,
        limit: 10,
        total: 25,
        totalPages: 3,
        hasNextPage: false,
        hasPreviousPage: true,
      });
    });

    it('should correctly calculate meta when total matches an exact multiple of limit', () => {
      const result = paginationMeta(2, 10, 20);
      expect(result).toEqual({
        page: 2,
        limit: 10,
        total: 20,
        totalPages: 2,
        hasNextPage: false,
        hasPreviousPage: true,
      });
    });

    it('should correctly calculate meta when total is smaller than limit', () => {
      const result = paginationMeta(1, 10, 5);
      expect(result).toEqual({
        page: 1,
        limit: 10,
        total: 5,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      });
    });
  });
});
