# Notificações e envio em segundo plano

## Fluxo de consentimento

Nenhuma permissão é solicitada no carregamento da página. A pessoa toca em **Ativar meus lembretes** na rotina, ou em **Ativar notificações** nos ajustes. `Notification.requestPermission()` é chamado diretamente desse gesto, antes das operações de rede. Negar a permissão mantém as demais funções disponíveis e mostra como liberar no navegador.

Na conta real, o app obtém a chave pública do dispatcher, espera o service worker do PWA, cria a assinatura Push e a associa ao usuário. A demonstração permite testar o aviso local e os horários dos medicamentos enquanto a aba estiver aberta, sem consultar ou cadastrar inscrições no servidor. A chave privada de push e o segredo do cron nunca vão ao frontend.

A confirmação de uma dose não é inferida pela notificação: o usuário precisa registrá-la na agenda.

## Arquitetura e código

- Função: `dispatch-reminders`, em `supabase/functions/dispatch-reminders/index.ts`.
- GET: retorna somente a chave pública VAPID.
- POST: exige o segredo aleatório de 256 bits do agendador antes de consultar os tratamentos.
- OPTIONS: suporta CORS; outros métodos são recusados.
- `push_server_config`: linha única com chaves geradas uma vez no servidor. RLS sem políticas para clientes e privilégios revogados de `anon` e `authenticated`; acesso da função com credencial do próprio runtime.
- `medcontrol-reminders`: cron de um em um minuto, chamando a função pelo `pg_net` com o segredo dedicado.
- `notification_deliveries`: chave única por inscrição, medicamento, data e horário coordena execuções concorrentes. A migração `202611230005_push_delivery_leases.sql` acrescenta confirmação de envio e uma concessão temporária de 45 segundos para recuperar tentativas abandonadas. Cada tentativa usa um token; um worker antigo não pode liberar a tentativa de outro. Falhas transitórias liberam a tentativa; inscrições vencidas (HTTP 404/410) são removidas.
- A leitura das inscrições usa paginação por cursor para não pular aparelhos quando inscrições vencidas são removidas durante o envio.
- A consulta considera o fuso horário do aparelho informado na inscrição e os últimos dois minutos para absorver atrasos curtos. Doses já confirmadas não geram novo aviso.
- Estoque para até três dias de consumo gera um aviso diário por medicamento/aparelho, com acesso à página de farmácias. Nenhum GPS é coletado automaticamente pelo aviso.

O conteúdo mostrado pelo worker é fixo e discreto, sem nome, dose ou medicamento na tela bloqueada. Os únicos destinos internos permitidos pelo worker são `/` e `/farmacias`.

O agendamento usa um segredo próprio; não transmite a chave `service_role`. Operadores com conexão direta privilegiada ao banco ainda podem acessar configurações/filas do servidor. Não copie essas informações para logs, cliente ou documentação pública.

## Reproduzir em outro projeto

1. Aplicar as migrações de `supabase/migrations/` em ordem, ajustando a URL da função na migração do cron.
2. Implantar a função:

```bash
supabase functions deploy dispatch-reminders --project-ref SEU_PROJECT_REF --no-verify-jwt
```

A verificação JWT legada da plataforma fica desligada para esse endpoint porque o POST usa um segredo opaco próprio. A função não permite disparo anônimo; GET divulga somente uma chave pública. No Dashboard, a opção correspondente é **Verify JWT with legacy secret**. O arquivo `supabase/config.toml` registra a mesma configuração.

3. Acessar GET uma vez para inicializar as chaves; o cliente também faz isso ao ativar os lembretes. Requisições simultâneas inserem a mesma chave primária e releem a linha vencedora; não regeneram chaves de inscrições existentes.
4. Publicar o frontend em HTTPS, atualizar os retornos do Auth e instalar/abrir o PWA no aparelho.
5. Na conta real, ativar notificações. Conferir a inscrição em `push_subscriptions` sem divulgar endpoint ou chaves.
6. Usar **Enviar teste agora** para verificar permissão e apresentação pelo navegador. Esse botão não chama o dispatcher. Para validar o caminho completo, cadastrar um horário de teste futuro, deixar o app em segundo plano e confirmar o recebimento no próprio aparelho; correlacionar a tentativa com o resultado do cron.

