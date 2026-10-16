process.env.MONGOMS_IP = "127.0.0.1";

module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/*.test.ts"],
  setupFiles: ["<rootDir>/src/tests/setup.ts"],
  testTimeout: 30000,
  clearMocks: true,
  collectCoverage: true,
  collectCoverageFrom: ["src/modules/*/service.ts"],
  coverageThreshold: {
    global: { statements: 80, branches: 80, functions: 80, lines: 80 },
  },
};
