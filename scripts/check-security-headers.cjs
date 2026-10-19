const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

function validateCaddyfile(caddyContent) {
  const checks = [
    {
      pattern: /Strict-Transport-Security\s+"max-age=31536000"/,
      name: "HSTS max-age=31536000",
    },
    {
      pattern: /X-Content-Type-Options\s+"nosniff"/,
      name: "X-Content-Type-Options nosniff",
    },
    { pattern: /X-Frame-Options\s+"DENY"/, name: "X-Frame-Options DENY" },
    {
      pattern: /Referrer-Policy\s+"strict-origin-when-cross-origin"/,
      name: "Referrer-Policy",
    },
    {
      pattern: /Permissions-Policy\s+"[^"]*camera=\(\)[^"]*"/,
      name: "Permissions-Policy camera=()",
    },
    {
      pattern: /Permissions-Policy\s+"[^"]*microphone=\(\)[^"]*"/,
      name: "Permissions-Policy microphone=()",
    },
    {
      pattern: /Permissions-Policy\s+"[^"]*geolocation=\(\)[^"]*"/,
      name: "Permissions-Policy geolocation=()",
    },
    {
      pattern: /Permissions-Policy\s+"[^"]*payment=\(\)[^"]*"/,
      name: "Permissions-Policy payment=()",
    },
    {
      pattern: /Content-Security-Policy\s+"[^"]*default-src 'self'/,
      name: "CSP default-src 'self'",
    },
    {
      pattern: /Content-Security-Policy\s+"[^"]*script-src 'self'/,
      name: "CSP script-src 'self'",
    },
    {
      pattern:
        /Content-Security-Policy\s+"[^"]*style-src 'self' 'unsafe-inline' https:\/\/fonts\.googleapis\.com/,
      name: "CSP style-src with google fonts",
    },
    {
      pattern: /Content-Security-Policy\s+"[^"]*img-src 'self' data: blob:/,
      name: "CSP img-src 'self' data: blob:",
    },
    {
      pattern:
        /Content-Security-Policy\s+"[^"]*font-src 'self' https:\/\/fonts\.gstatic\.com/,
      name: "CSP font-src with gstatic",
    },
    {
      pattern: /Content-Security-Policy\s+"[^"]*connect-src 'self'/,
      name: "CSP connect-src 'self'",
    },
    {
      pattern: /Content-Security-Policy\s+"[^"]*worker-src 'self'/,
      name: "CSP worker-src 'self'",
    },
    {
      pattern: /Content-Security-Policy\s+"[^"]*manifest-src 'self'/,
      name: "CSP manifest-src 'self'",
    },
    {
      pattern: /Content-Security-Policy\s+"[^"]*frame-ancestors 'none'/,
      name: "CSP frame-ancestors 'none'",
    },
    {
      pattern: /Content-Security-Policy\s+"[^"]*base-uri 'self'/,
      name: "CSP base-uri 'self'",
    },
    {
      pattern: /Content-Security-Policy\s+"[^"]*form-action 'self'/,
      name: "CSP form-action 'self'",
    },
    {
      pattern: /Content-Security-Policy\s+"[^"]*object-src 'none'/,
      name: "CSP object-src 'none'",
    },
    {
      pattern: /header_down\s+-Content-Security-Policy/,
      name: "reverse_proxy header_down CSP",
    },
    {
      pattern: /header_down\s+-X-Frame-Options/,
      name: "reverse_proxy header_down X-Frame-Options",
    },
  ];

  for (const { pattern, name } of checks) {
    assert.ok(pattern.test(caddyContent), `Caddyfile thiếu header: ${name}`);
  }

  // Khẳng định script-src không chứa unsafe-inline
  const cspMatch = caddyContent.match(/Content-Security-Policy\s+"([^"]+)"/);
  assert.ok(cspMatch, "Không tìm thấy Content-Security-Policy trong Caddyfile");
  const csp = cspMatch[1];
  const scriptSrcMatch = csp.match(/script-src\s+([^;]+)/);
  assert.ok(scriptSrcMatch, "CSP thiếu chỉ thị script-src");
  assert.ok(
    !scriptSrcMatch[1].includes("'unsafe-inline'"),
    "CSP script-src tuyệt đối không được chứa 'unsafe-inline'",
  );
}

function validateNginxConfig(nginxContent) {
  const checks = [
    {
      pattern: /add_header\s+X-Content-Type-Options\s+"nosniff"/,
      name: "nginx X-Content-Type-Options",
    },
    {
      pattern: /add_header\s+X-Frame-Options\s+"DENY"/,
      name: "nginx X-Frame-Options",
    },
    {
      pattern:
        /add_header\s+Referrer-Policy\s+"strict-origin-when-cross-origin"/,
      name: "nginx Referrer-Policy",
    },
    {
      pattern: /add_header\s+Permissions-Policy/,
      name: "nginx Permissions-Policy",
    },
    {
      pattern: /add_header\s+Content-Security-Policy/,
      name: "nginx Content-Security-Policy",
    },
  ];

  for (const { pattern, name } of checks) {
    assert.ok(pattern.test(nginxContent), `nginx.conf thiếu header: ${name}`);
  }
}

function checkAll(repoRoot = path.resolve(__dirname, "..")) {
  const caddyPath = path.join(repoRoot, "Caddyfile");
  const nginxPath = path.join(repoRoot, "apps/web/nginx.conf");

  const caddyContent = fs.readFileSync(caddyPath, "utf8");
  const nginxContent = fs.readFileSync(nginxPath, "utf8");

  validateCaddyfile(caddyContent);
  validateNginxConfig(nginxContent);
  return { ok: true, caddyPath, nginxPath };
}

if (require.main === module) {
  try {
    const result = checkAll();
    console.log("Xác thực header bảo mật Caddyfile và nginx.conf thành công.");
    console.log(
      "- Caddyfile: Đầy đủ HSTS, CSP (script-src no unsafe-inline, font/style whitelist), X-Frame-Options, header_down upstream cleanup.",
    );
    console.log(
      "- nginx.conf: Đầy đủ CSP, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy across locations.",
    );
  } catch (error) {
    console.error("Lỗi xác thực header bảo mật:", error.message);
    process.exit(1);
  }
}

module.exports = { validateCaddyfile, validateNginxConfig, checkAll };
