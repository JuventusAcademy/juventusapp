import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Printer, BarChart3 } from "lucide-react";
import { db, friendlyError } from "../lib/supabase";
import { today, currency, exportCsv } from "../domain";
import type { Row } from "../domain";
import { previewDashboard } from "../preview";
import { Loading, ErrorState } from "./ui";
export default function Reports({
  school,
  preview,
}: {
  school: string;
  preview: boolean;
}) {
  const [from, setFrom] = useState(today().slice(0, 7) + "-01"),
    [to, setTo] = useState(today());
  const q = useQuery({
    queryKey: ["report", school, from, to, preview],
    enabled: !!from && !!to && from <= to,
    queryFn: async () => {
      if (preview) return previewDashboard;
      const { data, error } = await db().rpc("dashboard", {
        sid: school,
        from_date: from,
        to_date: to,
      });
      if (error) throw error;
      return data as typeof previewDashboard;
    },
  });
  const stats = q.data;
  const records = stats
    ? [
        { name: "Alunos ativos", value: stats.active },
        { name: "Novas matrículas", value: stats.new_students },
        { name: "Receita recebida", value: stats.received },
        { name: "Valor a receber", value: stats.pending },
        { name: "Valor vencido", value: stats.overdue },
        { name: "Frequência média (%)", value: stats.attendance },
        { name: "Turmas ativas", value: stats.teams },
      ]
    : [];
  return (
    <>
      <div className="page-title">
        <div>
          <h1>Relatórios</h1>
          <p>Decisões melhores começam com informação confiável.</p>
        </div>
        <div className="toolbar-actions">
          <button
            className="btn secondary"
            disabled={!stats}
            onClick={() =>
              exportCsv(
                records.map((r, i) => ({
                  id: String(i),
                  school_id: school,
                  created_at: "",
                  ...r,
                  from,
                  to,
                })) as Row[],
                [
                  { key: "name", label: "Indicador" },
                  { key: "value", label: "Valor" },
                  { key: "from", label: "De" },
                  { key: "to", label: "Até" },
                ],
                "relatorio-futgestao",
              )
            }
          >
            <Download size={16} />
            CSV
          </button>
          <button className="btn primary" onClick={() => window.print()}>
            <Printer size={16} />
            Imprimir / PDF
          </button>
        </div>
      </div>
      <section className="panel padded report-filters">
        <label>
          De
          <input
            type="date"
            value={from}
            max={to}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label>
          Até
          <input
            type="date"
            value={to}
            min={from}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <p>
          Recebimentos pela data de pagamento; pendências pelo vencimento.
          Cadastros ativos representam a posição atual.
        </p>
      </section>
      {from > to ? (
        <p className="error-text">
          O período inicial deve ser anterior ao final.
        </p>
      ) : q.isPending ? (
        <Loading />
      ) : q.isError ? (
        <ErrorState
          message={friendlyError(q.error)}
          retry={() => q.refetch()}
        />
      ) : (
        <section className="panel">
          <div className="panel-head">
            <h2>
              <BarChart3 size={20} />
              Indicadores da escola
            </h2>
            <span>
              {from.split("-").reverse().join("/")} a{" "}
              {to.split("-").reverse().join("/")}
            </span>
          </div>
          <div className="report-stats">
            {records.map((r, i) => (
              <div key={r.name}>
                <span>{r.name}</span>
                <strong>
                  {[2, 3, 4].includes(i)
                    ? currency(r.value)
                    : r.value.toLocaleString("pt-BR") + (i === 5 ? "%" : "")}
                </strong>
              </div>
            ))}
          </div>
          <div className="padded">
            <h3>Atletas por categoria</h3>
            {stats?.categories.length ? (
              stats.categories.map((c) => (
                <div className="report-category" key={c.name}>
                  <span>{c.name}</span>
                  <div className="progress">
                    <i
                      style={{
                        width:
                          (stats.active
                            ? (Number(c.value) / stats.active) * 100
                            : 0) + "%",
                      }}
                    />
                  </div>
                  <strong>{c.value}</strong>
                </div>
              ))
            ) : (
              <p>Sem matrículas em categorias.</p>
            )}
            <p className="helper">
              Alunos em múltiplas categorias aparecem em cada uma.
              Justificativas são excluídas do denominador da frequência. Os
              totais são calculados no banco, respeitando suas permissões.
            </p>
          </div>
        </section>
      )}
    </>
  );
}
