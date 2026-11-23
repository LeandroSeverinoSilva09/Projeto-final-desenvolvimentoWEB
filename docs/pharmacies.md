# Farmácias próximas

Implementação da rota `/farmacias` para apoiar a consulta de reposição, inclusive quando `getStockStatus()` sinaliza estoque baixo ou vazio. Não consulta medicamentos, preços, estoques das farmácias, SUS ou Farmácia Popular. A disponibilidade deve ser confirmada diretamente com o estabelecimento.

## Arquivos e integração

| Arquivo | Responsabilidade |
| --- | --- |
| `src/pages/Pharmacies.tsx` | Tela, consentimento contextual, geolocalização por clique, busca manual e escolha de região, cancelamento, lista, links e mapa opcional |
| `src/lib/pharmacies.ts` | Tipos, validação, aproximação de coordenadas, requests públicos, timeout, cache efêmero, normalização, Haversine e URLs seguras |
| `src/lib/pharmacies.test.ts` | Testes Vitest de limites, dados externos, privacidade das requisições, cache, cancelamento e falhas |

Export da página: `Pharmacies`. Requer `MedicationProvider`, usa o componente `Header`, classes comuns `panel`, `btn`, `secondary`, `notice` e classes `pharmacy-*` específicas. A contagem de medicamentos com reposição necessária é calculada localmente e só produz um link interno para `/medicamentos`.

## Fluxo e privacidade

1. Ao abrir a página não há geolocalização nem consulta a serviços de mapa; o iframe também não existe ainda.
2. O texto curto antes do botão explica a transmissão de localização aproximada e que os medicamentos não são enviados. O bloco expansível **Como usamos sua localização**, também antes do botão, detalha os serviços, retenção e cancelamento. A pessoa escolhe **Usar minha localização** ou envia uma cidade/bairro/CEP pelo formulário.
3. A geolocalização usa `getCurrentPosition`, sem monitoramento contínuo, com `enableHighAccuracy: false`, timeout de 12 segundos e sem reutilizar uma posição antiga. As coordenadas do aparelho são arredondadas a três casas decimais, uma grade de aproximadamente 100 metros no Brasil, antes de entrar no estado React e nas requisições.
4. A busca manual só ocorre no submit; não há autocomplete, reverse geocoding nem busca automática ao digitar. Cidade/bairro admite texto entre 3 e 120 caracteres, sem número residencial. CEP deve ter 8 dígitos, opcionalmente com hífen. O ViaCEP fornece bairro/cidade/UF; logradouro, CEP e complemento são descartados antes da consulta ao Photon.
5. A pessoa confere e escolhe um dos locais encontrados. A distância de uma busca manual parte do centro da região escolhida, não da posição da pessoa. A busca pode ser substituída pela localização do aparelho depois.
6. O Overpass recebe somente a categoria farmácia, raio e ponto aproximado. Nunca recebe nomes de medicamentos, conta, email, receitas ou histórico.
7. O cache das fontes OSM/Photon/ViaCEP fica apenas em memória, com validade de 5 minutos e até 20 entradas. Cancelar, remover localização ou sair da página aborta requests, invalida callbacks de geolocalização e esvazia o cache. Nenhuma coordenada é escrita em Supabase, `localStorage`, `sessionStorage` ou URL da aplicação.
8. A remoção apaga o estado desta página; não revoga a permissão do navegador nem apaga registros já recebidos pelos serviços externos. A política do Overpass Dresel informa retenção de IP e consulta por até 14 dias; isso é explicado antes do clique e a política está vinculada na página.
9. A lista funciona sem mapa. Na fonte OpenStreetMap, o iframe do OpenStreetMap só é montado depois da escolha da região **e** do clique em **Mostrar mapa da região**. Mostra um marcador de referência no centro da busca; não representa individualmente todas as farmácias.
10. Links externos usam hosts fixos HTTPS, texto de consulta codificado e `noopener noreferrer`. O trajeto no Google Maps contém somente o destino da farmácia; a origem é escolhida dentro do Maps. Links de busca recebem apenas a região escolhida, sem medicamento. `fetch` usa `credentials: omit`, `cache: no-store` e referrer limitado à origem do app.

## Fontes públicas e políticas verificadas

Verificação em **23/11/2026**, com documentação primária:

