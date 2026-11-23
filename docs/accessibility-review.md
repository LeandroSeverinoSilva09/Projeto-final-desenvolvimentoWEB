# Revisão de acessibilidade e integridade — MEDControl

Data: 23/11/2026. Plataforma: aplicação web responsiva, em português brasileiro, com uso prioritário em telefone por pessoas idosas. Revisão feita segundo a persona ECC `a11y-architect` e a skill `accessibility`.

## Alcance e limites

Foi inspecionado o código dos fluxos de entrada/recuperação de conta, agenda, cadastro de medicamentos, reposição/arquivamento, histórico, acompanhamento, configurações e notificações. Foram criados testes locais de regras de negócio e de exportação. Esta revisão não criou contas, não utilizou credenciais e não enviou dados a serviços externos.

Os testes de navegador desta etapa não foram executados: o serviço Chrome DevTools informou que o perfil estava ocupado, e o navegador interno não estava disponível. O navegador usado pelo agente principal foi preservado. Assim, não há declaração de conformidade WCAG nem de validação visual real em 320/390 px ou com leitor de tela. A lista manual abaixo registra exatamente o que ainda precisa de observação em navegador/dispositivo.

## Achados principais encaminhados à implementação

| Prioridade | Achado e impacto | Recomendação / situação na revisão |
| --- | --- | --- |
| Alta | A adesão de hoje contava horários duplicados/inválidos e confirmações futuras; dias sem previsão anteriores ao cadastro entravam em `missedDays`. Isso podia prejudicar a interpretação da rotina. | Corrigido com `parseScheduleTimes`, limite de horário/timestamp ao presente e contagem de dias sem registro somente quando `expected > 0`. Os testes de cadastro, futuro, horários inválidos e vínculo com o medicamento passaram. |
| Alta | Estoque fracionado podia perder um dia por divisão binária (`0.3 / 0.1` seguido de `floor` resultava em 2). | Quantizar os cálculos em milésimos. O teste exige 3 dias com 0,3 de estoque e 0,1 por dia, mantendo 2 dias para 0,299. A correção foi observada na implementação. |
| Alta | Erros da reposição/arquivamento eram mostrados apenas em toast fora do `<dialog>`. O conteúdo externo fica inerte enquanto o modal nativo está aberto, podendo impedir a leitura do erro. | Foram observados erro inline `role="alert"` e `aria-busy` dentro do formulário modal. Validar anúncio real da falha com leitor de tela, valores preservados e possibilidade de tentar novamente. |
| Média | Algumas regras móveis chegavam a 10–12 px; a primeira regra de texto ampliado forçava certos textos para 15 px e podia reduzir textos de 16 px. A regra móvel também ocultava `stock-warning`, deixando a confirmação desabilitada sem motivo visível. | Foram observados aviso de estoque preservado e regras finais de 18/19 px para a preferência de ampliação. Manter dose/horário/estado legíveis e testar reflow e navegação em 320/390 px. |
| Média | A recuperação podia receber o evento depois da montagem de `Login`, sem atualizar seu modo. Um link inválido/expirado também precisa de saída clara. | Foi observada sincronização por `useEffect` para `recovering`; oferecer caminho para voltar ou pedir outro link e testar o caso expirado sem alterar credenciais reais. |

Outras recomendações enviadas: o nome acessível da confirmação foi atualizado para incluir medicamento e horário; o atalho móvel para `#agenda` deve executar o mesmo comportamento de rolagem do desktop; após troca de rota, direcionar o foco ao título principal e atualizar o título da página.

## Contraste e leitura

Foram calculadas razões a partir das cores sólidas do CSS usando luminância relativa sRGB. Antes dos ajustes, texto `#657b85` sobre branco resultava em **4,444:1**; `#78958c` sobre `#eaf5f2`, **2,909:1**; `#7d91a3` sobre `#edf4fb`, **2,935:1**; `#77918e` sobre `#eaf4ef`, **3,002:1**. Não se deve arredondar 4,444 para o mínimo 4,5.

Durante a revisão, esses usos foram substituídos por `#526b76`, que supera 4,5:1 nos fundos branco, `#eaf5f2`, `#edf4fb` e `#eaf4ef`. Ainda é necessário verificar estados reais, opacidades, elementos sobrepostos e os componentes acrescentados depois desta leitura.

Texto comum requer contraste de pelo menos 4,5:1; a exceção de 3:1 depende do tamanho/peso do texto. [W3C — contraste mínimo](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).

Tamanho mínimo de texto não é, por si só, um critério numérico universal da WCAG. Para este público e este produto, recomenda-se 16 px para dose, instrução e campos; pelo menos 14 px para informação auxiliar e navegação, com preferência ampliada efetiva.

## Semântica e árvore acessível esperada

| Fluxo | Semântica observada / anúncio esperado | Critérios relacionados |
| --- | --- | --- |
| Entrada | Campos com `<label>`, preenchimento automático de nome/e-mail/senha, botão nomeado para mostrar/ocultar senha, erro em `role="alert"` e sucesso em `role="status"`. | 1.3.1, 3.3.1, 3.3.2, 4.1.2, 4.1.3 |
| Agenda | Título da página, região da agenda, grupo “Filtrar agenda”, botões com estado pressionado. A confirmação deve anunciar “Confirmar [medicamento] às [horário]”. | 1.3.1, 2.4.6, 4.1.2 |
| Reposição | “Repor estoque, diálogo”; botão “Fechar”; descrição; campo numérico com unidade; “Cancelar”; “Adicionar ao estoque”. `showModal()` deve conter foco e impedir interação com o fundo; Escape fecha quando não há envio em andamento. | 2.1.1, 2.1.2, 2.4.3, 4.1.2 |
| Cadastro | Nome, dose prescrita, unidade de estoque e quantidade por tomada devem ser distinguíveis. Horários possuem rótulo individual; remoção possui nome com número do horário; identificação por cor tem nome e estado pressionado. | 1.3.1, 1.4.1, 3.3.1, 3.3.2 |
| Ajustes | Preferência “Texto ampliado” é um `switch` com `aria-checked`. A ação de notificações é explícita; permissão bloqueada e indisponível têm explicação textual. | 2.4.6, 3.2.2, 4.1.2 |
| Navegação | `<nav>` nomeado e links nativos; a rota ativa é marcada por `NavLink`. Há link para pular ao conteúdo. O destino deve receber foco útil quando acionado por teclado. | 2.4.1, 2.4.3, 2.4.7 |

