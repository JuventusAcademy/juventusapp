# FutGestão — plano e critérios de entrega

## Contexto

Workspace inicialmente vazio; sem repositório, projeto Supabase ou credenciais conectadas. Destino solicitado: GitHub + Supabase + Vercel. Aplicação React/Vite independente de Sites hosting.

## Direção de design (frontend-design)

Paleta: Marinho #10263e, Azul #365b81, Laranja #ff793f, Gelo #f3f5f8, Texto #172b43, Verde #227357. Barlow para identidade, títulos e texto; números tabulares. Alinhamento à esquerda, densidade moderada, tabelas legíveis. Agenda e linhas de campo são o elemento memorável; reduzir decoração nos demais módulos.

```text
Desktop: [sidebar fixa] [cabeçalho e contexto da escola    ]
                       [panorama operacional | ação      ]
                       [indicadores                      ]
                       [receita                 | agenda ]
                       [alunos recentes         | tarefas]
Mobile:  [cabeçalho][conteúdo em uma coluna][navegação inferior]
```

Revisão: substituído o hero de marketing por um resumo operacional com agenda de treinos; cards reservados a grupos distintos, tabela para cadastros. O portal dos responsáveis tem seleção de filhos e navegação própria.

## Etapas

1. Fundação: migração PostgreSQL, isolamento por escola, papéis, vínculos e RLS; autenticação e configuração explícita.
2. Operação: alunos, responsáveis, professores, unidades, categorias, turmas, matrículas, treinos e presença.
3. Financeiro: planos, mensalidades, agregações; Edge Functions Asaas sandbox, eventos idempotentes e reconciliação.
4. Comunicação: publicações por turma, agenda, notificações e documentos privados.
5. Portal: dados vinculados, agenda, mensalidades e evolução autorizada.
6. Esportivo: critérios, avaliações, competições e jogos.
7. Entrega: exportações, PWA, build, testes de domínio, documentação e configuração de deploy.

## Validação

TypeScript e build de produção; testes de cálculos financeiros, paginação e datas. Banco/Asaas só podem ser considerados validados após aplicar migrations e executar testes em projeto sandbox. Inspeção de RLS local não substitui testes com usuários reais por perfil.

## Dependências externas

URL e chave pública Supabase, migrations aplicadas, primeiro administrador provisionado; credenciais privadas Asaas no secret store das Edge Functions; autenticação GitHub/Vercel para publicação. Não gravar nem solicitar secrets no chat.

## Revisão visual — identidade Juventus
Paleta atual: preto #000000, branco #ffffff, grafite #171717, cinza #737373 e fundo #f5f5f5. Sidebar e área de acesso pretas, seleção branca, ações de alto contraste e gráficos monocromáticos. Tipografia Barlow e estrutura mantidas; tons de estado usados apenas para informação operacional. Revisão: sem azul ou laranja como cores de marca; o campo de futebol e a logo oficial continuam como elementos próprios da escola.
