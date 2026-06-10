import { AdherenceSummary } from '../components/dashboard/AdherenceSummary'
import { MedicationProgressList } from '../components/dashboard/MedicationProgressList'
import { StreakWidget } from '../components/dashboard/StreakWidget'
import { WeekCalendar } from '../components/dashboard/WeekCalendar'
import { Header } from '../components/layout/Header'

export function Progress() {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Header
        title="Status"
        subtitle="Veja como está indo seu tratamento"
      />

      <div className="flex-1 overflow-y-auto px-4 py-5 md:px-6">
        <div className="mx-auto max-w-3xl space-y-6">
          <AdherenceSummary />
          <WeekCalendar />
          <StreakWidget />
          <MedicationProgressList />
        </div>
      </div>
    </div>
  )
}
