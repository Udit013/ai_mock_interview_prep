import Vapi from "@vapi-ai/web";

// Lazy singleton — avoids instantiation in Node.js during Next.js build
let _instance: Vapi | null = null;

function getVapi(): Vapi {
  if (!_instance) {
    _instance = new Vapi(process.env.NEXT_PUBLIC_VAPI_WEB_TOKEN!);
  }
  return _instance;
}

// Proxy so call-sites can still write `vapi.start()` / `vapi.on()` etc.
export const vapi = new Proxy({} as Vapi, {
  get(_target, prop) {
    return getVapi()[prop as keyof Vapi];
  },
});
