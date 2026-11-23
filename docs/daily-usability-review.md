# Cadastro visual e uso diário — revisão ECC

Revisão de implementação e navegador em 23/11/2026. Método: product-lens, frontend-design-direction e browser-qa do ECC, com revisão de código de usabilidade e integridade. O refinamento visual também aplica accessibility e browser-qa do ECC. O público considerado inclui pessoas idosas e com pouca familiaridade digital. Não foram realizadas sessões com participantes; os resultados abaixo são verificações técnicas, não comprovação de compreensão por todos os públicos.

## Cadastro implementado

O formulário extenso foi substituído por quatro perguntas, com uma tela por vez:

1. **Qual é o nome do remédio?** Copiar o nome da caixa, incluindo o número/concentração quando houver. A ajuda para buscar nomes é opcional e fica recolhida. O nome completo é preservado, sem simplificação química por inferência.
2. **Como é o seu remédio?** Escolher uma figura: comprimido/cápsula, copinho em mL, gotas ou outra forma contada em unidades. A quantidade vem da receita, sem valor predefinido. Uso e quantidade em casa usam a mesma unidade; caixas/frascos não substituem medidas de uso.
3. **Que horas você usa o remédio?** Horários explícitos, inicialmente vazios. A pessoa pode acrescentar e remover horários. Não há sugestão automática de 08:00 ou intervalo clínico.
4. **Quanto remédio ainda tem em casa?** Contagem na unidade escolhida, com resumo e ações para alterar cada grupo antes de salvar. Zero é aceito se acabou. Observações e cor são opcionais.

As figuras representam formas de uso, sem identificar um medicamento real. Fotos de embalagens, leitura de código de barras e importação de receita continuam na [pesquisa de fornecedores](medication-registration/PRODUCT-BRIEF.md); não há integração de imagem ou prescrição automática.

O catálogo destaca nome e empresa responsável. Composição e registro ficam em “Mais informações”. “Usar este nome” preenche somente o nome, devolve o foco ao campo e pede que a pessoa acrescente o número escrito na caixa. A base não identifica a apresentação ou a orientação de um paciente.

Erros aparecem na etapa correspondente e levam o foco ao campo. A ajuda pode ser aberta sem concluir o cadastro. Botões e opções visuais têm áreas grandes; texto ampliado mantém o conteúdo acessível. A mudança de etapa anuncia a nova pergunta pelo foco no título.

## Refinamento para pessoas idosas e com pouca familiaridade digital

| Antes | Agora no cadastro |
| --- | --- |
| “Etapa” e “Por vez” | “Passo” e “Quanto você usa de cada vez” |
| “Outra forma em unidades” | “Outro tipo”, com explicação de que são itens contados um por um |
| “Mais um horário” e remoção apenas com X | “Adicionar outro horário” e “Tirar este horário”, com texto visível |
| “Alterar” e “Cancelar cadastro” | “Corrigir” e “Sair sem salvar” |
| Informar zero pelo teclado | Botão “Não tenho mais esse remédio”, que preenche zero somente após a pessoa tocar |

O campo do nome aparece antes do desenho de exemplo, para a pessoa começar sem procurar o campo. A embalagem ilustrada mostra onde procurar nome e número; o desenho não identifica um medicamento real. Os cartões têm figuras maiores, letras legíveis e “Escolhido” escrito, além do estado do botão de opção. No celular ficam em uma coluna, sem reduzir as letras para acomodar dois cartões.

“Letras maiores” está dentro do cadastro e mantém a escolha no aparelho. Campos de texto passam de 20 para 23 px e perguntas de 28/30 para 32 px. Os textos auxiliares relevantes têm pelo menos 16 px; erros são exibidos com 18 px. Bordas e foco receberam contraste mais forte. O valor informado aparece novamente junto da figura antes de avançar, sem sugerir quantidade de uso. Manhã, tarde, noite e madrugada têm ícone e palavra, sem depender apenas de cor.

Esta versão passou novamente pelas 32 combinações de largura, passo e tamanho das letras. Teste de teclado: setas selecionam o tipo de remédio, Tab chega à quantidade, o foco tem contorno de 3 px e erros recebem foco e descrição. Na demonstração isolada, `0,5` por uso, dois horários e o botão de remédio acabado salvaram `unitsPerDose=0.5`, `current=0` e os horários corretos. Lighthouse snapshot/mobile marcou acessibilidade 100 e boas práticas 100 nas telas de nome e tipo de remédio, sem erros ou avisos no console observado.

