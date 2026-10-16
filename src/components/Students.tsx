import {
  isDemoStudent,
  demoStudentPhoto,
  demoGuardianName,
  demoGuardianPhoto,
} from "../lib/studentDemo";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  Plus,
  Download,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Eye,
  Pencil,
  Archive,
  Phone,
  Mail,
  UserRound,
  ClipboardCheck,
  Wallet,
  Activity,
  ArrowLeft,
  Shirt,
  Goal,
  CalendarDays,
  Users,
} from "lucide-react";
import type { Row, Role } from "../domain";
import {
  currency,
  dateLabel,
  exportCsv,
  invoiceStatus,
  today,
} from "../domain";
import type { Module } from "../modules";
import { listRows, archiveRow } from "../lib/data";
import { db, friendlyError } from "../lib/supabase";
import { previewRows } from "../preview";
import { Loading, ErrorState, Empty, Badge, Modal } from "./ui";
import RecordForm from "./RecordForm";
import StudentDetail from "./StudentDetail";
type Props = {
  module: Module;
  school: string;
  role: Role;
  preview: boolean;
  notify: (s: string) => void;
};
type Context = {
  enrollments: Row[];
  teams: Row[];
  links: Row[];
  guardians: Row[];
  attendance: Row[];
  invoices: Row[];
  evaluations: Row[];
  criteria: Row[];
};
const emptyContext: Context = {
  enrollments: [],
  teams: [],
  links: [],
  guardians: [],
  attendance: [],
  invoices: [],
  evaluations: [],
  criteria: [],
};
export function studentAge(value: unknown) {
  if (!value) return "—";
  const birth = String(value);
  const now = today();
  let age = Number(now.slice(0, 4)) - Number(birth.slice(0, 4));
  if (now.slice(5) < birth.slice(5)) age--;
  return age >= 0 ? String(age) : "—";
}
function StudentPhoto({ row, large = false }: { row: Row; large?: boolean }) {
  const demo =
    String(row.registration_code || "").startsWith("DEMO-") ||
    row.school_id === "preview";

  return demo ? (
    <img
      className={"student-photo " + (large ? "large" : "")}
      src={demoStudentPhoto(row)}
      alt="Foto de exemplo"
      loading="lazy"
    />
  ) : (
    <span className={"student-photo placeholder " + (large ? "large" : "")}>
      <UserRound size={large ? 38 : 24} />
    </span>
  );
}
async function scopedRows(
  table: string,
  school: string,
  column: string,
  ids: string[],
) {
  if (!ids.length) return [] as Row[];
  let all: Row[] = [];
  for (let page = 0; ; page++) {
    const { data, error } = await db()
      .from(table)
      .select("*")
      .eq("school_id", school)
      .in(column, ids)
      .order("id")
      .range(page * 500, page * 500 + 499);
    if (error) throw error;
    all = all.concat(data as Row[]);
    if (data.length < 500) return all;
  }
}
function details(row: Row, c: Context) {
  const enrollment = c.enrollments.filter(
    (e) => e.student_id === row.id && e.status === "active",
  );
  const teams = enrollment
    .map((e) => c.teams.find((t) => t.id === e.team_id)?.name)
    .filter(Boolean)
    .join(", ");
  const links = c.links.filter((l) => l.student_id === row.id);
  const link = links.find((l) => l.billing) || links[0];
  const storedGuardian = c.guardians.find((g) => g.id === link?.guardian_id);
  const guardian: Row | undefined = storedGuardian
    ? { ...storedGuardian, name: demoGuardianName(row, storedGuardian.name) }
    : undefined;
  const attendance = c.attendance.filter((a) => a.student_id === row.id);
  const counts = {
    present: attendance.filter((a) => a.status === "present").length,
    absent: attendance.filter((a) => a.status === "absent").length,
    late: attendance.filter((a) => a.status === "late").length,
  };
  const base = counts.present + counts.absent + counts.late;
  const frequency = base
    ? Math.round(((counts.present + counts.late) / base) * 100)
    : null;
  const invoices = c.invoices.filter((i) => i.student_id === row.id);
  const due = invoices.filter((i) =>
    ["pending", "processing", "overdue"].includes(invoiceStatus(i)),
  );
  const overdue = due.filter((i) => invoiceStatus(i) === "overdue");
  const paid = invoices
    .filter((i) => i.status === "paid")
    .reduce((a, i) => a + Number(i.amount), 0);
  const evaluations = c.evaluations.filter((e) => e.student_id === row.id);
  return {
    teams,
    guardian,
    attendance,
    counts,
    frequency,
    invoices,
    due,
    overdue,
    paid,
    evaluations,
  };
}
export default function Students({
  module,
  school,
  role,
  preview,
  notify,
}: Props) {
  const [page, setPage] = useState(0),
    [search, setSearch] = useState(""),
    [term, setTerm] = useState(""),
    [filter, setFilter] = useState(""),
    [sort, setSort] = useState("created_at"),
    [quick, setQuick] = useState<Row>(),
    [full, setFull] = useState<Row>(),
    [tab, setTab] = useState("Ficha"),
    [edit, setEdit] = useState<Row | null>(),
    [archive, setArchive] = useState<Row>();
  const client = useQueryClient();
  const write = module.write.includes(role) && !preview;
  const financial = role !== "coach";
  useEffect(() => {
    const timer = setTimeout(() => {
      setTerm(search);
      setPage(0);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);
  const q = useQuery({
    queryKey: ["student-grid", school, page, term, filter, sort, preview],
    queryFn: async () => {
      if (preview) {
        let rows = (previewRows.students || []).filter(
          (r) =>
            (!term ||
              String(r.name).toLowerCase().includes(term.toLowerCase())) &&
            (!filter || r.status === filter),
        );
        if (sort === "name")
          rows = [...rows].sort((a, b) =>
            String(a.name).localeCompare(String(b.name)),
          );
        return {
          rows: rows.slice(page * 12, page * 12 + 12),
          count: rows.length,
        };
      }
      return listRows(
        module,
        school,
        page,
        term,
        sort,
        sort === "name",
        filter,
      );
    },
  });
  const ids = [
    ...new Set([
      ...(q.data?.rows.map((r) => String(r.id)) || []),
      ...(full ? [String(full.id)] : []),
    ]),
  ];
  const context = useQuery({
    queryKey: ["student-cards-context", school, ids.join(","), role, preview],
    enabled: ids.length > 0,
    queryFn: async (): Promise<Context> => {
      if (preview)
        return {
          ...emptyContext,
          enrollments: previewRows.enrollments || [],
          teams: previewRows.teams || [],
        };
      const [enrollments, links, attendance, invoices, evaluations] =
        await Promise.all([
          scopedRows("enrollments", school, "student_id", ids),
          financial
            ? scopedRows("student_guardians", school, "student_id", ids)
            : Promise.resolve([]),
          scopedRows("attendance", school, "student_id", ids),
          financial
            ? scopedRows("invoices", school, "student_id", ids)
            : Promise.resolve([]),
          scopedRows("evaluations", school, "student_id", ids),
        ]);
      const [teams, guardians, criteria] = await Promise.all([
        scopedRows("teams", school, "id", [
          ...new Set(enrollments.map((e) => String(e.team_id))),
        ]),
        scopedRows("guardians", school, "id", [
          ...new Set(links.map((l) => String(l.guardian_id))),
        ]),
        scopedRows("evaluation_criteria", school, "id", [
          ...new Set(evaluations.map((e) => String(e.criterion_id))),
        ]),
      ]);
      return {
        enrollments,
        links,
        attendance,
        invoices,
        evaluations,
        teams,
        guardians,
        criteria,
      };
    },
  });
  useEffect(() => {
    if (full) {
      const latest = q.data?.rows.find((row) => row.id === full.id);
      if (latest && latest !== full) setFull(latest);
    }
  }, [q.data, full]);
  const c = context.data || emptyContext;
  const pages = Math.max(1, Math.ceil((q.data?.count || 0) / 12));
  const arch = useMutation({
    mutationFn: () => archiveRow(module, school, archive!),
    onSuccess: () => {
      client.invalidateQueries();
      setArchive(undefined);
      notify("Aluno arquivado. Histórico preservado.");
    },
  });
  function openFull(row: Row, nextTab = "Ficha") {
    setQuick(undefined);
    setFull(row);
    setTab(nextTab);
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  async function exportStudents() {
    try {
      let rows: Row[] = [];
      for (let p = 0; ; p++) {
        const result = preview
          ? { rows: previewRows.students || [], count: 0 }
          : await listRows(
              module,
              school,
              p,
              term,
              sort,
              sort === "name",
              filter,
            );
        rows.push(...result.rows);
        if (preview || rows.length >= result.count) break;
      }
      exportCsv(
        rows,
        [
          { key: "name", label: "Aluno" },
          { key: "registration_code", label: "Matrícula" },
          { key: "birth_date", label: "Nascimento" },
          { key: "position", label: "Posição" },
          { key: "status", label: "Situação" },
        ],
        "alunos",
      );
      notify("Alunos exportados.");
    } catch (e) {
      notify(friendlyError(e));
    }
  }
  const actions = (row: Row) => (
    <>
      <button onClick={() => openFull(row)}>
        <Eye size={16} />
        Abrir ficha completa
      </button>
      {write && (
        <button
          onClick={() => {
            setQuick(undefined);
            setEdit(row);
          }}
        >
          <Pencil size={16} />
          Editar aluno
        </button>
      )}
      <button onClick={() => openFull(row, "Presença")}>
        <ClipboardCheck size={16} />
        Presenças
      </button>
      <button onClick={() => openFull(row, "Avaliações")}>
        <Activity size={16} />
        Avaliações
      </button>
      {financial && (
        <>
          <button onClick={() => openFull(row, "Financeiro")}>
            <Wallet size={16} />
            Mensalidades
          </button>
          <button onClick={() => openFull(row, "Responsáveis")}>
            <Users size={16} />
            Responsáveis
          </button>
        </>
      )}
      {write && row.status !== "inactive" && (
        <button className="archive-action" onClick={() => setArchive(row)}>
          <Archive size={16} />
          Arquivar aluno
        </button>
      )}
    </>
  );
  function FinanceLabel({ row }: { row: Row }) {
    const d = details(row, c);
    if (context.isPending)
      return <span className="student-tag">Carregando…</span>;
    if (context.isError)
      return <span className="student-tag">Resumo indisponível</span>;
    return (
      <span
        className={
          "student-tag " +
          (d.overdue.length
            ? "overdue"
            : d.due.length
              ? "pending"
              : d.invoices.length
                ? "paid"
                : "")
        }
      >
        {d.overdue.length
          ? "Mensalidade em atraso"
          : d.due.length
            ? "Mensalidade a vencer"
            : d.invoices.length
              ? "Financeiro em dia"
              : "Sem mensalidades"}
      </span>
    );
  }
  const renderOverview = (row: Row) => {
    const d = details(row, c);
    return (
      <>
        <section className="quick-block">
          <h3>
            <ClipboardCheck size={17} />
            Presença nos treinos
          </h3>
          <div className="attendance-counts">
            <div>
              <strong>{d.counts.present}</strong>
              <span>Presenças</span>
            </div>
            <div>
              <strong>{d.counts.absent}</strong>
              <span>Faltas</span>
            </div>
            <div>
              <strong>{d.counts.late}</strong>
              <span>Atrasos</span>
            </div>
          </div>
          <div className="progress">
            <i style={{ width: (d.frequency || 0) + "%" }} />
          </div>
          <small>
            {d.frequency === null
              ? "Sem chamadas registradas"
              : `${d.frequency}% de frequência · histórico registrado`}
          </small>
        </section>
        <section className="quick-block">
          <h3>
            <Activity size={17} />
            Evolução esportiva
          </h3>
          {d.evaluations.length ? (
            d.evaluations.slice(0, 5).map((e) => (
              <div className="quick-metric" key={e.id}>
                <span>
                  {String(
                    c.criteria.find((cr) => cr.id === e.criterion_id)?.name ||
                      e.name,
                  )}
                </span>
                <strong>
                  {String(e.score)}
                  <small>
                    {" "}
                    /{" "}
                    {String(
                      c.criteria.find((cr) => cr.id === e.criterion_id)
                        ?.max_score || 10,
                    )}
                  </small>
                </strong>
              </div>
            ))
          ) : (
            <p>Nenhuma avaliação registrada.</p>
          )}
        </section>
        {financial && (
          <section className="quick-block">
            <h3>
              <Wallet size={17} />
              Resumo financeiro
            </h3>
            <div className="quick-metric">
              <span>Total recebido</span>
              <strong>{currency(d.paid)}</strong>
            </div>
            <div className="quick-metric">
              <span>Em aberto</span>
              <strong>
                {currency(d.due.reduce((a, i) => a + Number(i.amount), 0))}
              </strong>
            </div>
            <FinanceLabel row={row} />
          </section>
        )}
        <section className="quick-block">
          <h3>
            <CalendarDays size={17} />
            Cadastro e contato
          </h3>
          <p>Entrada em {dateLabel(row.joined_on)}</p>
          {d.guardian && (
            <>
              <strong>{String(d.guardian.name)}</strong>
              <p>
                {String(
                  d.guardian.phone ||
                    d.guardian.email ||
                    "Contato não informado",
                )}
              </p>
            </>
          )}
        </section>
      </>
    );
  };
  if (full)
    return (
      <>
        <div className="page-title">
          <div>
            <button className="text-btn" onClick={() => setFull(undefined)}>
              <ArrowLeft size={16} />
              Voltar aos alunos
            </button>
            <h1>{String(full.name)}</h1>
            <p>Ficha do atleta e acompanhamento da escola.</p>
          </div>
          {write && (
            <button className="btn primary" onClick={() => setEdit(full)}>
              <Pencil size={16} />
              Editar aluno
            </button>
          )}
        </div>
        <div className="student-profile-layout">
          <aside className="panel athlete-profile">
            <StudentPhoto row={full} large />
            <h2>{String(full.name)}</h2>
            <span>{String(full.registration_code)}</span>
            <Badge
              value={String(full.status)}
              label={full.status === "active" ? "Ativo" : "Inativo"}
            />
            <dl>
              <div>
                <dt>Turma</dt>
                <dd>{details(full, c).teams || "Sem turma ativa"}</dd>
              </div>
              <div>
                <dt>Idade</dt>
                <dd>{studentAge(full.birth_date)} anos</dd>
              </div>
              <div>
                <dt>Posição</dt>
                <dd>{String(full.position || "Não informada")}</dd>
              </div>
              <div>
                <dt>Camisa</dt>
                <dd>{String(full.shirt_number ?? "—")}</dd>
              </div>
            </dl>
            <button className="btn secondary" onClick={() => setQuick(full)}>
              <Eye size={16} />
              Visualizar rápido
            </button>
          </aside>
          <StudentDetail
            key={String(full.id) + tab}
            row={q.data?.rows.find((r) => r.id === full.id) || full}
            school={school}
            preview={preview}
            role={role}
            notify={notify}
            onClose={() => setFull(undefined)}
            embedded
            initialTab={tab}
          />
        </div>
        {renderOverlays()}
      </>
    );
  function renderOverlays() {
    return (
      <>
        {edit !== undefined && (
          <RecordForm
            module={module}
            school={school}
            row={edit || undefined}
            onClose={() => setEdit(undefined)}
            onSaved={notify}
          />
        )}
        {quick && (
          <Modal
            title="Visualização rápida"
            onClose={() => setQuick(undefined)}
            drawer
          >
            <div className="quick-student-header">
              <StudentPhoto row={quick} large />
              <div>
                <h2>{String(quick.name)}</h2>
                <p>
                  {String(quick.registration_code)} ·{" "}
                  {details(quick, c).teams || "Sem turma ativa"}
                </p>
                <Badge
                  value={String(quick.status)}
                  label={quick.status === "active" ? "Ativo" : "Inativo"}
                />
              </div>
            </div>
            <div className="quick-actions">
              <button className="btn primary" onClick={() => openFull(quick)}>
                <Eye size={16} />
                Abrir ficha completa
              </button>
              {write && (
                <button
                  className="btn secondary"
                  onClick={() => {
                    setEdit(quick);
                    setQuick(undefined);
                  }}
                >
                  <Pencil size={16} />
                  Editar
                </button>
              )}
            </div>
            {context.isPending ? (
              <Loading />
            ) : context.isError ? (
              <ErrorState
                message={friendlyError(context.error)}
                retry={() => context.refetch()}
              />
            ) : (
              renderOverview(quick)
            )}
          </Modal>
        )}
        {archive && (
          <Modal title="Arquivar aluno" onClose={() => setArchive(undefined)}>
            <p>
              O cadastro de {String(archive.name)} ficará inativo. Os vínculos e
              o histórico serão preservados.
            </p>
            {arch.isError && (
              <p className="error-text">{friendlyError(arch.error)}</p>
            )}
            <div className="modal-actions">
              <button
                className="btn secondary"
                onClick={() => setArchive(undefined)}
              >
                Cancelar
              </button>
              <button
                className="btn danger"
                disabled={arch.isPending}
                onClick={() => arch.mutate()}
              >
                {arch.isPending ? "Arquivando…" : "Arquivar aluno"}
              </button>
            </div>
          </Modal>
        )}
      </>
    );
  }
  return (
    <>
      <div className="page-title">
        <div>
          <h1>Alunos</h1>
          <p>Seu elenco, as famílias e a evolução de cada atleta.</p>
        </div>
        {module.write.includes(role) && (
          <button
            className="btn primary"
            disabled={preview}
            onClick={() => setEdit(null)}
          >
            <Plus size={18} />
            Cadastrar aluno
          </button>
        )}
      </div>
      <section className="panel student-grid-toolbar">
        <label className="search">
          <Search size={18} />
          <input
            aria-label="Buscar alunos"
            placeholder="Buscar aluno pelo nome…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <div className="toolbar-actions">
          <select
            aria-label="Filtrar situação"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setPage(0);
            }}
          >
            <option value="">Todas as situações</option>
            <option value="active">Ativos</option>
            <option value="inactive">Inativos</option>
          </select>
          <select
            aria-label="Ordenar alunos"
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              setPage(0);
            }}
          >
            <option value="created_at">Mais recentes</option>
            <option value="name">Nome A–Z</option>
          </select>
        </div>
      </section>
      <div className="student-grid-meta">
        <span>
          {q.data?.count || 0} alunos{" "}
          {filter && `· ${filter === "active" ? "Ativos" : "Inativos"}`}
        </span>
        <button className="btn secondary" onClick={exportStudents}>
          <Download size={16} />
          Exportar
        </button>
      </div>
      {context.isError && (
        <div className="notice">
          Não foi possível carregar os resumos.{" "}
          <button onClick={() => context.refetch()}>Tentar novamente</button>
        </div>
      )}
      {q.isPending ? (
        <Loading />
      ) : q.isError ? (
        <ErrorState
          message={friendlyError(q.error)}
          retry={() => q.refetch()}
        />
      ) : !q.data.rows.length ? (
        <Empty
          title="Nenhum aluno encontrado"
          text="Tente outro nome, ajuste os filtros ou cadastre um atleta."
        />
      ) : (
        <div className="student-card-grid">
          {q.data.rows.map((row) => {
            const d = details(row, c);
            return (
              <article className="student-card" key={row.id}>
                <header>
                  <button
                    className="student-code"
                    onClick={() => openFull(row)}
                  >
                    {String(row.registration_code)}
                  </button>
                  <span className={"student-status " + String(row.status)}>
                    <i />
                    {row.status === "active" ? "Ativo" : "Inativo"}
                  </span>
                  <details className="student-card-menu">
                    <summary aria-label={"Ações de " + row.name}>
                      <MoreVertical size={18} />
                    </summary>
                    <div className="student-menu-options">{actions(row)}</div>
                  </details>
                </header>
                <div className="student-card-body">
                  <button
                    className="student-card-person"
                    onClick={() => openFull(row)}
                  >
                    <StudentPhoto row={row} />
                    <span>
                      <strong>{String(row.name)}</strong>
                      <small>
                        {context.isPending
                          ? "Carregando turma…"
                          : d.teams || "Sem turma ativa"}
                      </small>
                      <span className="student-position">
                        <Goal size={12} />
                        {String(row.position || "Posição a definir")}
                      </span>
                    </span>
                  </button>
                  <div className="student-card-stats">
                    <div>
                      <span>Camisa</span>
                      <strong>
                        {row.shirt_number == null
                          ? "—"
                          : "#" + row.shirt_number}
                      </strong>
                    </div>
                    <div>
                      <span>Idade</span>
                      <strong>{studentAge(row.birth_date)} anos</strong>
                    </div>
                    <div>
                      <span>Frequência</span>
                      <strong>
                        {d.frequency === null ? "—" : d.frequency + "%"}
                      </strong>
                    </div>
                  </div>
                  {financial && (
                    <div className="student-guardian">
                      {d.guardian && isDemoStudent(row) ? (
                        <img
                          className="guardian-photo"
                          src={demoGuardianPhoto(row)}
                          alt="Foto de exemplo do responsável"
                          loading="lazy"
                        />
                      ) : (
                        <UserRound size={20} />
                      )}
                      <span>
                        <strong>
                          {context.isPending
                            ? "Carregando responsável…"
                            : String(
                                d.guardian?.name || "Responsável não vinculado",
                              )}
                        </strong>
                        <small>
                          {String(
                            d.guardian?.phone ||
                              d.guardian?.email ||
                              "Contato não informado",
                          )}
                        </small>
                      </span>
                    </div>
                  )}
                  <div className="student-card-tags">
                    {financial && <FinanceLabel row={row} />}
                    <span className="student-tag">
                      <Shirt size={12} />
                      {row.image_consent
                        ? "Imagem autorizada"
                        : "Sem autorização de imagem"}
                    </span>
                  </div>
                </div>
                <footer>
                  <div>
                    {d.guardian?.phone ? (
                      <a
                        className="icon-btn"
                        href={
                          "tel:" +
                          String(d.guardian.phone).replace(/[^+\d]/g, "")
                        }
                        aria-label={"Ligar para responsável de " + row.name}
                      >
                        <Phone size={16} />
                      </a>
                    ) : (
                      <button
                        className="icon-btn"
                        disabled
                        aria-label="Telefone não cadastrado"
                      >
                        <Phone size={16} />
                      </button>
                    )}
                    {d.guardian?.email &&
                    !String(d.guardian.email).endsWith(".invalid") ? (
                      <a
                        className="icon-btn"
                        href={"mailto:" + d.guardian.email}
                        aria-label={"E-mail do responsável de " + row.name}
                      >
                        <Mail size={16} />
                      </a>
                    ) : (
                      <button
                        className="icon-btn"
                        disabled
                        aria-label="E-mail real não cadastrado"
                      >
                        <Mail size={16} />
                      </button>
                    )}
                  </div>
                  <button
                    className="btn student-quick-button"
                    onClick={() => setQuick(row)}
                  >
                    <Eye size={15} />
                    Visualizar rápido
                  </button>
                </footer>
              </article>
            );
          })}
        </div>
      )}
      <div className="pagination student-grid-pagination">
        <span>{q.data?.count || 0} alunos</span>
        <div>
          <button
            className="icon-btn"
            aria-label="Página anterior"
            disabled={!page}
            onClick={() => setPage(page - 1)}
          >
            <ChevronLeft size={18} />
          </button>
          <span>
            {page + 1} de {pages}
          </span>
          <button
            className="icon-btn"
            aria-label="Próxima página"
            disabled={page + 1 >= pages}
            onClick={() => setPage(page + 1)}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
      {renderOverlays()}
    </>
  );
}
