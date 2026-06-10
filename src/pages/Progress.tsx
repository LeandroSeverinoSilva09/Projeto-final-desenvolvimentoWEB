import { BarChart3, Calendar, Flame, Pill } from 'lucide-react'
import { AdherenceSummary } from '../components/dashboard/AdherenceSummary'
import { MedicationProgressList } from '../components/dashboard/MedicationProgressList'
import { StreakWidget } from '../components/dashboard/StreakWidget'
import { WeekCalendar } from '../components/dashboard/WeekCalendar'
import { Header } from '../components/layout/Header'
import { useMedications } from '../contexts/MedicationContext'

function SectionHeader({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof BarChart3
  title: string
  description: string
}) {
  return (
    <div className="mb-3 flex items-start gap-3">
      <div className="rounded-xl bg-primary-50 p-2 text-primary-600">
        <Icon size={20} />
      </div>
      <div>
        <h2 className="text-lg font-bold text-slate-800">{title}</h2>
        <p className="text-sm text-slate-500">{description}</p>
      </div>
    </div>
  )
}

export function Progress() {
  const { medications } = useMedications()

  if (medications.length === 0) {
    return (
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header title="Status" subtitle="Acompanhe seu tratamento" />
        <div className="flex flex-1 items-center justify-center px-6 text-center text-slate-500">
          Cadastre remédios na tela Início para ver seu progresso aqui.
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Header
        title="Status do tratamento"
        subtitle="Relatório da semana, adesão e estoque"
      />

      <div className="flex-1 overflow-y-auto px-4 py-5 md:px-6">
        <div className="mx-auto max-w-3xl space-y-8">
          <section>
            <SectionHeader
              icon={BarChart3}
              title="Resumo geral"
              description="Percentual de adesão nos últimos 7 dias"
            />
            <AdherenceSummary />
          </section>

          <section>
            <SectionHeader
              icon={Calendar}
              title="Histórico da semana"
              description="Toque em cada dia para ver o que foi tomado"
            />
            <WeekCalendar />
          </section>

          <section>
            <SectionHeader
              icon={Flame}
              title="Sequência de dias"
              description="Quantos dias seguidos você tomou tudo"
            />
            <StreakWidget />
          </section>

          <section>
            <SectionHeader
              icon={Pill}
              title="Desempenho por remédio"
              description="Doses na semana e estoque de cada medicamento"
            />
            <MedicationProgressList />
          </section>
        </div>
      </div>
    </div>
  )
}
