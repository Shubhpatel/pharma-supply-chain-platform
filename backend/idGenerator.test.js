const mongoose = require("mongoose");
const { nextNumber } = require("./src/utils/idGenerator");
const Counter = require("./src/models/Counter");

// Mock Counter model
jest.mock("./src/models/Counter");

// Dummy model to test with
const DummyModel = {
  modelName: "Dummy",
  countDocuments: jest.fn(),
};

describe("idGenerator.nextNumber", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should initialize counter from Model.countDocuments() and generate ID", async () => {
    // Counter.findByIdAndUpdate returns null initially
    Counter.findByIdAndUpdate.mockResolvedValueOnce(null);
    DummyModel.countDocuments.mockResolvedValueOnce(2);
    Counter.create.mockResolvedValueOnce({ _id: "Dummy_testId", seq: 3 });

    const id = await nextNumber(DummyModel, "testId", "TEST");
    expect(id).toBe("TEST-000003");

    expect(Counter.findByIdAndUpdate).toHaveBeenCalledWith(
      "Dummy_testId",
      { $inc: { seq: 1 } },
      { new: true, upsert: false }
    );
    expect(DummyModel.countDocuments).toHaveBeenCalled();
    expect(Counter.create).toHaveBeenCalledWith({ _id: "Dummy_testId", seq: 3 });
  });

  it("should resolve concurrent calls when duplicate key error occurs on creation", async () => {
    // 1st request doesn't find counter, tries to create but fails with 11000
    Counter.findByIdAndUpdate.mockResolvedValueOnce(null);
    DummyModel.countDocuments.mockResolvedValueOnce(0);

    const duplicateError = new Error("Duplicate key");
    duplicateError.code = 11000;
    Counter.create.mockRejectedValueOnce(duplicateError);

    // Fallback findByIdAndUpdate succeeds
    Counter.findByIdAndUpdate.mockResolvedValueOnce({ seq: 2 });

    const id = await nextNumber(DummyModel, "testId", "TEST");
    expect(id).toBe("TEST-000002");

    expect(Counter.findByIdAndUpdate).toHaveBeenCalledTimes(2); // Once initial, once in catch block
  });

  it("should return next number sequentially if counter already exists", async () => {
    Counter.findByIdAndUpdate.mockResolvedValueOnce({ seq: 4 });

    const id = await nextNumber(DummyModel, "testId", "TEST");
    expect(id).toBe("TEST-000004");

    expect(Counter.create).not.toHaveBeenCalled();
    expect(DummyModel.countDocuments).not.toHaveBeenCalled();
  });
});
