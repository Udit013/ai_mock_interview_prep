/**
 * Source of the two code-runner workers, served same-origin by
 * app/runner/<name>/route.ts.
 *
 * Why not blob: URLs (as before)? A blob: worker inherits the page's
 * Content-Security-Policy, so running user code (`new Function`, WebAssembly)
 * would force 'unsafe-eval' onto every page. A worker loaded from its own URL
 * gets its own, much narrower policy instead (see lib/security/csp.ts) — and
 * the JavaScript sandbox loses network access entirely.
 */

export const JS_WORKER_PATH = "/runner/js-worker.js";
export const PY_WORKER_PATH = "/runner/py-worker.js";

export const JS_WORKER_SOURCE = `
self.onmessage = function (e) {
  var logs = [];
  function fmt(v) {
    if (typeof v === 'string') return v;
    if (v instanceof Error) return v.name + ': ' + v.message;
    if (v === undefined) return 'undefined';
    try { return JSON.stringify(v, null, 2); } catch (_) { return String(v); }
  }
  function push() {
    logs.push(Array.prototype.slice.call(arguments).map(fmt).join(' '));
  }
  var sandboxConsole = { log: push, info: push, warn: push, error: push, debug: push };
  try {
    var fn = new Function('console', e.data.code);
    fn(sandboxConsole);
    self.postMessage({ ok: true, logs: logs });
  } catch (err) {
    self.postMessage({
      ok: false,
      logs: logs,
      error: err && err.message ? (err.name || 'Error') + ': ' + err.message : String(err)
    });
  }
};
`;

export const PYODIDE_VERSION = "0.26.4";
export const PYODIDE_BASE = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

export const PY_WORKER_SOURCE = `
importScripts('${PYODIDE_BASE}pyodide.js');
var pyodide = null;
var ready = (async function () {
  pyodide = await loadPyodide({ indexURL: '${PYODIDE_BASE}' });
})();

self.onmessage = async function (e) {
  var logs = [];
  try {
    await ready;
    pyodide.setStdout({ batched: function (s) { logs.push(s); } });
    pyodide.setStderr({ batched: function (s) { logs.push(s); } });
    await pyodide.runPythonAsync(e.data.code);
    self.postMessage({ ok: true, logs: logs });
  } catch (err) {
    self.postMessage({
      ok: false,
      logs: logs,
      error: err && err.message ? err.message : String(err)
    });
  }
};
`;
