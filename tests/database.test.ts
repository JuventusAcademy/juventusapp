import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
let db: PGlite;
const sid = "10000000-0000-0000-0000-000000000001",
  other = "10000000-0000-0000-0000-000000000002";
const admin = "20000000-0000-0000-0000-000000000001",
  guardian = "20000000-0000-0000-0000-000000000002",
  coach = "20000000-0000-0000-0000-000000000003",
  stranger = "20000000-0000-0000-0000-000000000004";
const student = "30000000-0000-0000-0000-000000000001",
  hidden = "30000000-0000-0000-0000-000000000002",
  cross = "30000000-0000-0000-0000-000000000003",
  g = "40000000-0000-0000-0000-000000000001",
  c = "50000000-0000-0000-0000-000000000001",
  team = "60000000-0000-0000-0000-000000000001",
  session = "70000000-0000-0000-0000-000000000001",
  invoice = "80000000-0000-0000-0000-000000000001";
async function asUser(uid: string, sql: string) {
  await db.exec(
    `set role authenticated; select set_config('request.jwt.claim.sub','${uid}',false);`,
  );
  try {
    return await db.query(sql);
  } finally {
    await db.exec("reset role");
  }
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key,raw_user_meta_data jsonb); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to authenticated,anon,service_role; grant execute on function auth.uid() to authenticated,anon,service_role; create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]); create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text); alter table storage.objects enable row level security; create function storage.foldername(text) returns text[] language sql immutable as $$ select string_to_array($1,'/') $$; grant usage on schema storage to authenticated; grant select,insert on storage.objects to authenticated;`,
  );
  for (const file of readdirSync(resolve("supabase/migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    const sql = readFileSync(
      resolve("supabase/migrations", file),
      "utf8",
    ).replace("create extension if not exists pgcrypto;", "");
    await db.exec(sql);
  }
  await db.exec(
    `insert into auth.users(id) values('${admin}'),('${guardian}'),('${coach}'),('${stranger}'); insert into public.schools(id,name) values('${sid}','Escola A'),('${other}','Escola B'); insert into school_memberships(school_id,user_id,role) values('${sid}','${admin}','admin'),('${sid}','${guardian}','guardian'),('${sid}','${coach}','coach'); insert into students(id,school_id,name,birth_date) values('${student}','${sid}','Atleta autorizado','2015-01-01'),('${hidden}','${sid}','Atleta restrito','2015-01-01'),('${cross}','${other}','Outra escola','2015-01-01'); insert into guardians(id,school_id,user_id,name,email,cpf) values('${g}','${sid}','${guardian}','Família','familia@example.com','12345678909'); insert into student_guardians(school_id,student_id,guardian_id,billing) values('${sid}','${student}','${g}',true); insert into coaches(id,school_id,user_id,name,email) values('${c}','${sid}','${coach}','Professor','prof@example.com'); insert into teams(id,school_id,name,coach_id,capacity) values('${team}','${sid}','Sub-10','${c}',1); insert into enrollments(school_id,student_id,team_id,started_on) values('${sid}','${student}','${team}','2026-01-01'); insert into training_sessions(id,school_id,team_id,name,starts_at,ends_at) values('${session}','${sid}','${team}','Treino','2026-10-16T16:00:00-03:00','2026-10-16T17:00:00-03:00'); insert into invoices(id,school_id,student_id,guardian_id,name,competence,original_amount,due_date) values('${invoice}','${sid}','${student}','${g}','Mensalidade','2026-10-01',200,'2026-10-10');`,
  );
}, 30000);
afterAll(async () => {
  await db?.close();
});
describe("migrations e autorização PostgreSQL real (PGlite)", () => {
  it("isola escolas inclusive para o administrador", async () => {
    const r = await asUser(admin, "select id from students");
    expect(r.rows).toHaveLength(2);
    expect(r.rows.some((r: any) => r.id === cross)).toBe(false);
  });
  it("responsável só vê o aluno vinculado", async () => {
    const r = await asUser(guardian, "select id from students");
    expect(r.rows).toEqual([{ id: student }]);
  });
  it("professor só vê os alunos de sua turma", async () => {
    const r = await asUser(coach, "select id from students");
    expect(r.rows).toEqual([{ id: student }]);
  });
  it("usuário sem vínculo não vê dados", async () => {
    expect((await asUser(stranger, "select id from students")).rows).toEqual(
      [],
    );
  });
  it("responsável não insere aluno nem promove a si mesmo", async () => {
    await expect(
      asUser(
        guardian,
        `insert into students(school_id,name,birth_date) values('${sid}','Invasão','2015-01-01')`,
      ),
    ).rejects.toThrow();
    await expect(
      asUser(
        guardian,
        `update school_memberships set role='admin' where user_id='${guardian}'`,
      ),
    ).rejects.toThrow();
  });
  it("não permite ultrapassar a capacidade", async () => {
    await expect(
      asUser(
        admin,
        `insert into enrollments(school_id,student_id,team_id) values('${sid}','${hidden}','${team}')`,
      ),
    ).rejects.toThrow("sem vagas");
  });
  it("não permite vínculos entre escolas", async () => {
    await expect(
      asUser(
        admin,
        `insert into student_guardians(school_id,student_id,guardian_id) values('${sid}','${cross}','${g}')`,
      ),
    ).rejects.toThrow();
  });
  it("bloqueia pagamento manual e alteração de cliente Asaas", async () => {
    await expect(
      asUser(admin, `update invoices set status='paid' where id='${invoice}'`),
    ).rejects.toThrow("backend");
    await expect(
      asUser(
        admin,
        `update guardians set asaas_customer_id='cus_invasao' where id='${g}'`,
      ),
    ).rejects.toThrow("integração");
  });
  it("professor não lê cobranças e não assume contas", async () => {
    expect((await asUser(coach, "select id from invoices")).rows).toEqual([]);
    await expect(
      asUser(
        admin,
        `update guardians set user_id='${stranger}' where id='${g}'`,
      ),
    ).rejects.toThrow("provisionamento");
  });
  it("presença duplicada é impedida e chamada não matriculada rejeitada", async () => {
    await asUser(
      coach,
      `insert into attendance(school_id,session_id,student_id,status) values('${sid}','${session}','${student}','present')`,
    );
    await expect(
      asUser(
        coach,
        `insert into attendance(school_id,session_id,student_id,status) values('${sid}','${session}','${student}','absent')`,
      ),
    ).rejects.toThrow();
    await expect(
      asUser(
        admin,
        `insert into attendance(school_id,session_id,student_id,status) values('${sid}','${session}','${hidden}','present')`,
      ),
    ).rejects.toThrow("não matriculado");
  });
  it("webhook aplica pagamento uma única vez com evento idempotente", async () => {
    await db.exec(
      `select apply_asaas_state('${invoice}','evt_1','PAYMENT_RECEIVED','pay_1','RECEIVED',200,'https://sandbox.asaas.com/i/test','2026-10-16T12:00:00-03:00'); select apply_asaas_state('${invoice}','evt_1','PAYMENT_RECEIVED','pay_1','RECEIVED',200,'https://sandbox.asaas.com/i/test','2026-10-16T12:00:00-03:00');`,
    );
    expect((await db.query("select * from payments")).rows).toHaveLength(1);
    expect((await db.query("select * from payment_events")).rows).toHaveLength(
      1,
    );
    expect(
      (
        await db.query(
          "select * from notifications where name='Pagamento confirmado'",
        )
      ).rows,
    ).toHaveLength(1);
  });
  it("usuário não executa função de serviço e divergência financeira falha", async () => {
    await expect(
      asUser(
        admin,
        `select apply_asaas_state('${invoice}','evt_2','PAYMENT_RECEIVED','pay_1','RECEIVED',200,null,null)`,
      ),
    ).rejects.toThrow();
    await expect(
      db.exec(
        `select apply_asaas_state('${invoice}','evt_bad','PAYMENT_RECEIVED','pay_1','RECEIVED',199,null,null)`,
      ),
    ).rejects.toThrow("Valor divergente");
  });
  it("agregações respeitam período e não dependem de paginação", async () => {
    const result = await asUser(
      admin,
      `select dashboard('${sid}','2026-10-01','2026-10-31') as d`,
    );
    expect((result.rows[0] as any).d.received).toBe(200);
    expect((result.rows[0] as any).d.active).toBe(2);
    expect((result.rows[0] as any).d.attendance).toBe(100);
  });
  it("bucket é privado e documento não é legível sem metadado autorizado", async () => {
    const bucket = await db.query("select public from storage.buckets");
    expect(bucket.rows).toEqual([{ public: false }]);
    await db.exec(
      `insert into storage.objects(bucket_id,name) values('student-documents','${sid}/${student}/doc.pdf')`,
    );
    expect(
      (await asUser(stranger, "select name from storage.objects")).rows,
    ).toEqual([]);
    await db.exec(
      `insert into documents(school_id,student_id,name,storage_path) values('${sid}','${student}','Documento privado','${sid}/${student}/doc.pdf')`,
    );
    expect(
      (await asUser(guardian, "select name from storage.objects")).rows,
    ).toHaveLength(1);
    expect(
      (await asUser(coach, "select name from storage.objects")).rows,
    ).toEqual([]);
    expect(
      (await asUser(stranger, "select name from storage.objects")).rows,
    ).toEqual([]);
  });
});
