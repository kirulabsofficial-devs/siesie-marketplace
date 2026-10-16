// Compatibility entry point. The former browser-local chat checks are replaced by
// isolated, server-backed two-browser journeys. Build the app first.
import("./e2e.mjs").catch((error) => { console.error(error); process.exitCode = 1; });
