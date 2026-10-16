# Juventus Academy São Carlos · FutGestão

Aplicação React + TypeScript + Vite para operação de escola de futebol. Interface em português, valores BRL e datas em America/Sao_Paulo. Visual desenvolvido com a skill frontend-design; logo obtida do perfil oficial indicado pelo usuário.

## Executar

Node.js 22.12+ e npm.

```sh
npm ci
cp .env.example .env.local
# Preencha a URL e a chave pública Supabase.
npm run dev
npm test
npm run build
```

Neste workspace, `.env.local` já contém apenas a URL e a chave **pública** fornecidas pelo proprietário. O arquivo é ignorado no Git. Nenhuma chave privada pode ser adicionada a variáveis `VITE_*`.

Em desenvolvimento, a tela de login oferece uma **prévia de design** com dados fictícios identificados e mutações bloqueadas. Essa opção não existe no build de produção. Dados operacionais vêm exclusivamente do Supabase.

## Arquitetura

- `src/components`: autenticação, dashboard, cadastros, ficha do aluno, chamada, agenda, relatórios, configurações e portal próprio para famílias.
- `src/modules.ts`: definições de campos, navegação e permissões de interface.
- `src/lib`: cliente Supabase e acesso a dados. TanStack Query gerencia cache e invalidação; React Hook Form e Zod validam os formulários.
- `supabase/migrations`: schema normalizado, restrições, RLS, auditoria, agregações, notificações e integração financeira.
- `supabase/functions`: APIs protegidas para convites, cobrança e webhook Asaas. Autenticação é validada explicitamente por `auth.getUser` dentro das funções; `verify_jwt=false` permite chaves publishable e webhooks sem depender do gateway JWT legado.
- `tests/database.test.ts`: executa as migrations em PostgreSQL embarcado PGlite, com stubs apenas dos schemas Auth/Storage e das roles do Supabase. Testa SQL e RLS reais. Não substitui ensaios contra Auth/Storage hospedados.

## Banco Supabase

Projeto: `hsagedxvjaxivxscqkby`. Escola: `22c62d6c-88e9-4e03-9b3f-757b9207dfea`.

As migrations são versionadas e ordenadas. Para um projeto novo:

```sh
npx supabase login
npx supabase link --project-ref SEU_PROJETO
npx supabase db push
```

No projeto indicado, as migrations foram aplicadas pelo editor SQL autenticado durante esta implementação. Antes de usar `db push` nele, registre a baseline com `supabase migration repair --status applied` para as versões que constam em `DEPLOYMENT_STATUS.md`. Não reaplique migrations já executadas. Não há alunos, famílias ou cobranças fictícias no banco real.

### Primeiro administrador

1. No Supabase, em Authentication → Users, crie o usuário com o e-mail do proprietário. O próprio proprietário deve informar a senha, sem compartilhá-la no chat ou no código.
2. Execute no SQL Editor, substituindo apenas o e-mail:

```sql
do $$
declare uid uuid;
begin
 select id into uid from auth.users where lower(email)=lower('ADMIN@EXEMPLO.COM');
 if uid is null then raise exception 'Crie o usuário no Auth antes de vincular.'; end if;
 insert into public.profiles(id) values(uid) on conflict do nothing;
 insert into public.school_memberships(school_id,user_id,role)
 values('22c62d6c-88e9-4e03-9b3f-757b9207dfea',uid,'admin')
 on conflict(school_id,user_id) do nothing;
end $$;
```

Esse procedimento administrativo não é exposto ao navegador. Para convites posteriores, use Configurações no aplicativo. Cadastre professores/responsáveis com o e-mail correto antes de convidá-los. Um usuário que já possui conta deve ser vinculado por um operador autorizado no painel, usando `provision_member` com a role `service_role` ou SQL administrativo. O endpoint de convite não altera contas existentes nem promove quem chama a função.

### Ordem recomendada de cadastros

Unidades → Categorias → Professores → Turmas → Alunos → Responsáveis → Vínculos familiares → Matrículas → Planos → Planos contratados → Mensalidades → Treinos → Chamada. Arquive cadastros em vez de apagá-los. Para transferir uma matrícula, encerre a anterior com a data correta e abra a nova; o histórico permanece.

## Vercel e GitHub

