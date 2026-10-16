import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { UserPlus, ShieldCheck, Database, Cloud, Link2 } from "lucide-react";
import { db, friendlyError } from "../lib/supabase";
import { roles, dateLabel } from "../domain";
import type { Role } from "../domain";
import { Loading, ErrorState } from "./ui";
export default function Settings({
  school,
  preview,
  notify,
}: {
  school: string;
  preview: boolean;
  notify: (s: string) => void;
}) {
  const [email, setEmail] = useState(""),
    [role, setRole] = useState<Role>("secretary");
  const invite = useMutation({
    mutationFn: async () => {
      const { data, error } = await db().functions.invoke("invite-member", {
        body: { school_id: school, email, role },
      });
      if (error)
        throw new Error(
          "Não foi possível enviar o convite. Confira a publicação da função e suas permissões.",
        );
      if (data.error) throw new Error(data.error);
    },
    onSuccess: () => {
      setEmail("");
      notify("Convite enviado para o e-mail informado.");
    },
  });
  const logs = useQuery({
    queryKey: ["audit", school, preview],
    queryFn: async () => {
      if (preview) return [];
      const { data, error } = await db()
        .from("audit_logs")
        .select("*")
        .eq("school_id", school)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data;
    },
  });
  return (
    <>
      <div className="page-title">
        <div>
          <h1>Configurações</h1>
          <p>Acesso, integrações e rastreabilidade da escola.</p>
        </div>
      </div>
      <div className="settings-grid">
        <section className="panel padded">
          <ShieldCheck size={25} className="orange-text" />
          <h2>Convide sua equipe</h2>
          <p>
            O perfil é atribuído no servidor. Vínculos de professores e
            responsáveis são associados pelo e-mail.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              invite.mutate();
            }}
          >
            <label>
              E-mail
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="pessoa@exemplo.com.br"
              />
            </label>
            <label>
              Perfil
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
              >
                {Object.entries(roles)
                  .filter(([r]) => r !== "student")
                  .map(([r, label]) => (
                    <option key={r} value={r}>
                      {label}
                    </option>
                  ))}
              </select>
            </label>
            {invite.isError && (
              <p className="error-text">{friendlyError(invite.error)}</p>
            )}
            <button
              className="btn primary"
              disabled={preview || invite.isPending}
            >
              <UserPlus size={17} />
              {invite.isPending ? "Enviando…" : "Enviar convite"}
            </button>
          </form>
        </section>
        <section className="panel padded">
          <Link2 size={25} className="orange-text" />
          <h2>Integrações</h2>
          <div className="integration-row">
            <Database size={20} />
            <div>
              <strong>Supabase</strong>
              <p>
                {preview
                  ? "Prévia visual, sem acesso ao banco"
                  : "Projeto configurado no aplicativo"}
              </p>
            </div>
          </div>
          <div className="integration-row">
            <Cloud size={20} />
            <div>
              <strong>Vercel</strong>
              <p>Build estático e rotas preparados. Deploy depende da conta.</p>
            </div>
          </div>
          <div className="notice">
            Asaas: as funções precisam ser publicadas e os segredos configurados
            no Supabase. Valide primeiro no sandbox. Não insira chaves privadas
            nesta tela.
          </div>
        </section>
      </div>
      <section className="panel">
        <div className="panel-head">
          <h2>Últimas alterações</h2>
          <small>30 registros mais recentes</small>
        </div>
        {logs.isPending ? (
          <Loading />
        ) : logs.isError ? (
          <ErrorState
            message={friendlyError(logs.error)}
            retry={() => logs.refetch()}
          />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Cadastro</th>
                  <th>Ação</th>
                  <th>Identificador</th>
                </tr>
              </thead>
              <tbody>
                {logs.data.map((log) => (
                  <tr key={log.id}>
                    <td>{dateLabel(log.created_at, true)}</td>
                    <td>{log.entity}</td>
                    <td>
                      {log.operation === "INSERT" ? "Cadastro" : "Atualização"}
                    </td>
                    <td className="id-cell">{log.record_id}</td>
                  </tr>
                ))}
                {!logs.data.length && (
                  <tr>
                    <td colSpan={4}>Nenhuma alteração registrada.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
