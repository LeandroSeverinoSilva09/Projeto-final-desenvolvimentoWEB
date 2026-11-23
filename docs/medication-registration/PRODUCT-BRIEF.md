# Cadastro de medicamentos mais simples — revisão ECC

Data da pesquisa: 23/11/2026. Escopo desta etapa: diagnóstico do cadastro e comparação documental de fornecedores. Não é uma integração já implantada.

## Decisão recomendada

**GO para cadastro assistido pela embalagem, com revisão da orientação do paciente.** Para o TCC, manter a identificação oficial local, acrescentar apresentações e códigos de barras da CMED, testar uma API de imagens e permitir foto da própria caixa. **Não escolher um fornecedor definitivo antes de medir sua cobertura de medicamentos brasileiros.**

Primeira candidata a prova de conceito gratuita de imagens: OSCBR/RSC. Alternativa comercial: Cosmos/Bluesoft. Uma API de catálogo identifica o produto; a orientação individual deve vir da receita ou ser informada pelo paciente/cuidador. Uma bula pode servir como consulta complementar.

## Público, problema e evidência local

O público prioritário são pessoas idosas e pessoas com pouca familiaridade digital, que conhecem a caixa e o nome usado na rotina. A hipótese de produto é que reconhecer o próprio remédio demanda menos esforço do que comparar registros técnicos. Ainda não houve teste com participantes para medir essa hipótese.

O catálogo existente já contém marcas como AAS, Novalgina, Dorflex e Glifage. O problema não é ausência total de nomes comerciais: os resultados apresentam princípio ativo, empresa detentora e registro com grande destaque, e a base local não informa concentração, apresentação, EAN ou foto. Trocar somente o endpoint pode reproduzir a mesma dificuldade.

O primeiro passo do formulário atual pede nome, dose, unidade de estoque, quantidade disponível e consumo por tomada. A dose escrita e o consumo numérico podem parecer a mesma pergunta. A quantidade por tomada começa em 1 e o primeiro horário em 08:00, sem que essas escolhas tenham vindo da prescrição.

## Opções de dados verificadas

