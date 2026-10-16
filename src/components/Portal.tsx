import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  ArrowUpRight,
  Wallet,
  MapPin,
  Activity,
  Newspaper,
} from "lucide-react";
import { db, friendlyError } from "../lib/supabase";
import { related } from "../lib/data";
import { currency, dateLabel, invoiceStatus, statusLabels } from "../domain";
import type { Row } from "../domain";
import { Loading, ErrorState, Empty, Badge } from "./ui";
import StudentDetail from "./StudentDetail";
import Payment from "./Payment";
export default function Portal({
  school,
  navigate,
  notify,
}: {
  school: string;
  navigate: (id: string) => void;
  notify: (s: string) => void;
}) {
  const [child, setChild] = useState(""),
    [detail, setDetail] = useState<Row>(),
    [payment, setPayment] = useState<Row>();
  const students = useQuery({
    queryKey: ["children", school],
    queryFn: () => related("students", school),
  });
  const current =
    students.data?.find((s) => s.id === child) || students.data?.[0];
  const q = useQuery({
    queryKey: ["portal", school, current?.id],
    enabled: !!current,
    queryFn: async () => {
      const [invoices, enrollments, news, announcements] = await Promise.all([
        db()
          .from("invoices")
          .select("*")
          .eq("school_id", school)
          .eq("student_id", current!.id)
          .in("status", ["pending", "processing", "overdue"])
          .order("due_date")
          .limit(3),
        db()
          .from("enrollments")
          .select("team_id")
          .eq("school_id", school)
          .eq("student_id", current!.id)
          .eq("status", "active"),
        db()
          .from("news")
          .select("*")
          .eq("school_id", school)
          .eq("published", true)
          .lte("publish_at", new Date().toISOString())
          .order("publish_at", { ascending: false })
          .limit(3),
        db()
          .from("announcements")
          .select("*")
          .eq("school_id", school)
          .eq("published", true)
          .lte("publish_at", new Date().toISOString())
          .order("publish_at", { ascending: false })
          .limit(4),
      ]);
      for (const r of [invoices, enrollments, news, announcements])
        if (r.error) throw r.error;
      const teamIds = enrollments.data!.map((r) => r.team_id);
      let sessions: Row[] = [];
      if (teamIds.length) {
        const result = await db()
          .from("training_sessions")
          .select("*")
          .eq("school_id", school)
          .in("team_id", teamIds)
          .eq("status", "scheduled")
          .gte("starts_at", new Date().toISOString())
          .order("starts_at")
          .limit(3);
        if (result.error) throw result.error;
        sessions = result.data as Row[];
      }
      return {
        invoices: invoices.data as Row[],
        sessions,
        news: news.data as Row[],
        announcements: (announcements.data as Row[]).filter(
          (a) => !a.team_id || teamIds.includes(String(a.team_id)),
        ),
      };
    },
  });
  if (students.isPending) return <Loading />;
  if (students.isError)
    return (
      <ErrorState
        message={friendlyError(students.error)}
        retry={() => students.refetch()}
      />
    );
  if (!current)
    return (
      <Empty
        title="Sua família está chegando ao time"
        text="Peça à escola para vincular os alunos ao seu acesso."
      />
    );
  return (
    <div className="portal">
      <div className="page-title">
        <div>
          <h1>Olá, família!</h1>
          <p>Vamos acompanhar mais uma conquista?</p>
        </div>
      </div>
      <section className="child-card">
        <span className="avatar large">
          {String(current.name)
            .split(" ")
            .slice(0, 2)
            .map((v) => v[0])
            .join("")}
        </span>
        <div>
          <small>Acompanhando</small>
          <select
            aria-label="Selecionar filho"
            value={current.id}
            onChange={(e) => setChild(e.target.value)}
          >
            {students.data.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <span>Matrícula {String(current.registration_code)}</span>
        </div>
        <button
          aria-label="Ver ficha do aluno"
          className="icon-btn"
          onClick={() => setDetail(current)}
        >
          <ArrowUpRight size={22} />
        </button>
      </section>
      {q.isPending ? (
        <Loading />
      ) : q.isError ? (
        <ErrorState
          message={friendlyError(q.error)}
          retry={() => q.refetch()}
        />
      ) : (
        <>
          <div className="portal-grid">
            <section className="panel padded">
              <CalendarDays className="brand-text" size={24} />
              <h2>Próximo treino</h2>
              {q.data.sessions[0] ? (
                <>
                  <h3>{q.data.sessions[0].name}</h3>
                  <p>{dateLabel(q.data.sessions[0].starts_at, true)}</p>
                  <p>
                    <MapPin size={14} />
                    {String(q.data.sessions[0].location || "Consulte a escola")}
                  </p>
                </>
              ) : (
                <p>Nenhum treino agendado para este aluno.</p>
              )}
              <button className="text-btn" onClick={() => navigate("calendar")}>
                Ver agenda <ArrowUpRight size={15} />
              </button>
            </section>
            <section className="panel padded">
              <Wallet className="brand-text" size={24} />
              <h2>Próxima mensalidade</h2>
              {q.data.invoices[0] ? (
                <>
                  <strong className="portal-amount">
                    {currency(q.data.invoices[0].amount)}
                  </strong>
                  <p>Vence em {dateLabel(q.data.invoices[0].due_date)}</p>
                  <Badge
                    value={invoiceStatus(q.data.invoices[0])}
                    label={statusLabels[invoiceStatus(q.data.invoices[0])]}
                  />
                  <button
                    className="btn primary"
                    onClick={() => setPayment(q.data.invoices[0])}
                  >
                    Ver pagamento
                  </button>
                </>
              ) : (
                <p>
                  Nenhuma mensalidade pendente disponível para seu acesso
                  financeiro.
                </p>
              )}
            </section>
          </div>
          <section className="panel">
            <div className="panel-head">
              <h2>Recados da escola</h2>
              <Newspaper size={21} />
            </div>
            {!q.data.announcements.length ? (
              <Empty
                title="Tudo em dia"
                text="Os próximos comunicados aparecem aqui."
              />
            ) : (
              <div className="detail-list">
                {q.data.announcements.map((a) => (
                  <article key={a.id}>
                    <h3>{a.name}</h3>
                    <p>{String(a.content)}</p>
                    <small>{dateLabel(a.publish_at)}</small>
                  </article>
                ))}
              </div>
            )}
          </section>
          <button
            className="performance-link"
            onClick={() => setDetail(current)}
          >
            <Activity size={24} />
            <div>
              <strong>Cada treino, uma evolução</strong>
              <span>Veja presença, avaliações e documentos.</span>
            </div>
            <ArrowUpRight size={22} />
          </button>
          <section className="panel">
            <div className="panel-head">
              <h2>Aconteceu na escola</h2>
            </div>
            {!q.data.news.length ? (
              <Empty
                title="Novidades em breve"
                text="As publicações autorizadas da escola aparecem aqui."
              />
            ) : (
              <div className="detail-list">
                {q.data.news.map((n) => (
                  <article key={n.id}>
                    <small>{String(n.category)}</small>
                    <h3>{n.name}</h3>
                    <p>{String(n.summary || n.content)}</p>
                    <button
                      className="text-btn"
                      onClick={() => navigate("news")}
                    >
                      Ler notícias
                    </button>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}
      {detail && (
        <StudentDetail
          row={detail}
          school={school}
          role="guardian"
          preview={false}
          notify={notify}
          onClose={() => setDetail(undefined)}
        />
      )}
      {payment && (
        <Payment
          row={payment}
          school={school}
          role="guardian"
          notify={notify}
          onClose={() => setPayment(undefined)}
        />
      )}
    </div>
  );
}
