# Farmácias próximas

A rota `/farmacias` apoia a reposição de medicamentos. A busca e a lista ficam diretamente na página. A pessoa encontra uma farmácia e só então escolhe Google Maps ou Waze para traçar a rota. A lista usa dados públicos do OpenStreetMap, sem chave de API ou faturamento. Nenhuma das opções confirma preço, estoque, participação na Farmácia Popular ou disponibilidade de medicamento.

## Uso diário

1. Ao abrir a página, a pessoa encontra **Usar minha localização** e a busca por cidade/bairro/CEP, sem precisar expandir uma seção ou abrir outro aplicativo. Nenhum pedido de mapas ou localização é feito automaticamente. O botão principal precede o texto de privacidade e está associado a ele por `aria-describedby`.
2. **O que preciso repor?** fica depois da busca e reúne os medicamentos com estoque baixo ou vazio, conforme `getStockStatus()`, em um resumo recolhido. Os nomes e quantidades permanecem no aplicativo e nunca são colocados nos links externos.
3. A pessoa escolhe **Usar minha localização** ou envia cidade, bairro ou CEP. A região aproximada é compartilhada somente após essa ação. Ao concluir a consulta, a página leva o foco e a rolagem para os resultados.
4. A busca manual ocorre somente ao enviar o formulário. A pessoa escolhe a região dentre os locais encontrados. CEP passa por ViaCEP; somente bairro, cidade e UF seguem para Photon, descartando CEP, logradouro e complemento.
5. Os resultados aparecem por distância, com destaque para o mais próximo desta busca, nome e endereço quando disponível. **Ligar** aparece quando há telefone público válido. Em cada farmácia, **Como chegar** revela **Google Maps** e **Waze**; os links usam somente o destino da farmácia, sem enviar a origem da pessoa. Waze não é oferecido como busca de estabelecimentos. Horários brutos ficam em **Horário informado**, com lembrete para confirmar com o estabelecimento.
6. O raio pode ser ampliado de 2 para 5 e 10 km. Sem resultados, a ação de ampliação aparece diretamente. Falhas têm mensagens próprias; erro de serviço nunca é apresentado como ausência de farmácias.
7. **Ver região no Google Maps** é um link secundário de consulta, em outra aba e sem chave. Ele considera a região da tentativa mais recente, inclusive se a consulta interna falhar e a lista anterior continuar visível. Sem região, consulta farmácias perto de você no próprio Google Maps.
8. **Cancelar busca**, **Remover localização** ou sair da página cancela pedidos pendentes, invalida callbacks atrasados e esvazia o cache em memória. Isso não apaga pedidos já recebidos pelos serviços nem revoga permissões do navegador.

Não há iframe de mapa, opção de abrir OpenStreetMap ou seleção de provedor na interface. A atribuição da fonte OSM permanece visível no rodapé, com os detalhes técnicos e de privacidade recolhidos. A lista interna nunca é apresentada como resultado do Google Maps ou do Waze. A integração de estabelecimentos do Google exige chave e configuração do Maps Platform; ela não foi ativada, conforme a preferência por uma solução sem custos de API.

## Localização e requisições