| Opção | O que a documentação oferece | Adequação ao projeto |
| --- | --- | --- |
| [Anvisa/CMED](https://www.gov.br/anvisa/pt-br/assuntos/medicamentos/cmed/precos) | Listas oficiais de apresentações e preços. A Anvisa identifica marca, EAN e apresentação entre as informações da CMED em sua [orientação de preços](https://www.gov.br/anvisa/pt-br/acessoainformacao/perguntasfrequentes/medicamentos/cmed/precos-de-medicamentos). | Complementar a base local com identificação da embalagem. Não é catálogo de fotos nem prescrição individual. As abreviações de apresentação também precisam de uma camada de exibição legível. |
| [OSCBR/RSC — API GTIN](https://gtin.rscsistemas.com.br/documentacao) | Consulta autenticada por GTIN e imagens; há [plano inicial gratuito](https://gtin.rscsistemas.com.br/main). A documentação avisa que a imagem pode ser um ícone padrão quando não houver foto. Os [termos publicados](https://gtin.rscsistemas.com.br/termos-de-uso) permitem exibição dos dados e imagens junto ao produto, inclusive no plano gratuito, com restrições à redistribuição da base. | Melhor primeira candidata gratuita para testar imagens. Base geral e colaborativa, sem cobertura farmacêutica medida nesta revisão. Confirmar cota e versão da API liberada para a conta. |
| [Cosmos/Bluesoft](https://cosmos.bluesoft.com.br/api/) | Consulta por GTIN e descrição, com campo `thumbnail`. O [fornecedor informa contratação de plano](https://cosmos.bluesoft.com.br/api-pricings). | Alternativa comercial para imagens. Preço e permissão de uso/cache das imagens devem ser confirmados; a página de planos retornou 403 nesta pesquisa. Não garante foto de toda apresentação farmacêutica. |
| [medicamentos.api.br](https://medicamentos.api.br/api/docs) | Serviço independente com busca por nome e EAN e identificação de apresentação. Plano gratuito documentado: 100 chamadas/dia e 1.000/mês; bula estruturada exige plano superior. Não há campo de foto documentado no OpenAPI consultado. | Candidata para facilitar consulta de dados Anvisa/CMED sem manter importação própria. Não resolve sozinha a identificação visual e exige chave. |
| [GS1 Brasil](https://portalapi.gs1br.org/pageFaq) | Consulta de produtos de terceiros por contrato específico; o [portal](https://portalapi.gs1br.org/) informa liberação prévia e planos de consulta. O [manual Verified by GS1](https://gs1portalstoragecdncms.blob.core.windows.net/strapi/strapi-assets/Manual_do_Usuario_API_Verified_by_GS_1_R1_31_1_a534922ec8.pdf) prevê imagens de produtos. | Avaliar para operação com contrato. Não tratar o acesso ao CNP de uma empresa como consulta gratuita irrestrita aos produtos de terceiros. |
| [DotCompany](https://dotcompany.com.br/api) | Catálogo geral por GTIN, com foto quando disponível. Publica R$ 0,04 por consulta com resultado, compra mínima de R$ 169 e cadastro com CNPJ. | Alternativa paga para ensaio de cobertura; não comprova que o conjunto anunciado de fotos cobre medicamentos. A consulta pública de exemplo não pôde ser validada pela ferramenta de pesquisa. |

Essas capacidades são informações dos fornecedores. Não foram criadas contas, usadas chaves, contratados planos ou realizados testes autenticados. Não há percentual de cobertura validado para recomendar contratação definitiva.

Evitar como dependência o [api-medicamentos-bulario](https://github.com/bhfsilva/api-medicamentos-bulario): o próprio autor o arquivou em julho de 2025 e informa que as imagens vêm de buscas no Google e podem divergir do medicamento. A antiga [RxImage da NLM](https://dailymed.nlm.nih.gov/dailymed/dailymed-announcements-details.cfm?date=2021-09-15) também foi encerrada; não é alternativa atual para este projeto.

## Cadastro proposto

1. **Qual é o remédio?** Oferecer “Ler código da caixa”, “Buscar pelo nome” e “Digitar o nome”. Mostrar nome da embalagem, concentração, forma e laboratório em linguagem simples. Registro e composição completa ficam em “Mais informações”. Se a pessoa não tiver câmera ou negar permissão, a busca continua disponível.
2. **Como foi orientado a tomar?** Registrar quantidade por tomada, unidade e orientação. Uma futura importação da receita pode preencher um rascunho, exibindo a origem de cada informação. Campos incertos ficam sem preenchimento. A pessoa confere antes de ativar os lembretes. Evitar horários e doses previamente selecionados sem origem na orientação.
3. **Confira seus lembretes.** Apresentar um resumo legível com remédio, concentração, quantidade e horários. Gerar os horários apenas depois que a pessoa informar o intervalo prescrito e escolher o primeiro horário. “Duas vezes ao dia” e “a cada 12 horas” precisam ser entradas distintas.

A foto da própria embalagem pode ser opcional e aparecer na agenda e nos cartões do aplicativo para reconhecimento. Os avisos na tela bloqueada continuam discretos, sem foto ou identificação do medicamento. Foto não deve ser o único identificador: nomes, concentrações e formas diferentes podem ter caixas semelhantes. Uma foto de catálogo só deve ser associada após conferir a apresentação e o GTIN; ausência de foto não impede o cadastro. Não substituir nome completo por apelidos como “da pressão”; um nome familiar pode aparecer junto da identificação preservada.

## Automação de “como tomar”

É viável automatizar a **transcrição de uma orientação existente**. O [protocolo de segurança da Anvisa/Ministério da Saúde](https://www.gov.br/anvisa/pt-br/centraisdeconteudo/publicacoes/servicosdesaude/publicacoes/protocolo-de-seguranca-na-prescricao-uso-e-administracao-de-medicamentos/@@download/file) distingue concentração, dose, posologia, via e orientações de uso. A concentração impressa na caixa não informa, por si, a quantidade que aquela pessoa deve tomar.

Para evolução futura, [Memed](https://doc.memed.com.br/docs/backend/prescricao/) documenta recuperação de prescrições vinculadas ao usuário prescritor e documentos estruturados. Isso depende de integração autorizada: não equivale a importar livremente qualquer receita de qualquer paciente. [MedReader](https://www.medreader.com.br/) anuncia extração de receitas por API, mas é uma candidata comercial a avaliar; não houve validação independente de precisão nem acesso a contrato técnico nesta revisão. OCR deve produzir rascunho para conferência, mantendo o texto original, sem completar informações ausentes por conhecimento geral do medicamento.

## Dependências reais do aplicativo

- Tornar estoque opcional exige alterar as regras atuais: hoje estoque insuficiente impede confirmar a dose. Esconder o campo e salvar zero criaria um cadastro sem utilidade. O próximo desenho deve distinguir “não informado” de “zerado”.
- Hoje a agenda é diária e não possui duração de tratamento. Não importar tratamentos de poucos dias, dias alternados, uso semanal, “se necessário” ou redução progressiva para lembretes diários indefinidos. Essas rotinas precisam de suporte explícito antes da automação.
- Chaves das APIs devem ficar no servidor. A consulta de catálogo precisa enviar somente a identificação do produto; fotos pessoais e receitas não devem ser enviadas a catálogos colaborativos para completar a base.

## Prioridades e critérios para avançar

| Ordem | Próximo passo | Evidência de conclusão |
| --- | --- | --- |
| 1 | Simplificar linguagem e hierarquia do cadastro, com identidade completa preservada. | Pessoas conseguem localizar nome, concentração e forma sem abrir dados regulatórios. |
| 2 | Fazer piloto de códigos de barras e fotos com a candidata gratuita. | Amostra proposta de 30 embalagens brasileiras: medir produto encontrado, apresentação correta e foto correspondente separadamente. Não contar ícone genérico como foto. |
| 3 | Testar o fluxo com pelo menos cinco representantes do público. | Metas propostas: quatro de cinco completam o cadastro sem intervenção e mediana de até dois minutos para um medicamento de rotina simples. São metas, não resultados observados. |
| 4 | Escolher fornecedor por cobertura medida, licença, custo e disponibilidade. | Nenhuma associação incorreta de imagem/apresentação na amostra aceita; operação manual funciona quando o serviço falha. |
| 5 | Avaliar importação de receita. | Toda informação extraída fica rastreável e editável; lembretes exigem conferência, com tratamento explícito de informações ausentes e regimes ainda não suportados. |

Não há necessidade de substituir toda a base para melhorar a experiência. A primeira entrega deve diminuir a digitação e a linguagem técnica; imagens e automação entram com fontes verificáveis e um caminho manual completo.
