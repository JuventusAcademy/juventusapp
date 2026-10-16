import type { Row } from "../domain";
import { today } from "../domain";
import { demoGuardianName } from "./studentDemo";
export function demoDetailRows(row: Row, tab: string): Row[] {
  const base = {
    school_id: row.school_id,
    created_at: new Date().toISOString(),
    student_id: row.id,
  };
  const date = today();
  const make = (id: string, extra: Record<string, unknown>): Row => ({
    ...base,
    id: `demo-${row.id}-${id}`,
    name: "Demonstração",
    ...extra,
  });
  if (tab === "Responsáveis")
    return [
      make("guardian", {
        name: demoGuardianName(row, ""),
        relationship: "Responsável legal · Demo",
        billing: true,
        pickup: true,
        emergency: true,
        email: "familia@example.invalid",
        phone: "(00) 00000-0000",
      }),
    ];
  if (tab === "Turmas")
    return [
      make("team", {
        name: "Sub-12 · Turma de demonstração",
        started_on: date,
        status: "active",
        schedule: "Terça e quinta, 17h às 18h",
        location: "Campo de demonstração",
        coach_name: "Ricardo Fernandes · Demo",
      }),
    ];
  if (tab === "Financeiro")
    return [
      make("invoice-paid", {
        name: "Mensalidade demonstrativa · quitada",
        amount: 210,
        due_date: date,
        status: "paid",
      }),
      make("invoice-pending", {
        name: "Mensalidade demonstrativa · em aberto",
        amount: 210,
        due_date: date,
        status: "pending",
      }),
    ];
  if (tab === "Presença")
    return [
      make("session-1", {
        name: "Fundamentos e passe · Demo",
        starts_at: date + "T17:00:00-03:00",
        status: "present",
      }),
      make("session-2", {
        name: "Finalização · Demo",
        starts_at: date + "T18:00:00-03:00",
        status: "late",
      }),
    ];
  if (tab === "Avaliações")
    return [
      "Passe",
      "Controle de bola",
      "Finalização",
      "Trabalho em equipe",
      "Posicionamento",
    ].map((name, i) =>
      make("evaluation-" + i, {
        name: name + " · Demo",
        score: [8, 7, 9, 8, 7][i],
        evaluated_on: date,
        comments: "Exemplo fictício de evolução técnica nos treinos.",
      }),
    );
  if (tab === "Documentos")
    return [
      make("document-enrollment", {
        name: "Ficha de matrícula · Demonstração",
        demo_url: "/demo-documents/ficha-matricula.html",
      }),
      make("document-sport", {
        name: "Plano de acompanhamento · Demonstração",
        demo_url: "/demo-documents/acompanhamento.html",
      }),
    ];
  return [];
}
