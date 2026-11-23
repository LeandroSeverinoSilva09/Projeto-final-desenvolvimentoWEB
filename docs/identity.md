# Identidade do MEDControl

## Conceito

**Cada cuidado conta.** A solução apoia pequenos cuidados cotidianos com autonomia. A linguagem conversa com a pessoa que toma o medicamento, evitando termos clínicos e administrativos desnecessários.

O símbolo próprio combina uma **cápsula e um relógio**: medicamento e tempo. Está em `public/brand-mark.svg` e `src/components/common/BrandMark.tsx`. A embalagem com cruz e os pequenos elementos de rotina formam a ilustração do produto; não representam uma marca ou prescrição comercial.

## Sistema visual

| Uso | Cor |
|---|---|
| Ação principal e marca | Verde petróleo `#087F83` |
| Texto principal | Azul profundo `#193544` |
| Texto de apoio | `#526B76` |
| Superfície geral | `#F5F7FA` |
| Rotina e cuidado | Verde claro `#EAF5F2` |
| Reposição | Amarelo claro com texto escuro |

Manrope dá unidade a títulos, botões e textos. O sistema mantém fontes locais de reserva. A cor nunca é a única indicação de estado: “Tomei”, “Aguardar”, “Estoque insuficiente” e “Repor em breve” acompanham ícones e ações.

## Decisões para o telefone

- A marca e “Como usar” ficam no topo; rotina, remédios, farmácias, histórico e ajustes ficam na navegação inferior.
- O próximo cuidado usa um horário grande. A agenda permite confirmar apenas os horários que já chegaram.
- O cadastro divide as informações em três etapas, com resumo antes de salvar. A pesquisa da Anvisa é opcional e não altera a dose.
- A localização é opcional. Buscar por cidade/CEP continua disponível quando a permissão é negada.
- Os campos usam teclados adequados a e-mail, números e horários. As ações principais têm texto e ícone.
- A ampliação de texto é uma preferência do aparelho; a ajuda oferece um caminho explícito para cada ação.
- O ambiente fictício sempre mostra “Modo demonstração”. Uma conta real começa sem remédios inventados.

A revisão estática de contraste e o roteiro para leitores de tela estão em `accessibility-review.md`. A validação com participantes idosos e pessoas com baixa familiaridade digital é uma etapa de pesquisa a realizar; não foi simulada como estudo concluído.
