import type { Row } from "../domain";
export function isDemoStudent(row: Row) {
  return (
    String(row.registration_code || "").startsWith("DEMO-") ||
    row.school_id === "preview"
  );
}
export function demoGuardianName(row: Row, original: unknown) {
  if (!isDemoStudent(row))
    return String(original || "Responsável não vinculado");
  const names = [
    "Mariana Oliveira",
    "Carlos Henrique Silva",
    "Fernanda Santos",
    "Ricardo Costa",
    "Patrícia Almeida",
    "André Pereira",
    "Juliana Ferreira",
    "Rodrigo Martins",
    "Camila Ribeiro",
    "Eduardo Souza",
    "Luciana Gomes",
    "Bruno Carvalho",
  ];
  const index =
    Number(String(row.registration_code).match(/\d+$/)?.[0] || 1) - 1;
  return names[index % names.length] + " · Demo";
}
export function demoGuardianPhoto(row: Row) {
  const index = Number(String(row.registration_code).match(/\d+$/)?.[0] || 1);
  return `/demo-guardians/parent-${index % 2 ? "02" : "01"}.jpg`;
}