Para atualizar uma instalação existente, aplicar a migração `005` antes de publicar a nova função. O comando de deploy inclui automaticamente `dispatch.ts`. Para o editor de arquivo único no Dashboard, executar `node scripts/bundle-dispatcher.mjs`: ele gera `/tmp/medcontrol-dispatch-reminders.ts`, mantendo os imports npm e reunindo apenas os módulos locais, sem ler credenciais.

Não é necessário inserir chaves privadas em `.env.local`. Se as chaves VAPID forem rotacionadas pelo operador, inscrições anteriores precisarão ser refeitas.

## Verificação técnica e limites

Foram verificados a compilação, o worker gerado, o consentimento no fluxo da interface com API simulada, o GET da função e a recusa de POST sem segredo. O agendamento foi configurado no projeto; duas execuções observadas retornaram HTTP 200, sem falhas e sem inscrições reais durante a verificação. A confirmação do recebimento com a tela bloqueada precisa ser realizada no telefone final; o teste de servidor não equivale a uma entrega observada em Android ou iOS.

Notificações não têm garantia de pontualidade: dependem de internet, permissão, suporte do navegador, energia/bateria, instalação do PWA e disponibilidade do servidor. No iPhone/iPad, use o app adicionado à tela inicial e uma versão compatível. O app aberto tem uma verificação local como alternativa quando não existe inscrição associada à conta no servidor; uma assinatura órfã no navegador não bloqueia essa alternativa. A checagem local de estoque evita duplicar o aviso do servidor quando a inscrição está ativa. Páginas suspensas não executam temporizadores com precisão.

O recurso não substitui um alarme médico. A permissão pode ser revogada no navegador. O botão **Desativar notificações** cancela a inscrição deste dispositivo e grava uma preferência local que bloqueia os avisos com o app aberto mesmo quando a permissão do navegador continua concedida. Falhas na remoção da inscrição são mostradas na interface e precisam de nova tentativa. Sair da conta tenta removê-la antes de encerrar a sessão, para não manter avisos em aparelho compartilhado.

### Cobertura da revisão local

Os testes executam o mesmo módulo `dispatch.ts` usado pela função, com banco e provedor simulados: concorrência, repetição, retomada de falha transitória, paginação durante remoção, dose confirmada, erro na reserva de estoque, erro ao liberar tentativa, virada de data e validação de endpoint. Os testes do cliente verificam a preferência de desativação, a identificação da inscrição por usuário e o fallback para inscrição órfã. Eles não comprovam entrega por um provedor real. A migração SQL precisa ser aplicada no projeto para que o dispatcher atualizado funcione.

`sent` conta requisições aceitas pelo provedor Push; não é comprovante de apresentação na tela. `failed` conta operações que falharam, incluindo persistência e limpeza, e pode superar o número de aparelhos. Uma interrupção após o provedor aceitar o aviso e antes da confirmação no banco pode gerar uma nova tentativa; não há garantia de entrega exatamente uma vez entre banco e provedor externo. O `tag` estável ajuda o navegador a substituir avisos repetidos. Se o banco estiver indisponível durante a consulta local da inscrição, o app mantém o fallback e pode mostrar um aviso adicional.

## Referências

