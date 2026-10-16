import { db } from "./supabase";
import { pageRange } from "../domain";
import type { Row } from "../domain";
import type { Module } from "../modules";
export async function listRows(
  module: Module,
  school: string,
  page: number,
  search: string,
  sort: string,
  ascending: boolean,
  filter: string,
) {
  let q = db()
    .from(module.table)
    .select("*", { count: "exact" })
    .eq("school_id", school);
  if (search && module.search)
    q = q.ilike(module.search, `%${search.replace(/[%_,()]/g, "")}%`);
  if (filter === "active")
    q = q.eq(
      module.archive || "status",
      module.archive === "active" ? true : "active",
    );
  if (filter === "inactive")
    q = q.eq(
      module.archive || "status",
      module.archive === "active" ? false : "inactive",
    );
  if (["pending", "paid", "overdue"].includes(filter)) {
    if (filter === "overdue")
      q = q.in("status", ["pending", "processing", "overdue"]).lt(
        "due_date",
        new Date().toLocaleDateString("en-CA", {
          timeZone: "America/Sao_Paulo",
        }),
      );
    else q = q.eq("status", filter);
  }
  const range = pageRange(page);
  const { data, error, count } = await q
    .order(sort, { ascending })
    .order("id")
    .range(range.from, range.to);
  if (error) throw error;
  return { rows: (data || []) as Row[], count: count || 0 };
}
export async function related(table: string, school: string) {
  let result: Row[] = [];
  let page = 0;
  while (true) {
    const { data, error } = await db()
      .from(table)
      .select("*")
      .eq("school_id", school)
      .order("id")
      .range(page * 500, page * 500 + 499);
    if (error) throw error;
    result = result.concat(data as Row[]);
    if (data.length < 500) break;
    page++;
  }
  return result;
}
export async function saveRow(
  table: string,
  school: string,
  values: Record<string, unknown>,
  id?: string,
) {
  const q = id
    ? db().from(table).update(values).eq("school_id", school).eq("id", id)
    : db()
        .from(table)
        .insert({ ...values, school_id: school });
  const { data, error } = await q.select("id").single();
  if (error) throw error;
  return data;
}
export async function archiveRow(module: Module, school: string, row: Row) {
  if (!module.archive)
    throw new Error("Este cadastro não permite arquivamento.");
  const key = module.archive;
  await saveRow(
    module.table,
    school,
    {
      [key]: key === "active" ? false : "inactive",
      ...(module.table === "enrollments"
        ? {
            ended_on: new Date().toLocaleDateString("en-CA", {
              timeZone: "America/Sao_Paulo",
            }),
          }
        : {}),
    },
    row.id,
  );
}
