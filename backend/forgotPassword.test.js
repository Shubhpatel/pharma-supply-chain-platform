const express = require("express");
const request = require("supertest");
const bcrypt = require("bcryptjs");

jest.mock("./src/models/User");
const User = require("./src/models/User");

const authRoutes = require("./src/routes/auth.routes");

const app = express();
app.use(express.json());
app.use("/api/auth", authRoutes);

describe("Forgot Password & Reset Password Auth Routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should generate a reset token for existing user", async () => {
    const mockUser = {
      _id: "user123",
      email: "test@example.com",
      save: jest.fn().mockResolvedValue(true),
    };
    User.findOne.mockResolvedValue(mockUser);

    const res = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "test@example.com" });

    expect(res.status).toBe(200);
    expect(res.body.resetToken).toBeDefined();
    expect(mockUser.resetPasswordToken).toBeDefined();
    expect(mockUser.resetPasswordExpires).toBeDefined();
    expect(mockUser.save).toHaveBeenCalled();
  });

  it("should return generic message if user does not exist", async () => {
    User.findOne.mockResolvedValue(null);

    const res = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "nonexistent@example.com" });

    expect(res.status).toBe(200);
    expect(res.body.message).toContain("If an account with that email exists");
    expect(res.body.resetToken).toBeUndefined();
  });

  it("should reset password successfully with valid token", async () => {
    const mockUser = {
      _id: "user123",
      passwordHash: "oldhash",
      save: jest.fn().mockResolvedValue(true),
    };
    User.findOne.mockResolvedValue(mockUser);

    const res = await request(app)
      .post("/api/auth/reset-password")
      .send({ token: "validtoken123", newPassword: "newpassword123" });

    expect(res.status).toBe(200);
    expect(res.body.message).toContain("successfully");
    expect(mockUser.resetPasswordToken).toBeUndefined();
    expect(mockUser.resetPasswordExpires).toBeUndefined();
    expect(mockUser.save).toHaveBeenCalled();
  });

  it("should reject password reset with invalid or expired token", async () => {
    User.findOne.mockResolvedValue(null);

    const res = await request(app)
      .post("/api/auth/reset-password")
      .send({ token: "invalidtoken123", newPassword: "newpassword123" });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("invalid or has expired");
  });
});
