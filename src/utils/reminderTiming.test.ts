import { describe, expect, it } from 'vitest'
import { reminderCandidates, reminderClaimTime } from '../../supabase/functions/_shared/reminderTiming'

describe('five-minute and on-time notification candidates', () => {
  it('targets both stages separately and limits catch-up to two minutes', () => {
    const candidates = reminderCandidates(new Date('2026-11-24T13:55:30Z'), 'America/Sao_Paulo')
    expect(candidates.filter(c => c.kind === 'advance').map(c => c.time)).toEqual(['11:00','10:59','10:58'])
    expect(candidates.filter(c => c.kind === 'due').map(c => c.time)).toEqual(['10:55','10:54','10:53'])
    expect(candidates.every(c => c.day === '2026-11-24')).toBe(true)
    expect(reminderClaimTime({ kind: 'due', time: '11:00' })).toBe('11:00')
    expect(reminderClaimTime({ kind: 'advance', time: '11:00' })).toBe('before:11:00')
  })
  it('reserves the next dose date when the advance notice crosses midnight', () => {
    const candidate = reminderCandidates(new Date('2026-11-24T02:55:00Z'), 'America/Sao_Paulo').find(c => c.kind === 'advance' && c.time === '00:00')
    expect(candidate).toEqual({ kind: 'advance', day: '2026-11-24', time: '00:00' })
  })
  it('keeps the previous dose date during catch-up after midnight', () => {
    expect(reminderCandidates(new Date('2026-11-24T03:01:00Z'), 'America/Sao_Paulo')).toContainEqual({ kind: 'due', day: '2026-11-23', time: '23:59' })
  })
  it('handles year rollover and a timezone clock jump using elapsed minutes', () => {
    expect(reminderCandidates(new Date('2026-12-31T23:55:00Z'), 'UTC')).toContainEqual({ kind: 'advance', day: '2027-01-01', time: '00:00' })
    expect(reminderCandidates(new Date('2026-03-08T06:58:00Z'), 'America/New_York')).toContainEqual({ kind: 'advance', day: '2026-03-08', time: '03:03' })
  })
})
