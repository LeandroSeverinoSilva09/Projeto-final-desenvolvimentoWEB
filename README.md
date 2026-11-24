# MEDControl

**Cada cuidado conta.** Um web app de impacto social para organizar medicamentos, lembrar horários, registrar doses e planejar reposições, com atenção a idosos e pessoas com pouca familiaridade com o telefone.

## O que está implementado

- Cadastro, entrada, confirmação de e-mail e recuperação de senha pelo **Supabase Auth**.
- Medicamentos e registros separados por conta, com **Row Level Security** no PostgreSQL.
- Cadastro visual em quatro perguntas (nome, quantidade por vez, horários e estoque), sem valores de uso ou horários predefinidos; figuras, cartões grandes e “Letras maiores”. Unidades e mL têm estoque numérico. Para gotas, a dose segue a receita e o estoque é uma escolha visual sobre o frasco: cheio, pela metade, acabando, vazio ou não sei dizer; não exige contar gotas restantes.
- Agenda diária e confirmação de dose sem duplicação. O estoque numérico é descontado na mesma transação; o nível dos frascos em gotas é atualizado pela pessoa, sem conversão automática ou previsão de duração.
- Histórico preservado ao arquivar um medicamento e exportação CSV dos até 5.000 registros mais recentes carregados por paginação.
- Busca local em uma cópia oficial dos **dados abertos da Anvisa**, com **10.339 registros ativos** na atualização de 23/11/2026. A seleção preenche somente o nome; dose e horários seguem a prescrição.
- Alerta de estoque numérico para aproximadamente três dias de consumo; frascos em gotas geram alerta quando marcados como acabando ou vazios. Acesso a **farmácias próximas**.
- Localização opcional, busca por cidade/bairro ou CEP, distâncias estimadas e acesso a mapas. Dados públicos do OpenStreetMap, Photon e ViaCEP, sem chave de mapas ou faturamento; Google Maps e Waze em destaque para abrir buscas e trajetos. A lista interna é opcional.
- Notificações solicitadas por um botão, teste imediato e dois lembretes por dose: cinco minutos antes e no horário. Demonstração com avisos locais; contas reais com inscrição Web Push e serviço agendado no Supabase, conforme a [validação e o estado da publicação](docs/notifications.md).
- Interface adaptada ao telefone, navegação fixa, saída da conta em Ajustes, texto ampliado, ajuda “Como usar” e alternativa manual aos recursos opcionais. Formulário mantém campos ao alternar janelas e recusa edição de estoque desatualizado.
- Demonstração identificada, com dados fictícios separados das contas reais.

## Executar

Requer Node.js 22.12 ou superior.

```bash
npm ci
cp .env.example .env.local
# Preencha somente a URL e a chave pública do seu Supabase.
npm run dev
```

Abra `http://localhost:5173`. Para conhecer sem criar conta, use **Explorar demonstração**. A demonstração é mantida apenas na aba e não envia seus exemplos ao banco.

```bash
npm test          # testes de regras, notificações e integrações públicas
npm run build     # TypeScript + build + service worker
npm run preview   # testar o build/PWA em localhost
```

No desenvolvimento comum, o service worker não é instalado. Para testar Web Push e instalação, use `npm run build` e `npm run preview`, ou publique em HTTPS. Para acesso real pelo telefone, use um endereço HTTPS; HTTP de rede local não permite todas as APIs de permissão.

## Supabase

O projeto usado nesta implementação é `pvadfgerkkvlecwfhiuq`. Sua URL e **publishable key** podem ir no cliente. Nunca coloque chaves secretas, `service_role` ou chaves privadas de push em variáveis `VITE_*`.

Para reproduzir em outro projeto, execute, **na ordem**, as migrações de `supabase/migrations/`. Elas criam medicamentos, doses, assinaturas push, controles de entrega, configuração privada do serviço e o agendamento. A migração de cron contém a referência do projeto; ajuste a URL ao reproduzir.

A migração `202611240006_bottle_stock.sql` separa a dose em gotas da observação do frasco. Ela preserva saldos antigos e inicia o nível como não informado. Aplique-a antes de publicar o frontend e a versão atualizada de `dispatch-reminders`. Consulte a [revisão ECC de gotas e frascos](docs/drop-medications-review.md).