- [Supabase — agendamento de Edge Functions](https://supabase.com/docs/guides/functions/schedule-functions)
- [Supabase — variáveis do runtime](https://supabase.com/docs/guides/functions/secrets)
- [MDN — Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
- [MDN — solicitação de permissão](https://developer.mozilla.org/en-US/docs/Web/API/Notification/requestPermission_static)
- [Web Push library](https://github.com/web-push-libs/web-push)


## Verificação remota desta revisão

Em 23/11/2026, após autorização explícita do responsável, a migração 005 e a nova função foram publicadas no projeto. Às 12:58 (America/Sao_Paulo), o cron estava ativo e as últimas três respostas HTTP eram 200, sem timeout, com `sent=0` e `failed=0`. Havia zero dispositivos reais inscritos. A coluna de token existia e `authenticated` não tinha permissão de executar o RPC de claim. GET público retornou 200 e POST com segredo inválido retornou 401. Esses resultados não confirmam recebimento no telefone.

## Correção do teste local em demonstração — 23/11/2026

O problema informado no computador foi reproduzido com o Chrome DevTools do ECC: havia um medicamento fictício no horário atual e a interface dizia “Lembretes autorizados”, mas o contexto passava `undefined` ao agendador sempre que o modo demonstração estava ativo. Consequentemente, nenhum horário da demonstração solicitava uma notificação, mesmo com permissão concedida. O botão de teste manual era um caminho separado.

Agora o agendador funciona na demonstração em modo exclusivamente local. A permissão, a preferência de desativação, a dose confirmada e a janela de dois minutos continuam sendo respeitadas. Envios simultâneos e novas verificações não duplicam a mesma dose; a identificação inclui o proprietário. A alteração da preferência e o retorno à aba também disparam uma nova conferência. Dados fictícios não precisam de inscrição no Supabase.

O envio pelo construtor de notificações do desktop passa a esperar o evento `show`; erro assíncrono ou ausência de confirmação em cinco segundos retorna falha. O botão de teste informa o resultado e orienta a conferir as permissões do sistema. Quando há service worker ativo, a confirmação continua sendo a resolução de `showNotification()`. Nenhum desses sinais demonstra que uma pessoa leu o aviso ou que o sistema apresentou um banner sobre outras janelas.

### Evidências executadas

| Teste | Resultado |
| --- | --- |
| ECC, cenário controlado antes da correção | Zero chamadas de notificação para a dose no horário atual |
| ECC, mesmo cenário após a correção | Uma chamada para a dose; nenhuma duplicação |
| Chrome desktop isolado, API nativa sem simulação de `show` | Aviso manual confirmado por `show` às 13:50:53, horário de São Paulo |
| Horário futuro 13:51, API nativa | Lembrete confirmado por `show` às 13:51:08; verificação usa intervalo de 15 segundos |
| Nova verificação após o disparo | Nenhum segundo aviso da mesma dose |
| Desativação pelos Ajustes e recarregamento | Nenhum novo aviso, mesmo com um novo medicamento no horário atual |
| Tráfego de inscrições push na demonstração | Zero consultas ou gravações |
| ECC, erro de exibição simulado | Mensagem de falha aparece e a mensagem de sucesso é removida |
| Testes automatizados | 132 testes em 12 arquivos passaram |
| Compilação | TypeScript, Vite e geração do service worker passaram |

Os eventos nativos estão em [notification-test-results.json](notification-test-results.json). A permissão foi concedida por automação somente dentro de um contexto descartável de um Chrome de teste. Não foram usadas credenciais, receitas ou medicamentos reais; nenhuma configuração global de notificações do sistema foi alterada. O banner do macOS não foi confirmado visualmente. O teste não valida o caminho de Web Push com conta real e aba fechada.

O roteiro nativo é repetível com `node scripts/test-browser-notifications.mjs --port 9337`, tendo o servidor Vite em `127.0.0.1:5173` e um Chrome dedicado iniciado com `--remote-debugging-port=9337` e um `--user-data-dir` temporário. O script cria e descarta seu próprio contexto, concede permissão nele, usa um horário futuro e verifica duplicação e desativação. Ele observa eventos reais da API e não cria um `show` artificial.

Para repetir pela interface: recarregue o app, entre na demonstração, ative as notificações em Ajustes e toque em **Enviar teste agora**. O teste é enviado nesse clique, sem cadastrar remédio ou aguardar horário. Para testar separadamente o lembrete da agenda, cadastre um horário fictício um ou dois minutos à frente e mantenha a aba aberta. A permissão pertence ao endereço usado: `localhost` e `127.0.0.1` são origens diferentes. Verifique também se o navegador está autorizado nos ajustes do computador e se Não Perturbe/Foco está ocultando banners.

## Teste imediato e revisão geral ECC

A ação **Enviar teste agora** foi verificada sem medicamentos cadastrados: dois eventos nativos `show` em 14 ms e 9 ms após os cliques. No preview de produção, com worker ativo, `showNotification()` foi resolvido em 5 ms e 3 ms. Os testes repetidos usam tags distintas; cliques simultâneos são bloqueados durante o envio. A falha remove a confirmação anterior e permite nova tentativa. Desativar no modo demonstração não consulta nem remove inscrições remotas.

A confirmação do navegador não atesta que o sistema operacional apresentou um banner. Consulte a [revisão completa e seus limites](platform-qa-review.md), os [eventos desktop](notification-immediate-qa.json) e os [resultados do PWA](notification-production-qa.json).
