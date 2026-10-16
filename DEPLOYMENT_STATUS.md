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
- GitHub: credencial conferida pela API como usuário `JuventusAcademy`, com permissão de escrita no repositório exato. Código enviado à branch `main`. O workflow de TypeScript/build/testes concluiu com sucesso: https://github.com/JuventusAcademy/juventusapp/actions/runs/38900604130.
- Vercel: destino final confirmado pelo proprietário e pela CLI: `smartcellsanca-9579/juventusapp`, projeto `prj_1jzsSYd1JT5EeqjYaGxdH2AwnknZ`. Deploy `dpl_BRNjdu8GFs7t6PHwmVtkyLQ1Jd8r` concluiu READY em produção com build de nuvem aprovado. URL definitiva: https://juventusapp.vercel.app (HTTP 200 verificado).
- A publicação inicial no time Prócion Sistemas foi um erro de seleção de conta, posteriormente corrigido. Esse projeto foi pausado de modo reversível; seu domínio anterior responde HTTP 503. Não foi apagado nenhum projeto ou dado de outros sistemas.
- APP_URL das Edge Functions e Site URL do Supabase foram ajustados para o domínio definitivo. CORS confirmou `https://juventusapp.vercel.app`. Retornos de autenticação do domínio anterior foram removidos e substituídos pelos dois retornos do domínio correto.
- As variáveis públicas Supabase foram configuradas na Vercel para Production/Preview. A CLI alterou automaticamente `.env.local` ao vincular o projeto; a configuração local original foi restaurada imediatamente, removendo o token OIDC gerado da aplicação. Nenhum segredo foi enviado ao repositório.
- Deploy automático por push: pendente a GitHub Login Connection na conta Vercel, exigida pelo provedor. O deploy manual por CLI funciona no time correto.
- Gravação real verificada pela interface autenticada: unidade São Carlos cadastrada e exibida após retorno do banco. O usuário confirmou o login real como administrador antes da troca do domínio; no domínio definitivo é necessário entrar novamente por ser outra origem.
- Interface revisada em 1440px e 390px, com busca de alunos, ficha individual, modo escuro, navegação e login real. Testes de pagamento sandbox e perfis adicionais continuam pendentes.

As migrations aplicadas manualmente devem ser marcadas como `applied` no histórico do Supabase CLI antes de um futuro `db push`.
