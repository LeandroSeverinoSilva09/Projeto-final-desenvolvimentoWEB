import { describe, expect, it } from 'vitest'
import { parseScheduleTimes } from './dates'

describe('parseScheduleTimes', () => {
  it('accepts only valid 24-hour clock times and sorts them', () => {
    expect(parseScheduleTimes('23:59, 00:00, 12:30, 24:00, 8:00, 08:60, -1:00, 12:3, abc'))
      .toEqual(['00:00', '12:30', '23:59'])
  })

  it('removes duplicates and blank entries without creating an extra dose', () => {
    expect(parseScheduleTimes(' 08:00 , ,08:00, 20:00,20:00, ')).toEqual(['08:00', '20:00'])
    expect(parseScheduleTimes(' , invalid, ')).toEqual([])
  })
})
