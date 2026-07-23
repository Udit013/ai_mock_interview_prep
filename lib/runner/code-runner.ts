/**
 * Client-side code execution for coding interviews.
 *
 * Everything runs inside a Web Worker, which matters for two reasons:
 *  1. Isolation — worker scope has no DOM, no cookies, no access to the app.
 *  2. Termination — an infinite loop can be killed with `worker.terminate()`,
 *     which is impossible for code running on the main thread.
 *
 * JavaScript runs instantly. Python runs on Pyodide (WASM), lazily fetched on
 * first use and kept warm in a persistent worker afterwards.
 */

export type RunnableLanguage = "javascript" | "python";

export interface RunResult {
  logs: string[];
  error?: string;
  timedOut?: boolean;
  durationMs: number;
}

export const RUNNABLE_LANGUAGES: RunnableLanguage[] = ["javascript", "python"];

export function isRunnable(language: string): language is RunnableLanguage {
  return (RUNNABLE_LANGUAGES as string[]).includes(language);
}

// ── JavaScript ───────────────────────────────────────────────────────────────

const JS_WORKER_SOURCE = `
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

function runJavaScript(code: string, timeoutMs: number): Promise<RunResult> {
  return new Promise((resolve) => {
    const started = performance.now();
    let worker: Worker | null = null;
    let url = "";
    let settled = false;

    const finish = (partial: Omit<RunResult, "durationMs">) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        worker?.terminate();
      } catch {
        /* already gone */
      }
      if (url) URL.revokeObjectURL(url);
      resolve({ ...partial, durationMs: Math.round(performance.now() - started) });
    };

    const timer = setTimeout(
      () =>
        finish({
          logs: [],
          timedOut: true,
          error: `Execution timed out after ${timeoutMs / 1000}s — check for an infinite loop.`,
        }),
      timeoutMs
    );

    try {
      const blob = new Blob([JS_WORKER_SOURCE], {
        type: "application/javascript",
      });
      url = URL.createObjectURL(blob);
      worker = new Worker(url);
      worker.onmessage = (ev: MessageEvent) =>
        finish({ logs: ev.data?.logs ?? [], error: ev.data?.error });
      worker.onerror = (ev: ErrorEvent) =>
        finish({ logs: [], error: ev.message || "Sandbox error." });
      worker.postMessage({ code });
    } catch (e) {
      finish({
        logs: [],
        error: e instanceof Error ? e.message : "Failed to start the sandbox.",
      });
    }
  });
}

// ── Python (Pyodide) ─────────────────────────────────────────────────────────

const PYODIDE_VERSION = "0.26.4";
const PYODIDE_BASE = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

const PY_WORKER_SOURCE = `
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

let pyWorker: Worker | null = null;
let pyWorkerUrl = "";
/** True once Pyodide has finished downloading at least once in this worker. */
let pyWarm = false;

function disposePythonWorker() {
  try {
    pyWorker?.terminate();
  } catch {
    /* already gone */
  }
  if (pyWorkerUrl) URL.revokeObjectURL(pyWorkerUrl);
  pyWorker = null;
  pyWorkerUrl = "";
  pyWarm = false;
}

/** Whether the Python runtime still needs its (one-time) ~10 MB download. */
export function pythonNeedsWarmup(): boolean {
  return !pyWarm;
}

function runPython(code: string, timeoutMs: number): Promise<RunResult> {
  return new Promise((resolve) => {
    const started = performance.now();
    let settled = false;

    const finish = (partial: Omit<RunResult, "durationMs">) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ ...partial, durationMs: Math.round(performance.now() - started) });
    };

    const timer = setTimeout(() => {
      // Kill the worker so a runaway loop can't wedge future runs.
      disposePythonWorker();
      finish({
        logs: [],
        timedOut: true,
        error: `Execution timed out after ${Math.round(timeoutMs / 1000)}s — check for an infinite loop, or retry if the runtime was still downloading.`,
      });
    }, timeoutMs);

    try {
      if (!pyWorker) {
        const blob = new Blob([PY_WORKER_SOURCE], {
          type: "application/javascript",
        });
        pyWorkerUrl = URL.createObjectURL(blob);
        pyWorker = new Worker(pyWorkerUrl);
      }

      pyWorker.onmessage = (ev: MessageEvent) => {
        pyWarm = true;
        finish({ logs: ev.data?.logs ?? [], error: ev.data?.error });
      };
      pyWorker.onerror = (ev: ErrorEvent) => {
        disposePythonWorker();
        finish({
          logs: [],
          error:
            ev.message ||
            "Couldn't load the Python runtime. Check your connection and try again.",
        });
      };
      pyWorker.postMessage({ code });
    } catch (e) {
      disposePythonWorker();
      finish({
        logs: [],
        error:
          e instanceof Error ? e.message : "Failed to start the Python sandbox.",
      });
    }
  });
}

// ── Public entry point ───────────────────────────────────────────────────────

export function runCode(language: string, code: string): Promise<RunResult> {
  if (language === "javascript") return runJavaScript(code, 5000);
  if (language === "python") {
    // The first run also downloads the runtime, so allow much more headroom.
    return runPython(code, pyWarm ? 15000 : 90000);
  }
  return Promise.resolve({
    logs: [],
    error: `Running ${language} in the browser isn't supported — use "Submit for review" to get the interviewer's feedback instead.`,
    durationMs: 0,
  });
}
