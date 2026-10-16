import { createClient } from "npm:@supabase/supabase-js@2";
export const url = Deno.env.get("SUPABASE_URL")!;
export const admin = () =>
  createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
export function cors(req: Request) {
  const origin = Deno.env.get("APP_URL") || "http://localhost:5173";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers":
      "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}
export function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...cors(req),
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}
export async function caller(req: Request) {
  const token = req.headers.get("Authorization")?.replace(/^Bearer /, "");
  if (!token) throw new Error("AUTH");
  const db = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) throw new Error("AUTH");
  return { db, user: data.user };
}
export async function asaas(path: string, method = "GET", body?: unknown) {
  const key = Deno.env.get("ASAAS_API_KEY");
  const env = Deno.env.get("ASAAS_ENV") || "sandbox";
  if (!key || !["sandbox", "production"].includes(env))
    throw new Error("INTEGRATION_DISABLED");
  const base =
    env === "production"
      ? "https://api.asaas.com/v3"
      : "https://api-sandbox.asaas.com/v3";
  const response = await fetch(base + path, {
    method,
    headers: {
      access_token: key,
      "Content-Type": "application/json",
      "User-Agent": "FutGestao/0.1",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    throw new Error(`PROVIDER_${response.status}`);
  }
  return await response.json();
}
export function uuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}
export async function applyPayment(
  invoiceId: string,
  payment: Record<string, unknown>,
  eventId: string,
  eventName: string,
) {
  const { error } = await admin().rpc("apply_asaas_state", {
    iid: invoiceId,
    eid: eventId,
    event_name: eventName,
    remote_id: payment.id,
    remote_status: payment.deleted ? "DELETED" : payment.status,
    remote_amount: payment.value,
    remote_url: payment.invoiceUrl || payment.bankSlipUrl || null,
    payment_date: payment.paymentDate
      ? String(payment.paymentDate) + "T12:00:00-03:00"
      : null,
  });
  if (error) throw new Error("RECONCILIATION_REQUIRED");
}
export function errorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message === "AUTH")
    return { error: "Sua sessão expirou. Entre novamente.", status: 401 };
  if (message === "INTEGRATION_DISABLED")
    return {
      error:
        "Asaas ainda não configurado no servidor. Solicite a ativação em sandbox.",
      status: 503,
    };
  if (message === "FORBIDDEN")
    return { error: "Seu perfil não permite esta operação.", status: 403 };
  if (message === "RECONCILIATION_REQUIRED")
    return {
      error:
        "O provedor respondeu com divergência. A equipe precisa reconciliar a cobrança.",
      status: 409,
    };
  return {
    error:
      "Não foi possível concluir a integração. Nenhum pagamento foi confirmado pelo aplicativo.",
    status: 502,
  };
}
