import { demoDetailRows } from "../lib/demoStudentDetails";
import { demoGuardianName, isDemoStudent } from "../lib/studentDemo";
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
  embedded = false,
  initialTab = "Ficha",
}: {
  row: Row;
  school: string;
  preview: boolean;
  role: Role;
  notify: (s: string) => void;
  onClose: () => void;
  embedded?: boolean;
  initialTab?: string;
}) {
  const [tab, setTab] = useState(initialTab);
  const client = useQueryClient();
  const q = useQuery({
    queryKey: ["student-detail", school, row.id, tab],
    enabled: tab !== "Ficha",
    queryFn: async () => {
      if (preview) return demoDetailRows(row, tab);
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
      if (!all.length && isDemoStudent(row)) return demoDetailRows(row, tab);
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
            email: data.find((g) => g.id === r.guardian_id)?.email,
            phone:
              data.find((g) => g.id === r.guardian_id)?.phone ||
              (isDemoStudent(row) ? "(00) 00000-0000" : ""),
            name:
              demoGuardianName(
                row,
                data.find((g) => g.id === r.guardian_id)?.name,
              ) || "Vínculo autorizado",
          }));
        }
      }
      if (tab === "Turmas") {
        const { data, error } = await db()
          .from("teams")
          .select("id,name,schedule,location")
          .eq("school_id", school)
          .in(
            "id",
            all.map((r) => r.team_id),
          );
        if (error) throw error;
        all = all.map((r) => ({
          ...r,
          name: data.find((t) => t.id === r.team_id)?.name || "Turma",
          schedule: data.find((t) => t.id === r.team_id)?.schedule,
          location: data.find((t) => t.id === r.team_id)?.location,
        }));
      }
      if (tab === "Presença" && all.length) {
        const { data, error } = await db()
          .from("training_sessions")
          .select("id,name,starts_at")
          .eq("school_id", school)
          .in(
            "id",
            all.map((r) => r.session_id),
          );
        if (error) throw error;
        all = all.map((r) => ({
          ...r,
          name: data.find((t) => t.id === r.session_id)?.name || "Treino",
          starts_at: data.find((t) => t.id === r.session_id)?.starts_at,
        }));
      }
      if (tab === "Avaliações" && all.length) {
        const { data, error } = await db()
          .from("evaluation_criteria")
          .select("id,name")
          .eq("school_id", school)
          .in(
            "id",
            all.map((r) => r.criterion_id),
          );
        if (error) throw error;
        all = all.map((r) => ({
          ...r,
          name: data.find((c) => c.id === r.criterion_id)?.name || r.name,
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
      if (
        isDemoStudent(row) &&
        String(doc.demo_url || "").startsWith("/demo-documents/")
      ) {
        window.open(String(doc.demo_url), "_blank", "noopener,noreferrer");
        return;
      }
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
    <DetailFrame title={String(row.name)} onClose={onClose} embedded={embedded}>
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
            [
              "Telefone",
              row.phone || (isDemoStudent(row) ? "(00) 00000-0000 · Demo" : ""),
            ],
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
                              ? `${r.relationship} · ${r.billing ? "Financeiro autorizado" : "Sem acesso financeiro"} · ${r.pickup ? "Retirada autorizada" : "Sem retirada"} · ${r.phone || r.email || "Contato não informado"}`
                              : tab === "Turmas"
                                ? `${dateLabel(r.started_on)} · ${statusLabels[String(r.status)]} · ${r.schedule || "Horário a definir"} · ${r.location || "Local a definir"}`
                                : tab === "Presença"
                                  ? `${statusLabels[String(r.status)]} · ${dateLabel(r.starts_at || r.created_at, true)}`
                                  : tab === "Documentos" && r.demo_url
                                    ? "Documento fictício de exemplo · sem validade"
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
    </DetailFrame>
  );
}

function DetailFrame({
  title,
  onClose,
  embedded,
  children,
}: {
  title: string;
  onClose: () => void;
  embedded: boolean;
  children: React.ReactNode;
}) {
  return embedded ? (
    <section className="panel student-full-detail">
      <div className="profile-section-heading">
        <h2>Ficha do atleta</h2>
        <span>Informações e histórico</span>
      </div>
      {children}
    </section>
  ) : (
    <Modal title={title} onClose={onClose} wide>
      {children}
    </Modal>
  );
}