Repositório informado: [JuventusAcademy/juventusapp](https://github.com/JuventusAcademy/juventusapp).

Importe o repositório na Vercel como Vite; raiz do projeto `/`; build `npm run build`; diretório `dist`. Adicione nas variáveis de Production/Preview:

```text
VITE_SUPABASE_URL=https://hsagedxvjaxivxscqkby.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<chave pública do projeto>
```

Não configure `VITE_ENABLE_DESIGN_PREVIEW=true` em produção. A opção é bloqueada por `import.meta.env.DEV` independentemente dessa variável.

Em Supabase → Authentication → URL Configuration, defina Site URL para o endereço publicado e autorize os redirects do mesmo domínio, inclusive `/?setup=1`. Não use curingas de hosts em produção. Configure SMTP próprio antes de convidar muitas famílias; o envio hospedado tem limites.

## Edge Functions e Asaas

```sh
npx supabase functions deploy invite-member
npx supabase functions deploy asaas-payment
npx supabase functions deploy asaas-webhook
```

Configure os secrets pelo painel Supabase, usando `supabase/functions/.env.example` como referência. `SUPABASE_SERVICE_ROLE_KEY` permanece somente no runtime servidor. `APP_URL` deve ser o domínio do aplicativo. `ASAAS_SCHOOL_ID` deve corresponder à escola acima. Esta primeira versão isola uma conta Asaas por escola e recusa outras escolas; não reutiliza silenciosamente a mesma credencial financeira para todos os tenants.

Asaas inicia em `sandbox`. Configure chave API sandbox, token de webhook aleatório longo e os eventos de cobrança para:

```text
https://hsagedxvjaxivxscqkby.supabase.co/functions/v1/asaas-webhook
```

Cadastre o CPF do responsável financeiro (não o CPF da criança). A função consulta/cria o cliente via `externalReference`, reserva a emissão no PostgreSQL e emite a cobrança. Webhook valida `asaas-access-token`, consulta o estado atual na API e aplica evento + pagamento + notificação em transação. Eventos duplicados não duplicam pagamentos. `CONFIRMED` é mantido em processamento; somente recebimento confirmado pelo provedor é contabilizado como pago. Valores divergentes exigem revisão.

### Falhas e reconciliação

`externalReference` não é tratada como garantia de idempotência de POST do provedor. Uma reserva persistida impede repetir uma emissão após timeout. Use “Reconciliar emissão” para procurar a cobrança já existente. Se a resposta for ambígua, confira primeiro o painel e a API Asaas. Nunca simplesmente reenvie POST.

Uma tentativa que falhou antes de criar a cobrança só pode ser liberada por operador administrativo após confirmar que não há cobrança com aquela `externalReference`. A limpeza pontual de `payment_requests` e, se necessário, de `customer_requests` é feita em SQL administrativo e registrada no procedimento operacional. Não existe botão que repete automaticamente uma tentativa incerta. Verifique também clientes pelo `externalReference` do responsável antes de liberar reserva de cliente.

Cancelamento remoto está implementado no endpoint para perfis autorizados; a interface ainda não expõe esse comando. O reenvio de cobrança usa compartilhamento manual do link hospedado; envio automático e rotinas agendadas de reconciliação/lembretes são evoluções pendentes. Nenhuma chave Asaas foi fornecida e nenhum Pix/boleto real foi emitido ou homologado nesta entrega.

Documentação oficial consultada:

- [Criação de cobranças](https://docs.asaas.com/reference/criar-nova-cobranca)
- [Clientes](https://docs.asaas.com/reference/criar-novo-cliente)
- [Pix](https://docs.asaas.com/reference/obter-qr-code-para-pagamentos-via-pix)
- [Webhooks](https://docs.asaas.com/docs/sobre-os-webhooks)
- [Supabase Auth getUser](https://supabase.com/docs/reference/javascript/auth-getuser)

## Segurança e operação

RLS é obrigatória em todas as tabelas. Professores acessam suas turmas; responsáveis acessam alunos vinculados e cobranças em que são o pagador financeiro. Documentos usam bucket privado e URLs assinadas por 60 segundos. MIME e tamanho de upload são limitados. Arquivos não são apagados pelo cliente. Se um upload de Storage concluir e o registro de metadados falhar, o objeto permanece privado e deve ser conciliado pelo operador.

Auditoria registra ator, entidade, operação e identificador sem copiar conteúdo sensível. RLS permanece a autoridade mesmo que alguém altere a interface. CSV neutraliza fórmulas. Notícias são texto simples escapado por React; HTML enviado não é executado. Não há feed público nem fotos de alunos expostas.

O PWA inclui manifest e service worker restrito ao ícone estático. Auth, documentos e financeiro não são armazenados pelo service worker. O aplicativo exige conexão para trabalhar com dados. Instalação e splash dependem do navegador; ícones PNG específicos para iOS e validação em dispositivos físicos permanecem no roteiro de homologação.

Backup, retenção, resposta a incidentes e autorizações de imagem precisam de política definida pela escola. Configure backups/exports privados e teste restauração em projeto isolado; não há promessa de conformidade jurídica ou recuperação sem esse ensaio. Restrições de infraestrutura dependem do plano contratado no Supabase/Vercel.

## Escopo entregue e evoluções

Implementados: autenticação por convite, recuperação de senha, roles/RLS, cadastros com validação/edição/arquivamento, busca e paginação no servidor, relações familiares, turmas/vagas/matrículas, chamada, mensalidades/planos, dashboard e relatórios básicos agregados, exportação CSV e impressão PDF, agenda mensal/lista, notícias e comunicados textuais, critérios/avaliações com radar, jogos/campeonatos/convocações, documentos privados, notificações persistidas, modo escuro, responsividade e portal da família.

Ainda não representa o escopo comercial integral do briefing. Pendentes: homologação fim a fim com usuários reais por perfil e pagamentos sandbox; filtros analíticos por unidade/professor/turma; geração automática recorrente de mensalidades; editor visual rico e galerias de imagens autorizadas; foto do atleta; calendário semanal/diário; séries históricas completas de avaliações; formação tática visual; confirmação de convocação na interface (RPC segura já criada); push/e-mail/WhatsApp oficiais; lembretes e publicação agendada com notificações via worker; gestão de retenção/consentimentos com comprovantes; testes de dispositivo, acessibilidade e carga. Consulte o status de implantação para separar código preparado de serviços publicados.
