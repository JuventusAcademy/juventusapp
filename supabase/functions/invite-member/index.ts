import { admin, caller, json, uuid, errorMessage } from "../_shared/core.ts";
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json(req, {});
  if (req.method !== "POST")
    return json(req, { error: "Método não permitido." }, 405);
  try {
    const { db } = await caller(req);
    const body = await req.json();
    const email = String(body.email || "")
      .trim()
      .toLowerCase();
    if (
      !uuid(body.school_id) ||
      !["admin", "secretary", "coach", "guardian"].includes(body.role) ||
      !/^\S+@\S+\.\S+$/.test(email)
    )
      return json(req, { error: "Dados inválidos." }, 400);
    const { data: allowed, error } = await db.rpc("has_role", {
      sid: body.school_id,
      allowed: ["admin"],
    });
    if (error || !allowed) throw new Error("FORBIDDEN");
    const service = admin();
    if (["coach", "guardian"].includes(body.role)) {
      const table = body.role === "coach" ? "coaches" : "guardians";
      const { data, error: lookupError } = await service
        .from(table)
        .select("id")
        .eq("school_id", body.school_id)
        .ilike("email", email)
        .is("user_id", null);
      if (lookupError || !data?.length)
        return json(
          req,
          { error: "Cadastre a pessoa com este e-mail antes de convidá-la." },
          400,
        );
    }
    const redirect = Deno.env.get("APP_URL");
    if (!redirect)
      return json(req, { error: "Configure APP_URL no servidor." }, 503);
    const { data, error: inviteError } =
      await service.auth.admin.inviteUserByEmail(email, {
        redirectTo:
          (redirect.endsWith("/") ? redirect.slice(0, -1) : redirect) +
          "/?setup=1",
      });
    if (inviteError || !data.user)
      return json(
        req,
        {
          error:
            "O convite não foi enviado. Se a pessoa já tem conta, associe o acesso pelo procedimento administrativo.",
        },
        409,
      );
    const { error: provisionError } = await service.rpc("provision_member", {
      sid: body.school_id,
      uid: data.user.id,
      member_role: body.role,
      member_email: email,
    });
    if (provisionError)
      return json(
        req,
        {
          error:
            "Convite criado, mas o vínculo falhou. Revise os vínculos no painel administrativo antes de reenviar.",
        },
        409,
      );
    return json(req, { ok: true });
  } catch (e) {
    const result = errorMessage(e);
    return json(req, { error: result.error }, result.status);
  }
});
