// Local browser QA in a disposable demo context. Run with a dedicated Chrome CDP port.
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'

const portAt = process.argv.indexOf('--port')
const port = portAt < 0 ? '9338' : process.argv[portAt + 1]
assert(/^\d+$/.test(port), 'Informe uma porta CDP numerica.')
const origin = 'http://127.0.0.1:5173'
const { webSocketDebuggerUrl } = await fetch(`http://127.0.0.1:${port}/json/version`).then(r => r.json())
const socket = new WebSocket(webSocketDebuggerUrl)
await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }) })
let sequence = 0
const pending = new Map()
socket.addEventListener('message', ({ data }) => {
  const message = JSON.parse(String(data)), request = pending.get(message.id)
  if (!request) return
  pending.delete(message.id); clearTimeout(request.timer)
  if (message.error) request.reject(new Error(message.error.message))
  else request.resolve(message.result)
})
function command(method, params = {}, sessionId) {
  const id = ++sequence
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Timeout: ${method}`)) }, 15000)
    pending.set(id, { resolve, reject, timer })
    socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }))
  })
}
const pause = ms => new Promise(resolve => setTimeout(resolve, ms))
const cases = [], apiRequests = [], errors = []
const { browserContextId } = await command('Target.createBrowserContext')
let sessionId, scenario = 'setup'
socket.addEventListener('message', ({ data }) => {
  const m = JSON.parse(String(data))
  if (m.sessionId !== sessionId) return
  if (m.method === 'Network.responseReceived' && /ovp\.dresel|photon\.komoot/.test(m.params.response.url)) apiRequests.push({ scenario, url: m.params.response.url, status: m.params.response.status })
  if (m.method === 'Runtime.exceptionThrown') errors.push({ scenario, message: m.params.exceptionDetails.text })
})
try {
  const { targetId } = await command('Target.createTarget', { browserContextId, url: 'about:blank' })
  sessionId = (await command('Target.attachToTarget', { targetId, flatten: true })).sessionId
  const page = (method, params) => command(method, params, sessionId)
  const evaluate = async expression => {
    const result = await page('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text)
    return result.result.value
  }
  const waitFor = async (expression, timeout = 30000) => {
    const end = Date.now() + timeout
    while (Date.now() < end) { if (await evaluate(expression)) return; await pause(100) }
    throw new Error(`Timeout em ${scenario}: ${expression}`)
  }
  const click = selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`)
  const input = (id, value) => evaluate(`(() => {const e=document.getElementById(${JSON.stringify(id)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`)
  const open = async name => {
    scenario = name
    await page('Page.navigate', { url: origin + '/farmacias' })
    await waitFor('!!document.querySelector(".pharmacy-page")')
    await evaluate('document.querySelector(".pharmacy-in-app").open=true')
    await pause(50)
  }
  const locate = () => evaluate('[...document.querySelectorAll("button")].find(e=>e.textContent.includes("Usar minha localização")).click()')
  const idle = () => waitFor('!document.querySelector(".pharmacy-cancel,.pharmacy-cancel-location")')
  const snapshot = () => evaluate(`(() => ({ page:!!document.querySelector('.pharmacy-page'), navigation:!!document.querySelector('.mobile-nav'), manualEnabled:!document.querySelector('#pharmacy-place')?.disabled, error:document.querySelector('.pharmacy-search-panel [role=alert]')?.textContent||null, cards:document.querySelectorAll('.pharmacy-card').length, status:document.querySelector('.pharmacy-status')?.textContent, location:document.querySelector('.pharmacy-location')?.textContent||null, mockRequests:window.__qaRequests||[] }))()`)
  const finish = async (extra = {}) => {
    const state = await snapshot()
    assert(state.page && state.navigation, `A tela e a navegacao devem continuar disponiveis: ${scenario}`)
    cases.push({ scenario, ...state, ...extra })
    console.log(JSON.stringify({ scenario, result: 'passed', cards: state.cards }))
    return state
  }
  const mockApi = () => evaluate(`(() => {
    window.__qaRequests=[];const nativeFetch=window.fetch.bind(window);
    window.fetch=async(url,init={})=>{const address=String(url);if(!/ovp\.dresel|photon\.komoot/.test(address))return nativeFetch(url,init);window.__qaRequests.push({url:address,body:String(init.body||'')});
      if(window.__qaHttpFailure)return new Response('{}',{status:503});
      if(window.__qaInvalidJson)return new Response('<html>not json</html>',{status:200});
      const value=address.includes('photon')?{features:[{geometry:{type:'Point',coordinates:[-47.06,-22.906]},properties:{countrycode:'BR',name:'Campinas',state:'Sao Paulo'}}]}:{elements:window.__qaEmpty?[]:[{type:'node',id:999,lat:-22.9061,lon:-47.0601,tags:{amenity:'pharmacy',name:'Farmacia ficticia QA','addr:street':'Rua de exemplo','addr:housenumber':'10',phone:'(19) 3333-4444'}}]};return new Response(JSON.stringify(value),{status:200,headers:{'Content-Type':'application/json'}});
    };
  })()`)
  await page('Page.enable'); await page('Runtime.enable'); await page('Network.enable')
  await page('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
  await page('Emulation.setGeolocationOverride', { latitude: -22.90612, longitude: -47.06012, accuracy: 35 })
  await command('Browser.grantPermissions', { browserContextId, origin, permissions: ['geolocation'] })
  await page('Page.navigate', { url: origin + '/login' })
  await waitFor('!!document.querySelector(".demo-button")')
  await click('.demo-button'); await waitFor('!!document.querySelector(".routine-heading")')

  await open('native_geolocation_real_public_api')
  await locate(); await idle()
  let state = await snapshot()
  assert(state.cards > 0, `A consulta real deve retornar farmacias: ${JSON.stringify(state)}`)
  assert(!state.error)
  await finish({ coordinatesEmulated: true, apiMocked: false })

  await command('Browser.setPermission', { browserContextId, origin, permission: { name: 'geolocation' }, setting: 'denied' })
  await open('native_permission_denied_manual_fallback')
  await locate(); await idle(); state = await snapshot()
  assert(state.error?.includes('não foi autorizada') && state.manualEnabled)
  await mockApi(); await input('pharmacy-place', 'Campinas, SP')
  await evaluate('document.querySelector(".pharmacy-search-form").requestSubmit()')
  await waitFor('!!document.querySelector(".pharmacy-place-option")'); await click('.pharmacy-place-option'); await idle()
  assert.equal((await snapshot()).cards, 1)
  await finish({ nativePermissionDenied: true, manualResultsMocked: true })
  await command('Browser.grantPermissions', { browserContextId, origin, permissions: ['geolocation'] })

  await open('synchronous_security_error')
  await evaluate("navigator.geolocation.getCurrentPosition=()=>{throw new DOMException('QA policy block','SecurityError')}")
  await locate(); await idle(); state = await snapshot()
  assert(state.error?.includes('não foi autorizada') && state.manualEnabled)
  await finish()

  await open('unsupported_geolocation')
  await evaluate("Object.defineProperty(navigator,'geolocation',{value:undefined,configurable:true})")
  await locate(); await idle(); state = await snapshot()
  assert(state.error?.includes('não está disponível') && state.manualEnabled)
  await finish()

  await open('native_approximate_position')
  await page('Emulation.setGeolocationOverride', { latitude: -22.90612, longitude: -47.06012, accuracy: 8000 })
  await mockApi(); await locate(); await idle(); state = await snapshot()
  assert.equal(state.cards, 1)
  assert(state.location.includes('Precisão informada') && state.location.includes('10 km'))
  assert(decodeURIComponent(state.mockRequests[0].body).includes('around:10000,-22.906,-47.06'))
  await finish({ coordinatesEmulated: true, apiMocked: true })

  await open('position_too_inaccurate')
  await page('Emulation.setGeolocationOverride', { latitude: -22.90612, longitude: -47.06012, accuracy: 50000 })
  await mockApi(); await locate(); await idle(); state = await snapshot()
  assert(state.error?.includes('muito imprecisa') && state.mockRequests.length === 0)
  await finish()

  await open('zero_coordinates')
  await page('Emulation.setGeolocationOverride', { latitude: 0, longitude: 0, accuracy: 10 })
  await mockApi(); await locate(); await idle(); state = await snapshot()
  assert(state.error?.includes('não informou') && state.mockRequests.length === 0)
  await finish()
  await page('Emulation.setGeolocationOverride', { latitude: -22.90612, longitude: -47.06012, accuracy: 35 })

  await open('cancel_ignores_late_position')
  await mockApi(); await evaluate('navigator.geolocation.getCurrentPosition=(success)=>{window.__qaLatePosition=success}')
  await locate(); assert((await snapshot()).manualEnabled)
  await click('.pharmacy-cancel-location')
  await evaluate('window.__qaLatePosition({coords:{latitude:-22.90612,longitude:-47.06012,accuracy:50}})'); await pause(100)
  state = await snapshot(); assert.equal(state.mockRequests.length, 0); assert.equal(state.cards, 0)
  await finish()

  await open('manual_search_interrupts_geolocation')
  await mockApi(); await evaluate('navigator.geolocation.getCurrentPosition=(success)=>{window.__qaLatePosition=success}')
  await locate(); await input('pharmacy-place', 'Campinas, SP')
  await evaluate('document.querySelector(".pharmacy-search-form").requestSubmit()')
  await waitFor('!!document.querySelector(".pharmacy-place-option")')
  await evaluate('window.__qaLatePosition({coords:{latitude:-22.90612,longitude:-47.06012,accuracy:50}})'); await pause(100)
  state = await snapshot(); assert.equal(state.mockRequests.filter(r=>r.url.includes('ovp.dresel')).length, 0)
  await click('.pharmacy-place-option'); await idle(); assert.equal((await snapshot()).cards, 1)
  await finish()

  await open('provider_failure_keeps_previous_results')
  await mockApi(); await locate(); await idle(); assert.equal((await snapshot()).cards, 1)
  await evaluate('window.__qaHttpFailure=true'); await pause(1100)
  await click('input[name=pharmacy-radius][value="5000"]'); await idle(); state = await snapshot()
  assert(state.error && state.cards === 1)
  assert(await evaluate('!!document.querySelector(".pharmacy-last-result-note")'))
  await finish({ apiMocked: true })

  await open('invalid_provider_json')
  await mockApi(); await evaluate('window.__qaInvalidJson=true'); await locate(); await idle()
  state = await snapshot(); assert(state.error && state.cards === 0 && state.manualEnabled)
  await finish({ apiMocked: true })

  await open('empty_results')
  await mockApi(); await evaluate('window.__qaEmpty=true'); await locate(); await idle()
  state = await snapshot(); assert(!state.error && state.cards === 0 && state.status.includes('0 farmácias'))
  await finish({ apiMocked: true })

  await open('silent_native_api_deadline')
  await evaluate('navigator.geolocation.getCurrentPosition=()=>{}'); await locate()
  await waitFor('!!document.querySelector(".pharmacy-cancel-location")')
  assert((await snapshot()).manualEnabled)
  await idle(); state = await snapshot(); assert(state.error?.includes('demorou') && state.manualEnabled)
  await finish({ nativeApiMocked: true })

  await open('render_boundary_recovery')
  await evaluate("window.__qaNativeURL=URL;window.URL=class extends URL { constructor(input,...rest){if(String(input)==='https://waze.com/ul')throw new Error('QA_RENDER_FAULT');super(input,...rest)} }")
  await locate(); await waitFor('!!document.querySelector(".pharmacy-recovery")')
  assert(await evaluate('!!document.querySelector(".mobile-nav")'))
  await evaluate('window.URL=window.__qaNativeURL'); await click('.pharmacy-recovery button')
  await waitFor('!!document.querySelector(".pharmacy-page")')
  await finish({ injectedRenderFailure: true, recovery: true })

  const issues=[]
  for (const [width,height] of [[320,568],[390,844],[1280,900]]) {
    await page('Emulation.setDeviceMetricsOverride', { width,height,deviceScaleFactor:1,mobile:width<900 })
    await open(`results_layout_${width}`); await mockApi(); await locate(); await idle()
    const cuts=await evaluate(`(() => [...document.querySelectorAll('.pharmacy-page *')].filter(e=>{const r=e.getBoundingClientRect();return r.width>1&&r.height>1&&r.right>innerWidth+1&&!e.closest('details:not([open])')}).map(e=>String(e.className)))()`)
    assert.equal(await evaluate('document.documentElement.scrollWidth'),width)
    if(cuts.length)issues.push({width,cuts})
    const routes=await evaluate('[...document.querySelectorAll(".pharmacy-route-options a")].map(e=>e.href)')
    assert(routes.some(url=>url.includes('google.com/maps/dir'))&&routes.some(url=>url.includes('waze.com/ul')))
    await finish({ width, height, cuts, apiMocked:true })
  }
  assert.equal(issues.length,0)
  const unexpected=errors.filter(e=>e.scenario!=='render_boundary_recovery')
  assert.equal(unexpected.length,0,JSON.stringify(unexpected))
  await writeFile('docs/pharmacy-qa-results.json',JSON.stringify({date:new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo'}).format(new Date()),environment:'Local Chrome, disposable demo context',cases,apiRequests,unexpectedExceptions:unexpected,limitations:['Device coordinates are emulated, not a physical GPS fix','Failure scenarios use controlled native API/provider failures']},null,2)+'\n')
  console.log(JSON.stringify({ result:'passed',scenarios:cases.length,unexpectedExceptions:unexpected.length }))
} finally { await command('Target.disposeBrowserContext',{browserContextId});socket.close() }
