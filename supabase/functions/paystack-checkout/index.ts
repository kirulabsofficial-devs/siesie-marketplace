import { applyCharge, startCheckout } from "../_shared/payments.ts";
import { browserHeaders, failure, paymentDeps, readJson, userFrom } from "../_shared/edge.ts";

// Opens Paystack's checkout for a quoted booking, and re-checks a checkout when the
// customer returns. Neither path can mark a booking paid without Paystack's confirmation.
Deno.serve(async (req: Request) => {
  const { origin, allowed, headers } = browserHeaders(req);
  const reply = (status: number, body: Record<string, unknown>) => Response.json(body, { status, headers });
  if (!allowed) return reply(403, { error: "Origin is not allowed." });
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return reply(405, { error: "Use POST." });
  try {
    const user = await userFrom(req);
    if (!user?.email) return reply(401, { error: "Log in to pay." });
    const body = await readJson(req, 1000);
    const deps = paymentDeps();
    if (typeof body.verify === "string") return reply(200, await applyCharge(deps, body.verify));
    const jobId = typeof body.jobId === "string" ? body.jobId : "";
    if (!/^SS-[A-Z0-9-]{12,36}$/.test(jobId)) return reply(400, { error: "Choose a booking to pay for." });
    const { url } = await startCheckout(deps, { jobId, userId: user.id, email: user.email, origin });
    return reply(200, { url });
  } catch (error) {
    return failure(error, headers);
  }
});
