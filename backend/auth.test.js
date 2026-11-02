const express = require("express");
const request = require("supertest");

jest.mock("./src/models/User");
const User = require("./src/models/User");

const authRoutes = require("./src/routes/auth.routes");

const app = express();
app.use(express.json());
app.use("/api/auth", authRoutes);

// Mock error-handling middleware to catch next(err)
app.use((err, req, res, next) => {
  res.status(500).json({ error: "Internal server error" });
});

describe("Auth Routes Error Paths", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return 500 when login encounters an error", async () => {
    User.findOne.mockRejectedValue(new Error("Database error"));

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "test@example.com", password: "password123" });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe("Internal server error");
  });

  it("should return 500 when forgot-password encounters an error", async () => {
    User.findOne.mockRejectedValue(new Error("Database error"));

    const res = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "test@example.com" });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe("Internal server error");
  });

  it("should return 500 when reset-password encounters an error", async () => {
    User.findOne.mockRejectedValue(new Error("Database error"));

    const res = await request(app)
      .post("/api/auth/reset-password")
      .send({ token: "validtoken123", newPassword: "newpassword123" });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe("Internal server error");
  });
});