O contorno global de foco, os nomes dos botões de editar/arquivar/fechar, os rótulos dos campos, os textos de estado e o uso de `<dialog>` nativo são boas bases. Eles não substituem a verificação da árvore real e da ordem do foco.

O mínimo AA de alvo é 24 × 24 CSS px, com exceções de espaçamento; **44 × 44 px** é uma meta recomendada para controles importantes deste público. Não classificar todo alvo de 26/35/40 px como falha AA automática. [W3C — tamanho mínimo de alvo](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).

O critério **2.4.11 é “Focus Not Obscured (Minimum)”**, não o critério de aparência do foco. Navegação fixa e botão flutuante devem manter o elemento focado ao menos parcialmente visível. [W3C — foco não encoberto](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html).

## Invariantes cobertos pelos testes

| Arquivo | Proteção verificada |
| --- | --- |
| `src/utils/dates.test.ts` | Horários estritos de 00:00 a 23:59, ordenação, remoção de vazios e duplicados. |
| `src/utils/schedule.test.ts` | `scheduleTime` explícito é a única correspondência; não transferir confirmação para outro horário; legado exige horário exato; separar medicamento e data; um registro não cria confirmações extras. |
| `src/utils/stock.test.ts` | Consumo por unidades de dose, frações 0,5/2,5, precisão de três casas, dias restantes, limites de estoque e ausência de mutação do objeto original. |
| `src/utils/adherence.test.ts` | Não contar dias anteriores ao cadastro, horários/registros futuros de hoje, horários inválidos/duplicados ou registros de outro medicamento; não classificar ausência de previsão como dia perdido. |
| `src/utils/export.test.ts` | Prefixos de fórmula e controles, espaços iniciais, escape de aspas/delimitadores, português, BOM UTF-8, horários de agendamento/confirmação e revogação do URL de download. |
| `src/utils/notifications.test.ts` | Importação/leitura não pedem permissão; estados concedido/negado/inseguro; envio por service worker ativo em celular; fallback por construtor; falha de entrega sem exceção não tratada. |

Resultado final local: **6 arquivos / 35 testes passaram** com `npm test -- src/utils`; `npx tsc -b` também passou. A implementação principal deve repetir os checks se fizer novas alterações. Esta revisão não fez testes externos de conta ou de envio de push.

## Verificação manual restante

1. Em 320 × 740 e 390 × 844, abrir entrada, agenda, cadastro, lista, histórico e ajustes. Verificar ausência de rolagem horizontal, leitura de nomes/doses longos, estado de estoque insuficiente visível e navegação sem sobreposição do botão flutuante. Repetir com “Texto ampliado” e zoom de 200%/400%.
2. Percorrer com Tab/Shift+Tab; acionar “Ir para o conteúdo”; alternar rota; conferir foco visível e título útil. Confirmar que a barra fixa não cobre campos/botões focados. Verificar retorno do foco ao fechar modal e destino lógico após arquivar o cartão que continha o acionador.
3. No modal, verificar Tab contido, Escape, botão de fechar e clique fora. Simular falha local de salvamento: o erro deve ser anunciado dentro do diálogo, com valores preservados e envio novamente disponível. Não disparar nova mutação enquanto a primeira estiver em andamento.
4. Com VoiceOver/Safari ou TalkBack/Chrome, ouvir nome/dose/horário, nomes específicos de confirmação, estados dos filtros, unidade de estoque, leitura dos erros e estado de texto ampliado. O total filtrado deve poder ser percebido após busca, incluindo quando o texto visual é ocultado no celular.
5. Validar campo decimal no teclado brasileiro com `0,5` e `2,5`, armazenamento em milésimos e exibição `pt-BR`. O aplicativo deve usar a mesma unidade no estoque e consumo, sem converter comprimidos, gotas ou mL automaticamente e sem inferir posologia.
6. Testar recuperação com link válido, inválido e expirado em ambiente de teste autorizado. Confirmar mensagem acionável e saída clara, sem prender o usuário no formulário de nova senha. A presente revisão não executou mudança de senha.
7. Confirmar que notificações não incluem nome/dose na tela bloqueada e que a saída da conta trata inscrição push. Verificar permissão recusada, falta de service worker e modo demonstração sem cadastro de inscrição remota.

## Privacidade e limites funcionais

O modo demonstração usa `sessionStorage`; os registros de conta são carregados por identidade autenticada. Foi observada limpeza de estado na troca de usuário e guarda contra resultado assíncrono de um proprietário anterior. Notificações de horário usam texto genérico, e a exportação do histórico depende de ação explícita.

O resumo de adesão usa a rotina **atual** dos medicamentos ativos desde o cadastro: alterações posteriores de horários podem mudar o resumo passado. A interface deve manter essa limitação clara. Registros são confirmações manuais; não constituem comprovação clínica nem indicação de dose.

A existência dessas proteções no cliente não verifica políticas de acesso do banco, entrega real de push, configuração de URL de recuperação ou comportamento em dispositivos físicos. Essas validações pertencem à integração e ao teste do agente principal.
