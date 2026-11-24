// Shared by the open-app scheduler and the server dispatcher. No patient details.
export type ReminderKind = 'advance' | 'due'
export interface ReminderCandidate { day: string; time: string; kind: ReminderKind }
export const ADVANCE_MINUTES = 5
export const REMINDER_GRACE_MINUTES = 2

export function localParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date)
  const p = Object.fromEntries(parts.map(value => [value.type, value.value]))
  return { day: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` }
}

export function reminderCandidates(now: Date, timezone: string): ReminderCandidate[] {
  const candidates: ReminderCandidate[] = []
  for (const kind of ['due', 'advance'] as const) {
    for (let delay = 0; delay <= REMINDER_GRACE_MINUTES; delay++) {
      const offset = (kind === 'advance' ? ADVANCE_MINUTES : 0) - delay
      // Convert the target instant, not a hand-built local date, across midnight/DST.
      candidates.push({ ...localParts(new Date(now.getTime() + offset * 60000), timezone), kind })
    }
  }
  return candidates
}

export function reminderClaimTime(candidate: Pick<ReminderCandidate, 'kind' | 'time'>): string {
  // Keep existing on-time claims compatible. The advance alert gets its own lease.
  return candidate.kind === 'advance' ? `before:${candidate.time}` : candidate.time
}

export function reminderMessage(kind: ReminderKind, time: string) {
  return kind === 'advance'
    ? { title: 'Prepare-se para seu cuidado', body: `Seu medicamento está agendado para ${time}. Prepare-se para esse horário.` }
    : { title: 'Seu cuidado tem hora', body: `Chegou seu horário de medicamento, agendado para ${time}. Abra o MEDControl para conferir.` }
}
