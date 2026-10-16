export type Role = "admin" | "secretary" | "coach" | "guardian" | "student";
export type Row = {
  id: string;
  school_id: string;
  created_at: string;
  name?: string;
  [key: string]: unknown;
};
export const roles: Record<Role, string> = {
  admin: "Administrador",
  secretary: "Secretaria",
  coach: "Professor",
  guardian: "Responsável",
  student: "Aluno",
};
export const currency = (value: unknown) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number(value || 0),
  );
export const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export function dateLabel(value: unknown, withTime = false) {
  if (!value) return "—";
  const raw = String(value);
  const d = new Date(raw.length === 10 ? raw + "T12:00:00-03:00" : raw);
  return Number.isNaN(+d)
    ? "—"
    : new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Sao_Paulo",
        day: "2-digit",
        month: "short",
        ...(withTime
          ? { hour: "2-digit", minute: "2-digit" }
          : { year: "numeric" }),
      }).format(d);
}
export function invoiceStatus(
  row: Pick<Row, "id"> & Record<string, unknown>,
  day = today(),
) {
  return ["pending", "processing", "overdue"].includes(String(row.status)) &&
    String(row.due_date) < day
    ? "overdue"
    : String(row.status);
}
export const statusLabels: Record<string, string> = {
  active: "Ativo",
  inactive: "Inativo",
  pending: "Pendente",
  processing: "Em processamento",
  paid: "Pago",
  overdue: "Vencido",
  cancelled: "Cancelado",
  refunded: "Estornado",
  scheduled: "Agendado",
  completed: "Concluído",
  present: "Presente",
  absent: "Ausente",
  excused: "Justificado",
  late: "Atrasado",
};
export function pageRange(page: number, size = 12) {
  const p = Math.max(0, Math.floor(page));
  return { from: p * size, to: p * size + size - 1 };
}
export function financialTotals(rows: Row[], day = today()) {
  return rows.reduce(
    (sum, r) => {
      const s = invoiceStatus(r, day),
        amount = Number(r.amount);
      if (s === "paid") sum.received += amount;
      if (["pending", "processing", "overdue"].includes(s))
        sum.pending += amount;
      if (s === "overdue") sum.overdue += amount;
      return sum;
    },
    { received: 0, pending: 0, overdue: 0 },
  );
}
export function safeCsv(value: unknown) {
  const s = String(value ?? "");
  return (
    '"' + (/^[\s]*[=+@\-]/.test(s) ? "'" + s : s).replaceAll('"', '""') + '"'
  );
}
export function exportCsv(
  rows: Row[],
  columns: { key: string; label: string }[],
  name: string,
) {
  const csv =
    "\uFEFF" +
    [
      columns.map((c) => safeCsv(c.label)).join(";"),
      ...rows.map((r) => columns.map((c) => safeCsv(r[c.key])).join(";")),
    ].join("\r\n");
  const url = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8;" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name + ".csv";
  a.click();
  URL.revokeObjectURL(url);
}