- [Photon/Komoot: API e termos](https://photon.komoot.io/) permite uso em projetos com volume moderado, sem garantia de disponibilidade. Uso excessivo pode ser bloqueado. [Documentação oficial da API](https://github.com/komoot/photon/blob/master/docs/api-v1.md): busca com `q`, `countrycode=BR`, `limit=5` e camadas `city`, `district`, `locality`. Retorno GeoJSON validado e deduplicado. Não são enviadas coordenadas do aparelho ao Photon.
- [Overpass Dresel: serviço e uso justo](https://ovp.dresel.systems/) disponibiliza gratuitamente um endpoint de América do Sul, incluindo Brasil, sem cadastro/chave, CORS aberto e limite de 4 consultas simultâneas por IP/região. [Política de privacidade e condições](https://ovp.dresel.systems/impressum.html) informa atualização dos extratos, ausência de garantia de disponibilidade e retenção de logs por 14 dias. A aplicação faz somente uma consulta por interação, em POST, sem retries automáticos nem envio de dados médicos.
- [ViaCEP: documentação oficial](https://viacep.com.br/) aceita CEP de 8 dígitos e retorna `erro: true` quando inexistente. A validação acontece antes da requisição. O serviço alerta contra uso massivo; o app consulta apenas um CEP enviado pela pessoa.
- [OpenStreetMap: atribuição e ODbL](https://www.openstreetmap.org/copyright) é vinculada no rodapé da tela. Cadastros colaborativos podem estar incompletos ou desatualizados.
- A [política atual da instância pública Nominatim](https://operations.osmfoundation.org/policies/nominatim/) exige identificação, limite agregado por aplicação e decisão informada do responsável, proíbe autocomplete e apresenta restrições a plataformas genéricas. Por isso essa instância não foi incorporada: a busca manual usa Photon.

O endpoint principal de Overpass e Private.coffee não foram adotados como fallback automático. Estavam indisponíveis no ambiente da verificação; fazer rodízio silencioso de provedores enviaria a localização a novos destinatários que a pessoa não escolheu. A tela informa indisponibilidade, mantém busca manual e permite abrir mapas externos.

## Consulta, dados e limites

- Endpoint padrão: `https://ovp.dresel.systems/api-sa/interpreter`.
- Query: união de `nwr[amenity=pharmacy]` e `nwr[healthcare=pharmacy]`, filtro `around`, `out center tags`, timeout de servidor de 20 segundos e memória máxima de 16 MiB. Os raios permitidos são exclusivamente 2, 5 e 10 km.
- Requests são abortáveis e têm timeout de cliente de 25 segundos. O cliente limita novas requisições a no máximo uma por segundo por serviço nesta sessão. Após HTTP 429, 406 ou 503, pausa esse serviço por 30 segundos. Não há sondagem, polling, busca em lote nem retry automático.
- Itens só entram na lista se têm categoria de farmácia, tipo OSM válido, ID inteiro positivo e coordenadas finitas válidas. A lista usa distância Haversine em linha reta, elimina duplicações por tipo/ID e descarta centros fora do raio. Geometria de prédios/áreas usa seu centro OSM, o que pode causar pequenas diferenças de distância.
- Nome ausente aparece como “Farmácia sem nome no mapa”; endereço e telefone ausentes não são inventados. Telefones públicos são aceitos apenas em formato numérico plausível e convertidos a `tel:` sem extensões executáveis. Horário é exibido no formato bruto `opening_hours`, rotulado como cadastro OSM e sem inferir “aberto agora”.
- Respostas com `remark` de falha, erro HTTP ou payload inválido não são apresentadas como “nenhuma farmácia”. Mensagens distinguem falha de localização, permissão negada, timeout, falta de conexão, CEP inexistente e ausência de resultados.

## Configuração para outro provedor

`VITE_PHOTON_URL` e `VITE_OVERPASS_URL` podem substituir os endpoints em builds administrados pelo responsável. O primeiro deve falar a API Photon, o segundo a API Overpass. Sem configuração, o app funciona com os endpoints públicos acima.

Ao trocar o provedor, o responsável deve conferir sua política e cobertura, e atualizar os nomes, links e aviso de privacidade da tela. Não colocar chaves privadas nessas variáveis Vite: são públicas no navegador. Para uma operação com muitos usuários, usar infraestrutura própria ou um provedor com capacidade contratada, limite global e política de privacidade adequada; o limite em memória só controla esta sessão do navegador.

## Validação

- `npx vitest run src/lib/pharmacies.test.ts`: **36 testes passaram**. Cobrem arredondamento, coordenadas inválidas, Haversine conhecido/antípodas, validação de query/CEP/raio, normalização de nodes/ways, ordenação, filtro de raio, duplicações, telefones, dados ausentes, retorno parcial, countrycode, URLs, ausência de origem no trajeto, request sem credenciais, cache, remoção, CEP sem logradouro no geocoder, abort, timeout e pausa após 429.
- `npx tsc -b --pretty false`: passou durante a implementação.
- Consulta real de referência, sem GPS pessoal: Photon `Campinas, SP` retornou HTTP 200, CORS `*` e locais brasileiros; ViaCEP `01001000` (Praça da Sé, São Paulo, endereço público) retornou HTTP 200 e CORS `*`.
- Consulta real **com a mesma query do app**, ponto público de referência do centro de São Paulo `-23.55,-46.633`, raio 2 km: Overpass Dresel respondeu HTTP 200, CORS `*`, **57 elementos**, sem `remark`, em cerca de **2,2 segundos**.
- Validação real adicional usando a própria lib carregada com Vite `ssrLoadModule`: `searchPlaces('Campinas, SP')` retornou locais brasileiros; `searchPharmacies({latitude:-23.55,longitude:-46.633}, 2000, signal)` retornou **57 farmácias**, com ordenação crescente conferida. Os primeiros resultados foram Onofre, Droga Raia e Drogasil, com distâncias aproximadas de 114, 134 e 183 metros. Não é uma confirmação de disponibilidade comercial.
- Limitação observada: Private.coffee não respondeu no tempo disponível; main Overpass apresentou timeout/TLS e a instância VK respondeu 504. Isso confirma a necessidade de estados de erro e alternativa externa; os resultados nunca são preenchidos com dados fictícios quando o serviço falha.

Para verificar a interface: abrir `/farmacias`, conferir que não há requests antes de uma escolha; buscar cidade/CEP e escolher região; conferir lista crescente em distância e atribuição; ampliar raio; abrir/ocultar mapa; testar negar localização, cancelar durante a espera, remover localização, alternar de busca manual para aparelho e simular offline. O app exige HTTPS ou localhost para geolocalização.

## Google Maps sem chave

A busca funciona inteiramente com fontes públicas sem cadastro ou chave de mapas. OpenStreetMap/Overpass fornece os estabelecimentos; Photon localiza a região e ViaCEP resolve o CEP. O app calcula distância e apresenta os estabelecimentos ordenados a partir da região escolhida.

**Abrir Google Maps** usa links públicos oficiais [Maps URLs](https://developers.google.com/maps/documentation/urls/get-started), que não exigem chave. Com uma região selecionada, o link envia somente a região aproximada; sem região, busca “farmácias perto de mim”. Cada estabelecimento oferece trajeto para suas coordenadas. O próprio Google Maps apresenta os resultados, avaliações e informações disponíveis ao abrir o site ou aplicativo; esses dados não são importados para a lista do MEDControl.

Não há SDK Google, credencial de mapas, cadastro de faturamento ou escolha de provedor na interface. Esta é a configuração definitiva solicitada pelo responsável. Serviços públicos continuam sujeitos a disponibilidade e limites; os erros são tratados e o link Google permanece disponível. A localização continua opcional e só é solicitada após a ação da pessoa.

## Correção de localização do aparelho

Na tela com falha foi observado o ponto `(0, 0)`, com precisão declarada de 1 m, resultando em consulta vazia fora da região do usuário. O fluxo agora valida a posição antes de enviar qualquer consulta: recusa o ponto nulo (incluindo coordenadas arredondadas para ele) e precisão inválida ou superior a 2 km. Esse limite é uma escolha do produto para não apresentar proximidade enganosa no menor raio de busca. A validação genérica de coordenadas continua permitindo pontos no equador e meridiano de Greenwich.

O navegador recebe `enableHighAccuracy: true`, `maximumAge: 0` e timeout de 20 segundos. Isso solicita uma posição mais precisa, mas não garante que navegador/aparelho a forneçam. Em falha, a tela permite nova tentativa ou cidade/bairro/CEP, sem apresentar zero estabelecimentos como conclusão. Quando uma consulta válida volta vazia, há ação direta para ampliar de 2 para 5 e 10 km.
