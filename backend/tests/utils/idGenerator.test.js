const { nextNumber } = require('../../src/utils/idGenerator');

describe('nextNumber', () => {
  it('generates the first number correctly (count is 0)', async () => {
    const Model = {
      countDocuments: jest.fn().mockResolvedValue(0),
    };
    const result = await nextNumber(Model, 'myField', 'PO');
    expect(result).toBe('PO-000001');
    expect(Model.countDocuments).toHaveBeenCalledTimes(1);
  });

  it('generates a sequential number correctly (count is > 0)', async () => {
    const Model = {
      countDocuments: jest.fn().mockResolvedValue(42),
    };
    const result = await nextNumber(Model, 'myField', 'GRN');
    expect(result).toBe('GRN-000043');
    expect(Model.countDocuments).toHaveBeenCalledTimes(1);
  });

  it('handles counts correctly that require padding reduction', async () => {
    const Model = {
      countDocuments: jest.fn().mockResolvedValue(99999),
    };
    const result = await nextNumber(Model, 'myField', 'INV');
    expect(result).toBe('INV-100000');
    expect(Model.countDocuments).toHaveBeenCalledTimes(1);
  });

  it('does not truncate large numbers', async () => {
    const Model = {
      countDocuments: jest.fn().mockResolvedValue(1000000),
    };
    const result = await nextNumber(Model, 'myField', 'INV');
    expect(result).toBe('INV-1000001');
    expect(Model.countDocuments).toHaveBeenCalledTimes(1);
  });
});
