# Revisão responsiva com ECC — 23/11/2026

Ambiente: servidor local em `http://127.0.0.1:5173`, Chrome DevTools do ECC e sessões isoladas de demonstração. Referências: skills ECC `frontend-design-direction` e `browser-qa`.

## Primeira revisão: problemas reproduzidos e correções

- Em 320 px, os filtros da agenda ultrapassavam o painel e eram cortados. As ações das doses mudavam de linha conforme o tamanho do botão. A agenda agora usa colunas explícitas e filtros que cabem no contêiner.
- O aviso de reposição comprimia o título em várias linhas estreitas. O texto e o link agora compartilham uma coluna com espaço suficiente.
- A ajuda cortava textos e botões; cartões e configurações também apresentavam cortes com texto ampliado. Foram ajustados mínimos de largura, quebra de texto e distribuição das ações.
- Em 768 px, a barra lateral deixava os cartões estreitos. A navegação inferior passa a ser usada até 900 px.
- As regras de celular estavam espalhadas em vários blocos sobrepostos. Foram reunidas em `src/styles/responsive.css`, carregado depois dos estilos gerais.
- Na entrada em 375 × 812 px, a área de apresentação passou de aproximadamente 278 para 204 px. O botão de login termina em aproximadamente 706 px, dentro da primeira tela.
- Foram corrigidos o contraste de textos pequenos do próximo cuidado, estado de estoque e dia atual, além dos nomes acessíveis de controles da rotina.

## Validação da primeira revisão

| Verificação | Resultado |
| --- | --- |
| Larguras de viewport | 320, 375, 390, 430, 768, 900, 901, 1024 e 1440 px |
| Rotas em cada largura | Rotina, medicamentos, cadastro, acompanhamento, histórico, ajustes, farmácias e ajuda |
| Modos de leitura | Normal e texto ampliado: 144 combinações de rota, largura e modo |
| Rolagem horizontal da página | Ausente nas combinações verificadas |
| Conteúdo excedendo contêineres visíveis | Nenhum corte detectado nas combinações verificadas |
| Cadastro em 320 px | Três etapas conferidas, incluindo resumo com nome e dose longos e texto ampliado; sem salvar medicamento |
| Modal de reposição em 320 px | Conteúdo e ações cabem com texto ampliado; Escape fecha; sem efetuar reposição |
| Entrada e criação de conta | Formulários conferidos em celular, sem envio de credenciais |
| Console da rotina e entrada | Sem erros ou avisos nas sessões verificadas |
| Documento, CSS de fontes e fonte | HTTP 200 nos pedidos inspecionados |
| Lighthouse da rotina em 320 px | Acessibilidade 100; boas práticas 100, no modo snapshot |
| Testes existentes | `npm test`: 11 arquivos e 118 testes passaram |
| Compilação | `npm run build`: TypeScript, Vite e geração do service worker passaram |

## Correção da altura útil após o cadastro visual

A revisão seguinte reproduziu um problema de proporção que não era rolagem horizontal: em 375 × 667 px, as áreas introdutórias ocupavam a primeira tela e o campo do nome começava em aproximadamente 664 px, abaixo da navegação. A verificação anterior de largura não era suficiente para detectar esse problema.

Correções implementadas:

- Cabeçalho e indicação de demonstração mais compactos, mantendo a identificação de dados fictícios. A navegação continua com cinco destinos, alvos de toque grandes e espaço reservado no final da página.
- Cadastro com título de contexto curto, indicador de passos compacto e menos instruções repetidas. O desenho da embalagem e a busca continuam disponíveis em **Ajuda com o nome**, sem ocupar espaço antes da ação principal.
- Figuras em duas colunas quando a largura permite; uma coluna em telas de até 360 px e no modo de letras maiores. Rótulos, unidades e orientação da receita continuam presentes; nenhuma quantidade ou horário é sugerido automaticamente.
- Na rotina, o horário seguinte e o nome dividem a mesma linha. A ilustração decorativa foi retirada do celular, e o aviso de reposição aparece depois da agenda. Nenhuma orientação clínica dos registros foi truncada.
- Lista de remédios com título e botão na mesma faixa, cartão de reposição compacto e menos margens internas. Google Maps e Waze mantêm botões grandes, com menos espaço de apresentação.

