import { handleWebhook } from "../_shared/payments.ts";
import { paymentDeps } from "../_shared/edge.ts";

// Paystack posts events here. Set this URL as the webhook in the Paystack dashboard:
//   https://<project-ref>.supabase.co/functions/v1/paystack-webhook
// Events are signature-checked, charges are re-verified with Paystack, and every
// update is idempotent, so Paystack's retries are safe.
Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Use POST.", { status: 405 });
  const secret = Deno.env.get("PAYSTACK_SECRET_KEY");
  if (!secret) return new Response("Payments have not been set up.", { status: 503 });
  const raw = await req.text();
  if (raw.length > 200_000) return new Response("Too large.", { status: 413 });
  try {
    return new Response(null, { status: await handleWebhook(paymentDeps(), secret, raw, req.headers.get("x-paystack-signature")) });
  } catch (error) {
    console.error(error);
    return new Response("Try again later.", { status: 500 });
  }
});
