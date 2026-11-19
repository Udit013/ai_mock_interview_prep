import fs from "fs";
import { describe, expect, it } from "vitest";
import { FIREBASE_AUTH_DOMAIN, JS_WORKER_CSP, PY_WORKER_CSP, pageCsp } from "@/lib/security/csp";
import { PYODIDE_BASE, PY_WORKER_SOURCE } from "@/lib/runner/worker-sources";

const directive = (csp: string, name: string) =>
  csp.split("; ").find((d) => d === name || d.startsWith(name + " ")) ?? "";

describe("page CSP", () => {
  const prod = pageCsp({ nonce: "abc123" });

  it("allows scripts only by nonce, with strict-dynamic", () => {
    const script = directive(prod, "script-src");
    expect(script).toContain("'nonce-abc123'");
    expect(script).toContain("'strict-dynamic'");
    expect(script).not.toContain("'unsafe-inline'");
    expect(script).not.toContain("'unsafe-eval'");
  });

  it("locks down framing, plugins, base and forms", () => {
    expect(directive(prod, "frame-ancestors")).toBe("frame-ancestors 'none'");
    expect(directive(prod, "object-src")).toBe("object-src 'none'");
    expect(directive(prod, "base-uri")).toBe("base-uri 'self'");
    expect(directive(prod, "form-action")).toBe("form-action 'self'");
    expect(prod).toContain("upgrade-insecure-requests");
  });

  it("permits Firebase's sign-in frame and same-origin workers", () => {
    expect(directive(prod, "frame-src")).toContain(`https://${FIREBASE_AUTH_DOMAIN}`);
    expect(directive(prod, "worker-src")).toBe("worker-src 'self' blob:");
  });

  it("only loosens for local development", () => {
    const dev = pageCsp({ nonce: "x", dev: true });
    expect(directive(dev, "script-src")).toContain("'unsafe-eval'");
    expect(dev).not.toContain("upgrade-insecure-requests");
  });

  it("keeps the auth domain in sync with the Firebase client config", () => {
    expect(fs.readFileSync("firebase/client.ts", "utf8")).toContain(`authDomain: "${FIREBASE_AUTH_DOMAIN}"`);
  });
});

describe("code-runner worker CSPs", () => {
  it("gives the JavaScript sandbox eval but no network", () => {
    expect(JS_WORKER_CSP).toBe("default-src 'none'; script-src 'unsafe-eval'");
  });

  it("lets the Python sandbox reach only the pinned Pyodide path", () => {
    expect(PY_WORKER_SOURCE).toContain(`importScripts('${PYODIDE_BASE}pyodide.js')`);
    expect(PYODIDE_BASE.startsWith("https://cdn.jsdelivr.net/pyodide/")).toBe(true);
    expect(directive(PY_WORKER_CSP, "connect-src")).toBe("connect-src https://cdn.jsdelivr.net/pyodide/");
    expect(directive(PY_WORKER_CSP, "script-src")).toContain("'wasm-unsafe-eval'");
  });
});
