const { defineConfig } = require("vitest/config");

module.exports = defineConfig({
  test: {
    globalSetup: "./tests/globalSetup.js",
    testTimeout: 20000,
    hookTimeout: 30000,
  },
});