- `getCurrentPosition` é chamado somente por ação explícita. A primeira tentativa usa `enableHighAccuracy: false`, cache de até 30 segundos e timeout de 8 segundos; posição indisponível ou pouco precisa permite uma segunda tentativa com alta precisão, sem cache e timeout de 10 segundos. Um limite próprio encerra cada tentativa se a API não chamar nenhum callback. Não há monitoramento contínuo. [A API exige contexto seguro e permissão do usuário](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/getCurrentPosition): no celular, acessar o computador por `http://192.168…` não equivale a localhost seguro; o endereço do aplicativo precisa de HTTPS.
- As coordenadas são arredondadas a três casas decimais antes de entrar no estado React ou em requisições, uma grade de aproximadamente 100 metros no Brasil. A validação do aparelho rejeita o ponto nulo `(0, 0)`, inclusive após arredondamento, e precisão inválida ou superior a 10 km. Acima de 2 km, tenta melhorar a posição antes de aceitar o ponto aproximado; se a precisão continuar entre 2 e 10 km, a interface informa a limitação e amplia o raio de busca para 5 ou 10 km. Pontos válidos no equador ou meridiano de Greenwich continuam aceitos.
- Permissão negada, exceção síncrona do navegador, API ausente, posição indisponível, timeout ou precisão insuficiente preservam a alternativa de cidade/bairro/CEP. O campo manual também permanece utilizável enquanto o aparelho procura sua posição; enviar uma cidade cancela a tentativa de geolocalização. Nenhuma consulta de farmácias é enviada após uma posição rejeitada.
- A distância usa Haversine em linha reta. Na busca manual, a referência é o centro aproximado da região escolhida, não a posição da pessoa. Não representa trajeto ou tempo de viagem.
- Cidade/bairro aceita de 3 a 120 caracteres e não admite número residencial. CEP exige 8 dígitos, com hífen opcional. Não há autocomplete nem busca a cada tecla.
- Overpass recebe somente categoria farmácia, raio e ponto aproximado. Não recebe nomes de medicamentos, conta, e-mail, receitas ou histórico.
- `fetch` usa `credentials: omit`, `cache: no-store`, referrer limitado à origem, AbortSignal e timeout de cliente de 25 segundos. Há limite local de uma nova requisição por segundo por serviço; HTTP 429, 406 ou 503 bloqueiam esse serviço por 30 segundos, sem retry automático.
- A última lista concluída permanece visível durante uma nova tentativa ou erro, com sua região e raio originais identificados. Um resultado novo substitui lista, região e raio juntos. Cancelar ou remover continua limpando esses dados.
- Cache somente em memória, com validade de 5 minutos e limite de 20 entradas. Coordenadas não são escritas em Supabase, `localStorage`, `sessionStorage` ou URL da aplicação.

## Links externos seguros

As URLs usam hosts HTTPS fixos, consulta codificada e `noopener noreferrer` na interface. Não há SDK, chave, faturamento de mapas, importação de avaliações ou scraping de Google/Waze.

