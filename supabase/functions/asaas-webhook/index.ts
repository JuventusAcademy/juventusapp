import { admin, asaas, json, applyPayment } from "../_shared/core.ts";
async function equalToken(a: string, b: string) {
  const enc = new TextEncoder();
  const [x, y] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(a)),
    crypto.subtle.digest("SHA-256", enc.encode(b)),
  ]);
  return (
    new Uint8Array(x).reduce(
      (diff, value, i) => diff | (value ^ new Uint8Array(y)[i]),
      0,
    ) === 0
  );
}
Deno.serve(async (req) => {
  if (req.method !== "POST")
    return json(req, { error: "Método não permitido." }, 405);
  const expected = Deno.env.get("ASAAS_WEBHOOK_TOKEN");
  if (
    !expected ||
    !(await equalToken(req.headers.get("asaas-access-token") || "", expected))
  )
    return json(req, { error: "Não autorizado." }, 401);
  try {
    const event = await req.json();
    if (
      typeof event.id !== "string" ||
      event.id.length > 200 ||
      typeof event.event !== "string" ||
      !event.event.startsWith("PAYMENT_") ||
      typeof event.payment?.id !== "string"
    )
      return json(req, { error: "Evento inválido." }, 400);
    const service = admin();
    const { data: previous, error: pError } = await service
      .from("payment_events")
      .select("id")
      .eq("id", "webhook:" + event.id)
      .maybeSingle();
    if (pError) throw pError;
    if (previous) return json(req, { received: true });
    // Estado atual consultado na API evita regressões por eventos entregues fora de ordem.
    const payment = await asaas(
      "/payments/" + encodeURIComponent(event.payment.id),
    );
    const { data: invoice, error } = await service
      .from("invoices")
      .select("id,school_id,provider_id")
      .eq("id", payment.externalReference)
      .maybeSingle();
    if (error) throw error;
    if (!invoice) return json(req, { ignored: true });
    if (
      invoice.school_id !== Deno.env.get("ASAAS_SCHOOL_ID") ||
      (invoice.provider_id && invoice.provider_id !== payment.id)
    )
      return json(req, { error: "Vínculo divergente." }, 409);
    await applyPayment(invoice.id, payment, "webhook:" + event.id, event.event);
    return json(req, { received: true });
  } catch {
    return json(
      req,
      { error: "Não processado. O provedor deve reenviar o evento." },
      500,
    );
  }
});
