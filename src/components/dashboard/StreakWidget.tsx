import { motion } from 'framer-motion'
import { Flame } from 'lucide-react'
import { useMedications } from '../../contexts/MedicationContext'
import { Card } from '../common/Card'

export function StreakWidget() {
  const { stats } = useMedications()
  const streak = stats.streakCount

  return (
    <Card>
      <div className="flex items-center gap-4">
        <motion.div
          animate={streak > 0 ? { scale: [1, 1.08, 1] } : {}}
          transition={{ repeat: Infinity, duration: 2 }}
          className={`rounded-2xl p-3 ${
            streak > 0
              ? 'bg-gradient-to-br from-orange-400 to-red-500 text-white'
              : 'bg-slate-100 text-slate-400'
          }`}
        >
          <Flame size={28} />
        </motion.div>
        <div>
          <p className="text-4xl font-extrabold text-slate-800">
            {streak}{' '}
            <span className="text-xl text-slate-500">{streak === 1 ? 'dia' : 'dias'}</span>
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {streak > 0
              ? 'Dias seguidos tomando todos os remédios'
              : 'Tome todos os remédios do dia para começar'}
          </p>
        </div>
      </div>
    </Card>
  )
}