Observações em 375 × 667, modo normal, dados fictícios:

| Elemento principal | Resultado após a correção |
| --- | --- |
| Campo do nome | Começa em aproximadamente 367 px e termina em 427 px; visível na primeira tela |
| Próximo passo do cadastro | Visível acima da navegação inferior |
| Primeiro botão Já tomei | Termina em aproximadamente 591 px, acima da navegação em 602 px |
| Primeiro nome na lista de remédios | Começa em aproximadamente 474 px, visível na primeira tela |

Foi adicionado `scripts/test-mobile-layout.mjs`, executado com Chrome temporário e contexto descartável de demonstração. O script exige que a largura e a altura medidas sejam exatamente as emuladas, verifica ausência de cortes e garante que o botão final possa ser alcançado acima da navegação após rolar. Não utiliza contas reais nem confirma doses.

- **220 estados conferidos**: oito rotas, com as quatro etapas do cadastro, em dois tamanhos de letras e dez viewports: 320×568, 360×640, 375×667, 390×844, 430×932, 768×1024, 900×900, 901×900, 1440×900 e 844×390.
- Nenhuma rolagem horizontal nem conteúdo principal ultrapassando a largura nos estados conferidos. O campo do nome ficou na primeira tela em todos os celulares em retrato no modo normal. Letras maiores mantêm o conteúdo legível, com rolagem vertical quando necessário.
- Busca por `novalgina` dentro da ajuda abriu as duas opções do catálogo local sem avançar a etapa.
- Lighthouse snapshot/mobile do cadastro: acessibilidade 100 e boas práticas 100. Console observado sem erros ou avisos.
- `npm test`: **158 testes passaram em 13 arquivos**. Build de produção e `git diff --check` concluídos sem erros.

Resultados: [mobile-proportion-test-results.json](mobile-proportion-test-results.json). Referências visuais atuais: [cadastro](screenshots/mobile-proportion-registration-375.png), [rotina](screenshots/mobile-proportion-routine-375.png) e [lista](screenshots/mobile-proportion-medications-375.png). Essas imagens registram o resultado atual; não havia referência desta versão para comparação automática de pixels, que permanece **INCONCLUSIVE**.

Para repetir o teste, inicie um Chrome dedicado com perfil temporário e porta CDP e execute `node scripts/test-mobile-layout.mjs --port 9338` com o Vite local ativo. Não reutilize um perfil pessoal. O script limpa seu contexto ao terminar; encerre o navegador temporário após a execução.

## Adaptação durante redimensionamento — 24/11/2026

O ECC reproduziu uma falha que a conferência anterior de largura não cobria. Em 1024×600, o menu lateral tinha cerca de 994 px de conteúdo em uma área de 600 px, com `overflow-y: visible`; as opções inferiores ficavam fora da tela. Em 1180×600, com letras maiores, a situação também impedia alcançar o botão de saída. A distribuição de desktop mantinha a agenda abaixo de uma introdução grande em larguras de tablet.

Correções:

