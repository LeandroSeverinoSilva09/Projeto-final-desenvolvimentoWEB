# Farmácias próximas

A rota `/farmacias` apoia a reposição de medicamentos. Google Maps e Waze aparecem como ações principais, pois a pessoa pode usar o mapa que já conhece. A lista dentro do MEDControl é uma alternativa opcional e usa dados públicos do OpenStreetMap. Nenhuma das opções confirma preço, estoque, participação na Farmácia Popular ou disponibilidade de medicamento.

## Uso diário

1. Ao abrir a página, a pessoa encontra **Google Maps** e **Waze**, sem precisar liberar localização ao MEDControl. Os links fazem uma busca por “farmácias perto de mim”; a localização fica sob controle do serviço aberto e das permissões concedidas a ele. A página não faz requisições de mapas nem solicita localização automaticamente.
2. **O que preciso repor?** reúne os medicamentos com estoque baixo ou vazio, conforme `getStockStatus()`, em um resumo recolhido. Os nomes e quantidades permanecem no aplicativo e nunca são colocados nos links externos.
3. **Ver farmácias nesta página** abre a busca opcional. A pessoa escolhe **Usar minha localização** ou envia cidade, bairro ou CEP. O aviso antes das ações informa o compartilhamento da região aproximada e aponta para mais detalhes de privacidade.
4. A busca manual ocorre somente ao enviar o formulário. A pessoa escolhe a região dentre os locais encontrados. CEP passa por ViaCEP; somente bairro, cidade e UF seguem para Photon, descartando CEP, logradouro e complemento.
5. Os resultados mostram nome, endereço quando disponível e distância aproximada. **Ligar** aparece quando há telefone público válido. Os trajetos **Google Maps** e **Waze** usam somente o destino da farmácia, sem enviar a origem da pessoa. Horários brutos ficam em **Horário informado**, com lembrete para confirmar com o estabelecimento.
6. O raio pode ser ampliado de 2 para 5 e 10 km. Sem resultados, a ação de ampliação aparece diretamente. Falhas têm mensagens próprias; erro de serviço nunca é apresentado como ausência de farmácias.
7. **Cancelar busca**, **Remover localização**, recolher a busca ou sair da página cancela pedidos pendentes, invalida callbacks atrasados e esvazia o cache em memória. Isso não apaga pedidos já recebidos pelos serviços nem revoga permissões do navegador.

Não há iframe de mapa, opção de abrir OpenStreetMap ou seleção de provedor na interface. A atribuição da fonte OSM permanece visível no rodapé, com os detalhes técnicos e de privacidade recolhidos. A lista interna nunca é apresentada como resultado do Google Maps ou do Waze.

## Localização e requisições

- `getCurrentPosition` é chamado somente por ação explícita, com `enableHighAccuracy: true`, `maximumAge: 0` e timeout de 20 segundos. Não há monitoramento contínuo. Geolocalização exige HTTPS ou localhost.
- As coordenadas são arredondadas a três casas decimais antes de entrar no estado React ou em requisições, uma grade de aproximadamente 100 metros no Brasil. A validação do aparelho rejeita o ponto nulo `(0, 0)`, inclusive após arredondamento, e precisão inválida ou superior a 2 km. Pontos válidos no equador ou meridiano de Greenwich continuam aceitos.
- Permissão negada, posição indisponível, timeout ou precisão insuficiente preservam a alternativa de cidade/bairro/CEP. Nenhuma consulta de farmácias é enviada após uma posição rejeitada.
- A distância usa Haversine em linha reta. Na busca manual, a referência é o centro aproximado da região escolhida, não a posição da pessoa. Não representa trajeto ou tempo de viagem.
- Cidade/bairro aceita de 3 a 120 caracteres e não admite número residencial. CEP exige 8 dígitos, com hífen opcional. Não há autocomplete nem busca a cada tecla.
- Overpass recebe somente categoria farmácia, raio e ponto aproximado. Não recebe nomes de medicamentos, conta, e-mail, receitas ou histórico.
- `fetch` usa `credentials: omit`, `cache: no-store`, referrer limitado à origem, AbortSignal e timeout de cliente de 25 segundos. Há limite local de uma nova requisição por segundo por serviço; HTTP 429, 406 ou 503 bloqueiam esse serviço por 30 segundos, sem retry automático.
- Cache somente em memória, com validade de 5 minutos e limite de 20 entradas. Coordenadas não são escritas em Supabase, `localStorage`, `sessionStorage` ou URL da aplicação.

## Links externos seguros

As URLs usam hosts HTTPS fixos, consulta codificada e `noopener noreferrer` na interface. Não há SDK, chave, faturamento de mapas, importação de avaliações ou scraping de Google/Waze.

- [Google Maps URLs, documentação oficial](https://developers.google.com/maps/documentation/urls/get-started): busca com `api=1&query=...`; trajeto com `api=1&destination=latitude,longitude`, sem `origin`. Links não exigem chave.
- [Waze Deep Links, documentação oficial](https://developers.google.com/waze/deeplinks/): `https://waze.com/ul?q=...` para busca; uma região aproximada pode ser enviada em `ll` como referência. Busca não contém `navigate`. Somente o trajeto de uma farmácia conhecida usa `ll=latitude,longitude&navigate=yes`. O link HTTPS pode abrir o aplicativo ou a página do Waze, inclusive quando o aplicativo não está instalado.
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
| `src/lib/pharmacies.test.ts` | Regressões de limites, fontes externas, links e cancelamento |
| `src/pages/PublicInformation.tsx` | Privacidade e condições dos serviços externos |

A página requer `MedicationProvider` e usa `Header` e componentes visuais comuns. `VITE_PHOTON_URL` e `VITE_OVERPASS_URL` permitem substituir endpoints em builds administrados. São variáveis públicas: não usar chaves privadas. Ao trocar provedor, conferir cobertura e políticas e atualizar avisos/links. Para volume elevado, contratar capacidade ou hospedar os serviços; o limite em memória vale apenas para esta sessão.

## Validação

`npm test -- src/lib/pharmacies.test.ts` cobre coordenadas e precisão, CEP/cidade, Haversine, normalização, telefones, queries limitadas, links Google Maps/Waze, região sem navegação indevida, ausência de origem e dados médicos, requests sem credenciais, cache, cancelamento, timeout e pausa após limitação do serviço.

A conferência de interface deve incluir desktop, mobile estreito e texto grande: estado inicial sem pedidos de rede, abertura das duas opções externas, busca manual, escolha de região, negação de localização, cancelamento durante espera, callback tardio após recolher, ampliação do raio, chamada telefônica e destinos das duas rotas. Confirmar atribuição visível e ausência de nomes de medicamentos nos links.
