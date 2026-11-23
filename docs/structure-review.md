# Revisão de estrutura, integridade e usabilidade

Data: 23/11/2026. Revisão local pelas personas ECC `code-architect` e `react-reviewer`, com leitura do README, TCC, rotas, contexto de autenticação/dados, formulário, histórico, acompanhamento e migrações SQL. O projeto foi recebido sem histórico Git; a revisão considera os arquivos existentes, não um diff.

## Alcance e evidência

Esta etapa fez inspeção estática e análise do grafo de imports a partir de `src/main.tsx`. Não leu credenciais, não criou contas, não alterou dados remotos e não executou testes em dispositivos. Os resultados históricos descritos em `verification.md` não foram repetidos por esta revisão. O agente principal realiza as correções e a verificação integrada; mapas e notificações têm revisão própria.

Os achados abaixo registram o estado **antes das correções desta rodada**. As referências identificam os trechos originais; linhas podem mudar após implementação. As cinco correções foram posteriormente relidas no código, conforme a seção de acompanhamento. Isso não equivale a teste real de conta ou dispositivo.

## Achados encaminhados

| Prioridade | Local original | Problema reproduzível e impacto | Correção indicada |
| --- | --- | --- | --- |
| P1 | `src/contexts/MedicationContext.tsx:95–97`, `src/lib/medications.ts:5` | Uma edição envia `current` e `total` do formulário junto com nome, dose e horários. Se outro aparelho confirmar uma dose ou repor enquanto o formulário está aberto, salvar a edição pode restaurar o saldo antigo. Os RPCs de dose/reposição são atômicos, mas a atualização integral do formulário ainda permite perder o efeito deles. | Separar atualização dos dados descritivos da alteração de saldo; se o saldo for editável, exigir controle de concorrência no banco e recusar versão obsoleta. Não resolver apenas com um novo `fetch` antes de gravar, pois permanece uma janela de corrida. |
| P2 | `src/pages/AddMedication.tsx:9`, `src/contexts/MedicationContext.tsx:54,71` | Toda recuperação de foco dispara carregamento. A página substitui o formulário pelo indicador durante qualquer carregamento. Sair para conferir uma prescrição e voltar desmonta o componente, apagando campos e a etapa, inclusive no cadastro novo. | Manter o formulário montado durante atualização de fundo; aguardar dados somente quando a edição ainda não possui o medicamento inicial. |
| P2 | `src/components/layout/AppLayout.tsx`, `src/pages/Settings.tsx`, regras móveis de `src/styles/globals.css` | A saída da conta real existe apenas na barra lateral, ocultada no telefone. Ajustes não oferece sair. O banner permite sair da demonstração, mas não resolve a conta real em aparelho compartilhado. | Disponibilizar saída com texto explícito nos ajustes, desabilitar durante execução e mostrar falha acionável. |
| P2 | `src/contexts/AuthContext.tsx:62`, `src/pages/Login.tsx:36`, `src/App.tsx` | `finishRecovery` altera diretamente o histórico do navegador. O React Router não recebe essa mudança e pode continuar com `/recuperar-senha`, cuja rota renderiza `Login` mesmo autenticado. Após salvar a nova senha a URL e o conteúdo podem divergir. | Finalizar o estado de recuperação e navegar por `useNavigate` para uma rota coerente. Exercitar sucesso e saída da recuperação. |
| P2 | `src/contexts/MedicationContext.tsx:69` | A demonstração só salva quando há algum medicamento. Arquivar o último mantém a versão anterior em `sessionStorage`; recarregar faz o medicamento reaparecer, contrariando o roteiro de arquivamento. | Persistir também listas vazias após hidratação da demonstração, sem sobrescrever o estado salvo com o estado inicial vazio. |

## Acompanhamento das correções

- **Concorrência de estoque — corrigida no código:** o formulário conserva o medicamento original da abertura. A atualização compara atomicamente `current`, `total` e `stock_unit`, além de exigir que o medicamento não esteja arquivado. `select('id').maybeSingle()` permite identificar nenhuma linha atualizada e apresentar conflito. Isso impede que a edição substitua silenciosamente um saldo diferente; não constitui versionamento integral de todos os campos da prescrição.
- **Perda de formulário — corrigida no código:** o carregamento substitui a edição somente quando ainda não existe medicamento inicial; atualizações de fundo mantêm a instância do formulário e seus campos. Cadastro novo não espera consulta de dados.
- **Saída no telefone — corrigida no código:** ajustes oferece botão de saída, estado de execução e erro textual com `role="alert"`.
- **Recuperação — corrigida no código:** `finishRecovery` somente atualiza o contexto; o formulário usa `navigate` do React Router após salvar e ao sair da recuperação.
- **Demonstração vazia — corrigida no código:** persistência aceita lista vazia e exige que `dataOwner` corresponda ao usuário, protegendo a hidratação inicial.

