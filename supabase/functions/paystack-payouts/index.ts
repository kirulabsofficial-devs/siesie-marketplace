import { processPayouts, resolveDispute, retryPayout } from "../_shared/payments.ts";
import { browserHeaders, DbError, failure, paymentDeps, readJson, sameSecret, userFrom } from "../_shared/edge.ts";

// Sends workers their share. Called every 10 minutes by the pg_cron job in
// supabase/cron.sql, and straight after a customer confirms so payouts don't wait.
// Admins also use it to retry a failed transfer or settle a dispute.
Deno.serve(async (req: Request) => {
  const cronSecret = Deno.env.get("SIESIE_CRON_SECRET");
  const fromCron = !!cronSecret && sameSecret(req.headers.get("x-siesie-cron"), cronSecret);
  const { allowed, headers } = browserHeaders(req);
  const reply = (status: number, body: Record<string, unknown>) => Response.json(body, { status, headers });
  if (!fromCron && !allowed) return reply(403, { error: "Origin is not allowed." });
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return reply(405, { error: "Use POST." });
  try {
    const body = await readJson(req, 3000);
    const action = typeof body.action === "string" ? body.action : "process";
    if (fromCron) {
      if (action !== "process") return reply(400, { error: "The scheduled job can only process payouts." });
      return reply(200, await processPayouts(paymentDeps()));
    }
    const user = await userFrom(req);
    if (!user) return reply(401, { error: "Log in to continue." });
    const deps = paymentDeps();
    // Any signed-in user may nudge the queue; it only sends payouts that are already due.
    if (action === "process") {
      await processPayouts(deps);
      return reply(200, { ok: true });
    }
    const jobId = typeof body.jobId === "string" ? body.jobId : "";
    if (action === "retry") {
      await retryPayout(deps, { jobId, adminId: user.id });
      return reply(200, { ok: true });
    }
    if (action === "resolve") {
      const result = await resolveDispute(deps, { jobId, adminId: user.id, toWorker: Number(body.toWorker), note: typeof body.note === "string" ? body.note : "" });
      return reply(200, { ok: true, refunded: result.refunded });
    }
    throw new DbError("Unknown payout action.", false);
  } catch (error) {
    return failure(error, headers);
  }
});
