import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, CheckCheck } from "lucide-react";
import { related } from "../lib/data";
import { db, friendlyError } from "../lib/supabase";
import { dateLabel } from "../domain";
import type { Row } from "../domain";
import { Empty, Loading, ErrorState } from "./ui";
import { previewRows } from "../preview";
export default function Attendance({
  school,
  preview,
  notify,
}: {
  school: string;
  preview: boolean;
  notify: (s: string) => void;
}) {
  const [session, setSession] = useState(""),
    [marks, setMarks] = useState<Record<string, string>>({}),
    [notes, setNotes] = useState<Record<string, string>>({});
  const q = useQuery({
    queryKey: ["attendance-sessions", school, preview],
    queryFn: () =>
      preview
        ? Promise.resolve(previewRows.training_sessions)
        : related("training_sessions", school),
  });
  const current = q.data?.find((s) => s.id === session);
  const roster = useQuery({
    queryKey: ["roster", school, session],
    enabled: !!session,
    queryFn: async () => {
      if (preview)
        return { students: previewRows.students, attendance: [] as Row[] };
      const { data: enrollments, error } = await db()
        .from("enrollments")
        .select("student_id,started_on,ended_on")
        .eq("school_id", school)
        .eq("team_id", String(current?.team_id));
      if (error) throw error;
      const date = new Date(String(current?.starts_at)).toLocaleDateString(
        "en-CA",
        { timeZone: "America/Sao_Paulo" },
      );
      const ids = (enrollments || [])
        .filter(
          (e) => e.started_on <= date && (!e.ended_on || e.ended_on >= date),
        )
        .map((e) => e.student_id);
      if (!ids.length) return { students: [], attendance: [] };
      const [students, attendance] = await Promise.all([
        db()
          .from("students")
          .select("*")
          .eq("school_id", school)
          .in("id", ids)
          .order("name"),
        db()
          .from("attendance")
          .select("*")
          .eq("school_id", school)
          .eq("session_id", session),
      ]);
      if (students.error) throw students.error;
      if (attendance.error) throw attendance.error;
      return {
        students: students.data as Row[],
        attendance: attendance.data as Row[],
      };
    },
  });
  useEffect(() => {
    setMarks(
      Object.fromEntries(
        (roster.data?.attendance || []).map((a) => [
          String(a.student_id),
          String(a.status),
        ]),
      ),
    );
    setNotes(
      Object.fromEntries(
        (roster.data?.attendance || []).map((a) => [
          String(a.student_id),
          String(a.notes || ""),
        ]),
      ),
    );
  }, [roster.data]);
  const client = useQueryClient();
  const save = useMutation({
    mutationFn: async () => {
      const students = roster.data?.students || [];
      if (students.some((s) => !marks[s.id]))
        throw new Error("Marque a situação de todos os alunos.");
      const existing = Object.fromEntries(
        (roster.data?.attendance || []).map((a) => [
          String(a.student_id),
          a.id,
        ]),
      );
      const rows = students.map((s) => ({
        ...(existing[s.id] ? { id: existing[s.id] } : {}),
        school_id: school,
        session_id: session,
        student_id: s.id,
        status: marks[s.id],
        notes: notes[s.id] || null,
      }));
      const { error } = await db()
        .from("attendance")
        .upsert(rows, { onConflict: "school_id,session_id,student_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      client.invalidateQueries();
      notify("Chamada salva.");
    },
  });
  return (
    <>
      <div className="page-title">
        <div>
          <h1>Chamada digital</h1>
          <p>Cada presença conta no desenvolvimento do atleta.</p>
        </div>
      </div>
      <section className="panel padded">
        <label className="field-label">
          Selecione o treino
          <select value={session} onChange={(e) => setSession(e.target.value)}>
            <option value="">Escolha uma turma e data</option>
            {q.data?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} — {dateLabel(s.starts_at, true)}
              </option>
            ))}
          </select>
        </label>
        {q.isError && (
          <ErrorState
            message={friendlyError(q.error)}
            retry={() => q.refetch()}
          />
        )}
      </section>
      {!session ? (
        <Empty
          title="Pronto para o treino?"
          text="Selecione um treino para abrir a lista de alunos."
        />
      ) : roster.isPending ? (
        <Loading />
      ) : roster.isError ? (
        <ErrorState
          message={friendlyError(roster.error)}
          retry={() => roster.refetch()}
        />
      ) : (
        <section className="panel">
          <div className="panel-head">
            <h2>{current?.name}</h2>
            <button
              className="btn secondary"
              disabled={preview}
              onClick={() =>
                setMarks(
                  Object.fromEntries(
                    roster.data.students.map((s) => [s.id, "present"]),
                  ),
                )
              }
            >
              <CheckCheck size={17} />
              Todos presentes
            </button>
          </div>
          {!roster.data.students.length ? (
            <Empty
              title="Nenhum aluno matriculado"
              text="Confira as matrículas da turma para a data deste treino."
            />
          ) : (
            <div className="attendance-list">
              {roster.data.students.map((s) => (
                <div className="attendance-row" key={s.id}>
                  <strong>{s.name}</strong>
                  <select
                    aria-label={"Presença de " + s.name}
                    disabled={preview}
                    value={marks[s.id] || ""}
                    onChange={(e) =>
                      setMarks({ ...marks, [s.id]: e.target.value })
                    }
                  >
                    <option value="">Selecionar</option>
                    <option value="present">Presente</option>
                    <option value="absent">Ausente</option>
                    <option value="excused">Justificado</option>
                    <option value="late">Atrasado</option>
                  </select>
                  <input
                    aria-label={"Observações de " + s.name}
                    placeholder="Observação (opcional)"
                    maxLength={500}
                    disabled={preview}
                    value={notes[s.id] || ""}
                    onChange={(e) =>
                      setNotes({ ...notes, [s.id]: e.target.value })
                    }
                  />
                </div>
              ))}
            </div>
          )}
          {save.isError && (
            <p className="error-text padded">{friendlyError(save.error)}</p>
          )}
          <div className="modal-actions">
            <button
              className="btn primary"
              disabled={
                preview || save.isPending || !roster.data.students.length
              }
              onClick={() => save.mutate()}
            >
              <Check size={17} />
              {save.isPending ? "Salvando…" : "Salvar chamada"}
            </button>
          </div>
        </section>
      )}
    </>
  );
}