Os dois refinamentos também foram observados no código: atualizar os dados antes de apresentar conflito de edição, para que voltar/reabrir já carregue o saldo recente; e navegar explicitamente após login bem-sucedido, inclusive se o formulário de entrada foi alcançado pela rota de recuperação inválida. O agente principal mantém a responsabilidade pelos testes integrados.

## Alinhamento com README e TCC

A divisão atual é adequada ao protótipo: páginas e componentes apresentam a rotina; o contexto organiza operações e estado; `src/lib` integra serviços; utilitários concentram regras; PostgreSQL controla isolamento e transações. Não há justificativa para exigir uma migração de arquitetura só por haver autenticação no cliente: o Supabase SDK e as políticas de banco são uma escolha deliberada desta SPA.

As migrações habilitam RLS, restringem medicamentos e doses à identidade autenticada e não permitem ao cliente inserir diretamente registros de tomada. O RPC de confirmação valida conta, medicamento ativo, horário e saldo; usa bloqueio de linha e unicidade por medicamento/data/horário. Arquivamento conserva registros. Essas propriedades foram observadas no SQL, sem afirmar que o banco publicado está atualizado nesta etapa.

README e TCC explicitam limites relevantes: rotina diária, ausência de histórico de versões da prescrição, registros declarados pelo usuário, dependência de permissões/conectividade, exportação limitada aos dados carregados e necessidade de avaliação real de usabilidade. A descrição não deve ser ampliada para eficácia clínica ou conformidade formal com base em testes de software.

A consulta de doses foi corrigida nesta rodada para paginar até os 5.000 registros mais recentes. O cursor combina `taken_at` original, sem perder microssegundos, e `id`; isso preserva registros com timestamp empatado. A lista de medicamentos ativos também é paginada, por `created_at` e `id`. Uma página curta não é tratada como fim, pois pode refletir o limite de resposta configurado na API; a busca termina em página vazia ou no limite de histórico. Não foi necessário consultar ou alterar configuração remota.

Foram executados **4 testes locais de paginação**, todos aprovados, em `src/lib/medications.test.ts`, com API simulada: corte de 1.000 linhas, histórico limitado às 5.000 mais recentes, empates de timestamp, corte menor de 250 linhas, lista de medicamentos com arquivados e falha em página posterior. `npx tsc -b` também passou após a implementação. Nenhuma chamada real ao Supabase foi feita por esses testes. A paginação evita os deslocamentos da paginação por offset; não promete uma fotografia transacional única quando dados mudam entre requisições.

## Estrutura que merece manutenção posterior

O grafo de imports encontrou 21 módulos de interface/apoio fora do caminho de execução atual: `Card`, `EmptyState`, `WelcomeGuide`, os componentes de `dashboard`, `Navbar`, `DoseReminderModal`, `FilterBar`, `LowStockBanner`, `LowStockModal`, `MedIcon3D`, `MedicationCard`, `MedicationStockRow`, `PillBox`, `ReminderManager`, `useLocalStorage` e `utils/medIcon`.

Eles representam uma interface anterior. Por exemplo, comportamentos de confirmação ou reposição encontrados nesses arquivos não foram classificados como falhas da agenda atual, que é renderizada por `pages/Home.tsx`. Remover ou identificar explicitamente os módulos legados reduziria a chance de manutenção na tela errada. Não é necessário reestruturar todo o projeto para corrigir os fluxos ativos.

O projeto possui testes Vitest e verificação TypeScript no build, mas não define script/configuração ESLint com regras de Hooks. Isso reduz a detecção automática de regressões de React. É uma lacuna de tooling; não demonstra por si uma falha em execução.

## Usabilidade e acessibilidade

Há boas bases verificáveis no código: rótulos em campos, botões nativos, descrição específica de confirmação por medicamento/horário, diálogo nativo, mensagens de erro, ajuda, navegação com nome, foco na troca de rota e preferência de texto ampliado. O formulário em três etapas reduz a quantidade de informação simultânea.

Ainda convém verificar em aparelho e leitor de tela: foco ao trocar etapa, anúncio dos erros e instruções, valores decimais com teclado brasileiro, fonte da navegação e textos auxiliares no telefone, retorno do foco após arquivar e acesso à saída da conta. A presença de CSS responsivo e atributos ARIA não substitui essa observação. Nenhum certificado ou declaração de conformidade WCAG é produzido por esta revisão.

## Verificação dirigida para as correções

1. Preencher cadastro/edição, avançar de etapa, alternar a janela e retornar: campos e etapa permanecem.
2. Abrir edição em um aparelho e confirmar/repor em outro: salvar dados descritivos não desfaz o saldo; alteração concorrente de saldo apresenta conflito.
3. Na largura de telefone, localizar e concluir saída da conta real; simular falha e conferir possibilidade de tentar de novo.
4. Concluir recuperação com sessão de teste: URL, rota e formulário acompanham a navegação do Router.
5. Arquivar todos os medicamentos da demonstração, recarregar e confirmar lista vazia com histórico preservado.
