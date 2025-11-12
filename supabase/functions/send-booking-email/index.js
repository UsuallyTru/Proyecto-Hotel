// supabase/functions/send-booking-email/index.js
// Edge Function en JS puro (Deno) + Resend API via fetch

// NOTA: Evitamos el SDK de Resend en Deno Edge (causaba "Deno.writeAll is not a function").
// Usamos fetch directamente contra la API de Resend.

const VERSION = "v2-fetch";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const MAIL_FROM = Deno.env.get("MAIL_FROM") ?? "Hotel Sheraton <onboarding@resend.dev>";

Deno.serve((_req) => {
  return json({ version: "disabled", ok: false, disabled: true, reason: "send-booking-email disabled" }, 410);
});

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
