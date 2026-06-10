import { motion } from 'framer-motion'
import { BarChart3, CheckCircle2, MinusCircle, XCircle } from 'lucide-react'
import { useMemo } from 'react'
import { useMedications } from '../../contexts/MedicationContext'
import { ADHERENCE_LABELS, getWeeklyAdherence } from '../../utils/adherence'
import { Card } from '../common/Card'

export function AdherenceSummary() {
  const { medications, history } = useMedications()
  const summary = useMemo(
    () => getWeeklyAdherence(medications, history),
    [medications, history]
  )

  return (
    <Card className="!p-0 overflow-hidden">
      <div className="flex items-center gap-3 bg-gradient-to-r from-primary-600 to-primary-700 px-5 py-4">
        <BarChart3 size={28} className="text-white" />
        <div>
          <h2 className="text-xl font-bold text-white">Adesão na semana</h2>
          <p className="text-sm text-blue-100">Quanto do tratamento foi seguido</p>
        </div>
      </div>

      <div className="p-5">
        <div className="mb-4 text-center">
          <p className="text-5xl font-extrabold text-primary-600">{summary.percentage}%</p>
          <p className="mt-1 text-base font-semibold text-slate-600">
            {summary.totalTaken} doses tomadas de {summary.totalExpected} previstas
          </p>
        </div>

        <div className="mb-4 h-4 overflow-hidden rounded-full bg-slate-200">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${summary.percentage}%` }}
            transition={{ duration: 0.8 }}
            className={`h-full rounded-full ${
              summary.percentage >= 80
                ? 'bg-emerald-500'
                : summary.percentage >= 50
                  ? 'bg-amber-500'
                  : 'bg-red-500'
            }`}
          />
        </div>

        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="flex flex-col items-center rounded-xl bg-emerald-50 p-3">
            <CheckCircle2 size={20} className="text-emerald-600" />
            <p className="mt-1 text-2xl font-extrabold text-emerald-600">{summary.completeDays}</p>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              {ADHERENCE_LABELS.complete.short}
            </p>
          </div>
          <div className="flex flex-col items-center rounded-xl bg-amber-50 p-3">
            <MinusCircle size={20} className="text-amber-600" />
            <p className="mt-1 text-2xl font-extrabold text-amber-600">{summary.partialDays}</p>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              {ADHERENCE_LABELS.partial.short}
            </p>
          </div>
          <div className="flex flex-col items-center rounded-xl bg-red-50 p-3">
            <XCircle size={20} className="text-red-600" />
            <p className="mt-1 text-2xl font-extrabold text-red-600">{summary.missedDays}</p>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              {ADHERENCE_LABELS.none.short}
            </p>
          </div>
        </div>
      </div>
    </Card>
  )
}
