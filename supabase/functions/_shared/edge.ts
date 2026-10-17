import { createClient } from "npm:@supabase/supabase-js@2.116.0";
import { paystackApi, PaystackError, type Deps } from "./payments.ts";

// Secrets live in Edge Function secrets, never in VITE_ variables:
//   PAYSTACK_SECRET_KEY  sk_test_… or sk_live_…
//   SITE_ORIGINS         comma-separated origins allowed to call from a browser
//   SIESIE_CRON_SECRET   shared with the pg_cron job in supabase/cron.sql

export class ConfigError extends Error {}
export class DbError extends Error {
  forbidden: boolean;
  constructor(message: string, forbidden: boolean) {
    super(message);
    this.forbidden = forbidden;
  }
}

const service = () =>
  createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false, autoRefreshToken: false } });

export function paymentDeps(): Deps {
  const secret = Deno.env.get("PAYSTACK_SECRET_KEY");
  if (!secret) throw new ConfigError("PAYSTACK_SECRET_KEY is not set.");
  const client = service();
  return {
    rpc: async (action, input) => {
      const { data, error } = await client.rpc("siesie_payments", { action, input });
      if (error) throw new DbError(error.message, error.code === "42501");
      return data;
    },
    paystack: paystackApi(secret),
    log: (message) => console.error(message),
  };
}

export async function userFrom(req: Request) {
  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  const { data, error } = await service().auth.getUser(authorization.slice(7));
  return error ? null : data.user;
}

export function browserHeaders(req: Request) {
  const origins = (Deno.env.get("SITE_ORIGINS") || "").split(",").map((s) => s.trim()).filter(Boolean);
  const origin = req.headers.get("Origin") || "";
  const allowed = !!origin && origins.includes(origin);
  const headers = {
    "Content-Type": "application/json", "Cache-Control": "no-store", "Vary": "Origin",
    "Access-Control-Allow-Origin": allowed ? origin : "null",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
  return { origin, allowed, headers };
}

export async function readJson(req: Request, maxLength: number): Promise<Record<string, unknown>> {
  const text = await req.text();
  if (text.length > maxLength) throw new DbError("Request is too large.", false);
  try {
    const value = JSON.parse(text || "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch {
    throw new DbError("Send a JSON request.", false);
  }
}

export function sameSecret(given: string | null, expected: string) {
  if (!given || given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

/** Turns an error into a reply a customer or admin can act on. No money moved unless the reply says so. */
export function failure(error: unknown, headers: Record<string, string>) {
  const reply = (status: number, message: string) => Response.json({ error: message }, { status, headers });
  if (error instanceof DbError) return reply(error.forbidden ? 403 : 400, error.message);
  if (error instanceof ConfigError) return reply(503, "Payments have not been set up yet.");
  if (error instanceof PaystackError) return reply(502, error.ambiguous ? "Paystack did not answer. Please try again in a few minutes." : `Paystack: ${error.message}`);
  console.error(error);
  return reply(500, "Something went wrong. Please try again.");
}
