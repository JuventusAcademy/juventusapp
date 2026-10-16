import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import {
  Users,
  Wallet,
  CalendarDays,
  ArrowUpRight,
  ArrowRight,
  Clock3,
  MapPin,
  UserPlus,
  Activity,
  TrendingUp,
} from "lucide-react";
import { db, friendlyError } from "../lib/supabase";
import type { Row, Role } from "../domain";
import { currency, dateLabel, today } from "../domain";
import { previewDashboard, previewRows } from "../preview";
import { Loading, ErrorState, Empty, Badge } from "./ui";
type Stats = typeof previewDashboard;
export default function Dashboard({
  school,
  preview,
  role,
  navigate,
}: {
  school: string;
  preview: boolean;
  role: Role;
  navigate: (id: string) => void;
}) {
  const [period, setPeriod] = useState("month");
  const [chartMonths, setChartMonths] = useState(6);
  const end = today();
  const start =
    period === "year" ? end.slice(0, 4) + "-01-01" : end.slice(0, 7) + "-01";
  const q = useQuery({
    queryKey: ["dashboard", school, start, end, preview],
    queryFn: async () => {
      if (preview) return previewDashboard;
      const { data, error } = await db().rpc("dashboard", {
        sid: school,
        from_date: start,
        to_date: end,
      });
      if (error) throw error;
      return data as Stats;
    },
  });
  const sessions = useQuery({
    queryKey: ["upcoming", school, preview],
    queryFn: async () => {
      if (preview) return previewRows.training_sessions;
      const { data, error } = await db()
        .from("training_sessions")
        .select("*")
        .eq("school_id", school)
        .eq("status", "scheduled")
        .gte("starts_at", new Date().toISOString())
        .order("starts_at")
        .limit(3);
      if (error) throw error;
      return data as Row[];
    },
  });
  const recent = useQuery({
    queryKey: ["recent", school, preview],
    queryFn: async () => {
      if (preview) return previewRows.students;
      const { data, error } = await db()
        .from("students")
        .select("*")
        .eq("school_id", school)
        .order("created_at", { ascending: false })
        .limit(4);
      if (error) throw error;
      return data as Row[];
    },
  });
  if (q.isPending) return <Loading />;
  if (q.isError)
    return (
      <ErrorState message={friendlyError(q.error)} retry={() => q.refetch()} />
    );
  const d = q.data,
    financial = role !== "coach";
  return (
    <>
      <div className="page-title">
        <div>
          <div className="season-label">
            <span />
            Temporada {today().slice(0, 4)}
          </div>
          <h1>Visão geral</h1>
          <p>O dia a dia da sua Academy, em um só lugar.</p>
        </div>
        <select
          aria-label="Período dos indicadores"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
        >
          <option value="month">Este mês</option>
          <option value="year">Este ano</option>
        </select>
      </div>
      <section className="club-hero" aria-label="Juventus Academy São Carlos">
        <div className="club-hero-copy">
          <span className="club-signature">
            Juventus Academy <span>São Carlos</span>
          </span>
          <h2>
            O futuro
            <br />
            entra em campo.
          </h2>
          <p>Uma escola. Muitas histórias para formar.</p>
          <button
            className="club-hero-action"
            onClick={() => navigate("training")}
          >
            Agenda de treinos <ArrowUpRight size={20} />
          </button>
        </div>
        <figure className="club-kit-photo">
          <img
            src="/juventus-home-2025-26.webp"
            alt="Camisa oficial Juventus Home 2025/26, com listras pretas e brancas"
            fetchPriority="high"
          />
          <figcaption>
            Home kit 2025/26 <span>Juventus × adidas</span>
          </figcaption>
        </figure>
        <div className="club-hero-foot">
          <span>Dentro e fora de campo.</span>
          <span>Temporada {today().slice(0, 4)}</span>
        </div>
      </section>
      <div className="club-shortcuts" aria-label="Acesso rápido">
        <button onClick={() => navigate("students")}>
          <Users size={18} />
          <span>Elenco da escola</span>
          <ArrowUpRight size={17} />
        </button>
        <button onClick={() => navigate("attendance")}>
          <Activity size={18} />
          <span>Fazer chamada</span>
          <ArrowUpRight size={17} />
        </button>
        <button onClick={() => navigate(financial ? "finance" : "teams")}>
          <CalendarDays size={18} />
          <span>{financial ? "Ver mensalidades" : "Minhas turmas"}</span>
          <ArrowUpRight size={17} />
        </button>
      </div>
      <div className="stats">
        <Stat
          icon={<Users size={21} />}
          label="Atletas ativos"
          value={d.active.toLocaleString("pt-BR")}
          detail={`${d.students} alunos cadastrados`}
          color="neutral"
        />
        <Stat
          icon={<UserPlus size={21} />}
          label="Novas matrículas"
          value={String(d.new_students)}
          detail="No período selecionado"
          color="neutral"
        />
        {financial ? (
          <>
            <Stat
              icon={<Wallet size={21} />}
              label="Recebido no período"
              value={currency(d.received)}
              detail="Pagamentos confirmados"
              color="neutral"
            />
            <Stat
              icon={<Clock3 size={21} />}
              label="A receber no período"
              value={currency(d.pending)}
              detail={`${currency(d.overdue)} em atraso`}
              color="neutral"
            />
          </>
        ) : (
          <>
            <Stat
              icon={<CalendarDays size={21} />}
              label="Turmas autorizadas"
              value={String(d.teams)}
              detail="Com acesso pelo seu perfil"
              color="neutral"
            />
            <Stat
              icon={<Activity size={21} />}
              label="Frequência"
              value={d.attendance + "%"}
              detail="Justificativas fora da base"
              color="neutral"
            />
          </>
        )}
      </div>
      <div className="dashboard-grid">
        <section className="panel revenue-panel">
          <div className="panel-head">
            <div>
              <h2>
                {financial ? "Receita da escola" : "Atletas por categoria"}
              </h2>
              <p>
                {financial
                  ? "Valores efetivamente recebidos, por mês."
                  : "Matrículas ativas das turmas autorizadas."}
              </p>
            </div>
            <span className="subtle-icon">
              <TrendingUp size={20} />
            </span>
          </div>
          {financial ? (
            <>
              <div className="revenue-summary">
                <div>
                  <span>Recebido no período selecionado</span>
                  <strong>{currency(d.received)}</strong>
                </div>
                <div className="chart-range" aria-label="Histórico do gráfico">
                  {[6, 12].map((months) => (
                    <button
                      key={months}
                      aria-pressed={chartMonths === months}
                      onClick={() => setChartMonths(months)}
                    >
                      {months} meses
                    </button>
                  ))}
                </div>
              </div>
              <div className="chart revenue-bars">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={d.revenue.slice(-chartMonths)}
                    barSize={chartMonths === 6 ? 34 : 20}
                    margin={{ top: 20, right: 10, left: 0, bottom: 5 }}
                  >
                    <CartesianGrid
                      vertical={false}
                      stroke="var(--border)"
                      strokeDasharray="2 6"
                    />
                    <XAxis
                      dataKey="month"
                      tickFormatter={(v) =>
                        new Date(String(v) + "-15T12:00:00").toLocaleDateString(
                          "pt-BR",
                          { month: "short" },
                        )
                      }
                      axisLine={false}
                      tickLine={false}
                      tickMargin={14}
                      tick={{ fontSize: 12, fill: "var(--muted)" }}
                    />
                    <YAxis
                      width={62}
                      tickFormatter={(v) =>
                        Number(v) >= 1000
                          ? (Number(v) / 1000).toLocaleString("pt-BR") + " mil"
                          : String(v)
                      }
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: "var(--muted)" }}
                    />
                    <Tooltip
                      cursor={{ fill: "var(--subtle)", radius: 6 }}
                      formatter={(v) => currency(v)}
                      labelFormatter={(v) =>
                        new Date(String(v) + "-15T12:00:00").toLocaleDateString(
                          "pt-BR",
                          { month: "long", year: "numeric" },
                        )
                      }
                      contentStyle={{
                        borderRadius: 8,
                        border: "1px solid var(--border)",
                        background: "var(--panel)",
                        color: "var(--text)",
                        boxShadow: "0 8px 28px #00000012",
                        padding: "12px 16px",
                      }}
                    />
                    <Bar
                      dataKey="amount"
                      name="Recebido"
                      radius={[5, 5, 0, 0]}
                      maxBarSize={40}
                    >
                      {d.revenue.slice(-chartMonths).map((item, i) => (
                        <Cell
                          key={item.month}
                          fill={
                            i === d.revenue.slice(-chartMonths).length - 1
                              ? "var(--chart-line)"
                              : "var(--chart-bar)"
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="revenue-foot">
                <span>
                  <i />
                  Receita mensal
                </span>
                <span>
                  Últimos {chartMonths} meses · Passe sobre as barras para ver
                  os valores
                </span>
              </div>
            </>
          ) : (
            <div className="chart">
              <ResponsiveContainer>
                <BarChart data={d.categories}>
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar
                    dataKey="value"
                    name="Atletas"
                    fill="var(--chart-line)"
                    radius={[5, 5, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
        <section className="panel agenda-panel">
          <div className="panel-head">
            <div>
              <h2>Próximos treinos</h2>
              <p>A bola vai rolar.</p>
            </div>
            <CalendarDays size={20} />
          </div>
          {sessions.isError ? (
            <ErrorState message={friendlyError(sessions.error)} />
          ) : sessions.isPending ? (
            <Loading />
          ) : !sessions.data.length ? (
            <Empty title="Agenda livre" text="Cadastre os próximos treinos." />
          ) : (
            <div className="session-list">
              {sessions.data.map((s, i) => (
                <div className="session" key={s.id}>
                  <div className={"session-time " + (i === 0 ? "accent" : "")}>
                    <strong>
                      {new Date(String(s.starts_at)).toLocaleTimeString(
                        "pt-BR",
                        {
                          timeZone: "America/Sao_Paulo",
                          hour: "2-digit",
                          minute: "2-digit",
                        },
                      )}
                    </strong>
                    <small>{dateLabel(s.starts_at).split(" de ")[0]}</small>
                  </div>
                  <div>
                    <h3>{s.name}</h3>
                    <p>
                      <MapPin size={12} />
                      {String(s.location || "Local a definir")}
                    </p>
                    <Badge value="scheduled" label="Treino agendado" />
                  </div>
                </div>
              ))}
            </div>
          )}
          <button className="panel-link" onClick={() => navigate("training")}>
            Ver todos os treinos <ArrowRight size={16} />
          </button>
        </section>
        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>Chegaram para o time</h2>
              <p>Últimos alunos cadastrados.</p>
            </div>
            <button className="text-btn" onClick={() => navigate("students")}>
              Ver alunos <ArrowUpRight size={15} />
            </button>
          </div>
          {recent.isError ? (
            <ErrorState message={friendlyError(recent.error)} />
          ) : recent.isPending ? (
            <Loading />
          ) : !recent.data.length ? (
            <Empty
              title="Seu primeiro atleta está por vir"
              text="Comece cadastrando os alunos da escola."
            />
          ) : (
            <div className="recent-list">
              {recent.data.map((r) => (
                <div key={r.id}>
                  <span className="avatar">
                    {String(r.name)
                      .split(" ")
                      .slice(0, 2)
                      .map((v) => v[0])
                      .join("")}
                  </span>
                  <div>
                    <strong>{r.name}</strong>
                    <small>Matrícula {String(r.registration_code)}</small>
                  </div>
                  <span className="recent-date">{dateLabel(r.joined_on)}</span>
                  <Badge
                    value={String(r.status)}
                    label={r.status === "active" ? "Ativo" : "Inativo"}
                  />
                </div>
              ))}
            </div>
          )}
        </section>
        <section className="panel team-panel">
          <div className="panel-head">
            <div>
              <h2>Dentro de campo</h2>
              <p>Uma escola em movimento.</p>
            </div>
            <Activity size={20} />
          </div>
          <div className="field-stat">
            <span>Frequência média</span>
            <strong>
              {d.attendance.toLocaleString("pt-BR")}
              <small>%</small>
            </strong>
            <div className="progress">
              <i style={{ width: Math.min(100, d.attendance) + "%" }} />
            </div>
            <small>Presenças e atrasos / chamadas sem justificativas.</small>
          </div>
          <div className="team-totals">
            <div>
              <strong>{d.teams}</strong>
              <span>Turmas ativas</span>
            </div>
            <div>
              <strong>{d.coaches}</strong>
              <span>Professores ativos</span>
            </div>
          </div>
          <button className="panel-link" onClick={() => navigate("attendance")}>
            Fazer chamada <ArrowRight size={16} />
          </button>
        </section>
      </div>
    </>
  );
}
function Stat({
  icon,
  label,
  value,
  detail,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
  color: string;
}) {
  return (
    <section className="stat">
      <span className={"stat-icon " + color}>{icon}</span>
      <span className="stat-label">{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </section>
  );
}
