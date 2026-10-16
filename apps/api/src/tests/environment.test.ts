import { parseEnvironment } from "../config/environment";
const production = {
  NODE_ENV: "production",
  MONGODB_URI: "mongodb://localhost/db",
  JWT_SECRET: "a-private-long-secret-at-least-thirty-two-characters",
  CORS_ORIGIN: "https://app.example.com",
  TRUST_PROXY_HOPS: "2",
};
test("production accepts an HTTPS origin and two trusted proxy hops", () => {
  expect(parseEnvironment(production).TRUST_PROXY_HOPS).toBe(2);
});
test("production rejects HTTP because secure cookies require HTTPS", () => {
  expect(() =>
    parseEnvironment({ ...production, CORS_ORIGIN: "http://app.example.com" }),
  ).toThrow(/HTTPS/);
});
test("production rejects an origin with path, query, hash or credentials", () => {
  for (const origin of [
    "https://app.example.com/path",
    "https://app.example.com?x=1",
    "https://app.example.com#x",
    "https://user:pass@app.example.com",
  ])
    expect(() =>
      parseEnvironment({ ...production, CORS_ORIGIN: origin }),
    ).toThrow(/HTTPS/);
});
test("production rejects placeholder JWT secrets", () => {
  expect(() =>
    parseEnvironment({
      ...production,
      JWT_SECRET: "replace-with-a-random-secret-at-least-32-characters",
    }),
  ).toThrow(/JWT_SECRET/);
});
test("development continues to allow local HTTP", () => {
  expect(
    parseEnvironment({
      ...production,
      NODE_ENV: "development",
      CORS_ORIGIN: "http://127.0.0.1:5173",
    }).NODE_ENV,
  ).toBe("development");
});
test("environment requires a database URI and bounded proxy hops", () => {
  expect(() =>
    parseEnvironment({ ...production, MONGODB_URI: undefined }),
  ).toThrow();
  expect(() =>
    parseEnvironment({ ...production, TRUST_PROXY_HOPS: "4" }),
  ).toThrow();
});

test("production canonicalizes origin for browser CORS matching", () => {
  expect(
    parseEnvironment({
      ...production,
      CORS_ORIGIN: "https://APP.example.com:443/",
    }).CORS_ORIGIN,
  ).toBe("https://app.example.com");
});

test("ENABLE_API_DOCS defaults to false and parses strings/booleans correctly", () => {
  expect(parseEnvironment(production).ENABLE_API_DOCS).toBe(false);
  expect(
    parseEnvironment({ ...production, ENABLE_API_DOCS: "true" })
      .ENABLE_API_DOCS,
  ).toBe(true);
  expect(
    parseEnvironment({ ...production, ENABLE_API_DOCS: "1" })
      .ENABLE_API_DOCS,
  ).toBe(true);
  expect(
    parseEnvironment({ ...production, ENABLE_API_DOCS: "false" })
      .ENABLE_API_DOCS,
  ).toBe(false);
});

