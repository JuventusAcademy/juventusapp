import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, MapPin } from "lucide-react";
import type { Row } from "../domain";
import { today, dateLabel } from "../domain";
import { db, friendlyError } from "../lib/supabase";
import { previewRows } from "../preview";
import { Loading, ErrorState, Empty, Modal } from "./ui";
export default function Calendar({
  school,
  preview,
}: {
  school: string;
  preview: boolean;
}) {
  const [month, setMonth] = useState(today().slice(0, 7)),
    [mode, setMode] = useState("month"),
    [selected, setSelected] = useState<Row>();
  const q = useQuery<Row[]>({
    queryKey: ["calendar", school, month, preview],
    queryFn: async () => {
      if (preview)
        return (previewRows.training_sessions || []).map((r) => ({
          ...r,
          kind: "Treino",
        }));
      const start = month + "-01T00:00:00-03:00";
      const next = new Date(
        Number(month.slice(0, 4)),
        Number(month.slice(5)),
        1,
      ).toLocaleDateString("en-CA");
      const result = await Promise.all(
        ["training_sessions", "events", "matches"].map(async (table) => {
          let all: Row[] = [];
          for (let page = 0; ; page++) {
            const { data, error } = await db()
              .from(table)
              .select("*")
              .eq("school_id", school)
              .gte("starts_at", start)
              .lt("starts_at", next + "T00:00:00-03:00")
              .order("starts_at")
              .range(page * 500, page * 500 + 499);
            if (error) throw error;
            all = all.concat(
              (data as Row[]).map((r) => ({
                ...r,
                kind:
                  table === "training_sessions"
                    ? "Treino"
                    : table === "matches"
                      ? "Jogo"
                      : String(r.kind),
              })),
            );
            if (data.length < 500) break;
          }
          return all;
        }),
      );
      return result
        .flat()
        .sort((a, b) => String(a.starts_at).localeCompare(String(b.starts_at)));
    },
  });
  function shift(amount: number) {
    const d = new Date(
      Number(month.slice(0, 4)),
      Number(month.slice(5)) - 1 + amount,
      1,
    );
    setMonth(d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"));
  }
  const first = new Date(month + "-01T12:00:00"),
    offset = (first.getDay() + 6) % 7,
    days = new Date(
      Number(month.slice(0, 4)),
      Number(month.slice(5)),
      0,
    ).getDate();
  const items = q.data || [];
  return (
    <>
      <div className="page-title">
        <div>
          <h1>Agenda da escola</h1>
          <p>O próximo treino. O próximo encontro. A próxima conquista.</p>
        </div>
        <div className="segmented">
          <button
            className={mode === "month" ? "selected" : ""}
            onClick={() => setMode("month")}
          >
            Mês
          </button>
          <button
            className={mode === "list" ? "selected" : ""}
            onClick={() => setMode("list")}
          >
            Lista
          </button>
        </div>
      </div>
      <section className="panel">
        <div className="panel-head">
          <button
            aria-label="Mês anterior"
            className="icon-btn"
            onClick={() => shift(-1)}
          >
            <ChevronLeft size={20} />
          </button>
          <h2>
            {first.toLocaleDateString("pt-BR", {
              month: "long",
              year: "numeric",
            })}
          </h2>
          <button
            aria-label="Próximo mês"
            className="icon-btn"
            onClick={() => shift(1)}
          >
            <ChevronRight size={20} />
          </button>
        </div>
        {q.isPending ? (
          <Loading />
        ) : q.isError ? (
          <ErrorState
            message={friendlyError(q.error)}
            retry={() => q.refetch()}
          />
        ) : mode === "month" ? (
          <div className="calendar">
            <div className="weekdays">
              {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>
            <div className="calendar-grid">
              {Array.from({ length: offset }, (_, i) => (
                <div key={"empty" + i} className="calendar-day muted" />
              ))}
              {Array.from({ length: days }, (_, i) => {
                const day = month + "-" + String(i + 1).padStart(2, "0");
                return (
                  <div
                    key={day}
                    className={
                      "calendar-day " + (day === today() ? "current" : "")
                    }
                  >
                    <span>{i + 1}</span>
                    {items
                      .filter(
                        (r) =>
                          new Date(String(r.starts_at)).toLocaleDateString(
                            "en-CA",
                            { timeZone: "America/Sao_Paulo" },
                          ) === day,
                      )
                      .map((r) => (
                        <button
                          key={r.id}
                          className={
                            r.status === "cancelled" ? "cancelled" : ""
                          }
                          onClick={() => setSelected(r)}
                        >
                          {String(r.kind)} · {r.name}
                        </button>
                      ))}
                  </div>
                );
              })}
            </div>
          </div>
        ) : !items.length ? (
          <Empty
            title="Este mês está livre"
            text="Cadastre treinos e eventos para preencher a agenda."
          />
        ) : (
          <div className="detail-list">
            {items.map((r) => (
              <button
                className="calendar-list-item"
                key={r.id}
                onClick={() => setSelected(r)}
              >
                <span>{dateLabel(r.starts_at, true)}</span>
                <strong>{r.name}</strong>
                <small>{String(r.kind)}</small>
              </button>
            ))}
          </div>
        )}
      </section>
      {selected && (
        <Modal
          title={String(selected.name)}
          onClose={() => setSelected(undefined)}
        >
          <p>{dateLabel(selected.starts_at, true)}</p>
          <p>
            <MapPin size={16} />
            {String(selected.location || "Local a definir")}
          </p>
          <p>{String(selected.description || selected.opponent || "")}</p>
          <small>
            {selected.status === "cancelled"
              ? "Atividade cancelada"
              : String(selected.kind)}
          </small>
        </Modal>
      )}
    </>
  );
}
