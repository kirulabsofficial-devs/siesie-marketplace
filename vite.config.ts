import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
  if (mode === "live") {
    const env = loadEnv(mode, ".", "VITE_");
    if (!env.VITE_SUPABASE_URL?.startsWith("https://") || !env.VITE_SUPABASE_PUBLISHABLE_KEY) throw new Error("Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY before building the live site.");
    const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
    let publicKey = key.startsWith("sb_publishable_");
    if (key.split(".").length === 3) {
      try { publicKey = JSON.parse(atob(key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).role === "anon"; } catch { publicKey = false; }
    }
    if (!publicKey) throw new Error("Use the public Supabase publishable/anon key, never a secret or service-role key in VITE_ variables.");
  }
  return {
  plugins: [react(), tailwindcss()],
  server: { port: 5178 },
  preview: { port: 5178 },
  };
});
