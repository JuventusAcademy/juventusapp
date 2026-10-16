import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  AreaChart,
  Area,
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
  Goal,
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
          <p>Seu time evolui. Sua gestão acompanha.</p>
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
      <div className="welcome">
        <div>
          <div className="welcome-tag">
            <Goal size={17} />O jogo começa com uma boa gestão
          </div>
          <h2>
            Mais tempo para formar atletas.
            <br />
            Mais clareza para cuidar da escola.
          </h2>
          <p>Acompanhe as famílias, os treinos e os próximos passos.</p>
          <button onClick={() => navigate("training")}>
            Ver agenda de treinos <ArrowUpRight size={17} />
          </button>
        </div>
        <div className="pitch" aria-hidden="true">
          <div className="pitch-mid" />
          <div className="pitch-center" />
          <div className="pitch-area left" />
          <div className="pitch-area right" />
          <span className="player p1" />
          <span className="player p2" />
          <span className="player p3" />
          <span className="player p4" />
          <span className="player p5" />
          <span className="ball" />
        </div>
      </div>
      <div className="stats">
        <Stat
          icon={<Users size={21} />}
          label="Atletas ativos"
          value={d.active.toLocaleString("pt-BR")}
          detail={`${d.students} alunos cadastrados`}
          color="blue"
        />
        <Stat
          icon={<UserPlus size={21} />}
          label="Novas matrículas"
          value={String(d.new_students)}
          detail="No período selecionado"
          color="orange"
        />
        {financial ? (
          <>
            <Stat
              icon={<Wallet size={21} />}
              label="Recebido no período"
              value={currency(d.received)}
              detail="Pagamentos confirmados"
              color="green"
            />
            <Stat
              icon={<Clock3 size={21} />}
              label="A receber no período"
              value={currency(d.pending)}
              detail={`${currency(d.overdue)} em atraso`}
              color="amber"
            />
          </>
        ) : (
          <>
            <Stat
              icon={<CalendarDays size={21} />}
              label="Turmas autorizadas"
              value={String(d.teams)}
              detail="Com acesso pelo seu perfil"
              color="green"
            />
            <Stat
              icon={<Activity size={21} />}
              label="Frequência"
              value={d.attendance + "%"}
              detail="Justificativas fora da base"
              color="amber"
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
              <div className="chart-total">
                <strong>{currency(d.received)}</strong>
                <span>
                  <span className="legend-dot" />
                  Receita recebida
                </span>
              </div>
              <div className="chart">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={d.revenue}
                    margin={{ top: 10, right: 12, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient
                        id="revenueFill"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="#ff793f"
                          stopOpacity={0.22}
                        />
                        <stop
                          offset="100%"
                          stopColor="#ff793f"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      vertical={false}
                      strokeDasharray="3 5"
                      stroke="#e7ebef"
                    />
                    <XAxis
                      dataKey="month"
                      tickFormatter={(v) =>
                        new Date(String(v) + "-15T12:00:00").toLocaleDateString(
                          "pt-BR",
                          { month: "short" },
                        )
                      }
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 12, fill: "#7c8898" }}
                    />
                    <YAxis
                      width={55}
                      tickFormatter={(v) =>
                        Number(v) >= 1000
                          ? Number(v) / 1000 + " mil"
                          : String(v)
                      }
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11, fill: "#7c8898" }}
                    />
                    <Tooltip
                      formatter={(v) => currency(v)}
                      labelFormatter={(v) => String(v)}
                      contentStyle={{
                        borderRadius: 12,
                        border: "1px solid #e7ebef",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="amount"
                      name="Recebido"
                      stroke="#ee743d"
                      strokeWidth={3}
                      fill="url(#revenueFill)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
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
                    fill="#ff793f"
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
