// Local-only UI regression checks in a disposable Chrome context. Node.js 22+.
// Start a dedicated Chrome with a CDP port, then run: node scripts/test-mobile-layout.mjs --port 9338
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
const viewports = [[320,568],[360,640],[375,667],[390,844],[430,932],[768,1024],[900,900],[901,900],[1440,900],[844,390]]
const routes = ['/', '/medicamentos', '/adicionar', '/status', '/historico', '/configuracoes', '/farmacias', '/ajuda']
const rows = []
const { browserContextId } = await command('Target.createBrowserContext')
try {
  const { targetId } = await command('Target.createTarget', { browserContextId, url: 'about:blank' })
  const { sessionId } = await command('Target.attachToTarget', { targetId, flatten: true })
  const page = (method, params) => command(method, params, sessionId)
  const evaluate = async expression => {
    const result = await page('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text)
    return result.result.value
  }
  const waitFor = async expression => {
    for (let attempt = 0; attempt < 50; attempt++) { if (await evaluate(expression)) return; await pause(100) }
    throw new Error(`Condicao nao confirmada: ${expression}`)
  }
  const navigate = async route => {
    await page('Page.navigate', { url: origin + route })
    await waitFor(`location.pathname===${JSON.stringify(route)} && !!document.querySelector('#main-content h1')`)
    await evaluate('document.fonts.ready')
    await pause(80)
  }
  const input = (id, value) => evaluate(`(() => {const e=document.getElementById(${JSON.stringify(id)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`)
  const submit = async () => { await evaluate('document.querySelector(".medication-form").requestSubmit()'); await pause(30) }
  const inspect = async (width, height, large) => {
    const row = await evaluate(`(() => {
      window.scrollTo(0,0);
      const root=document.querySelector('#main-content'), nav=document.querySelector('.mobile-nav');
      const visible=e=>{if(!e.getClientRects().length)return false;for(let p=e;p;p=p.parentElement){const style=getComputedStyle(p);if(style.visibility==='hidden'||style.clipPath!=='none'||p.getAttribute('aria-hidden')==='true')return false;if(p.tagName==='DETAILS'&&!p.open&&!p.querySelector(':scope > summary')?.contains(e))return false;}return true;};
      const cuts=[...root.querySelectorAll('*')].filter(visible).map(e=>({tag:e.tagName,class:String(e.className),text:e.textContent.slice(0,50),left:e.getBoundingClientRect().left,right:e.getBoundingClientRect().right})).filter(e=>e.left< -1||e.right>innerWidth+1);
      const step=Number(document.querySelector('.med-form-tools strong')?.textContent)||null;
      const primary=document.querySelector(step===1?'#med-name':step===2?'.med-format-option':step===3?'input[type=time]':step===4?'#med-quantity':location.pathname==='/'?'.dose-row .btn':location.pathname==='/medicamentos'?'.medication-detail h2':'.pharmacy-search-panel > .btn');
      const rect=primary?.getBoundingClientRect();const navRect=nav?.getBoundingClientRect();
      return {route:location.pathname,step,width:innerWidth,height:innerHeight,large:document.documentElement.classList.contains('large-text'),documentWidth:document.documentElement.scrollWidth,cuts,primary:rect?{top:rect.top,bottom:rect.bottom,visible:rect.top>=0&&rect.bottom<=(navRect?.height?navRect.top:innerHeight)}:null};
    })()`)
    assert.equal(row.width, width, 'O teste deve medir a largura emulada, sem usar dimensoes padrao.')
    assert.equal(row.height, height, 'O teste deve medir a altura emulada.')
    assert.equal(row.large, large)
    assert(row.documentWidth <= width + 1, `Rolagem horizontal em ${JSON.stringify(row)}`)
    rows.push(row)
    return row
  }
  await page('Page.enable'); await page('Runtime.enable')
  await page('Page.navigate', { url: origin + '/login' })
  await waitFor('!!document.querySelector(".demo-button")')
  await evaluate('document.querySelector(".demo-button").click()')
  await waitFor('!!document.querySelector(".routine-heading")')
  for (const [width, height] of viewports) {
    await page('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width <= 900 })
    for (const large of [false,true]) {
      await evaluate(`localStorage.setItem('medcontrol_large_text',${JSON.stringify(String(large))})`)
      for (const route of routes) {
        await navigate(route)
        const first = await inspect(width, height, large)
        if (route !== '/adicionar') continue
        if (!large && width <= 600 && height >= 568) assert(first.primary.visible, `O nome deve aparecer na primeira tela: ${JSON.stringify(first)}`)
        await input('med-name', 'Remedio ficticio para conferir proporcao e quebra de texto 500 mg')
        await submit(); await inspect(width, height, large)
        await evaluate('document.querySelector("input[value=liquid]").click()')
        await input('med-units', '2,5'); await submit()
        assert.equal(await evaluate('document.querySelector("input[type=time]").value'), '', 'Nao preencher horario sem escolha.')
        await input('med-time-0', '08:00'); await inspect(width, height, large)
        await submit(); await input('med-quantity', '10,5'); await inspect(width, height, large)
        await evaluate('document.querySelector(".med-form-continue").scrollIntoView({block:"center"})')
        const reachable = await evaluate(`(() => {const e=document.querySelector('.med-form-continue'),r=e.getBoundingClientRect(),n=document.querySelector('.mobile-nav').getBoundingClientRect();return r.top>=0&&r.bottom<=(n.height?n.top:innerHeight);})()`)
        assert(reachable, `Acao final coberta pela navegacao em ${width}x${height}, large=${large}`)
      }
    }
    console.log(JSON.stringify({ viewport: `${width}x${height}`, checked: rows.length }))
  }
  // Record current mobile references, always with fictitious demonstration data.
  await mkdir('docs/screenshots', { recursive: true })
  await page('Emulation.setDeviceMetricsOverride', { width: 375, height: 667, deviceScaleFactor: 1, mobile: true })
  await evaluate("localStorage.setItem('medcontrol_large_text','false')")
  for (const [route, name] of [['/adicionar','registration'],['/','routine'],['/medicamentos','medications']]) {
    await navigate(route)
    await evaluate('window.scrollTo(0,0)')
    const screenshot = await page('Page.captureScreenshot', { format: 'png' })
    await writeFile(`docs/screenshots/mobile-proportion-${name}-375.png`, Buffer.from(screenshot.data,'base64'))
  }
  const report = { date: new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date()), environment: 'Local Chrome CDP, disposable demo context; no real accounts', rows, layoutIssues: rows.filter(row=>row.cuts.length), visualRegression: 'INCONCLUSIVE: no baseline for this version', limitations: ['No physical iOS/Android device or real virtual keyboard', 'No participant usability sessions'] }
  await writeFile('docs/mobile-proportion-test-results.json', JSON.stringify(report,null,2)+'\n')
  assert.equal(report.layoutIssues.length, 0, 'Conteudo fora da largura da tela; consulte o relatorio.')
  console.log(JSON.stringify({ result:'passed', screens:rows.length, layoutIssues:report.layoutIssues.length }))
} finally { await command('Target.disposeBrowserContext', { browserContextId }); socket.close() }
