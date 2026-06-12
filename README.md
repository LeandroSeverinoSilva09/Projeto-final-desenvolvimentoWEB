# MEDControl

Gerenciador de medicamentos pensado para **facilidade de uso**, especialmente por idosos e pacientes com tratamento contínuo.

## O que o app faz

| Tela | Para que serve |
|---|---|
| **Início** | Mostra o que tomar hoje, com botão grande "Já tomei" |
| **Adicionar** | Cadastra remédio, dose, horários e estoque |
| **Status** | Resumo simples: calendário da semana, adesão e estoque |
| **Histórico** | Lista de todas as doses confirmadas |

## Destaques de usabilidade

- **Calendário semanal** com cores fáceis de entender:
  - Verde = tomou tudo
  - Amarelo = tomou alguns
  - Vermelho = esqueceu
- **Alerta de reposição** calculado pelo consumo diário (avisa 3 dias antes de acabar)
- **Caixinha visual** com medidor proporcional (funciona com 20 ou 60 unidades)
- **Modal no horário** pedindo para tomar o remédio
- **Textos grandes**, botões amplos e ícones claros

## Tecnologias

React 19 · TypeScript · Vite · Tailwind CSS · React Router · Lucide React · Framer Motion · date-fns · PWA · localStorage · Vercel

## Como rodar

```bash
npm install
npm run dev
```

Acesse `http://localhost:5173`

```bash
npm run build   # build de produção
```

## Estrutura

```
src/
├── pages/          Login, Home, Status, Histórico, Adicionar
├── components/     UI reutilizável (calendário, caixinha, modais)
├── contexts/       Estado global + localStorage
└── utils/          Cálculos de estoque, adesão e horários
```

## Equipe

Projeto desenvolvido pela equipe abaixo como trabalho de **Desenvolvimento Web**.

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

**Repositório:** [github.com/LeandroSeverinoSilva09/Projeto-final-desenvolvimentoWEB](https://github.com/LeandroSeverinoSilva09/Projeto-final-desenvolvimentoWEB)

---

> *MEDControl: porque cada dose no horário certo faz toda a diferença.*
