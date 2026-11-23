# Busca pública de medicamentos

O MEDControl ajuda a identificar o nome da embalagem usando uma cópia dos **dados abertos oficiais da Anvisa**. A seleção preenche somente o nome do medicamento. Dose, horários, indicação, equivalência e substituição não são inferidos pelo catálogo.

## Fonte e procedência

- [CSV oficial — Medicamentos Registrados no Brasil](https://dados.anvisa.gov.br/dados/DADOS_ABERTOS_MEDICAMENTOS.csv).
- [Orientação oficial da Anvisa que identifica o arquivo e explica sua consulta](https://www.gov.br/anvisa/pt-br/assuntos/fiscalizacao-e-monitoramento/farmacovigilancia/relatorios-periodicos-de-avaliacao-beneficio-risco-rpbr-1), consultada em 23/11/2026.
- [Documentação e dicionário oficial da base](https://dados.anvisa.gov.br/dados/Documentacao_e_Dicionario_de_Dados_Registros_Validos_Medicamento_V1.pdf).
- [Conjunto no Portal Brasileiro de Dados Abertos](https://dados.gov.br/dados/conjuntos-dados/medicamentos-registrados-no-brasil).

O snapshot entregue em `public/data/medications.json` foi gerado em **23/11/2026**, a partir de um HTTP 200 do host oficial. O cabeçalho `Last-Modified` recebido foi `Mon, 23 Nov 2026 14:54:37 GMT`. SHA-256 dos bytes originais: `7842d895cd81c700908b5f84e035d28c023bfc2eee9c1a9ad1269e653db8fe87`.

Essa versão contém **10.339 registros distintos**, em aproximadamente **995 KB** de JSON (179 KB com gzip). Das 229.707 linhas originais, 85.497 tinham situação `Ativo`; 12.371 foram excluídas por campos essenciais ausentes ou inválidos e 62.787 repetições idênticas foram removidas. Os números e as datas ficam também no próprio arquivo, para auditoria e futuras atualizações.

São incluídos apenas `TIPO_PRODUTO=MEDICAMENTO` e `SITUACAO_REGISTRO=Ativo`, com nome, princípio ativo, empresa detentora e número de registro de nove dígitos preenchidos. `Ativo` é a classificação publicada pela fonte na data da cópia: não é uma verificação atual da regularidade, disponibilidade em farmácias ou adequação ao tratamento. Campos incompletos e produtos fora desse filtro podem não aparecer; o preenchimento manual continua disponível.

`EMPRESA_DETENTORA_REGISTRO` identifica o **detentor do registro**, que pode diferir do fabricante. A interface usa esse rótulo. O prefixo de CNPJ é removido somente para legibilidade. A origem e a ordem dos campos permanecem explícitas em `fields` e no script. As informações são apresentadas como texto React; nenhum HTML da fonte é executado.

## Atualizar a cópia

Na raiz do projeto, com Node.js compatível com o Vite instalado:

```sh
node scripts/update-drug-catalog.mjs
npx vitest run src/lib/drugCatalog.test.ts
npm run build
```

O script acessa exclusivamente o CSV oficial, sem credenciais. Decodifica UTF-8 ou Windows-1252, lê CSV com aspas, delimitadores e quebras de linha, valida as colunas, filtra, deduplica, ordena e grava primeiro um arquivo temporário. Só substitui a cópia anterior depois de transformar todos os registros com sucesso. Respostas vazias, menos de 1.000 registros completos, estrutura inesperada ou registros conflitantes interrompem a atualização e preservam o catálogo anterior. O limite de download é 100 MB; o timeout é de 120 segundos.

Para reproduzir a transformação de um CSV oficial previamente baixado, sem rede:

```sh
node scripts/update-drug-catalog.mjs --input /caminho/DADOS_ABERTOS_MEDICAMENTOS.csv --last-modified 'Mon, 23 Nov 2026 14:54:37 GMT'
```

Use em `--last-modified` o cabeçalho real daquele download. Se a data não for conhecida, omita o argumento: o arquivo terá `sourceLastModified: null` e a interface informará a data de geração da cópia. `generatedAt` corresponde à transformação, enquanto `sourceLastModified` corresponde à alteração informada pelo servidor da Anvisa. O hash sempre se refere aos bytes exatos do CSV de entrada. O CSV original de aproximadamente 46 MB não é distribuído pelo aplicativo.

Revise as contagens, eventuais mudanças de esquema e a data antes de publicar a atualização. Redistribua o snapshot com a atribuição e os metadados da Anvisa. As consultas não dependem de chaves de API ou serviços não oficiais.

## Integração e comportamento

```tsx
import { MedicationSearch } from '../medication/MedicationSearch'

<MedicationSearch currentValue={name} onSelect={setName} />
```

Coloque o componente antes do campo manual. `onSelect` recebe apenas uma `string` com o nome oficial. `currentValue` é opcional e permite ocultar a confirmação se o nome tiver sido alterado manualmente. O componente pode ficar dentro do formulário existente: não cria um `<form>` aninhado e captura Enter do campo de busca para não salvar o medicamento sem querer.

A busca ocorre apenas ao pressionar **Buscar** ou Enter. Na primeira busca válida, um GET ao arquivo estático no **mesmo host** carrega a base. Essa requisição não contém termos de busca, cookies, identificadores da conta ou referrer. As consultas seguintes usam a mesma cópia em memória. O aplicativo não envia as buscas à Anvisa ou a outro provedor, nem armazena histórico de buscas. Links da fonte abrem sem referrer e sem incluir o termo digitado.

O catálogo só carrega quando necessário e respeita `import.meta.env.BASE_URL`, inclusive em publicação sob subdiretório. O carregamento tem timeout de 15 segundos e permite nova tentativa após falha. O arquivo JSON precisa ser publicado junto do site; não há dependência de CORS da Anvisa em tempo de uso. O service worker atual pode não pré-armazenar JSON: se a primeira consulta ocorrer sem conexão e sem cópia HTTP disponível, a interface orienta o preenchimento manual.

O mecanismo normaliza acentos e pontuação e busca todos os termos no nome ou no princípio ativo. Nomes exatos vêm antes de prefixos e outros trechos; não há aproximação por efeito clínico. São mostrados no máximo oito resultados por busca, com a contagem total e orientação para refinar o nome. Cada resultado contém nome, princípio ativo, detentor e registro para conferência com a embalagem.

Há estados iniciais, consulta curta, carregamento, erro recuperável, nenhum resultado, lista e confirmação da seleção. Todos os botões têm `type="button"`; rótulos e identificadores são exclusivos, mudanças de estado usam `role="status"` e a lista tem semântica de lista. A integração visual deve manter fonte legível, contraste e alvos de toque de pelo menos 44 px.

## Classes para estilização

O componente não altera estilos globais. Classes disponíveis:

| Classes | Elementos |
| --- | --- |
| `catalog-search`, `catalog-heading`, `catalog-label` | Seção, título/descrição e rótulo |
| `catalog-controls`, `catalog-input`, `catalog-submit` | Linha de busca, campo e botão |
| `catalog-privacy`, `catalog-status`, `catalog-error`, `catalog-selected` | Informação de privacidade, estados e confirmação |
| `catalog-results`, `catalog-result`, `catalog-result-info` | Lista, item e informações de um registro |
| `catalog-name`, `catalog-ingredient`, `catalog-holder`, `catalog-registration` | Campos do registro |
| `catalog-select`, `catalog-source`, `catalog-note` | Ação de seleção, procedência e orientação da prescrição |

## Verificação

`src/lib/drugCatalog.test.ts` valida o snapshot real, origem e esquema, integridade e unicidade dos registros, busca com acentos e múltiplos termos, ordenação e limites, ausência de dose no resultado, requisição estática sem consultas/credenciais, falha HTTP e HTML inválido. Também exercita o script de ingestão com CSV entre aspas, quebras de linha, filtros de situação/campos, deduplicação e rejeição de dados truncados ou conflitantes. Os dados artificiais usados nesses testes são apenas fixtures e nunca integram o catálogo público.
