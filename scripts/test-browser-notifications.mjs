// Native desktop notification check. Requires a dedicated Chrome with a CDP port.
// All permissions, data and pages belong to a new disposable browser context.
import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'

const portIndex = process.argv.indexOf('--port')
const port = portIndex >= 0 ? process.argv[portIndex + 1] : '9337'
assert(/^\d+$/.test(port), 'Informe uma porta CDP numerica com --port.')
const origin = 'http://127.0.0.1:5173'
const version = await fetch(`http://127.0.0.1:${port}/json/version`).then(r => r.json())
const socket = new WebSocket(version.webSocketDebuggerUrl)
await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }) })
const pending = new Map()
const pushRequests = []
let nextId = 0
socket.addEventListener('message', ({ data }) => {
  const message = JSON.parse(String(data))
  if (message.method === 'Network.requestWillBeSent') {
    const request = message.params.request
    if (new URL(request.url).pathname.includes('/push_subscriptions')) pushRequests.push({ method: request.method, path: new URL(request.url).pathname })
  }
  if (!message.id) return
  const request = pending.get(message.id)
  if (!request) return
  pending.delete(message.id); clearTimeout(request.timer)
  if (message.error) request.reject(new Error(message.error.message))
  else request.resolve(message.result)
})
function command(method, params = {}, sessionId) {
  const id = ++nextId
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Timeout: ${method}`)) }, 15000)
    pending.set(id, { resolve, reject, timer })
    socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }))
  })
}
const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))
const { browserContextId } = await command('Target.createBrowserContext')
let report
try {
  await command('Browser.grantPermissions', { browserContextId, origin, permissions: ['notifications'] })
  const { targetId } = await command('Target.createTarget', { browserContextId, url: 'about:blank' })
  const { sessionId } = await command('Target.attachToTarget', { targetId, flatten: true })
  const page = (method, params) => command(method, params, sessionId)
  const evaluate = async expression => {
    const result = await page('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text)
    return result.result.value
  }
  const waitFor = async (expression, timeout = 10000) => {
    const deadline = Date.now() + timeout
    while (Date.now() < deadline) {
      const result = await evaluate(expression)
      if (result) return result
      await pause(250)
    }
    throw new Error(`Condicao nao confirmada: ${expression}`)
  }
  await page('Runtime.enable')
  await page('Network.enable')
  await page('Page.enable')
  await page('Page.addScriptToEvaluateOnNewDocument', { source: `
    window.__eccEvents = []; window.__eccNotices = [];
    const NativeNotification = window.Notification;
    window.Notification = class extends NativeNotification {
      constructor(title, options) {
        super(title, options);
        window.__eccNotices.push(this);
        const record = type => window.__eccEvents.push({type,title,tag:options?.tag,time:new Date().toISOString()});
        record('created');
        this.addEventListener('show', () => record('show'));
        this.addEventListener('error', () => record('error'));
      }
    };
  ` })
  await page('Page.navigate', { url: `${origin}/login` })
  await waitFor('!!document.querySelector(".demo-button")')
  assert.equal(await evaluate('Array.isArray(window.__eccEvents)'), true, 'A observacao dos eventos nativos precisa estar ativa.')
  assert.equal(await evaluate('Notification.permission'), 'granted')
  const scheduledTime = await evaluate(`(() => {
    const now = new Date(), next = new Date(Date.now() + 60000);
    const schedule = String(next.getHours()).padStart(2,'0') + ':' + String(next.getMinutes()).padStart(2,'0');
    localStorage.removeItem('medcontrol-notifications-disabled');
    sessionStorage.setItem('medcontrol_demo_data', JSON.stringify({user:null,medications:[{id:'ecc-native-notification',name:'Teste ficticio ECC',dose:'Teste',current:10,total:10,schedules:schedule,frequency:24,takenCount:0,unitsPerDose:1,createdAt:now.toISOString()}],history:[],stats:{streakCount:0,lastStreakDate:null,totalDoses:0}}));
    document.querySelector('.demo-button').click();
    return schedule;
  })()`)
  await waitFor('[...document.querySelectorAll("button")].some(b=>b.textContent==="Testar aviso local")')
  await evaluate('[...document.querySelectorAll("button")].find(b=>b.textContent==="Testar aviso local").click()')
  await waitFor('window.__eccEvents.some(e=>e.type==="show" && e.title==="Teste de aviso local")')
  console.log(JSON.stringify({ check: 'manual_native_notification', result: 'show_event', scheduledTime }))
  await waitFor('window.__eccEvents.some(e=>e.type==="show" && e.title==="Seu cuidado tem hora")', 90000)
  console.log(JSON.stringify({ check: 'scheduled_native_notification', result: 'show_event' }))
  await pause(16000)
  const events = await evaluate('window.__eccEvents')
  assert.equal(events.filter(e => e.type === 'show' && e.title === 'Seu cuidado tem hora').length, 1, 'O lembrete deve aparecer uma unica vez.')
  await evaluate('window.__eccNotices.forEach(n=>n.close()); history.pushState({},"","/configuracoes"); dispatchEvent(new PopStateEvent("popstate"))')
  await waitFor('[...document.querySelectorAll("button")].some(b=>b.textContent==="Desativar notificações")')
  await evaluate('[...document.querySelectorAll("button")].find(b=>b.textContent==="Desativar notificações").click()')
  await waitFor('localStorage.getItem("medcontrol-notifications-disabled")==="true"')
  await evaluate(`(() => {
    const state=JSON.parse(sessionStorage.getItem('medcontrol_demo_data'));
    const now=new Date();state.medications[0].id='ecc-disabled-notification';
    state.medications[0].schedules=String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0');
    sessionStorage.setItem('medcontrol_demo_data',JSON.stringify(state));
  })()`)
  await page('Page.reload')
  await waitFor('!!document.querySelector(".notification-panel")')
  await pause(16000)
  assert.equal((await evaluate('window.__eccEvents')).length, 0, 'Desativar deve impedir novas notificacoes.')
  assert.equal(pushRequests.length, 0, 'A demonstracao nao deve consultar ou cadastrar inscricoes remotas.')
  report = { checkedAt: new Date().toISOString(), origin, browser: version.Browser, permissionGrantedInDisposableContext: true, api: 'native Notification with real show events', scheduledTime, events, duplicateCheck: 'passed', disabledCheck: 'passed', pushSubscriptionRequests: pushRequests, osBannerVisuallyConfirmed: false }
  await writeFile('/tmp/medcontrol-native-notifications.json', JSON.stringify(report, null, 2))
  console.log(JSON.stringify({ result: 'passed', report: '/tmp/medcontrol-native-notifications.json', nativeShowEvents: events.filter(e=>e.type==='show').length, duplicateCheck: report.duplicateCheck, disabledCheck: report.disabledCheck, pushSubscriptionRequests: 0 }))
} finally {
  await command('Target.disposeBrowserContext', { browserContextId }).catch(() => {})
  socket.close()
}
