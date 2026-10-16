import { describe, it, expect } from "vitest";
import {
  invoiceStatus,
  financialTotals,
  pageRange,
  safeCsv,
  dateLabel,
} from "./domain";
import type { Row } from "./domain";
const row = (status: string, due_date: string, amount: number) =>
  ({
    id: crypto.randomUUID(),
    school_id: "s",
    created_at: "",
    status,
    due_date,
    amount,
  }) as Row;
describe("cálculos financeiros", () => {
  it("deriva vencimento sem alterar pagamentos e cancelamentos", () => {
    expect(invoiceStatus(row("pending", "2026-10-14", 100), "2026-10-16")).toBe(
      "overdue",
    );
    expect(invoiceStatus(row("paid", "2026-10-14", 100), "2026-10-16")).toBe(
      "paid",
    );
    expect(invoiceStatus(row("pending", "2026-10-16", 100), "2026-10-16")).toBe(
      "pending",
    );
    expect(
      invoiceStatus(row("cancelled", "2026-10-14", 100), "2026-10-16"),
    ).toBe("cancelled");
  });
  it("soma valores finais e não soma cancelamentos e estornos", () => {
    expect(
      financialTotals(
        [
          row("paid", "2026-10-01", 200),
          row("pending", "2026-10-14", 80),
          row("pending", "2026-10-20", 90),
          row("cancelled", "2026-10-01", 500),
          row("refunded", "2026-10-01", 300),
        ],
        "2026-10-16",
      ),
    ).toEqual({ received: 200, pending: 170, overdue: 80 });
  });
});
it("usa intervalos inclusivos sem sobrepor páginas", () => {
  expect(pageRange(0)).toEqual({ from: 0, to: 11 });
  expect(pageRange(1)).toEqual({ from: 12, to: 23 });
  expect(pageRange(-2)).toEqual({ from: 0, to: 11 });
});
it("neutraliza fórmulas ao exportar CSV", () => {
  expect(safeCsv('=HYPERLINK("malicioso")')).toBe(
    '"\'=HYPERLINK(""malicioso"")"',
  );
  expect(safeCsv("  +1")).toBe('"\'  +1"');
  expect(safeCsv("Gabriel; Silva")).toBe('"Gabriel; Silva"');
});
it("preserva data civil brasileira e lida com valor inválido", () => {
  expect(dateLabel("2016-03-12")).toContain("12");
  expect(dateLabel("invalid")).toBe("—");
});
