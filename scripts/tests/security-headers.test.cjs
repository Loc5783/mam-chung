const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  checkAll,
  validateCaddyfile,
  validateNginxConfig,
} = require("../check-security-headers.cjs");

test("security headers script validates Caddyfile and nginx.conf successfully", () => {
  const result = checkAll();
  assert.equal(result.ok, true);
});

test("validateCaddyfile catches missing headers or unsafe-inline in script-src", () => {
  assert.throws(() => validateCaddyfile(""), /Caddyfile thiếu header/);

  const unsafeCaddy = `
{$DOMAIN} {
  header {
    Strict-Transport-Security "max-age=31536000"
    X-Content-Type-Options "nosniff"
    X-Frame-Options "DENY"
    Referrer-Policy "strict-origin-when-cross-origin"
    Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=()"
    Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob:; font-src 'self' https://fonts.gstatic.com; connect-src 'self'; worker-src 'self'; manifest-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none';"
  }
  reverse_proxy web:80 {
    header_down -Content-Security-Policy
    header_down -X-Frame-Options
  }
}
`;
  assert.throws(
    () => validateCaddyfile(unsafeCaddy),
    /script-src tuyệt đối không được chứa 'unsafe-inline'/,
  );
});

test("validateNginxConfig catches missing directives", () => {
  assert.throws(
    () => validateNginxConfig("server { listen 80; }"),
    /nginx.conf thiếu header/,
  );
});