- A navegação inferior e o cadastro compacto passam a ser usados até 1100 px. O mesmo limite é aplicado ao formulário, evitando mudanças incompatíveis entre a estrutura e os campos.
- Em janelas largas e baixas, o menu lateral tem rolagem própria. A área decorativa é recolhida em alturas de até 760 px; as opções mantêm tamanho de toque e não são comprimidas para caber.
- O conteúdo usa espaçamento horizontal flexível e uma área de consulta de tamanho. Os cartões se distribuem pela largura disponível com `auto-fit`, e os painéis se reorganizam conforme a área de conteúdo, inclusive quando a barra lateral ocupa parte da janela. Referência: [container queries no MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Containment/Container_queries).
- Telas de baixa altura têm cabeçalho e navegação mais compactos. O viewport usa `interactive-widget=resizes-content` para navegadores compatíveis; o teste de altura reduzida não comprova comportamento de um teclado físico/virtual real.
- O manifesto do app instalado usa `orientation: any`, preservando as orientações permitidas pelo sistema, em vez de forçar retrato. O manifesto gerado foi conferido. Referência: [orientação do manifesto no MDN](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/orientation).
- A revisão de desktop também corrigiu contraste do contador da lista e nomes das duas regiões complementares para leitores de tela.

Validação final:

| Verificação | Resultado |
| --- | --- |
| Roteiro de páginas/etapas em dez viewports | 220 estados, sem cortes ou rolagem horizontal |
| Redimensionamento sem recarregar | 174 estados, incluindo entrada, rotina, cartões, cadastro e ajustes |
| Dimensões e densidades | 21 combinações, de 320×568 até 2560×1440, DPR 1/2/3, retrato e paisagem |
| Preservação do cadastro | Nome fictício preservado em todas as trocas de tamanho; `performance.timeOrigin` permaneceu igual durante cada sequência |
| Navegação | Apenas um menu visível; área útil integral em larguras de tablet; opções inferiores alcançáveis no menu lateral |
| Formulário de reposição | Quatro tamanhos, incluindo 844×390; ações alcançáveis, sem confirmar nenhuma reposição |
| Acessibilidade automatizada | 45 estados com axe-core 4.14.1, sem violações automáticas; verificações incompletas ficam no relatório |
| Farmácias após alterar estilos compartilhados | 24 estados, sem cortes, exceções ou violações automáticas |
| Testes e compilação | 203 testes em 17 arquivos; TypeScript, Vite e PWA passaram |

O novo [roteiro de redimensionamento](../scripts/test-responsive-resize.mjs) usa somente demonstração descartável e não grava doses, reposições ou dados em contas reais. Resultados: [redimensionamento](responsive-resize-qa.json), [páginas e etapas](mobile-proportion-test-results.json) e [farmácias](pharmacy-usability-qa.json).

Para repetir, com o Vite e um Chrome temporário na porta indicada:

```bash
node scripts/test-responsive-resize.mjs --port 9338 --axe-path /caminho/temporario/axe-core/axe.min.js
```

Referências atuais: [celular](screenshots/responsive-routine-375x667.png), [altura reduzida](screenshots/responsive-routine-375x420.png), [tablet](screenshots/responsive-routine-1024x768.png) e [desktop](screenshots/responsive-routine-1440x900.png). A distribuição mudou; a comparação automática de pixels entre estruturas diferentes permanece inconclusiva. As imagens e as medidas atuais foram inspecionadas.

O resultado é aprovado no escopo de layout e interação local observado. Não constitui certificação WCAG, teste de zoom pela barra do navegador, teclado virtual real, leitor de tela ou GPS físico. A emulação de dimensões, orientação e densidade não equivale a teste em aparelho Android/iOS. Core Web Vitals não foram medidos nesta revisão.

## Limites

Resultado responsivo aprovado no escopo local observado. A comparação automática de regressão visual permanece **INCONCLUSIVE**, pois não existe baseline versionado de screenshots. Houve inspeção visual antes e depois das correções.

A nota automatizada de acessibilidade se refere somente à rotina e não demonstra conformidade WCAG do aplicativo. Não foram executados testes com leitor de tela, Safari/iOS físico, teclado virtual real, permissões de notificações, autenticação real ou serviços de localização. Core Web Vitals não foram medidos nesta revisão.

Os avisos do Lighthouse sobre `robots.txt` e `llms.txt` pertencem à indexação no servidor de desenvolvimento, que retorna o HTML da SPA para caminhos inexistentes, e não ao ajuste de proporção mobile.
