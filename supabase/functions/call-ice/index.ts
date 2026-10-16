import { createClient } from "npm:@supabase/supabase-js@2.116.0";

// The long-lived TURN token stays in Edge Function secrets, never in a VITE_ variable.
Deno.serve(async (req: Request) => {
  const origins = (Deno.env.get("SITE_ORIGINS") || "").split(",").map((s) => s.trim()).filter(Boolean);
  const origin = req.headers.get("Origin") || "";
  const headers = { "Content-Type": "application/json", "Cache-Control": "no-store", "Vary": "Origin",
    "Access-Control-Allow-Origin": origins.includes(origin) ? origin : "null",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
  const reply = (status: number, error: string) => Response.json({ error }, { status, headers });
  if (!origin || !origins.includes(origin)) return reply(403, "Origin is not allowed.");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return reply(405, "Use POST.");
  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return reply(401, "Log in to call.");
  const keyId = Deno.env.get("CLOUDFLARE_TURN_KEY_ID");
  const token = Deno.env.get("CLOUDFLARE_TURN_API_TOKEN");
  if (!keyId || !token) return reply(503, "Calling has not been configured.");
  try {
    const body = await req.text();
    if (body.length > 1000) return reply(400, "Request too large.");
    const { callId, device } = JSON.parse(body);
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuid.test(callId) || !uuid.test(device)) return reply(400, "Invalid call.");
    const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: authError } = await client.auth.getUser(authorization.slice(7));
    if (authError || !user) return reply(401, "Log in to call.");
    const { data: allowed, error } = await client.rpc("siesie_call", { action: "relay", input: { callId, device } });
    if (error || !allowed?.allowed) return reply(403, "This call is unavailable.");
    const response = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(keyId)}/credentials/generate-ice-servers`, {
      method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ttl: 7200 }), signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return reply(503, "The call relay is unavailable.");
    const result = await response.json();
    if (!Array.isArray(result.iceServers) || !result.iceServers.length) return reply(503, "The call relay is unavailable.");
    return Response.json({ iceServers: result.iceServers }, { headers });
  } catch { return reply(503, "The call could not connect. Please try again."); }
});
