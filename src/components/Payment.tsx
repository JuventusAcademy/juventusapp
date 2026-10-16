import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Copy, ExternalLink, RefreshCw } from "lucide-react";
import type { Row, Role } from "../domain";
import { currency, dateLabel, invoiceStatus, statusLabels } from "../domain";
import { db, friendlyError } from "../lib/supabase";
import { Modal, Badge } from "./ui";
type PaymentInfo = {
  provider_url?: string;
  encodedImage?: string;
  payload?: string;
  identificationField?: string;
  status?: string;
};
export default function Payment({
  row,
  school,
  role,
  onClose,
  notify,
}: {
  row: Row;
  school: string;
  role: Role;
  onClose: () => void;
  notify: (s: string) => void;
}) {
  const [info, setInfo] = useState<PaymentInfo>({
    provider_url: String(row.provider_url || ""),
  });
  const client = useQueryClient();
  const canManage = ["admin", "secretary"].includes(role);
  const mutation = useMutation({
    mutationFn: async (action: string) => {
      const { data, error } = await db().functions.invoke("asaas-payment", {
        body: { invoice_id: row.id, school_id: school, action },
      });
      if (error) {
        let message =
          "A integração Asaas não respondeu. Confira a configuração com a administração.";
        try {
          const result = await error.context?.json();
          if (result?.error) message = result.error;
        } catch {
          /* Sem corpo legível. */
        }
        throw new Error(message);
      }
      if (data.error) throw new Error(data.error);
      return data as PaymentInfo;
    },
    onSuccess: (data) => {
      setInfo(data);
      client.invalidateQueries();
      notify("Cobrança consultada no provedor.");
    },
  });
  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      notify("Código copiado.");
    } catch {
      notify("Não foi possível copiar. Selecione e copie o código exibido.");
    }
  }
  const safeUrl = (value?: string) => {
    try {
      const u = new URL(value || "");
      return u.protocol === "https:" &&
        (u.hostname === "asaas.com" || u.hostname.endsWith(".asaas.com"))
        ? u.href
        : undefined;
    } catch {
      return undefined;
    }
  };
  const url = safeUrl(info.provider_url);
  return (
    <Modal title="Detalhes da mensalidade" onClose={onClose}>
      <div className="payment-total">
        <Badge
          value={invoiceStatus(row)}
          label={statusLabels[invoiceStatus(row)]}
        />
        <strong>{currency(row.amount)}</strong>
        <p>
          {row.name} · Vencimento {dateLabel(row.due_date)}
        </p>
      </div>
      {!row.provider_id && (
        <div className="notice">
          A cobrança ainda não foi emitida no Asaas. Somente a equipe da escola
          pode emitir.
        </div>
      )}
      <div className="payment-actions">
        {canManage && !row.provider_id && (
          <button
            className="btn primary"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate("create")}
          >
            Emitir {row.billing_type === "PIX" ? "Pix" : "boleto"}
          </button>
        )}
        <button
          className="btn secondary"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate("details")}
        >
          <RefreshCw size={16} />
          {mutation.isPending ? "Consultando…" : "Consultar pagamento"}
        </button>
        {canManage && (
          <button
            className="btn secondary"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate("reconcile")}
          >
            Reconciliar emissão
          </button>
        )}
      </div>
      {mutation.isError && (
        <p className="error-text" role="alert">
          {friendlyError(mutation.error)}
        </p>
      )}
      {info.encodedImage && (
        <img
          className="pix-image"
          alt="QR Code Pix da cobrança"
          src={"data:image/png;base64," + info.encodedImage}
        />
      )}
      <div className="payment-actions">
        {url && (
          <a
            className="btn primary"
            href={url}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink size={16} />
            Abrir cobrança
          </a>
        )}
        {(info.payload || info.identificationField) && (
          <>
            <textarea
              aria-label="Código de pagamento"
              readOnly
              value={info.payload || info.identificationField}
            />
            <button
              className="btn secondary"
              onClick={() =>
                copy(info.payload || info.identificationField || "")
              }
            >
              <Copy size={16} />
              Copiar {info.payload ? "Pix" : "linha digitável"}
            </button>
          </>
        )}
      </div>
      <p className="helper">
        O pagamento só é reconhecido após consulta ao Asaas. A emissão não
        confirma recebimento.
      </p>
    </Modal>
  );
}