Em **Authentication → URL Configuration**, defina o endereço do app como Site URL e permita seus retornos. Neste projeto foram configurados `http://127.0.0.1:5173/**` e `http://localhost:5173/**`. Antes de usar outro endereço ou publicar, adicione seu domínio HTTPS e `/recuperar-senha`. A confirmação por e-mail permanece ligada. O envio de e-mails de produção depende da configuração e dos limites de e-mail do seu projeto Supabase.

A função `supabase/functions/dispatch-reminders/index.ts` fornece apenas a chave pública pelo GET e aceita disparos POST somente com o segredo do agendador. As chaves do serviço são geradas uma vez no servidor, em tabela sem acesso pelo cliente. Consulte [notificações](docs/notifications.md) para implantação, verificação e limites.

Para repetir os testes reais de banco, com autorização do responsável:

```bash
# Defina SUPABASE_TEST_ADMIN_KEY somente no processo/terminal, fora dos arquivos.
node scripts/test-supabase.mjs
```

O script cria duas contas descartáveis sem enviar e-mails, verifica login, isolamento, confirmação concorrente, edição com estoque desatualizado e a fila de tentativas de push, e limpa seus dados ao terminar. A inscrição fictícia usa um domínio bloqueado pelo dispatcher; esse teste não envia notificações externas. Não use contas de pessoas reais para esse teste.

## Fontes públicas

O cadastro de medicamentos utiliza uma **cópia de dados oficiais**, sem API clínica, recomendação de dose ou identificação por foto. Atualize com `node scripts/update-drug-catalog.mjs` e consulte a [documentação do catálogo](docs/medication-catalog.md).

A busca de farmácias funciona com serviços públicos sem cadastro ou chave de mapas: OpenStreetMap via Overpass Dresel fornece os estabelecimentos. Photon/Komoot localiza cidades e bairros; ViaCEP permite informar CEP. Os pedidos partem apenas da ação do usuário e a posição é aproximada antes do envio. A posição não é gravada na conta. Consulte [fontes, privacidade e limites dos mapas](docs/pharmacies.md).

Google Maps e Waze abrem buscas e trajetos por links públicos oficiais, sem SDK ou API paga. Os resultados listados dentro do MEDControl vêm do OpenStreetMap.

**A localização de uma farmácia não confirma estoque, preço, horário atual ou participação na Farmácia Popular.** A pessoa deve confirmar a disponibilidade com o estabelecimento.

## Para o TCC

- [Escopo, arquitetura, requisitos e roteiro de apresentação](docs/TCC.md)
- [Identidade visual e decisões de interface](docs/identity.md)
- [Revisão de acessibilidade e testes](docs/accessibility-review.md)
- [Revisão responsiva mobile com ECC](docs/responsive-review.md)
- [Revisão implementada do cadastro e uso diário](docs/daily-usability-review.md)
- [Pesquisa ECC de fotos e identificação de medicamentos](docs/medication-registration/PRODUCT-BRIEF.md)
- [Revisão ECC da estrutura e correções](docs/structure-review.md)
- [Evidências de verificação e pendências](docs/verification.md)

O MEDControl organiza uma rotina informada pelo usuário; não prescreve, ajusta tratamento nem substitui acompanhamento profissional. O acompanhamento usa os horários atuais dos medicamentos ativos desde o cadastro; não reconstrói versões anteriores da prescrição. Dados antigos do protótipo em `localStorage` não são importados automaticamente para contas reais.

## Tecnologias

React 19, TypeScript, Vite, Tailwind CSS, React Router, Supabase Auth/PostgreSQL/Edge Functions/Cron, Web Push, PWA e Vitest.

## Equipe

| Integrante |
|---|
| Arthur Fonseca Victor da Silva |
| Gabriell Levy Santos Oliveira |
| Italo Gabriel Sobreira Silva |
| João Gabriel Beligoli |
| Leandro Severino da Silva |
| Pedro Henrique Alves Teixeira |
| Pedro Henrique Noleto Milagres |
| Vinicius Diniz Viana Moreira |

Repositório original: [Projeto-final-desenvolvimentoWEB](https://github.com/LeandroSeverinoSilva09/Projeto-final-desenvolvimentoWEB).
