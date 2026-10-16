# Estado verificável da implantação

Atualizado durante a implementação em 16/10/2026 (America/Sao_Paulo).

- Projeto Supabase indicado respondeu à chave pública fornecida; inicialmente sem tabelas no schema public.
- As migrations 202610160001 a 202610160005 foram executadas pelo editor SQL autenticado; resultado confirmado: 32 tabelas, todas com RLS ativa.
- Migration 202610160006 e cadastro da escola enviados ao editor; confirmação final registrada ao término.
- Não foram inseridos alunos, responsáveis ou pagamentos de demonstração no banco real.
- `.env.local` contém somente dados públicos e é ignorado no Git.
- Primeiro administrador ainda depende do e-mail do proprietário e da criação de senha por ele.
- Testes locais: 19 aprovados, incluindo migrations PostgreSQL/RLS em PGlite; build TypeScript + Vite aprovado antes dos últimos ajustes de identidade e endurecimento. Verificação final pendente.
- Asaas: sem credencial fornecida. Estrutura preparada; nenhuma cobrança emitida nem homologação real realizada.
- GitHub/Vercel/Edge Functions: resultados finais serão registrados ao término das tentativas de publicação.

As migrations aplicadas manualmente devem ser marcadas como `applied` no histórico do Supabase CLI antes de um futuro `db push`.
