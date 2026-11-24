# Gotas e controle visual do frasco — revisão ECC, 24/11/2026

## Problema e decisão de usabilidade

O cadastro exigia contar gotas restantes no frasco e as telas usavam o símbolo de comprimido para todos os remédios. A revisão ECC Product Lens e Browser QA tratou a dose e a observação do estoque como informações diferentes:

- A pessoa continua informando quantas gotas usa por vez e os horários da sua receita.
- No estoque, escolhe uma figura: **Cheio**, **Pela metade**, **Está acabando**, **Vazio** ou **Não sei dizer**. Nenhuma opção vem marcada no cadastro novo.
- A conferência mostra a dose e a situação do frasco separadas. Não pede quantidade de gotas restantes, capacidade ou fator gotas/mL.
- **Atualizar frasco**, em Meus remédios, permite registrar uma mudança ou um frasco novo. O registro de uma dose não altera o nível automaticamente nem estima dias restantes.
- Frascos marcados como acabando ou vazios entram no filtro de reposição e na lista de farmácias. “Não sei dizer” não é interpretado como vazio. Um frasco explicitamente marcado como vazio impede nova confirmação até a pessoa conferir e atualizar a informação.
- Os ícones usam a forma cadastrada: gotas, líquido ou sólido. O símbolo de gotas aparece na lista, na agenda inclusive móvel, no estoque, na conferência do cadastro e no acompanhamento. O nome e a dose continuam em texto.

A avaliação é técnica e heurística. Os desenhos são referências visuais, sem identificação comercial ou medição do conteúdo. Ainda é necessário observar usuários idosos e pessoas com pouca familiaridade digital utilizando essas escolhas.

## Modelo e compatibilidade

`stock_unit = 'gotas'` identifica a dose em gotas. A coluna nova `stock_level` guarda a observação (`full`, `half`, `low`, `empty`, `unknown`). Os campos numéricos antigos permanecem preservados, mas deixam de determinar a quantidade ou duração dos frascos em gotas. Não se converte um saldo antigo em um nível presumido.

A migração `202611240006_bottle_stock.sql` adiciona a coluna com valor inicial `unknown` e adapta os RPCs. Mantém proprietário, RLS, bloqueio de linha, horário válido, prevenção de duplicação e privilégios existentes. A reposição numérica de gotas é recusada. Unidades e mL continuam com desconto e reposição exatos, incluindo valores fracionados.

O dispatcher atualizado consulta a situação do frasco para avisos de reposição. As notificações de horário continuam independentes desse aviso de estoque. A autenticação do cron e o conteúdo discreto das notificações permanecem os mesmos.

## Evidências desta rodada

| Verificação | Resultado |
| --- | --- |
| Regras automatizadas do aplicativo e dispatcher | 190 testes em 15 arquivos, aprovados |
| PostgreSQL em memória, migrações reais e papéis separados | 9 cenários aprovados: legado preservado, permissões, RLS, dose única sem desconto de gotas, nível desconhecido, frasco vazio, atualização válida e consumo/reposição decimal em mL |
| Navegador local, demonstração descartável | 12 cenários aprovados: cadastro, erro/foco, dose separada, ícone móvel, edição, mudança de unidade, atualização do frasco, filtro e farmácias, vazio/novo frasco, legado e três dimensões |
| Acessibilidade axe-core | 10 estados sem violações automáticas detectadas, incluindo formulário, cartão, agenda e diálogo; texto ampliado em 375, 768 e 1440 px |
| Regressão geral | 29 cenários funcionais aprovados, incluindo cadastro em mL, estoque, histórico, CSV, edição e saída |
| Proporção | 220 estados verificados sem cortes horizontais |
| Compilação | TypeScript, Vite e PWA aprovados |

O scan encontrou contraste insuficiente nos links de privacidade/termos do rodapé de desktop; a cor foi escurecida e a auditoria repetida passou. Não há uma referência anterior equivalente para as novas figuras: a comparação visual anterior é **INCONCLUSIVA**. As capturas novas registram a versão atual.

Relatórios: [gotas na interface](drop-medications-qa.json), [migração em PostgreSQL](bottle-stock-sql-qa.json), [regressão geral](platform-qa-results.json), [proporção](mobile-proportion-test-results.json). Roteiros: `scripts/test-drop-medications.mjs` e `scripts/test-bottle-stock-sql.mjs`. PGlite e axe-core foram usados temporariamente fora do projeto, sem acrescentar dependências ao aplicativo.

## Ativação no Supabase

**Ativado em produção após autorização explícita em 24/11/2026.** A migração foi executada pelo SQL Editor do painel autenticado, usando o mesmo SQL validado localmente. Não foi usado o gerenciador de migrações do CLI. A verificação posterior confirmou a coluna `stock_level`, a separação da dose em gotas, a reposição visual, o bloqueio de execução por `anon` e a permissão para usuários autenticados.

A função `dispatch-reminders` foi atualizada e o painel confirmou uma implantação nova. Foram alteradas a leitura de `stock_unit`/`stock_level` e a condição de aviso de reposição dos frascos. A autenticação do serviço não foi alterada. A execução do cron posterior à publicação, às 14:54 de São Paulo, retornou HTTP 200, sem timeout, com `sent=0` e `failed=0`.

A checagem remota foi de estrutura, permissões e saúde do serviço, sem consultar registros pessoais ou enviar notificações de teste a pessoas. Os cenários funcionais de dose e estoque foram exercitados no banco temporário e na demonstração. Esses resultados não comprovam recebimento de push em aparelhos físicos. Consulte o [registro de ativação](bottle-stock-production-qa.json).

As chaves não estão no repositório. As chaves de API e a autorização administrativa da plataforma são mecanismos distintos, conforme a [documentação de chaves](https://supabase.com/docs/guides/getting-started/api-keys) e a [Management API](https://supabase.com/docs/reference/api/introduction).

```bash
npm test
npm run build
node scripts/test-bottle-stock-sql.mjs --pglite-path /caminho/temporario/pglite/dist/index.js
node scripts/test-drop-medications.mjs --port 9338 --axe-path /caminho/temporario/axe.min.js
```

O roteiro de navegador exige um Chrome dedicado com perfil temporário e o servidor local em `127.0.0.1:5173`. Não usa receitas, GPS ou contas pessoais. Os testes locais não são apresentados como execução de RPCs ou migração no projeto remoto.