Os dados deste refinamento estão em [medication-accessibility-test-results.json](medication-accessibility-test-results.json). A comparação automática com imagens de referência é **inconclusiva**, pois as imagens anteriores não representam esta interface. Não houve sessão com leitor de tela ou participantes idosos; a inspeção da árvore de acessibilidade, teclado e auditorias automáticas não substitui essas sessões.

## Integridade ao editar

- Quantidades com vírgula são aceitas; números válidos são exibidos no formato brasileiro ao sair do campo. Entradas como `1.000`, ambíguas entre decimal e milhar, pedem correção em vez de virar `1` silenciosamente.
- A orientação existente fica visível na edição. Alterar quantidade ou forma com texto de receita exige conferência explícita; o aplicativo não interpreta nem reescreve o texto clínico. A confirmação permanece marcada e acessível ao teclado.
- Trocar a unidade limpa as quantidades de uso e de casa. O total de referência é recalculado na unidade nova, sem converter ou reaproveitar o número da unidade anterior.
- Valores e controles de edição ficam desabilitados enquanto o salvamento está em andamento. A proteção existente contra edição de estoque desatualizado foi mantida.

## Farmácias implementadas

Google Maps e Waze são as duas ações principais, sem pedir localização ao abrir a página. A lista interna é opcional e não tem iframe nem opção de navegação OpenStreetMap. A atribuição dos dados colaborativos permanece no rodapé. Contatos e trajetos ficam próximos de cada resultado; nomes de remédios não fazem parte dos links externos. Detalhes de fontes, privacidade e limites estão em [farmácias](pharmacies.md).

## Verificações realizadas

- Cadastro e edição pela interface, em demonstração isolada: `2,5 mL`, dois horários e estoque `10,5`; valores persistidos corretamente apenas na aba de teste.
- Edição de mL para gotas: campos limpos, receita antiga visível, avanço bloqueado até conferência e novo total salvo na unidade correta. Erro em texto de receita recolhido reabre o conteúdo e recebe foco.
- Busca real no catálogo local por `novalgina`: duas opções, dados técnicos recolhidos, seleção somente do nome. Enter busca sem avançar ou salvar o formulário.
- **32 combinações do cadastro:** quatro etapas × larguras 320/390/768/1440 × texto normal/ampliado. Sem conteúdo visível fora da largura e sem ações principais abaixo de 44 px.
- **14 combinações de farmácias:** resultados nas quatro larguras e lista recolhida nas três menores, com texto normal/ampliado. Sem cortes; seletores de raio e link de informações têm área de toque de 44 px.
- Fluxos de localização negada, cancelamento, callback atrasado e busca manual exercitados com respostas controladas no contexto isolado. Os dados artificiais não entraram no catálogo nem no banco.
- Consulta pública real por **Campinas, SP**: quatro opções de região; seleção de Campinas retornou **41 farmácias** em até 2 km, por Photon/Overpass, sem simular as respostas dessa consulta. Essa contagem é uma observação do teste, não disponibilidade garantida.
- Lighthouse em modo snapshot/mobile: **acessibilidade 100 e boas práticas 100** na etapa visual do cadastro e na página inicial de farmácias. Essa pontuação não equivale a aprovação integral WCAG ou teste com pessoas.

Os resultados estruturados ficam em [daily-usability-test-results.json](daily-usability-test-results.json). Os testes de regras incluem validação por etapa, decimais, quantidade zero, horários repetidos, conferência da receita e unidades, além dos testes existentes de notificações e integrações. Verificação final: **158 testes passaram em 13 arquivos** (`npm test`), **build de produção concluído** (`npm run build`) e `git diff --check` sem erros.

## Próxima validação com pessoas

Observar representantes do público cadastrando um exemplo de sua rotina sem instrução prévia: localizar nome/número na embalagem, escolher a figura, informar a quantidade por vez, definir horários e distinguir quantidade em casa. Registrar ajuda necessária, erros e conclusão; não orientar respostas durante a tentativa. Avaliar também leitura com texto ampliado e retorno para corrigir uma informação. As metas sugeridas na pesquisa anterior continuam sendo metas, sem resultados de participantes atribuídos a esta revisão.

A abertura dos aplicativos nativos Google Maps/Waze em aparelhos reais e a identificação por foto não foram testadas nesta etapa.
