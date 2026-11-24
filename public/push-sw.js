/* Loaded by the generated Workbox service worker. No medication details on lock screens. */
self.addEventListener('push', event => {
  let data = {}
  try { data = event.data?.json() || {} } catch { /* use the private fallback below */ }
  const stock = data.kind === 'stock'
  const advance = data.kind === 'advance'
  const time = typeof data.time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(data.time) ? data.time : null
  const title = stock ? 'Vamos planejar sua reposição?' : advance ? 'Prepare-se para seu cuidado' : 'Seu cuidado tem hora'
  let body = 'Você tem um medicamento agendado. Abra o MEDControl para conferir.'
  if (stock) body = 'Há medicamento com estoque baixo. Veja farmácias próximas no MEDControl.'
  else if (advance) body = time ? `Seu medicamento está agendado para ${time}. Prepare-se para esse horário.` : 'Seu próximo horário de medicamento está chegando. Abra o MEDControl para conferir.'
  else if (time) body = `Chegou seu horário de medicamento, agendado para ${time}. Abra o MEDControl para conferir.`
  event.waitUntil(self.registration.showNotification(title, {
    body,
    icon: '/icons/icon-192.png', badge: '/pill.svg',
    tag: typeof data.tag === 'string' ? data.tag : 'medcontrol-dose',
    data: { url: stock ? '/farmacias' : '/' },
  }))
})
self.addEventListener('notificationclick', event => {
  event.notification.close()
  event.waitUntil((async () => {
    const path = event.notification.data?.url === '/farmacias' ? '/farmacias' : '/'
    const tabs = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const existing = tabs.find(tab => new URL(tab.url).origin === self.location.origin)
    if (existing) { await existing.navigate(path); return existing.focus() }
    return self.clients.openWindow(path)
  })())
})
