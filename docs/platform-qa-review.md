# Revisão funcional e de usabilidade ECC — 23/11/2026

Conclusão: os fluxos locais da apresentação acadêmica estão aprovados após as correções descritas abaixo. Isso não equivale a homologação do uso público em todos os aparelhos. A revisão usou ECC Browser QA, Product Lens e Verification Loop, Chrome isolado, dados fictícios e testes reproduzíveis no repositório.

## Resultado por função

| Função | Evidência desta rodada | Resultado |
| --- | --- | --- |
| Entrada e proteção de páginas | Campos obrigatórios, mostrar senha, erro de credenciais, cadastro e recuperação com respostas controladas; demonstração e saída reais na interface | Aprovado no escopo local; entrega de e-mail não exercitada |
| Cadastro do remédio | Quatro passos, erros com foco no campo, figuras sem seleção automática, vírgula decimal, horários vazios/duplicados e conferência | Aprovado |
| Ajuda com o nome | Busca no catálogo local real da Anvisa, Enter sem avançar o formulário, seleção preenchendo somente o nome | Aprovado |
| Agenda | Confirmação dupla registra uma única dose; 10,5 mL menos 2,5 mL resulta em 8 mL; dose futura e estoque insuficiente ficam indisponíveis | Aprovado |
| Edição | Nome editado preserva medida, saldo, doses contadas e histórico | Aprovado |
| Reposição e arquivamento | Reposição de 0,5 mL soma ao saldo; zero e saldo acima do limite são recusados; arquivar preserva o histórico | Aprovado |
| Histórico e progresso | Filtros, sete dias do calendário e conteúdo do CSV conferidos; download interceptado para inspeção local do arquivo | Aprovado |
| Ajustes e navegação | Texto ampliado persiste após recarga; links, página atual, ajuda, privacidade, termos e saída | Aprovado |
| Farmácias | 17 cenários, incluindo permissão negada, API ausente, erro síncrono, posição imprecisa/nula, timeout, cancelamento, falha do serviço e recuperação de renderização | Aprovado |
| Busca real de farmácias | Coordenadas emuladas de ponto público de Campinas, API pública real, HTTP 200 e 41 resultados | Aprovado; não usa GPS físico |
| Teste imediato na demonstração | Dois cliques separados, sem remédios cadastrados: eventos nativos `show` em 14 ms e 9 ms | Aprovado no Chrome desktop testado |
| Teste na compilação de produção | Service worker ativo: `showNotification()` resolvido em 5 ms e 3 ms | Aprovado no navegador testado |
| Lembrete por horário e desativação | Um lembrete confirmado por horário, sem repetição; desativar bloqueia novos avisos; zero requests de inscrições push na demonstração | Aprovado |
| Responsividade | 220 estados: 10 dimensões, texto normal/ampliado e todas as etapas do cadastro | Zero cortes horizontais |
| Acessibilidade automática | Lighthouse em 14 estados com nota 100; axe-core 4.14.1 em 34 estados completos, incluindo catálogo, erros, diálogo e resultados de farmácias | Zero violações automáticas; quatro verificações de contraste classificadas como manuais |
| Backend atual | Inspeção somente de leitura: RLS em cinco tabelas; políticas por proprietário; configuração/fila de push sem acesso de clientes; RPCs de dose/reposição com `auth.uid()`, trava e `search_path` fixo | Configuração conferida; nenhuma conta real alterada |
| Agendador remoto | Cron ativo a cada minuto; últimas três respostas consultadas HTTP 200, sem timeout, `sent=0`, `failed=0`; zero inscrições existentes | Saúde conferida; sem entrega remota observada |

Os 29 cenários de interface não apresentaram exceções não tratadas nem mutações em tratamentos reais. As simulações de autenticação e falhas estão identificadas no roteiro; não são apresentadas como testes de envio real de e-mail ou de Web Push.

## Correções encontradas pela revisão

- O botão passou a dizer **Enviar teste agora**, com orientação de que não exige remédio ou horário. Cada teste manual recebe um identificador novo; há proteção contra cliques simultâneos e liberação do estado de envio mesmo em falha.
- Desativar avisos na demonstração altera a preferência local sem remover inscrições de uma conta real.
- Editar um remédio da demonstração preserva a contagem de doses. O limite do saldo de reposição também é aplicado nesse ambiente.
- O diálogo mantém Tab e Shift+Tab entre os controles; Escape continua fechando. A entrada e a faixa de demonstração possuem regiões identificadas para tecnologias assistivas.
- A conferência do cadastro usa pares de termo/valor válidos para leitores de tela. O controle de remover localização ganhou contraste e texto maior; os links de telefone incluem o número visível no nome acessível.
- O atalho repetido de farmácias foi removido dos Ajustes, deixando a conta e a saída mais próximas do início da tela.
- Foram incorporadas as correções anteriores de proporção móvel e recuperação da geolocalização, agora verificadas em conjunto com os demais fluxos.

