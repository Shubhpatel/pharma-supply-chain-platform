const request = require("supertest");
const express = require("express");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET = "test-secret-key-123";
const JWT_SECRET = process.env.JWT_SECRET;
const dummyUserId = "60d5ecb8b5c9c22b8c8b4567";
const token = jwt.sign({ id: dummyUserId, email: "test@example.com", role: "ADMIN", permissions: ["reports"] }, JWT_SECRET);

jest.mock("../../src/middleware/auth", () => ({
  requireAuth: (req, res, next) => { req.user = { id: dummyUserId, role: "ADMIN", permissions: ["reports"] }; next(); },
  requirePermission: () => (req, res, next) => next()
}));

const reportsRoutes = require("../../src/routes/reports.routes");

const app = express();
app.use(express.json());
app.use("/api/reports", reportsRoutes);

describe("Reports Routes Error Path", () => {
    let globalFetch;
    beforeAll(() => {
        globalFetch = global.fetch;
    });

    afterAll(() => {
        global.fetch = globalFetch;
    });

    test("1. Gemini API error path should be covered and handled", async () => {
      global.fetch = jest.fn(() => Promise.reject(new Error("Network Error")));
      process.env.GEMINI_API_KEY = "test-api-key";

      const res = await request(app)
        .post("/api/reports/ai-summary")
        .set("Authorization", `Bearer ${token}`)
        .send({ reportType: "Sales", data: [] });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("report");
      expect(typeof res.body.report).toBe('string');
      expect(res.body.report).toContain("Executive summary");

      expect(global.fetch).toHaveBeenCalled();
    });

    test("2. AbortError is handled gracefully", async () => {
      const abortError = new Error("AbortError");
      abortError.name = "AbortError";
      global.fetch = jest.fn(() => Promise.reject(abortError));
      process.env.GEMINI_API_KEY = "test-api-key";

      const res = await request(app)
        .post("/api/reports/ai-summary")
        .set("Authorization", `Bearer ${token}`)
        .send({ reportType: "Sales", data: [] });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("report");
      expect(typeof res.body.report).toBe('string');
      expect(res.body.report).toContain("Executive summary");

      expect(global.fetch).toHaveBeenCalled();
    });
});
