import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { BrandMark } from '../components/common/BrandMark'

export function PublicInformation({ kind }: { kind: 'privacy' | 'terms' }) {
  const privacy = kind === 'privacy'
  const title = privacy ? 'Privacidade e seus dados' : 'Condições de uso'
  useEffect(() => { document.title = `${title} | MEDControl`; window.scrollTo(0, 0) }, [title])
  return <main className="main-content" style={{ maxWidth: 820, margin: 'auto', paddingBottom: 48 }}>
    <Link className="brand" to="/"><BrandMark size={32}/><span>MEDControl</span></Link>
    <article className="panel settings-panel mt-5">
      <h1>{title}</h1><p className="muted">Versão acadêmica · Atualizado em 23 de novembro de 2026</p>
      {privacy ? <>
        <h2 className="mt-5">O que fica na sua conta</h2>
        <p>O Supabase mantém seu cadastro, e-mail, medicamentos, horários, estoque e registros de tomada para permitir acesso à sua rotina. A sessão é mantida neste navegador. As regras do banco separam os registros por conta; a equipe responsável pela operação pode acessar dados para suporte e manutenção.</p>
        <h2 className="mt-5">Localização e farmácias</h2>
        <p>A localização é opcional e solicitada somente ao tocar no botão correspondente. As coordenadas são aproximadas antes da busca e não são gravadas na sua conta. Você também pode informar uma cidade, bairro ou CEP.</p>
        <p>Ao tocar em um link do Google Maps, você abre o site ou aplicativo do Google com a região ou o destino escolhido. O MEDControl não carrega a API nem o SDK do Google. O Google também recebe informações técnicas, como IP e dados do navegador, conforme sua política. Os nomes dos seus medicamentos e os registros de saúde não são incluídos nesses pedidos.</p>
        <p>Na busca de farmácias desta página, a região é enviada ao Overpass Dresel, que informa retenção de consultas e IP por até 14 dias. Photon/Komoot recebe a cidade ou bairro digitados. ViaCEP recebe o CEP; somente cidade e bairro seguem para a busca de região. Não informe dados de saúde no campo de localização.</p>
        <p>Abrir um mapa ou trajeto externo compartilha o local com o serviço escolhido. Remover a localização no MEDControl limpa o estado da página, mas não apaga pedidos já recebidos por esses serviços.</p>
        <h2 className="mt-5">Notificações e armazenamento no aparelho</h2>
        <p>Ativar lembretes registra no Supabase uma inscrição do navegador e seu fuso horário. O provedor de push do navegador entrega avisos discretos, sem nome do medicamento na tela bloqueada. Você pode desativá-los nos ajustes. Ao sair, o aplicativo tenta remover a inscrição deste aparelho.</p>
        <p>Preferências de leitura e de avisos ficam no aparelho. O aplicativo instalado guarda arquivos para carregar a interface. Na demonstração, os exemplos ficam apenas na aba. A busca de medicamentos consulta localmente uma cópia do catálogo da Anvisa, sem enviar o nome pesquisado ao órgão.</p>
        <h2 className="mt-5">Seus controles</h2>
        <p>Você pode editar sua rotina, arquivar medicamentos, baixar o histórico carregado e sair da conta. Arquivar preserva as doses anteriores. Esta versão não tem exclusão automática da conta; para solicitar exclusão dos dados no servidor, contate a equipe responsável pelo projeto. O canal de atendimento deve ser definido antes de disponibilizar o serviço ao público.</p>
        <p>Não há recursos de venda de dados, publicidade ou análise de audiência nesta versão. Esta página descreve o funcionamento implementado e não representa certificação de conformidade.</p>
      </> : <>
        <h2 className="mt-5">Finalidade</h2>
        <p>O MEDControl é um projeto acadêmico para organizar a rotina informada por você. Utilize os medicamentos, doses e horários orientados pelo profissional de saúde. O app não prescreve, não recomenda substituições e não é um serviço de emergência.</p>
        <h2 className="mt-5">Registros e lembretes</h2>
        <p>Confirme uma tomada somente depois de realizá-la e confira o estoque físico. A previsão de reposição usa os horários atuais. Os lembretes dependem da conexão, da permissão e do funcionamento do aparelho e do navegador; sua pontualidade e entrega não são garantidas.</p>
        <h2 className="mt-5">Mapas e catálogo</h2>
        <p>Os mapas ajudam a encontrar estabelecimentos e não confirmam disponibilidade de medicamento, preço ou participação em programas públicos. Confira essas informações com a farmácia. O catálogo da Anvisa ajuda a reconhecer o nome cadastrado e não valida uma prescrição.</p>
        <p>O uso dos recursos Google Maps está sujeito também aos <a className="text-link" href="https://maps.google.com/help/terms_maps/" target="_blank" rel="noopener noreferrer">Termos de Serviço adicionais do Google Maps/Google Earth</a>. Dados de estabelecimentos podem estar incompletos ou desatualizados. A lista de farmácias do MEDControl usa dados públicos do OpenStreetMap, com atribuição aos seus colaboradores.</p>
        <h2 className="mt-5">Versão de apresentação</h2>
        <p>Esta versão está em validação acadêmica. Antes de uso público, são necessários configuração de hospedagem HTTPS, envio de e-mails, canal de suporte e testes em aparelhos reais. A demonstração contém exemplos fictícios e não deve receber informações pessoais de saúde.</p>
      </>}
      <h2 className="mt-5">Serviços e informações relacionadas</h2>
      <ul>
        <li><a className="text-link" href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Política de Privacidade do Google</a></li>
        <li><a className="text-link" href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer">Privacidade do Supabase</a></li>
        <li><a className="text-link" href="https://ovp.dresel.systems/impressum.html" target="_blank" rel="noopener noreferrer">Política do Overpass Dresel</a></li>
        <li><a className="text-link" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">Atribuição OpenStreetMap</a></li>
      </ul>
      <p className="mt-5"><Link className="text-link" to={privacy ? '/termos' : '/privacidade'}>{privacy ? 'Condições de uso' : 'Privacidade e seus dados'}</Link></p>
      <Link className="btn secondary mt-5" to="/">Voltar ao MEDControl</Link>
    </article>
  </main>
}