- [Google Maps URLs, documentação oficial](https://developers.google.com/maps/documentation/urls/get-started): busca com `api=1&query=...`; trajeto com `api=1&destination=latitude,longitude`, sem `origin`. Links não exigem chave.
- [Waze Deep Links, documentação oficial](https://developers.google.com/waze/deeplinks/): somente o trajeto de uma farmácia conhecida usa `https://waze.com/ul?ll=latitude,longitude&navigate=yes`. O link HTTPS pode abrir o aplicativo ou a página do Waze, inclusive quando o aplicativo não está instalado.
- O serviço aberto recebe a região/destino e dados técnicos da conexão conforme suas políticas. Medicamentos e histórico não fazem parte dos links. Termos e políticas estão vinculados em `/termos` e `/privacidade`, incluindo [termos Waze](https://www.waze.com/legal/tos) e [privacidade Waze](https://www.waze.com/legal/privacy).

## Fontes e normalização

Fontes e documentação consultadas em **23/11/2026**:

- [OpenStreetMap: atribuição e ODbL](https://www.openstreetmap.org/copyright). Cadastros colaborativos podem estar incompletos ou desatualizados.
- [Overpass Dresel](https://ovp.dresel.systems/), endpoint `https://ovp.dresel.systems/api-sa/interpreter`. A [política do serviço](https://ovp.dresel.systems/impressum.html) informa retenção de IP e consulta por até 14 dias, sem garantia de disponibilidade. Não há troca automática por outro provedor em caso de falha.
- [Photon/Komoot](https://photon.komoot.io/) e [documentação da API](https://github.com/komoot/photon/blob/master/docs/api-v1.md), para cidade/bairro brasileiros com limite de 5 resultados e camadas `city`, `district`, `locality`. Não recebe a posição do aparelho.
- [ViaCEP](https://viacep.com.br/), somente para um CEP enviado pela pessoa. Entrada e retorno `erro: true` são validados antes de seguir à busca de região.

A consulta Overpass une `nwr[amenity=pharmacy]` e `nwr[healthcare=pharmacy]`, com filtro `around`, `out center tags`, timeout de servidor de 20 segundos e memória máxima de 16 MiB. Os raios aceitos são exclusivamente 2, 5 e 10 km.

Os itens precisam de categoria farmácia, tipo OSM válido, ID inteiro positivo e coordenadas finitas válidas. A normalização elimina duplicações por tipo/ID, descarta centros fora do raio e ordena por distância. Geometrias de áreas usam seu centro OSM. Nome ausente é identificado como ausente; endereço e contato não são inventados. Telefone numérico plausível vira `tel:`; conteúdo executável e extensões são descartados. `opening_hours` é mostrado como texto, sem inferir “aberto agora”. Payload inválido ou `remark` de falha gera erro, não lista vazia.

## Arquivos e configuração

| Arquivo | Responsabilidade |
| --- | --- |
| `src/pages/Pharmacies.tsx` | Fluxo, estados, busca opcional, cancelamento e ações externas |
| `src/styles/pharmacies.css` | Estilos da página e reflow em telas estreitas, com seletores locais |
| `src/lib/pharmacies.ts` | Validação, consultas, cache, distâncias e URLs seguras |
| `src/lib/deviceGeolocation.ts` | API nativa, captura de exceções, tentativas limitadas, precisão e cancelamento |
| `src/components/common/PharmacyErrorBoundary.tsx` | Recuperação de erro de renderização sem remover a navegação do app |
| `src/lib/pharmacies.test.ts` | Regressões de limites, fontes externas, links e cancelamento |
| `src/pages/PublicInformation.tsx` | Privacidade e condições dos serviços externos |

A página requer `MedicationProvider` e usa `Header` e componentes visuais comuns. `VITE_PHOTON_URL` e `VITE_OVERPASS_URL` permitem substituir endpoints em builds administrados. São variáveis públicas: não usar chaves privadas. Ao trocar provedor, conferir cobertura e políticas e atualizar avisos/links. Para volume elevado, contratar capacidade ou hospedar os serviços; o limite em memória vale apenas para esta sessão.

## Validação

`npm test -- src/lib/pharmacies.test.ts` cobre coordenadas e precisão, CEP/cidade, Haversine, normalização, telefones, queries limitadas, links Google Maps/Waze, região sem navegação indevida, ausência de origem e dados médicos, requests sem credenciais, cache, cancelamento, timeout e pausa após limitação do serviço.

A conferência de interface deve incluir desktop, mobile estreito e texto grande: estado inicial com busca visível e sem pedidos de rede, busca manual, escolha de região, negação de localização, cancelamento durante espera, callback tardio após cancelar, ampliação do raio, chamada telefônica e destinos das duas rotas após escolher a farmácia. Confirmar atribuição visível e ausência de nomes de medicamentos nos links.

## Lista visível e escolha de rota — 24/11/2026

A lista estava escondida atrás de “Ver farmácias nesta página”, enquanto os primeiros botões abriam buscas externas. A página agora prioriza a localização e a consulta interna. Waze aparece somente depois de abrir “Como chegar” em uma farmácia. O resumo de reposição fica depois da busca, para que o botão principal permaneça visível até em 320×568 com letras maiores. Um link secundário consulta a região no Google Maps, sem chave ou API paga.

- **203 testes** em 17 arquivos e compilação TypeScript/Vite/PWA passaram.
- O [roteiro de localização](../scripts/test-pharmacy-flow.mjs) passou em **19 cenários**, incluindo consulta real ao Overpass com **41 farmácias**, permissão negada, alternativa manual, timeout, cancelamento, precisão insuficiente, recuperação de renderização e escolha de rota pelo teclado. O ponto de Campinas foi emulado; não representa GPS físico do usuário. [Resultados](pharmacy-qa-results.json).
- O [roteiro de usabilidade](../scripts/test-pharmacy-usability.mjs) passou em **24 estados**: início, lista e opções de rota; larguras 320, 375, 768 e 1440; texto normal e ampliado. Nenhum corte lateral, exceção JavaScript ou violação automática no axe-core. O botão principal ficou visível no início em todos esses tamanhos. Farmácias, telefones e coordenadas desse roteiro são fictícios. [Resultados](pharmacy-usability-qa.json).
- A região usada pelo link Google Maps foi conferida após uma falha: a lista anterior mantém seu contexto, e o link consulta a região da nova tentativa. Nenhum destino Waze usa o centro de uma região como se fosse a farmácia.
- Capturas locais: [busca no início da página](screenshots/farmacias-busca-mobile.png), [lista no celular](screenshots/farmacias-lista-mobile.png) e [escolha de rota](screenshots/farmacias-rotas-mobile.png). A mudança de estrutura não possui uma referência visual equivalente para comparação de pixels; a regressão visual por pixels é inconclusiva. Foram conferidos o layout e as imagens atuais.

Os testes automáticos não certificam conformidade WCAG. Leitores de tela e GPS em aparelhos físicos ainda precisam de validação. A lista é pública e pode estar incompleta; o app não foi conectado à base de estabelecimentos do Google.


## QA de geolocalização e recuperação — 23/11/2026

A falha de bloqueio foi reproduzida antes da correção com uma exceção síncrona `SecurityError`: o erro escapava do clique, o estado permanecia em espera e a busca por cidade ficava desativada. A página agora trata a exceção e encerra a espera, mantendo o formulário manual. Erros assíncronos e callbacks atrasados também são tratados; a proteção de renderização mantém os outros destinos do aplicativo disponíveis se houver uma falha inesperada de apresentação.

`node scripts/test-pharmacy-flow.mjs --port 9338` executou **17 cenários** em Chrome dedicado, contexto de demonstração descartável:

- API nativa com permissão concedida, coordenadas emuladas de Campinas e **requisição real ao Overpass: HTTP 200, 41 farmácias**. Não foi uma localização física do celular do usuário.
- Permissão nativa negada, seguida de busca manual; exceção síncrona de política; API ausente; posição aproximada; precisão excessivamente baixa; coordenadas nulas.
- Cancelamento com callback tardio; busca manual interrompendo geolocalização; indisponibilidade do provedor preservando a lista anterior; JSON inválido; resultado vazio; API nativa sem resposta até o limite próprio.
- Falha de renderização artificial, recuperação com “Tentar novamente” e navegação preservada. O Error Boundary é específico da página e não substitui o tratamento de erros do clique, [como explica a documentação do React](https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary).
- Lista de resultados e rotas Google Maps/Waze em 320×568, 390×844 e 1280×900, sem cortes laterais.

As falhas e os retornos controlados estão identificados no [relatório de QA](pharmacy-qa-results.json). O fluxo normal e as falhas esperadas não produziram exceções não tratadas. A falha artificial de renderização gera o diagnóstico esperado e a tela de recuperação.

Verificação final: **172 testes passaram em 14 arquivos**, TypeScript/build de produção concluído. Ainda não foram testados GPS físico, Safari/iOS físico ou o endereço que a pessoa abre no próprio celular. O código não concede permissões do navegador nem transforma HTTP de rede local em contexto seguro.


### Modo celular do computador e endereço 127.0.0.1

O ambiente informado posteriormente foi o modo celular do navegador no computador, em `127…`, e não um telefone físico na rede local. Nessa situação, HTTP em loopback é uma [origem considerada confiável](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Secure_Contexts#potentially_trustworthy_origins). A observação anterior sobre HTTPS em IP de rede local não explica, por si, esse caso.

O [Device Mode do Chrome](https://developer.chrome.com/docs/devtools/device-mode) simula a apresentação mobile. A localização precisa vir do computador ou ser definida separadamente no [painel Sensors](https://developer.chrome.com/docs/devtools/sensors#geolocation).

Na sessão isolada do ECC, a verificação sem coordenadas brasileiras configuradas encontrou `isSecureContext=true`, permissão `granted` e resposta nativa `0,0`, precisão `0`. O aplicativo manteve a página, o campo manual e a nova tentativa disponíveis, sem consultar farmácias para esse ponto. Na mesma página, após configurar explicitamente Campinas no emulador, uma nova tentativa recebeu HTTP 200 e listou 41 farmácias. Isso valida a recuperação sem recarregar; não é uma leitura da posição física ou das configurações do Chrome pessoal do usuário.

Para repetir com uma posição de teste, abra o Command Menu do DevTools (`Command+Shift+P` no Mac, `Control+Shift+P` no Windows), escolha **Show Sensors**, selecione **Custom location** em **Geolocation** e informe latitude `-22.906` e longitude `-47.060`. Depois toque em **Usar minha localização**. Para posição real, retire a substituição de coordenadas e permita localização no navegador e no sistema. O aplicativo não deve escolher uma cidade simulada automaticamente.
