# Estado verificável da implantação

Atualizado durante a implementação em 16/10/2026 (America/Sao_Paulo).

- Projeto Supabase indicado respondeu à chave pública fornecida; inicialmente sem tabelas no schema public.
- As seis migrations 202610160001 a 202610160006 foram executadas pelo editor SQL autenticado; resultado confirmado: 33 tabelas, todas com RLS ativa.
- Escola Juventus Academy São Carlos cadastrada e usuário indicado pelo proprietário vinculado como administrador. O proprietário criou a senha pessoalmente e confirmou o login; painel real carregou sem dados de demonstração.
- Não foram inseridos alunos, responsáveis ou pagamentos de demonstração no banco real.
- `.env.local` contém somente dados públicos e é ignorado no Git.
- Testes locais: 19 aprovados, incluindo migrations PostgreSQL/RLS em PGlite; build TypeScript + Vite aprovado com os ajustes finais de identidade e datas. As três Edge Functions passaram também por `deno check`.
- Auditoria npm: zero vulnerabilidades detectadas.
- Asaas: sem credencial fornecida. Estrutura preparada; nenhuma cobrança emitida nem homologação real realizada.
- Edge Functions `invite-member`, `asaas-payment` e `asaas-webhook` publicadas. Todas recusaram requisições sem autenticação/token válido com HTTP 401. Configurados APP_URL, ASAAS_ENV=sandbox e ASAAS_SCHOOL_ID. Nenhuma chave Asaas privada foi configurada.
- GitHub: repositório remoto configurado para o endereço informado; commit local criado. Push falhou por ausência de autenticação. Nenhum arquivo foi enviado ao GitHub.
- Vercel: publicação inicial foi transferida para o time Prócion Sistemas, mas o proprietário informou que essa era a conta incorreta. A autorização da CLI foi interrompida; destino final precisa ser corrigido após acesso à conta certa. O domínio publicado inicialmente não deve ser considerado a entrega definitiva. O build final possui pequenos ajustes de formulários ainda a republicar.
- Interface revisada em 1440px e 390px, com busca de alunos, ficha individual, modo escuro, navegação e login real. Testes de pagamento sandbox e perfis adicionais continuam pendentes.

As migrations aplicadas manualmente devem ser marcadas como `applied` no histórico do Supabase CLI antes de um futuro `db push`.