## Adequação ao propósito

A organização atende ao propósito acadêmico de ajudar a lembrar e registrar a rotina informada pela pessoa: agenda em destaque, **Já tomei** após o horário, cadastro por perguntas, figuras genéricas, letras maiores, conferência antes de salvar e Google Maps/Waze como ações claras. A busca da Anvisa é opcional; não define dose, frequência ou substituição. As figuras representam formas de apresentação, sem prometer identificar uma embalagem comercial.

Essa conclusão é uma avaliação técnica e heurística. Não foram medidos tempo de cadastro, taxa de conclusão ou erros com participantes idosos ou com pouca experiência digital. A próxima validação deve observar pessoas desse público cadastrando um remédio fictício, corrigindo um dado, registrando uma dose e repondo o estoque sem ajuda. Registrar conclusão independente, erros e necessidade de assistência, incluindo uso de VoiceOver/TalkBack.

## Verificações e limites

- `npm test`: **172 testes em 14 arquivos**, todos aprovados.
- `npm run build`: TypeScript, Vite e geração do PWA aprovados.
- `npm audit --omit=dev`: zero vulnerabilidades reportadas em dependências de produção.
- O projeto não configura lint nem provedor de cobertura; não foi atribuída nota de cobertura ou aprovação fictícia a esses itens.
- O axe-core não concluiu automaticamente quatro verificações de contraste no catálogo e nas figuras de apresentação, distribuídas entre texto normal/ampliado. Elas estão identificadas como `incomplete` no relatório e não foram contadas como aprovação de conformidade.
- O Supabase Advisor aponta RPCs `SECURITY DEFINER` acessíveis a usuários autenticados: isso é intencional para dose/reposição e foi conferido nas definições e permissões atuais. Configuração e fila de envio permanecem sem políticas de cliente e sem privilégios de leitura. [Documentação do aviso](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).
- Trace local da compilação de produção, sem limitação de CPU/rede: LCP de 379 ms na entrada e 107 ms na rotina, CLS 0. INP e desempenho em rede móvel não foram medidos.
- Comparação visual com uma referência anterior equivalente: **INCONCLUSIVA**. As imagens desta rodada passam a registrar a versão atual; ausência de corte não representa igualdade com uma referência anterior.
- Eventos `show` e resolução de `showNotification()` confirmam a aceitação pelo navegador. O banner do macOS não foi observado visualmente. Android/iOS físicos, tela bloqueada, entrega com aba fechada e e-mails no domínio final continuam pendentes de validação nesse ambiente.
- A inspeção remota desta rodada foi somente de leitura. Os testes anteriores com contas descartáveis estão documentados em `verification.md`; não foram repetidos como se fossem testes desta rodada.

## Reproduzir e consultar evidências

Use um Chrome dedicado com `--user-data-dir` temporário e `--remote-debugging-port=9338`, sem usar o perfil pessoal. Servidor Vite em `127.0.0.1:5173`; para o PWA, executar o build e servir o preview em `127.0.0.1:4173`.

```bash
npm test
npm run build
node scripts/test-platform-flow.mjs --port 9338
node scripts/test-mobile-layout.mjs --port 9338
node scripts/test-pharmacy-flow.mjs --port 9338
node scripts/test-browser-notifications.mjs --port 9338
node scripts/test-browser-notifications.mjs --port 9338 --origin http://127.0.0.1:4173
```

Para repetir o scan completo de acessibilidade, disponibilize uma cópia local de `axe.min.js` e acrescente `--axe-path /caminho/axe.min.js` ao roteiro funcional. O arquivo foi usado temporariamente, sem adicionar dependência ao aplicativo.

Evidências: [interface](platform-qa-results.json), [acessibilidade](accessibility-qa-results.json), [Lighthouse e trace](lighthouse-qa-results.json), [proporção](mobile-proportion-test-results.json), [farmácias](pharmacy-qa-results.json), [avisos imediatos](notification-immediate-qa.json), [avisos no PWA](notification-production-qa.json) e [capturas](screenshots/).
