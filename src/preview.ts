// Exclusivamente prévia de design em desenvolvimento. Nunca representa a operação real.
import type { Row } from "./domain";
export const previewDashboard = {
  students: 192,
  active: 186,
  new_students: 12,
  teams: 9,
  coaches: 5,
  received: 28450,
  pending: 5860,
  overdue: 1240,
  attendance: 92.4,
  revenue: [
    { month: "2026-05", amount: 22100 },
    { month: "2026-06", amount: 24300 },
    { month: "2026-07", amount: 23400 },
    { month: "2026-08", amount: 26900 },
    { month: "2026-09", amount: 25800 },
    { month: "2026-10", amount: 28450 },
  ],
  categories: [
    { name: "Sub-8", value: 34 },
    { name: "Sub-10", value: 48 },
    { name: "Sub-12", value: 52 },
    { name: "Sub-14", value: 32 },
    { name: "Sub-16", value: 20 },
  ],
};
const row = (
  id: string,
  name: string,
  extra: Record<string, unknown>,
): Row => ({
  id,
  school_id: "preview",
  created_at: "2026-10-16T12:00:00Z",
  name,
  ...extra,
});
export const previewRows: Record<string, Row[]> = {
  students: [
    row("1", "Gabriel Oliveira", {
      registration_code: "FG-0248",
      birth_date: "2016-03-12",
      joined_on: "2026-10-14",
      status: "active",
    }),
    row("2", "Lucas Santos", {
      registration_code: "FG-0247",
      birth_date: "2014-07-22",
      joined_on: "2026-10-13",
      status: "active",
    }),
    row("3", "Pedro Almeida", {
      registration_code: "FG-0246",
      birth_date: "2015-05-08",
      joined_on: "2026-10-12",
      status: "active",
    }),
    row("4", "Miguel Ferreira", {
      registration_code: "FG-0245",
      birth_date: "2013-09-17",
      joined_on: "2026-10-10",
      status: "active",
    }),
  ],
  teams: [
    row("t1", "Sub-10 • Tarde", {
      capacity: 24,
      schedule: "Seg e qua, 16h",
      active: true,
    }),
    row("t2", "Sub-12 • Tarde", {
      capacity: 24,
      schedule: "Ter e qui, 17h",
      active: true,
    }),
  ],
  training_sessions: [
    row("s1", "Fundamentos e finalização", {
      team_id: "t1",
      starts_at: "2026-10-16T16:00:00-03:00",
      ends_at: "2026-10-16T17:30:00-03:00",
      location: "Campo principal",
      status: "scheduled",
    }),
    row("s2", "Treino técnico e coletivo", {
      team_id: "t2",
      starts_at: "2026-10-16T17:30:00-03:00",
      ends_at: "2026-10-16T19:00:00-03:00",
      location: "Campo principal",
      status: "scheduled",
    }),
  ],
  announcements: [
    row("a1", "Reunião com os responsáveis", {
      content:
        "Nosso encontro de acompanhamento acontece no sábado, às 9h. Vamos conversar sobre o desenvolvimento dos atletas.",
      published: true,
      publish_at: "2026-10-16T12:00:00Z",
    }),
  ],
  news: [
    row("n1", "Uma semana de muita evolução", {
      category: "Dentro de campo",
      summary:
        "Dedicação, trabalho em equipe e novos aprendizados nos treinos da semana.",
      content:
        "Cada treino é uma oportunidade de aprender. Confira com a equipe pedagógica a evolução do seu atleta.",
      published: true,
      publish_at: "2026-10-16T12:00:00Z",
    }),
  ],
};
