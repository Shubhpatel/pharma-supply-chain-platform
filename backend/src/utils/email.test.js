const nodemailer = require("nodemailer");
const { sendPasswordResetEmail } = require("./email");

jest.mock("nodemailer");

describe("Email Utility Tests", () => {
  const originalEnv = { ...process.env };
  let mockSendMail;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    // Safely clear process.env before reassigning to avoid leaking test states
    Object.keys(process.env).forEach(key => delete process.env[key]);
    Object.assign(process.env, originalEnv);

    mockSendMail = jest.fn().mockResolvedValue(true);
    nodemailer.createTransport.mockReturnValue({
      sendMail: mockSendMail,
    });
  });

  afterAll(() => {
    Object.keys(process.env).forEach(key => delete process.env[key]);
    Object.assign(process.env, originalEnv);
  });

  describe("sendPasswordResetEmail", () => {
    test("should throw an error if SMTP configuration is missing", async () => {
      delete process.env.SMTP_HOST;
      process.env.SMTP_PORT = "587";
      process.env.SMTP_USER = "user@test.com";
      process.env.SMTP_PASSWORD = "password";

      await expect(sendPasswordResetEmail("test@test.com", "mock-token")).rejects.toThrow("SMTP email configuration is incomplete");
    });

    test("should call createTransport and sendMail with correct payload using default frontend URL", async () => {
      process.env.SMTP_HOST = "smtp.test.com";
      process.env.SMTP_PORT = "587";
      process.env.SMTP_USER = "user@test.com";
      process.env.SMTP_PASSWORD = "password";
      process.env.SMTP_SECURE = "false";
      delete process.env.FRONTEND_URL;
      delete process.env.SMTP_FROM;

      await sendPasswordResetEmail("test@test.com", "mock-token");

      expect(nodemailer.createTransport).toHaveBeenCalledWith({
        host: "smtp.test.com",
        port: 587,
        secure: false,
        auth: {
          user: "user@test.com",
          pass: "password",
        },
      });

      const resetUrl = "http://localhost:3000/reset-password?token=mock-token";
      expect(mockSendMail).toHaveBeenCalledWith(expect.objectContaining({
        from: "user@test.com",
        to: "test@test.com",
        subject: "Reset your password",
        text: expect.stringContaining(resetUrl),
        html: expect.stringContaining(resetUrl),
      }));
    });

    test("should use FRONTEND_URL and SMTP_FROM environment variables if provided", async () => {
      process.env.SMTP_HOST = "smtp.test.com";
      process.env.SMTP_PORT = "465";
      process.env.SMTP_USER = "user@test.com";
      process.env.SMTP_PASSWORD = "password";
      process.env.SMTP_SECURE = "true";
      process.env.FRONTEND_URL = "https://app.example.com";
      process.env.SMTP_FROM = "noreply@example.com";

      await sendPasswordResetEmail("test@test.com", "mock-token-2");

      expect(nodemailer.createTransport).toHaveBeenCalledWith(expect.objectContaining({
        secure: true,
      }));

      const resetUrl = "https://app.example.com/reset-password?token=mock-token-2";
      expect(mockSendMail).toHaveBeenCalledWith(expect.objectContaining({
        from: "noreply@example.com",
        to: "test@test.com",
        subject: "Reset your password",
        text: expect.stringContaining(resetUrl),
        html: expect.stringContaining(resetUrl),
      }));
    });
  });
});
