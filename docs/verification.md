# Verificação da implementação — 23/11/2026

## Verificações concluídas

- `npm test`: **11 arquivos e 118 testes aprovados**. Cobrem horários, associação estrita de doses, estoque fracionado e precisão decimal, adesão, CSV, notificações, catálogo oficial e normalização/erros dos serviços de mapas, paginação do histórico e novas tentativas do dispatcher.
- `npm audit --omit=dev`: nenhuma vulnerabilidade reportada nas dependências de produção. A cadeia de ferramentas de build ainda reporta quatro avisos moderados transitivos de Workbox/glob/minimatch; não foi forçada uma troca de versão incompatível.
- `npm run build`: TypeScript, build de produção e geração do service worker aprovados.
- Banco real: login de duas contas descartáveis; RLS bloqueando leitura/escrita/RPC entre contas; confirmação concorrente gerando um único registro/desconto; recusa de horário futuro, horário não cadastrado e duplicação; reposição por soma; arquivamento preservando histórico; consumo e reposição decimais. Também foram testadas edição com saldo obsoleto e fila de push: restrição do RPC, concorrência, tentativa expirada, proteção contra liberação por token antigo e não repetição após confirmação. A inscrição fictícia usou domínio bloqueado pelo dispatcher; não houve envio de push externo. Contas, inscrições e dados foram removidos ao final, sem envio de e-mails.
- Navegador: busca por paracetamol encontrou oito resultados exibidos no catálogo oficial; seleção preencheu nome e deixou dose vazia.
- Navegador: cadastro nas três etapas, revisão de 10 mL com consumo fictício de 2,5 mL; toque duplo resultou em uma dose e saldo de 7,5 mL; reposição de 0,5 mL resultou em 8 mL; arquivamento preservou o histórico.
- Modal nativo: foco dentro do diálogo na abertura; fechamento após sucesso; erro apresentado dentro do próprio modal.
- Permissão de notificações, com API simulada na página de teste: zero solicitações antes da ação e uma solicitação após o clique; estado da interface atualizado para autorizado.
- Mapas reais: consulta manual por São Paulo retornou cinco opções de local e 59 farmácias no raio selecionado no teste; outra referência pública de centro urbano retornou 57. Contagens variam com o ponto e a base. Nenhum GPS pessoal foi usado nesses testes.
- Rotina, remédios, ajustes, farmácias, cadastro, ajuda, progresso e histórico foram verificados sem rolagem horizontal em emulação estreita. Texto ampliado também foi exercitado. O teste não substitui verificação em aparelhos físicos.
- PWA de produção: service worker ativo no escopo do app, e chave pública de push obtida pelo navegador com HTTP 200.
- Serviço push implantado: GET retornou apenas a chave pública (HTTP 200); POST com segredo inválido retornou 401; acesso à configuração privada pela chave pública foi recusado.
- Cron: duas execuções observadas retornaram HTTP 200 com `sent=0` e `failed=0`, sem inscrições reais durante a verificação.

## Validação ainda necessária no ambiente final

- Receber um push em Android e iOS reais com o aplicativo em segundo plano e a tela bloqueada.
- Confirmar cadastro e recuperação por e-mail no domínio final e com o serviço de e-mail/SMTP configurado para os destinatários de produção.
- Adicionar o domínio HTTPS publicado à configuração de retorno do Supabase Auth.
- Executar pesquisa com usuários representativos, incluindo pessoas idosas e com pouca experiência digital, e avaliação com VoiceOver/TalkBack.

As verificações registram comportamento técnico observado, sem atestar eficácia clínica ou conformidade formal.

## Revisão ECC desta rodada

A migração 005 e a função atualizada foram publicadas após autorização. Às 12:58 de 23/11/2026 (America/Sao_Paulo), cron ativo, migração presente, RPC privado e últimas respostas HTTP 200, `sent=0`, `failed=0`, sem timeout. Zero aparelhos reais inscritos: ainda não existe evidência de entrega observada no telefone.

No navegador de teste, a nova tela móvel mostrou a ação Google Maps gratuita e identificou os resultados OpenStreetMap. Antes da ação não houve requisição ao SDK Google. Sem chave, a escolha Google interna ficou indisponível. A busca manual por São Paulo retornou 59 farmácias, sem overflow horizontal. O botão de saída nos Ajustes ficou visível com altura de 50 px. A revisão automática recusou uma limpeza de caches; o teste continuou em outra origem local sem apagar os caches existentes.


## Simplificação para fontes públicas sem chave

Por solicitação do responsável, a integração opcional Places e seus 12 testes específicos foram removidos. Permanecem a busca pública OSM/Photon/ViaCEP e os links oficiais de busca/trajeto do Google Maps. A lista não depende de chave ou faturamento. Interface, README e política foram ajustados; a configuração antiga de chave não é mais utilizada.

Build final aprovado e navegador validado na versão sem chave: zero opções de provedor, zero carregamentos do SDK Google e nenhuma rolagem horizontal na largura móvel. Permanecem 111 testes; a redução corresponde apenas aos 12 testes da integração Places removida.

## Regressão de geolocalização

A tela aberta foi inspecionada sem coletar novo GPS: mostrava zero resultados e o link Google apontava para `(0, 0)`. Sete testes adicionais cobrem posição nula/arredondada, precisão inválida/imprecisa e pontos válidos no equador. Testes e build passaram. No navegador, a posição nula simulada gerou mensagem de localização indisponível, zero requests Overpass e nenhum link Google com o ponto nulo. O recebimento da posição real ainda depende do aparelho.

O fluxo do botão de localização também foi testado com coordenadas simuladas de um ponto público (Praça da Sé), consultando o serviço real: 57 farmácias retornadas e nenhuma rolagem horizontal. A simulação foi removida e a página reiniciada ao terminar; não foi coletada a posição real do usuário.
