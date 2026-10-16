import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload, FileText } from "lucide-react";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { Row, Role } from "../domain";
import { dateLabel, currency, statusLabels } from "../domain";
import { db, friendlyError } from "../lib/supabase";
import { Modal, Loading, ErrorState, Empty, Badge } from "./ui";
const tabs = [
  "Ficha",
  "Responsáveis",
  "Turmas",
  "Financeiro",
  "Presença",
  "Avaliações",
  "Documentos",
];
const tables: Record<string, string> = {
  Responsáveis: "student_guardians",
  Turmas: "enrollments",
  Financeiro: "invoices",
  Presença: "attendance",
  Avaliações: "evaluations",
  Documentos: "documents",
};
export default function StudentDetail({
  row,
  school,
  preview,
  role,
  notify,
  onClose,
}: {
  row: Row;
  school: string;
  preview: boolean;
  role: Role;
  notify: (s: string) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState("Ficha");
  const client = useQueryClient();
  const q = useQuery({
    queryKey: ["student-detail", school, row.id, tab],
    enabled: tab !== "Ficha",
    queryFn: async () => {
      if (preview) return [];
      const table = tables[tab];
      let all: Row[] = [];
      for (let page = 0; ; page++) {
        const { data, error } = await db()
          .from(table)
          .select("*")
          .eq("school_id", school)
          .eq("student_id", row.id)
          .order("created_at", { ascending: false })
          .range(page * 500, page * 500 + 499);
        if (error) throw error;
        all = all.concat(data as Row[]);
        if (data.length < 500) break;
      }
      if (tab === "Responsáveis") {
        const ids = all.map((r) => r.guardian_id);
        if (ids.length) {
          const { data, error } = await db()
            .from("guardians")
            .select("id,name,email,phone")
            .eq("school_id", school)
            .in("id", ids);
          if (error) throw error;
          all = all.map((r) => ({
            ...r,
            name:
              data.find((g) => g.id === r.guardian_id)?.name ||
              "Vínculo autorizado",
          }));
        }
      }
      if (tab === "Turmas") {
        const { data, error } = await db()
          .from("teams")
          .select("id,name")
          .eq("school_id", school)
          .in(
            "id",
            all.map((r) => r.team_id),
          );
        if (error) throw error;
        all = all.map((r) => ({
          ...r,
          name: data.find((t) => t.id === r.team_id)?.name || "Turma",
        }));
      }
      return all;
    },
  });
  const upload = useMutation({
    mutationFn: async (file: File) => {
      if (
        !["application/pdf", "image/png", "image/jpeg", "image/webp"].includes(
          file.type,
        ) ||
        file.size > 10 * 1024 * 1024
      )
        throw new Error("Envie PDF, JPG, PNG ou WebP de até 10 MB.");
      const extension =
        file.type === "application/pdf" ? "pdf" : file.type.split("/")[1];
      const path = `${school}/${row.id}/${crypto.randomUUID()}.${extension}`;
      const { error } = await db()
        .storage.from("student-documents")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      const { error: insertError } = await db().from("documents").insert({
        school_id: school,
        student_id: row.id,
        name: file.name,
        storage_path: path,
      });
      if (insertError) throw insertError;
    },
    onSuccess: () => {
      client.invalidateQueries();
      notify("Documento enviado para armazenamento privado.");
    },
  });
  async function openDocument(doc: Row) {
    try {
      const { data, error } = await db()
        .storage.from("student-documents")
        .createSignedUrl(String(doc.storage_path), 60);
      if (error) throw error;
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (e) {
      notify(friendlyError(e));
    }
  }
  return (
    <Modal title={String(row.name)} onClose={onClose} wide>
      <div className="student-summary">
        <span className="avatar large">
          {String(row.name)
            .split(" ")
            .slice(0, 2)
            .map((v) => v[0])
            .join("")}
        </span>
        <div>
          <strong>Matrícula {String(row.registration_code)}</strong>
          <p>Nascimento: {dateLabel(row.birth_date)}</p>
        </div>
        <Badge
          value={String(row.status)}
          label={statusLabels[String(row.status)]}
        />
      </div>
      <div className="tabs">
        {tabs
          .filter(
            (t) =>
              role !== "coach" ||
              !["Responsáveis", "Financeiro", "Documentos"].includes(t),
          )
          .map((t) => (
            <button
              key={t}
              className={tab === t ? "selected" : ""}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
      </div>
      {tab === "Ficha" ? (
        <dl className="details">
          {[
            ["Telefone", row.phone],
            ["Endereço", row.address],
            ["Posição", row.position],
            ["Camisa", row.shirt_number],
            ["Entrada", dateLabel(row.joined_on)],
            [
              "Autorização de imagem",
              row.image_consent ? "Registrada" : "Não registrada",
            ],
          ].map(([label, value]) => (
            <div key={String(label)}>
              <dt>{String(label)}</dt>
              <dd>{String(value || "Não informado")}</dd>
            </div>
          ))}
        </dl>
      ) : q.isPending ? (
        <Loading />
      ) : q.isError ? (
        <ErrorState
          message={friendlyError(q.error)}
          retry={() => q.refetch()}
        />
      ) : (
        <>
          {tab === "Documentos" && ["admin", "secretary"].includes(role) && (
            <label className="btn secondary upload-button">
              <Upload size={16} />
              {upload.isPending ? "Enviando…" : "Enviar documento privado"}
              <input
                type="file"
                disabled={preview || upload.isPending}
                accept=".pdf,.png,.jpg,.jpeg,.webp"
                onChange={(e) => {
                  if (e.target.files?.[0]) upload.mutate(e.target.files[0]);
                  e.target.value = "";
                }}
              />
            </label>
          )}
          {upload.isError && (
            <p className="error-text">{friendlyError(upload.error)}</p>
          )}
          {!q.data?.length ? (
            <Empty
              title="Nenhum registro disponível"
              text="Os dados aparecem aqui quando cadastrados e autorizados para seu perfil."
            />
          ) : (
            <>
              {tab === "Avaliações" && (
                <div className="radar">
                  <ResponsiveContainer>
                    <RadarChart data={q.data.slice(0, 10)}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="name" />
                      <Tooltip />
                      <Radar
                        name="Nota"
                        dataKey="score"
                        stroke="var(--chart-line)"
                        fill="var(--chart-line)"
                        fillOpacity={0.22}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              )}
              <div className="detail-list">
                {q.data.map((r) => (
                  <div key={r.id}>
                    <div>
                      <strong>
                        {r.name ||
                          (tab === "Presença"
                            ? statusLabels[String(r.status)] || "Chamada"
                            : tab === "Turmas"
                              ? "Matrícula"
                              : "Registro")}
                      </strong>
                      <p>
                        {tab === "Financeiro"
                          ? `${currency(r.amount)} · ${dateLabel(r.due_date)} · ${statusLabels[String(r.status)]}`
                          : tab === "Avaliações"
                            ? `Nota ${r.score} · ${dateLabel(r.evaluated_on)} · ${r.comments || ""}`
                            : tab === "Responsáveis"
                              ? `${r.relationship} · ${r.billing ? "Financeiro autorizado" : "Sem acesso financeiro"} · ${r.pickup ? "Retirada autorizada" : "Sem retirada"}`
                              : tab === "Turmas"
                                ? `${dateLabel(r.started_on)} · ${statusLabels[String(r.status)]}`
                                : dateLabel(r.created_at)}
                      </p>
                    </div>
                    {tab === "Documentos" && (
                      <button
                        className="btn secondary"
                        onClick={() => openDocument(r)}
                      >
                        <FileText size={16} />
                        Abrir
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </Modal>
  );
}
