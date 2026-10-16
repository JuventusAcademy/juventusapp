import { useEffect, useState } from "react";
import {
  useQuery,
  useQueries,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import {
  Plus,
  Search,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Archive,
  Download,
  Eye,
  CreditCard,
} from "lucide-react";
import type { Row, Role } from "../domain";
import { columnLabels } from "../modules";
import type { Module } from "../modules";
import { listRows, archiveRow, related } from "../lib/data";
import { friendlyError } from "../lib/supabase";
import {
  currency,
  dateLabel,
  exportCsv,
  invoiceStatus,
  statusLabels,
} from "../domain";
import { Loading, Empty, ErrorState, Badge, Modal } from "./ui";
import RecordForm from "./RecordForm";
import StudentDetail from "./StudentDetail";
import Payment from "./Payment";
import { previewRows } from "../preview";
export function cell(row: Row, key: string, refs: Record<string, Row[]> = {}) {
  const value = row[key];
  if (key === "status") {
    const status = row.due_date ? invoiceStatus(row) : String(value);
    return <Badge value={status} label={statusLabels[status]} />;
  }
  if (typeof value === "boolean")
    return (
      <Badge
        value={value ? "active" : "inactive"}
        label={value ? "Sim" : "Não"}
      />
    );
  if (["amount", "discount", "original_amount"].includes(key))
    return <strong>{currency(value)}</strong>;
  if (
    key.endsWith("_at") ||
    key.endsWith("_on") ||
    ["birth_date", "due_date"].includes(key)
  )
    return dateLabel(value, key === "starts_at");
  if (key.endsWith("_id"))
    return refs[key]?.find((r) => r.id === value)?.name || "—";
  return String(value ?? "—");
}
export default function Records({
  module,
  school,
  role,
  preview,
  notify,
}: {
  module: Module;
  school: string;
  role: Role;
  preview: boolean;
  notify: (s: string) => void;
}) {
  const [page, setPage] = useState(0),
    [search, setSearch] = useState(""),
    [debounced, setDebounced] = useState(""),
    [sort, setSort] = useState("created_at"),
    [asc, setAsc] = useState(false),
    [filter, setFilter] = useState(""),
    [edit, setEdit] = useState<Row | null | undefined>(),
    [view, setView] = useState<Row>(),
    [payment, setPayment] = useState<Row>(),
    [archive, setArchive] = useState<Row>();
  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search);
      setPage(0);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);
  const q = useQuery({
    queryKey: [
      "records",
      school,
      module.table,
      page,
      debounced,
      sort,
      asc,
      filter,
      preview,
    ],
    queryFn: () =>
      preview
        ? Promise.resolve({
            rows: (previewRows[module.table] || []).filter(
              (r) =>
                !debounced ||
                String(r.name).toLowerCase().includes(debounced.toLowerCase()),
            ),
            count: (previewRows[module.table] || []).length,
          })
        : listRows(module, school, page, debounced, sort, asc, filter),
  });
  const refFields = module.fields.filter((f) => f.ref);
  const refsQueries = useQueries({
    queries: refFields.map((f) => ({
      queryKey: ["related", school, f.ref],
      queryFn: () =>
        preview
          ? Promise.resolve(previewRows[f.ref!] || [])
          : related(f.ref!, school),
    })),
  });
  const refs = Object.fromEntries(
    refFields.map((f, i) => [f.key, refsQueries[i].data || []]),
  );
  const write = module.write.includes(role) && !preview;
  const client = useQueryClient();
  const arch = useMutation({
    mutationFn: () => archiveRow(module, school, archive!),
    onSuccess: () => {
      client.invalidateQueries();
      setArchive(undefined);
      notify("Cadastro arquivado. O histórico foi preservado.");
    },
  });
  async function exportAll() {
    try {
      const rows = preview
        ? previewRows[module.table] || []
        : await related(module.table, school);
      exportCsv(
        rows,
        module.columns.map((key) => ({ key, label: columnLabels[key] || key })),
        module.id,
      );
      notify("CSV exportado com os registros autorizados.");
    } catch (e) {
      notify(friendlyError(e));
    }
  }
  const pages = Math.max(1, Math.ceil((q.data?.count || 0) / 12));
  return (
    <>
      <div className="page-title">
        <div>
          <h1>{module.title}</h1>
          <p>{module.description}</p>
        </div>
        {module.write.includes(role) && (
          <button
            className="btn primary"
            disabled={preview}
            onClick={() => setEdit(null)}
          >
            <Plus size={18} />
            Cadastrar {module.singular}
          </button>
        )}
      </div>
      {module.id === "finance" && (
        <div className="notice">
          <CreditCard size={20} />
          <span>
            Mensalidades salvas no banco. A emissão de Pix e boleto exige a
            ativação do Asaas pela administração.
          </span>
        </div>
      )}
      <section className="panel">
        <div className="table-toolbar">
          <label className="search">
            <Search size={18} />
            <input
              aria-label={"Buscar " + module.title}
              placeholder={
                module.search
                  ? "Buscar por nome…"
                  : "Pesquisa por nome não se aplica a este vínculo"
              }
              value={search}
              disabled={!module.search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <div className="toolbar-actions">
            {(module.archive || module.id === "finance") && (
              <select
                aria-label="Filtrar situação"
                value={filter}
                onChange={(e) => {
                  setFilter(e.target.value);
                  setPage(0);
                }}
              >
                <option value="">Todas as situações</option>
                {module.id === "finance" ? (
                  <>
                    <option value="pending">Pendentes</option>
                    <option value="paid">Pagas</option>
                    <option value="overdue">Vencidas</option>
                  </>
                ) : (
                  <>
                    <option value="active">Ativos</option>
                    <option value="inactive">Inativos</option>
                  </>
                )}
              </select>
            )}
            <button className="btn secondary" onClick={exportAll}>
              <Download size={16} />
              Exportar CSV
            </button>
          </div>
        </div>
        {q.isPending ? (
          <Loading />
        ) : q.isError ? (
          <ErrorState
            message={friendlyError(q.error)}
            retry={() => q.refetch()}
          />
        ) : !q.data.rows.length ? (
          <Empty
            title={
              debounced
                ? "Nenhum resultado encontrado"
                : "Ainda não há " + module.title.toLowerCase()
            }
            text={
              debounced
                ? "Experimente outro nome ou remova os filtros."
                : preview
                  ? "Esta seção não tem dados de exemplo."
                  : `Use “Cadastrar ${module.singular}” para começar.`
            }
          />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  {module.columns.map((key) => (
                    <th key={key}>
                      <button
                        onClick={() => {
                          setSort(key);
                          setAsc(sort === key ? !asc : true);
                          setPage(0);
                        }}
                      >
                        {columnLabels[key] || key}
                        <ArrowUpDown size={12} />
                      </button>
                    </th>
                  ))}
                  <th>
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {q.data.rows.map((row) => (
                  <tr key={row.id}>
                    {module.columns.map((key, i) => (
                      <td key={key}>
                        {i === 0 && key === "name" ? (
                          <span className="person">
                            <span className="avatar">
                              {String(row.name)
                                .split(" ")
                                .slice(0, 2)
                                .map((n) => n[0])
                                .join("")}
                            </span>
                            <strong>{String(row.name)}</strong>
                          </span>
                        ) : (
                          cell(row, key, refs)
                        )}
                      </td>
                    ))}
                    <td>
                      <div className="row-actions">
                        <button
                          className="icon-btn"
                          aria-label="Ver detalhes"
                          onClick={() => setView(row)}
                        >
                          <Eye size={17} />
                        </button>
                        {module.id === "finance" && (
                          <button
                            className="icon-btn"
                            aria-label="Consultar cobrança"
                            disabled={preview}
                            onClick={() => setPayment(row)}
                          >
                            <CreditCard size={17} />
                          </button>
                        )}
                        {write && (
                          <button
                            className="icon-btn"
                            aria-label="Editar registro"
                            onClick={() => setEdit(row)}
                          >
                            <Pencil size={16} />
                          </button>
                        )}
                        {write &&
                          module.archive &&
                          row[module.archive] !== false &&
                          row[module.archive] !== "inactive" && (
                            <button
                              className="icon-btn"
                              aria-label="Arquivar registro"
                              onClick={() => setArchive(row)}
                            >
                              <Archive size={16} />
                            </button>
                          )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="pagination">
          <span>
            {q.data?.count || 0} registros{preview ? " de exemplo" : ""}
          </span>
          <div>
            <button
              aria-label="Página anterior"
              className="icon-btn"
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft size={18} />
            </button>
            <span>
              {page + 1} de {pages}
            </span>
            <button
              aria-label="Próxima página"
              className="icon-btn"
              disabled={page + 1 >= pages}
              onClick={() => setPage(page + 1)}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </section>
      {edit !== undefined && (
        <RecordForm
          module={module}
          school={school}
          row={edit || undefined}
          onClose={() => setEdit(undefined)}
          onSaved={notify}
        />
      )}
      {view &&
        (module.id === "students" ? (
          <StudentDetail
            row={view}
            school={school}
            preview={preview}
            role={role}
            notify={notify}
            onClose={() => setView(undefined)}
          />
        ) : (
          <Modal
            title={String(view.name || "Detalhes")}
            onClose={() => setView(undefined)}
          >
            <dl className="details">
              {module.fields.map((f) => (
                <div key={f.key}>
                  <dt>{f.label}</dt>
                  <dd>{cell(view, f.key, refs)}</dd>
                </div>
              ))}
            </dl>
          </Modal>
        ))}
      {payment && (
        <Payment
          row={payment}
          school={school}
          role={role}
          notify={notify}
          onClose={() => setPayment(undefined)}
        />
      )}
      {archive && (
        <Modal title="Arquivar cadastro" onClose={() => setArchive(undefined)}>
          <p>
            O cadastro ficará inativo. Seus vínculos e histórico serão
            preservados.
          </p>
          {arch.isError && (
            <p className="error-text">{friendlyError(arch.error)}</p>
          )}
          <div className="modal-actions">
            <button
              className="btn secondary"
              onClick={() => setArchive(undefined)}
            >
              Voltar
            </button>
            <button
              className="btn danger"
              disabled={arch.isPending}
              onClick={() => arch.mutate()}
            >
              {arch.isPending ? "Arquivando…" : "Arquivar cadastro"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
