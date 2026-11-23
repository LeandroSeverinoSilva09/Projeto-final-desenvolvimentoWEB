# Revisão responsiva com ECC — 23/11/2026

Ambiente: servidor local em `http://127.0.0.1:5173`, Chrome DevTools do ECC e sessões isoladas de demonstração. Referências: skills ECC `frontend-design-direction` e `browser-qa`.

## Problemas reproduzidos e correções

- Em 320 px, os filtros da agenda ultrapassavam o painel e eram cortados. As ações das doses mudavam de linha conforme o tamanho do botão. A agenda agora usa colunas explícitas e filtros que cabem no contêiner.
- O aviso de reposição comprimia o título em várias linhas estreitas. O texto e o link agora compartilham uma coluna com espaço suficiente.
- A ajuda cortava textos e botões; cartões e configurações também apresentavam cortes com texto ampliado. Foram ajustados mínimos de largura, quebra de texto e distribuição das ações.
- Em 768 px, a barra lateral deixava os cartões estreitos. A navegação inferior passa a ser usada até 900 px.
- As regras de celular estavam espalhadas em vários blocos sobrepostos. Foram reunidas em `src/styles/responsive.css`, carregado depois dos estilos gerais.
- Na entrada em 375 × 812 px, a área de apresentação passou de aproximadamente 278 para 204 px. O botão de login termina em aproximadamente 706 px, dentro da primeira tela.
- Foram corrigidos o contraste de textos pequenos do próximo cuidado, estado de estoque e dia atual, além dos nomes acessíveis de controles da rotina.

## Validação executada

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

## Limites

Resultado responsivo aprovado no escopo local observado. A comparação automática de regressão visual permanece **INCONCLUSIVE**, pois não existe baseline versionado de screenshots. Houve inspeção visual antes e depois das correções.

A nota automatizada de acessibilidade se refere somente à rotina e não demonstra conformidade WCAG do aplicativo. Não foram executados testes com leitor de tela, Safari/iOS físico, teclado virtual real, permissões de notificações, autenticação real ou serviços de localização. Core Web Vitals não foram medidos nesta revisão.

Os avisos do Lighthouse sobre `robots.txt` e `llms.txt` pertencem à indexação no servidor de desenvolvimento, que retorna o HTML da SPA para caminhos inexistentes, e não ao ajuste de proporção mobile.
