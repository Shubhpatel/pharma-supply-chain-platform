const mongoose = require("mongoose");
const connectDB = require("./src/config/db");

jest.mock("mongoose");

describe("connectDB", () => {
  let originalEnv;
  let logSpy;
  let errorSpy;
  let exitSpy;

  beforeEach(() => {
    originalEnv = process.env.MONGO_URI;
    logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    exitSpy = jest.spyOn(process, "exit").mockImplementation(() => {});
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env.MONGO_URI = originalEnv;
    logSpy.mockRestore();
    errorSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it("should connect to MongoDB successfully using process.env.MONGO_URI", async () => {
    process.env.MONGO_URI = "mongodb://test-uri:27017/test-db";
    mongoose.connect.mockResolvedValueOnce();

    await connectDB();

    expect(mongoose.connect).toHaveBeenCalledWith("mongodb://test-uri:27017/test-db");
    expect(logSpy).toHaveBeenCalledWith("MongoDB connected:", "mongodb://test-uri:27017/test-db");
  });

  it("should connect to MongoDB successfully using default URI if env is not set", async () => {
    delete process.env.MONGO_URI;
    mongoose.connect.mockResolvedValueOnce();

    await connectDB();

    expect(mongoose.connect).toHaveBeenCalledWith("mongodb://127.0.0.1:27017/pharma-inventory");
    expect(logSpy).toHaveBeenCalledWith("MongoDB connected:", "mongodb://127.0.0.1:27017/pharma-inventory");
  });

  it("should exit process on connection error", async () => {
    const error = new Error("Connection failed");
    mongoose.connect.mockRejectedValueOnce(error);

    await connectDB();

    expect(mongoose.connect).toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith("MongoDB connection error:", "Connection failed");
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
