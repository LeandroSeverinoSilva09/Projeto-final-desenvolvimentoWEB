import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { describe, expect, it, vi } from 'vitest'

const source = readFileSync(new URL('../../public/push-sw.js', import.meta.url), 'utf8')
async function pushed(data: Record<string, unknown>) {
  const listeners: Record<string, (event: unknown) => void> = {}
  const showNotification = vi.fn().mockResolvedValue(undefined)
  let delivery: Promise<unknown> | undefined
  runInNewContext(source, { self: { addEventListener: (name: string, handler: (event: unknown) => void) => { listeners[name] = handler }, registration: { showNotification } } })
  listeners.push({ data: { json: () => data }, waitUntil: (promise: Promise<unknown>) => { delivery = promise } })
  await delivery
  return showNotification.mock.calls[0]
}
describe('push presentation uses distinct private-safe messages', () => {
  it('distinguishes advance and due notices while preserving their separate tags', async () => {
    const advance = await pushed({ kind: 'advance', time: '10:00', tag: 'advance-safe' })
    const due = await pushed({ kind: 'due', time: '10:00', tag: 'due-safe' })
    expect(advance[0]).toBe('Prepare-se para seu cuidado');expect(due[0]).toBe('Seu cuidado tem hora')
    expect(advance[1]).toMatchObject({tag:'advance-safe',body:expect.stringContaining('10:00'),data:{url:'/'}})
    expect(due[1]).toMatchObject({tag:'due-safe',body:expect.stringContaining('Chegou'),data:{url:'/'}})
  })
  it('ignores arbitrary message/name content and malformed times', async () => {
    const notice=await pushed({kind:'advance',time:'invalid time',name:'private medicine',body:'private dose'})
    expect(JSON.stringify(notice)).not.toMatch(/private|invalid time/)
    expect(notice[1].body).toContain('próximo horário')
  })
  it('keeps legacy due pushes and stock reminders working', async () => {
    expect((await pushed({}))[0]).toBe('Seu cuidado tem hora')
    expect((await pushed({kind:'stock'}))[1].data.url).toBe('/farmacias')
  })
})
