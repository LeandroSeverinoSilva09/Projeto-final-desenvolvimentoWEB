/* Loaded by the generated Workbox service worker. No medication details on lock screens. */
self.addEventListener('push', event => {
  let data = {}
  try { data = event.data?.json() || {} } catch { /* use the private fallback below */ }
  const stock = data.kind === 'stock'
  event.waitUntil(self.registration.showNotification(stock ? 'Vamos planejar sua reposição?' : 'Seu cuidado tem hora', {
    body: stock ? 'Há medicamento com estoque baixo. Veja farmácias próximas no MEDControl.' : 'Você tem um medicamento agendado. Abra o MEDControl para conferir.',
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
