import { motion } from 'framer-motion'
import { Pill } from 'lucide-react'
import { TodayOverview } from '../components/dashboard/TodayOverview'
import { TodaySchedule } from '../components/dashboard/TodaySchedule'
import { LowStockBanner } from '../components/medication/LowStockBanner'
import { FilterBar } from '../components/medication/FilterBar'
import { MedicationStockRow } from '../components/medication/MedicationStockRow'
import { EmptyState } from '../components/common/EmptyState'
import { WelcomeGuide } from '../components/common/WelcomeGuide'
import { Header } from '../components/layout/Header'
import { useMedications } from '../contexts/MedicationContext'
import { formatDateLong } from '../utils/dates'

export function Home() {
  const { user, medications, filteredMedications, filter } = useMedications()
  const todayLabel = formatDateLong(new Date())

  const emptyDescription =
    filter === 'alert'
      ? 'Nenhum remédio precisa de reposição agora.'
      : filter === 'ok'
        ? 'Nenhum remédio com estoque em dia.'
        : 'Toque em Adicionar para cadastrar seu primeiro remédio.'

  const headerTitle = user ? `Olá, ${user.name}` : 'MEDControl'

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Header
        title={headerTitle}
        subtitle={`${todayLabel} · Sua rotina de hoje`}
      />

      <div className="flex-1 overflow-y-auto px-4 py-5 md:px-6">
        <div className="mx-auto max-w-3xl space-y-6">
          {medications.length === 0 && <WelcomeGuide />}

          {medications.length > 0 && (
            <>
              <LowStockBanner />
              <TodayOverview />
              <TodaySchedule />

              <div>
                <div className="mb-3 flex items-center gap-2">
                  <Pill size={22} className="text-primary-600" />
                  <div>
                    <h2 className="text-lg font-bold text-slate-800">Estoque dos remédios</h2>
                    <p className="text-sm text-slate-500">
                      Quantidade na caixa e horários cadastrados
                    </p>
                  </div>
                </div>
                <FilterBar />

                {filteredMedications.length === 0 ? (
                  <div className="mt-4">
                    <EmptyState
                      medIcon="pill"
                      title="Nenhum remédio aqui"
                      description={emptyDescription}
                    />
                  </div>
                ) : (
                  <motion.div layout className="mt-4 space-y-3">
                    {filteredMedications.map((med, i) => (
                      <motion.div
                        key={med.id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04 }}
                      >
                        <MedicationStockRow medication={med} />
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
