import {
  admin,
  caller,
  asaas,
  json,
  uuid,
  applyPayment,
  errorMessage,
} from "../_shared/core.ts";
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json(req, {});
  if (req.method !== "POST")
    return json(req, { error: "Método não permitido." }, 405);
  try {
    const { db } = await caller(req);
    const body = await req.json();
    if (
      !uuid(body.invoice_id) ||
      !uuid(body.school_id) ||
      !["create", "details", "reconcile", "cancel"].includes(body.action)
    )
      return json(req, { error: "Requisição inválida." }, 400);
    let { data: invoice, error } = await db
      .from("invoices")
      .select("*")
      .eq("id", body.invoice_id)
      .eq("school_id", body.school_id)
      .single();
    if (error || !invoice) throw new Error("FORBIDDEN");
    if (Deno.env.get("ASAAS_SCHOOL_ID") !== invoice.school_id)
      throw new Error("INTEGRATION_DISABLED");
    const privileged = body.action !== "details";
    if (privileged) {
      const { data: allowed, error: roleError } = await db.rpc("has_role", {
        sid: invoice.school_id,
        allowed: ["admin", "secretary"],
      });
      if (roleError || !allowed) throw new Error("FORBIDDEN");
    }
    let providerId = invoice.provider_id;
    const service = admin();
    if (body.action === "create" && !providerId) {
      if (invoice.status !== "pending" || Number(invoice.amount) <= 0)
        return json(
          req,
          {
            error:
              "A mensalidade deve estar pendente e ter valor maior que zero.",
          },
          400,
        );
      if (!Deno.env.get("ASAAS_API_KEY"))
        throw new Error("INTEGRATION_DISABLED");
      const { data: reserved, error: claimError } = await service.rpc(
        "reserve_invoice",
        { iid: invoice.id },
      );
      if (claimError)
        return json(
          req,
          {
            error:
              claimError.code === "P0001"
                ? claimError.message
                : "Esta emissão já foi iniciada. Use Reconciliar emissão. Não repita a cobrança manualmente.",
          },
          409,
        );
      invoice = reserved;
      try {
        const { data: guardian, error: gError } = await service
          .from("guardians")
          .select("*")
          .eq("id", invoice.guardian_id)
          .eq("school_id", invoice.school_id)
          .single();
        if (gError || !guardian) throw new Error("FORBIDDEN");
        let customer = guardian.asaas_customer_id;
        if (!customer) {
          if (!guardian.cpf)
            return json(
              req,
              {
                error:
                  "Cadastre o CPF do responsável financeiro antes da emissão. A tentativa ficou reservada; após corrigir, libere-a pelo procedimento administrativo documentado.",
              },
              400,
            );
          const found = await asaas(
            "/customers?externalReference=" + encodeURIComponent(guardian.id),
          );
          if (found.data?.length > 1)
            throw new Error("RECONCILIATION_REQUIRED");
          customer = found.data?.[0]?.id;
          if (!customer) {
            const { error: customerClaimError } = await service
              .from("customer_requests")
              .insert({
                guardian_id: guardian.id,
                school_id: invoice.school_id,
              });
            if (customerClaimError) throw new Error("RECONCILIATION_REQUIRED");
            const created = await asaas("/customers", "POST", {
              name: guardian.name,
              cpfCnpj: guardian.cpf,
              email: guardian.email,
              externalReference: guardian.id,
              notificationDisabled: true,
            });
            customer = created.id;
          }
          const { error: updateError } = await service
            .from("guardians")
            .update({ asaas_customer_id: customer })
            .eq("id", guardian.id)
            .eq("school_id", invoice.school_id);
          if (updateError) throw new Error("RECONCILIATION_REQUIRED");
        }
        // externalReference é usada para reconciliação; não presumimos que o provedor deduplica POSTs.
        const found = await asaas(
          "/payments?externalReference=" + encodeURIComponent(invoice.id),
        );
        if (found.data?.length > 1) throw new Error("RECONCILIATION_REQUIRED");
        const payment =
          found.data?.[0] ||
          (await asaas("/payments", "POST", {
            customer,
            billingType: invoice.billing_type,
            value: Number(invoice.amount),
            dueDate: invoice.due_date,
            description: invoice.name,
            externalReference: invoice.id,
          }));
        providerId = payment.id;
        await applyPayment(
          invoice.id,
          payment,
          "emit:" + invoice.id,
          "EMISSION",
        );
      } catch (e) {
        await service
          .from("payment_requests")
          .update({ state: "uncertain", updated_at: new Date().toISOString() })
          .eq("invoice_id", invoice.id);
        throw e;
      }
    }
    if (body.action === "reconcile" && !providerId) {
      const found = await asaas(
        "/payments?externalReference=" + encodeURIComponent(invoice.id),
      );
      if (found.data?.length !== 1)
        return json(
          req,
          {
            error:
              "Não foi encontrada uma única cobrança correspondente. Verifique a conta Asaas antes de liberar uma nova tentativa.",
          },
          409,
        );
      providerId = found.data[0].id;
    }
    if (!providerId)
      return json(
        req,
        { error: "A cobrança ainda não foi emitida pela escola." },
        409,
      );
    if (body.action === "cancel") {
      if (!["pending", "overdue"].includes(invoice.status))
        return json(
          req,
          { error: "A cobrança não pode ser cancelada neste estado." },
          409,
        );
      await asaas("/payments/" + encodeURIComponent(providerId), "DELETE");
    }
    const payment = await asaas("/payments/" + encodeURIComponent(providerId));
    if (payment.externalReference !== invoice.id)
      throw new Error("RECONCILIATION_REQUIRED");
    await applyPayment(
      invoice.id,
      payment,
      "sync:" + crypto.randomUUID(),
      "RECONCILIATION",
    );
    let detail: Record<string, unknown> = {};
    if (
      !["RECEIVED", "REFUNDED", "RECEIVED_IN_CASH"].includes(payment.status) &&
      !payment.deleted
    ) {
      if (invoice.billing_type === "PIX") {
        const pix = await asaas(
          "/payments/" + encodeURIComponent(providerId) + "/pixQrCode",
        );
        detail = { encodedImage: pix.encodedImage, payload: pix.payload };
      } else {
        const boleto = await asaas(
          "/payments/" +
            encodeURIComponent(providerId) +
            "/identificationField",
        );
        detail = { identificationField: boleto.identificationField };
      }
    }
    return json(req, {
      ...detail,
      provider_url: payment.invoiceUrl || payment.bankSlipUrl,
      status: payment.status,
    });
  } catch (e) {
    const result = errorMessage(e);
    return json(req, { error: result.error }, result.status);
  }
});
