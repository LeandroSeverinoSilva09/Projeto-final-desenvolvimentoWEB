// ECC functional QA against local demo only. Auth responses are fixtures; no emails or real accounts.
import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'

const portAt=process.argv.indexOf('--port'),port=portAt<0?'9338':process.argv[portAt+1]
assert(/^\d+$/.test(port))
const origin='http://127.0.0.1:5173'
const axeAt=process.argv.indexOf('--axe-path')
const axeSource=axeAt<0?null:await readFile(process.argv[axeAt+1],'utf8')
const version=await fetch(`http://127.0.0.1:${port}/json/version`).then(r=>r.json())
const socket=new WebSocket(version.webSocketDebuggerUrl)
await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true})})
let nextId=0,sessionId
const pending=new Map(),cases=[],errors=[],remoteMutations=[],loadedDocuments=new Set(),accessibility=[]
socket.addEventListener('message',({data})=>{
  const m=JSON.parse(String(data)),p=pending.get(m.id)
  if(p){pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(new Error(m.error.message)):p.resolve(m.result)}
  if(m.sessionId!==sessionId)return
  if(m.method==='Page.lifecycleEvent'&&m.params.name==='DOMContentLoaded')loadedDocuments.add(m.params.loaderId)
  if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text)
  if(m.method==='Network.requestWillBeSent'){
    const r=m.params.request
    if(/supabase\.co\/(rest|functions)\//.test(r.url)&&!['GET','OPTIONS','HEAD'].includes(r.method))remoteMutations.push({method:r.method,path:new URL(r.url).pathname})
  }
})
function command(method,params={},session){
  const id=++nextId
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{pending.delete(id);reject(new Error(`Timeout ${method}`))},15000)
    pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params,...(session?{sessionId:session}:{})}))
  })
}
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms))
const {browserContextId}=await command('Target.createBrowserContext')
try{
  const {targetId}=await command('Target.createTarget',{browserContextId,url:'about:blank'})
  sessionId=(await command('Target.attachToTarget',{targetId,flatten:true})).sessionId
  const page=(method,params)=>command(method,params,sessionId)
  const evaluate=async expression=>{
    const r=await page('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true})
    if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text)
    return r.result.value
  }
  const waitFor=async expression=>{
    for(let i=0;i<100;i++){if(await evaluate(`(async()=>Boolean(await (${expression})))()`))return;await pause(100)}
    throw new Error(`Condicao nao confirmada: ${expression}`)
  }
  const click=selector=>evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`)
  const button=text=>evaluate(`(() => {const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(text)});if(!b||b.disabled)throw Error('Botao ausente ou indisponivel: '+${JSON.stringify(text)});b.click()})()`)
  const input=(selector,value)=>evaluate(`(() => {const e=document.querySelector(${JSON.stringify(selector)}),proto=e.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));})()`)
  const navigate=async (route,expected=route)=>{
    const {loaderId}=await page('Page.navigate',{url:origin+route})
    if(loaderId){for(let i=0;i<100&&!loadedDocuments.has(loaderId);i++)await pause(100);assert(loadedDocuments.has(loaderId),'O novo documento precisa terminar de carregar.')}
    await waitFor(`location.pathname===${JSON.stringify(expected)}&&!!document.querySelector('main')`);await pause(100)
  }
  const next=async()=>{await evaluate('document.querySelector(".medication-form").requestSubmit()');await pause(100)}
  const step=number=>waitFor(`document.querySelector('.medication-form')?.dataset.step===${JSON.stringify(String(number))}`)
  const state=()=>evaluate('JSON.parse(sessionStorage.getItem("medcontrol_demo_data"))')
  const pass=(name,evidence={})=>{cases.push({name,result:'passed',...evidence});console.log(JSON.stringify({check:name,result:'passed'}))}
  const audit=async name=>{
    if(!axeSource)return
    if(!await evaluate('!!window.axe'))await evaluate(axeSource+';true')
    const original=await evaluate('document.documentElement.classList.contains("large-text")')
    try{
      for(const large of [false,true]){
        await evaluate(`document.documentElement.classList.toggle('large-text',${large});true`)
        const result=await evaluate(`axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa','best-practice']}}).then(r=>({version:r.testEngine.version,violations:r.violations.map(v=>({id:v.id,impact:v.impact,description:v.description,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))})),incomplete:r.incomplete.map(v=>({id:v.id,nodes:v.nodes.length}))}))`)
        const row={name,large,...result};accessibility.push(row)
        if(result.violations.length)await writeFile('/tmp/medcontrol-a11y-failure.json',JSON.stringify(row,null,2))
        assert.equal(result.violations.length,0,`Acessibilidade em ${name}, texto ampliado=${large}: /tmp/medcontrol-a11y-failure.json`)
      }
    }finally{await evaluate(`document.documentElement.classList.toggle('large-text',${original});true`)}
  }
  await page('Page.enable');await page('Runtime.enable');await page('Network.enable')
  await page('Page.setLifecycleEventsEnabled',{enabled:true})
  await page('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true})
  await page('Page.addScriptToEvaluateOnNewDocument',{source:`
    window.__qaAuth=[];window.__qaBlobs=[];window.__qaPermissionRequests=0;window.__qaNoticeMode='show';
    const nativeFetch=window.fetch.bind(window);
    window.fetch=async(url,init={})=>{
      const address=String(url);
      if(!/supabase\\.co\\/auth\\/v1\\//.test(address))return nativeFetch(url,init);
      const path=new URL(address).pathname;window.__qaAuth.push(path);
      if(path.endsWith('/token'))return new Response(JSON.stringify({code:'invalid_credentials',msg:'Invalid login credentials'}),{status:400,headers:{'Content-Type':'application/json'}});
      if(path.endsWith('/signup'))return new Response(JSON.stringify({id:'00000000-0000-4000-8000-000000000001',aud:'authenticated',email:'qa@example.invalid',created_at:new Date().toISOString(),identities:[]}),{status:200,headers:{'Content-Type':'application/json'}});
      if(path.endsWith('/recover'))return new Response('{}',{status:200,headers:{'Content-Type':'application/json'}});
      return new Response('{}',{status:400,headers:{'Content-Type':'application/json'}});
    };
    const createUrl=URL.createObjectURL.bind(URL);
    URL.createObjectURL=blob=>{window.__qaBlobs.push(blob);return createUrl(blob)};
    const nativeClick=HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click=function(){if(this.download){window.__qaDownload=this.download;return}return nativeClick.call(this)};
    class TestNotification extends EventTarget{
      static permission=sessionStorage.getItem('__qaPermission')||'default';
      static async requestPermission(){window.__qaPermissionRequests++;this.permission='granted';sessionStorage.setItem('__qaPermission','granted');return 'granted'}
      constructor(){super();queueMicrotask(()=>{if(window.__qaNoticeMode==='throw')this.onerror?.();else this.onshow?.()})}
      close(){}
    }
    window.Notification=TestNotification;
  `})
  await navigate('/medicamentos','/login')
  assert.equal(await evaluate('window.__qaPermissionRequests'),0);pass('protected_route_and_no_permission_prompt')
  await audit('login')
  assert.equal(await evaluate('document.querySelector("main.auth-page")!==null'),true)
  await evaluate('document.querySelector("form").requestSubmit()')
  assert.equal(await evaluate('window.__qaAuth.length'),0);pass('login_required_fields_prevent_request')
  await input('input[type=email]','qa@example.invalid');await input('input[type=password]','FictitiousPassword123!')
  await click('button[aria-label="Mostrar senha"]')
  assert.equal(await evaluate('document.querySelector("input[autocomplete=current-password]").type'),'text')
  await click('button[aria-label="Ocultar senha"]')
  await evaluate('document.querySelector("form").requestSubmit()');await waitFor('document.querySelector("[role=alert]")?.textContent.includes("incorretos")')
  pass('login_error_and_password_visibility',{auth:'fixture; no real login'})
  await button('Criar conta');await input('input[autocomplete=name]','Pessoa ficticia QA');await input('input[type=password]','FictitiousPassword123!')
  await evaluate('document.querySelector("form").requestSubmit()');await waitFor('document.querySelector("[role=status]")?.textContent.includes("confirmar o cadastro")')
  pass('signup_confirmation_feedback',{auth:'fixture; no email sent'})
  await button('Entrar');await button('Esqueci minha senha')
  await evaluate('document.querySelector("form").requestSubmit()');await waitFor('document.querySelector("[role=status]")?.textContent.includes("Se houver uma conta")')
  pass('password_recovery_feedback',{auth:'fixture; no email sent'})
  await button('Voltar para entrar')
  await evaluate(`sessionStorage.setItem('medcontrol_demo_data',JSON.stringify({user:null,medications:[],history:[],stats:{streakCount:0,lastStreakDate:null,totalDoses:0}}));localStorage.setItem('medcontrol-notifications-disabled','false')`)
  await click('.demo-button');await waitFor('!!document.querySelector(".routine-heading")')
  assert.equal((await state()).medications.length,0);pass('demo_and_empty_routine')

  await button('Ativar notificações');await waitFor('[...document.querySelectorAll("button")].some(b=>b.textContent==="Enviar teste agora")')
  assert.equal(await evaluate('window.__qaPermissionRequests'),1)
  await button('Enviar teste agora');await waitFor('document.querySelector(".notification-panel [role=status]")?.textContent.includes("enviado agora")')
  await evaluate("window.__qaNoticeMode='throw'");await button('Enviar teste agora')
  await waitFor('document.querySelector(".notification-panel [role=alert]")?.textContent.includes("não confirmou")')
  assert.equal(await evaluate('!!document.querySelector(".notification-panel [role=status]")'),false)
  pass('notification_consent_success_and_failed_display',{notificationAPI:'fixture; native delivery tested separately'})
  await navigate('/configuracoes');await button('Desativar notificações')
  await waitFor('localStorage.getItem("medcontrol-notifications-disabled")==="true"')
  pass('demo_disable_without_remote_subscription_mutation')

  await navigate('/adicionar');await waitFor('!!document.querySelector(".medication-form")')
  await next();await waitFor('!!document.querySelector("#med-name-error")')
  assert.equal(await evaluate('document.activeElement.id'),'med-name');pass('empty_name_focus_and_error')
  await audit('name-validation')
  await click('.med-name-help > summary');await button('Buscar')
  await waitFor('document.querySelector(".catalog-status")?.textContent.includes("2 letras")')
  await input('.catalog-input','paracetamol');await evaluate('document.querySelector(".catalog-input").focus()')
  await page('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});await page('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13})
  await waitFor('document.querySelectorAll(".catalog-result").length>0')
  assert.equal(await evaluate('document.querySelector(".medication-form").dataset.step'),'1')
  await audit('catalog-results')
  const catalogName=await evaluate('document.querySelector(".catalog-name").textContent')
  await click('.catalog-select');assert.equal(await evaluate('document.querySelector("#med-name").value'),catalogName)
  pass('local_anvisa_catalog_enter_search_and_name_selection',{nameOnly:true})
  await input('#med-name','Remedio ficticio QA');await next();await step(2)
  assert.equal(await evaluate('document.querySelectorAll(".med-format-option input:checked").length'),0)
  await next();await waitFor('!!document.querySelector("#med-format-error")')
  await click('input[value=liquid]');await input('#med-units','0');await next();await waitFor('!!document.querySelector("#med-units-error")')
  await input('#med-units','2,5');await audit('format-and-amount');await next();await step(3)
  assert.equal(await evaluate('document.querySelector("input[type=time]").value'),'')
  await next();await waitFor('!!document.querySelector("#med-times-error")')
  await input('#med-time-0','00:00');await button('Adicionar outro horário');await input('#med-time-1','00:00');await next()
  await waitFor('!!document.querySelector("#med-times-error")')
  await audit('schedule-validation')
  await click('button[aria-label="Tirar horário 2"]');await next();await step(4)
  await input('#med-quantity','10,5');await audit('review');await next();await waitFor('location.pathname==="/medicamentos"&&document.querySelector(".medication-detail")')
  let s=await state(),med=s.medications[0]
  assert.equal(med.current,10.5);assert.equal(med.unitsPerDose,2.5);assert.equal(med.stockUnit,'mL');assert.equal(med.schedules,'00:00')
  const id=med.id;pass('four_step_registration_explicit_choices_decimal_and_duplicate_times',{current:10.5,unitsPerDose:2.5,stockUnit:'mL'})
  await navigate('/medicamentos');await waitFor('!!document.querySelector(".medication-detail")')
  assert.equal((await state()).medications[0].id,id);pass('demo_session_reload_persistence')
  await navigate('/');await waitFor('!!document.querySelector(".dose-row button")')
  await evaluate('(()=>{const b=document.querySelector(".dose-row button");b.click();b.click()})()')
  await waitFor('!!document.querySelector(".dose-done")');s=await state()
  assert.equal(s.history.length,1);assert.equal(s.medications[0].current,8);assert.equal(s.medications[0].takenCount,1)
  pass('double_confirmation_records_once_and_subtracts_exact_decimal',{history:1,current:8})
  await button('Pendentes');assert.equal(await evaluate('document.querySelectorAll(".dose-row").length'),0)
  await button('Tomadas');assert.equal(await evaluate('document.querySelectorAll(".dose-row").length'),1);pass('agenda_filters')

  await navigate(`/editar/${id}`);await waitFor('!!document.querySelector("#med-name")')
  await input('#med-name','Remedio ficticio QA editado');await next();await step(2)
  assert.equal(await evaluate('document.querySelector("#med-units").value'),'2,5')
  await next();await step(3);await next();await step(4)
  assert.equal(await evaluate('document.querySelector("#med-quantity").value'),'8')
  await next();await waitFor('location.pathname==="/medicamentos"')
  s=await state();assert.equal(s.medications[0].takenCount,1);assert.equal(s.history.length,1);assert.equal(s.medications[0].current,8)
  pass('editing_preserves_count_stock_units_and_history')
  await button('Repor estoque');await waitFor('!!document.querySelector("dialog[open]")')
  await page('Page.bringToFront');await page('Emulation.setFocusEmulationEnabled',{enabled:true})
  assert.equal(await evaluate('document.querySelector("dialog[open]").contains(document.activeElement)'),true)
  await audit('restock-dialog')
  for(let i=0;i<7;i++){
    await page('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});await page('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9})
    assert.equal(await evaluate('document.querySelector("dialog[open]").contains(document.activeElement)'),true,JSON.stringify(await evaluate('({iteration:'+i+',active:document.activeElement.outerHTML.slice(0,250),focus:document.hasFocus()})')))
  }
  await page('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await page('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27})
  await waitFor('!document.querySelector("dialog[open]")');pass('modal_keyboard_focus_trap_and_escape')
  await button('Repor estoque');await waitFor('!!document.querySelector("dialog[open]")')
  await input('dialog[open] input[type=number]','0');await evaluate('document.querySelector("dialog[open] form").requestSubmit()')
  assert.equal((await state()).medications[0].current,8)
  await input('dialog[open] input[type=number]','100000');await button('Adicionar ao estoque')
  await waitFor('document.querySelector("dialog[open] [role=alert]")?.textContent.includes("limite")')
  assert.equal((await state()).medications[0].current,8)
  await input('dialog[open] input[type=number]','0.5');await button('Adicionar ao estoque')
  await waitFor('!document.querySelector("dialog[open]")');assert.equal((await state()).medications[0].current,8.5)
  pass('restock_validates_and_adds_decimal',{current:8.5})
  await input('input[aria-label="Buscar medicamento"]','inexistente');assert.equal(await evaluate('document.querySelectorAll(".medication-detail").length'),0)
  await input('input[aria-label="Buscar medicamento"]','QA editado');assert.equal(await evaluate('document.querySelectorAll(".medication-detail").length'),1)
  await click('.filter-button');assert.equal(await evaluate('document.querySelectorAll(".medication-detail").length'),0)
  assert.equal(await evaluate('document.querySelector(".filter-button").getAttribute("aria-pressed")'),'true')
  await click('.filter-button')
  pass('medication_search')
  await navigate('/historico');await waitFor('!!document.querySelector(".history-row")')
  await input('input[aria-label="Buscar no histórico"]','inexistente');assert.equal(await evaluate('document.querySelectorAll(".history-row").length'),0)
  await input('input[aria-label="Buscar no histórico"]','QA');await input('select','today')
  await button('Exportar registros');await waitFor('window.__qaBlobs.length===1')
  const csv=await evaluate('window.__qaBlobs[0].text()')
  assert(csv.includes('Remedio ficticio QA')&&csv.includes('00:00')&&csv.split('\r\n').length===2)
  assert.match(await evaluate('window.__qaDownload'),/^medcontrol-historico-.*\.csv$/)
  pass('history_search_period_and_csv_content',{rows:1,download:'intercepted locally; CSV blob inspected'})
  await navigate('/status');await waitFor('!!document.querySelector(".calendar-grid")')
  assert.equal(await evaluate('document.querySelectorAll(".calendar-grid button").length'),7)
  assert.match(await evaluate('document.querySelector(".selected-day").textContent'),/Remedio ficticio QA/)
  await click('.calendar-grid button');assert.equal(await evaluate('document.querySelector(".calendar-grid button").getAttribute("aria-pressed")'),'true')
  pass('weekly_progress_and_calendar')
  await navigate('/configuracoes');await click('button[role=switch]')
  assert.equal(await evaluate('document.documentElement.classList.contains("large-text")'),true)
  await navigate('/configuracoes');await waitFor('!!document.querySelector("button[role=switch]")')
  assert.equal(await evaluate('document.querySelector("button[role=switch]").getAttribute("aria-checked")'),'true')
  await click('button[role=switch]');pass('large_text_persists_across_reload')
  for(const route of ['/','/medicamentos','/historico','/status','/configuracoes','/farmacias','/ajuda','/privacidade','/termos']){
    await navigate(route)
    assert.equal(await evaluate('document.querySelectorAll("main").length'),1,`Landmark principal em ${route}`)
    assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'),true,`Largura em ${route}`)
    await audit(route)
    if(axeSource&&route==='/farmacias'){
      await evaluate(`(()=>{document.querySelector('.pharmacy-in-app').open=true;navigator.geolocation.getCurrentPosition=success=>success({coords:{latitude:-22.90612,longitude:-47.06012,accuracy:35}});const nativeFetch=window.fetch;window.fetch=(url,init)=>String(url).includes('ovp.dresel')?Promise.resolve(new Response(JSON.stringify({elements:[{type:'node',id:999,lat:-22.9061,lon:-47.0601,tags:{amenity:'pharmacy',name:'Farmacia ficticia QA',phone:'(19) 3333-4444','addr:street':'Rua de exemplo'}}]}),{status:200,headers:{'Content-Type':'application/json'}})):nativeFetch(url,init)})()`)
      await button('Usar minha localização');await waitFor('document.querySelectorAll(".pharmacy-card").length===1')
      await audit('pharmacy-results-fixture')
    }
  }
  pass('all_routes_main_landmark_and_mobile_width',{routes:9})
  await navigate('/')
  for(const route of ['/medicamentos','/farmacias','/historico','/configuracoes','/']){
    await click(`.mobile-nav a[href="${route}"]`);await waitFor(`location.pathname===${JSON.stringify(route)}&&document.querySelector('.mobile-nav a[href="${route}"]').getAttribute('aria-current')==='page'`)
    assert.equal(await evaluate(`document.querySelector('.mobile-nav a[href="${route}"]').getAttribute('aria-current')`),'page')
  }
  await click('.help-link');await waitFor('location.pathname==="/ajuda"')
  pass('daily_navigation_links_and_current_page')
  await navigate('/medicamentos');await waitFor('!!document.querySelector(".medication-detail")')
  await click(`button[aria-label="Arquivar Remedio ficticio QA editado"]`);await waitFor('!!document.querySelector("dialog[open]")')
  await button('Arquivar medicamento');await waitFor('!document.querySelector("dialog[open]")')
  s=await state();assert.equal(s.medications.length,0);assert.equal(s.history.length,1)
  await navigate('/historico');assert.equal(await evaluate('document.querySelectorAll(".history-row").length'),1)
  pass('archive_preserves_history')
  await navigate('/editar/inexistente');await waitFor('document.querySelector("h1")?.textContent==="Medicamento não encontrado"')
  pass('unknown_medication_recovery')
  // Explicitly seed only fictitious data to exercise future and insufficient-stock guards.
  await evaluate(`(()=>{const s=JSON.parse(sessionStorage.getItem('medcontrol_demo_data'));s.medications=[{id:'future',name:'Futuro QA',dose:'1 unidade',current:10,total:10,schedules:'23:59',frequency:24,takenCount:0,unitsPerDose:1,createdAt:new Date().toISOString()},{id:'empty',name:'Sem estoque QA',dose:'1 unidade',current:0,total:10,schedules:'00:00',frequency:24,takenCount:0,unitsPerDose:1,createdAt:new Date().toISOString()}];sessionStorage.setItem('medcontrol_demo_data',JSON.stringify(s))})()`)
  await navigate('/');await waitFor('document.querySelectorAll(".dose-row").length===2')
  assert.equal(await evaluate('[...document.querySelectorAll(".dose-row button")].every(b=>b.disabled)'),true)
  assert.match(await evaluate('document.querySelector(".dose-list").textContent'),/Estoque insuficiente/)
  pass('future_dose_and_insufficient_stock_disabled')
  await mkdir('docs/screenshots',{recursive:true})
  for(const [width,height] of [[375,667],[768,1024],[1440,900]]){
    await page('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<=900})
    await navigate('/configuracoes');await evaluate('document.fonts.ready');await pause(120)
    const screenshot=await page('Page.captureScreenshot',{format:'png'})
    await writeFile(`docs/screenshots/platform-settings-${width}.png`,Buffer.from(screenshot.data,'base64'))
  }
  pass('three_breakpoint_visual_references',{visualRegression:'INCONCLUSIVE: no previous matching baseline'})
  await button('Sair da demonstração');await waitFor('location.pathname==="/login"')
  await navigate('/historico','/login')
  assert.equal(await evaluate('sessionStorage.getItem("medcontrol_demo")'),null)
  pass('logout_revokes_protected_routes')
  assert.equal(remoteMutations.length,0);assert.equal(errors.length,0)
  pass('no_uncaught_errors_or_real_treatment_mutations')
  const report={checkedAt:new Date().toISOString(),origin,browser:version.Browser,scope:'Disposable local demo; auth/permission failure fixtures explicitly identified',cases,uncaughtErrors:errors,remoteMutations,limitations:['No real account signup/recovery emails sent','No physical Android/iOS or screen reader test','No participant usability study','Native notifications tested by a separate script','Visual regression inconclusive without previous matching baselines']}
  await writeFile('docs/platform-qa-results.json',JSON.stringify(report,null,2)+'\n')
  if(axeSource)await writeFile('docs/accessibility-qa-results.json',JSON.stringify({checkedAt:new Date().toISOString(),tool:'axe-core',viewport:{width:390,height:844},scope:'Local demo; normal and large text; pharmacy result fixture includes a phone link',states:accessibility,limitations:['Automated scan does not certify WCAG compliance','Incomplete checks require human assessment','No VoiceOver/TalkBack session or participant usability study']},null,2)+'\n')
  console.log(JSON.stringify({result:'passed',cases:cases.length,uncaughtErrors:errors.length,remoteMutations:remoteMutations.length}))
}finally{await command('Target.disposeBrowserContext',{browserContextId}).catch(()=>{});socket.close()}
