import { motion } from 'framer-motion'
import { Calendar, CheckCircle2 } from 'lucide-react'
import { useMemo } from 'react'
import { EmptyState } from '../components/common/EmptyState'
import { Header } from '../components/layout/Header'
import { MedIcon3D } from '../components/medication/MedIcon3D'
import { useMedications } from '../contexts/MedicationContext'
import { getTodayKey } from '../utils/dates'
import { groupHistoryByDate } from '../utils/schedule'

export function History() {
  const { history } = useMedications()
  const grouped = useMemo(() => groupHistoryByDate(history), [history])
  const today = getTodayKey()

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Header
        title="Histórico"
        subtitle="Todas as doses que você confirmou"
      />

      <div className="flex-1 overflow-y-auto px-4 py-5 md:px-6">
        <div className="mx-auto max-w-3xl space-y-5">
          {grouped.length === 0 ? (
            <EmptyState
              icon={Calendar}
              title="Nenhuma dose registrada"
              description="Quando você tocar em Já tomei na tela Início, as doses aparecerão aqui."
            />
          ) : (
            grouped.map((group, groupIndex) => (
              <section key={group.date}>
                <div className="mb-3 flex items-center gap-2">
                  <Calendar size={16} className="text-slate-500" />
                  <h2 className="text-lg font-bold text-slate-800">{group.date}</h2>
                  {group.date === today && (
                    <span className="rounded-full bg-primary-100 px-2 py-0.5 text-xs font-bold text-primary-700">
                      Hoje
                    </span>
                  )}
                  <span className="text-sm text-slate-400">
                    {group.records.length} {group.records.length === 1 ? 'dose' : 'doses'}
                  </span>
                </div>

                <div className="space-y-3">
                  {group.records.map((record, index) => (
                    <motion.div
                      key={record.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: groupIndex * 0.1 + index * 0.03 }}
                      className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"
                    >
                      <MedIcon3D dose={record.dose} size="sm" />

                      <div className="min-w-0 flex-1">
                        <p className="text-lg font-bold text-slate-800">{record.name}</p>
                        <p className="text-sm text-slate-500">{record.dose}</p>
                      </div>

                      <div className="flex items-center gap-1.5 text-base font-bold text-emerald-600">
                        <CheckCircle2 size={16} />
                        {record.time}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
