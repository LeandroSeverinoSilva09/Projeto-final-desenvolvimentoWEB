// Local demo fixtures only; never writes treatment data to Supabase.
import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { localBrowser, pause } from './lib/local-browser.mjs'
const arg=name=>{const at=process.argv.indexOf(name);return at<0?undefined:process.argv[at+1]}
const browser=await localBrowser(arg('--port')||'9338')
const {page,evaluate,waitFor,navigate,input,button}=browser
const axeSource=arg('--axe-path')?await readFile(arg('--axe-path'),'utf8'):null
const cases=[],a11y=[]
const pass=name=>{cases.push({name,result:'passed'});console.log(JSON.stringify({check:name,result:'passed'}))}
const next=async()=>{await evaluate('document.querySelector(".medication-form").requestSubmit()');await pause(60)}
const step=n=>waitFor(`document.querySelector('.medication-form')?.dataset.step==='${n}'`)
const click=selector=>evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`)
const state=()=>evaluate('JSON.parse(sessionStorage.getItem("medcontrol_demo_data"))')
const choose=level=>click(`.bottle-level-option input[value="${level}"]`)
const audit=async name=>{
  if(!axeSource)return
  if(!await evaluate('!!window.axe'))await evaluate(axeSource+';true')
  const result=await evaluate(`axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa','best-practice']}}).then(r=>({version:r.testEngine.version,violations:r.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))})),incomplete:r.incomplete.map(v=>({id:v.id,nodes:v.nodes.length}))}))`)
  a11y.push({name,...result})
  if(result.violations.length)await writeFile('/tmp/medcontrol-drop-a11y-failure.json',JSON.stringify(a11y.at(-1),null,2))
  assert.equal(result.violations.length,0,`Acessibilidade em ${name}: /tmp/medcontrol-drop-a11y-failure.json`)
}
const openDrops=async name=>{
  await navigate('/adicionar');await waitFor('!!document.querySelector("#med-name")')
  await input('#med-name',name);await next();await step(2)
  await click('input[value=drops]');await input('#med-units','20');await next();await step(3)
  await input('#med-time-0','00:00');await next();await step(4)
}
try{
  await page('Emulation.setDeviceMetricsOverride',{width:375,height:667,deviceScaleFactor:1,mobile:true})
  await navigate('/login');await waitFor('!!document.querySelector(".demo-button")')
  await evaluate(`sessionStorage.setItem('medcontrol_demo_data',JSON.stringify({user:null,medications:[],history:[],stats:{streakCount:0,lastStreakDate:null,totalDoses:0}}));localStorage.setItem('medcontrol-notifications-disabled','true');document.querySelector('.demo-button').click()`)
  await waitFor('!!document.querySelector(".routine-heading")')
  await openDrops('Remedio ficticio em gotas')
  assert.equal(await evaluate('!!document.querySelector("#med-quantity")'),false)
  assert.equal(await evaluate('document.querySelectorAll(".bottle-level-option").length'),5)
  assert.equal(await evaluate('document.querySelectorAll(".bottle-level-option input:checked").length'),0)
  await next();await waitFor('document.querySelector(".bottle-level-field [role=alert]")?.textContent.includes("Escolha")')
  assert.equal(await evaluate('document.activeElement.id'),'med-stockLevel')
  pass('drops_stock_uses_five_visual_choices_without_numeric_question_or_default')
  await choose('half');await audit('drops-form-half-mobile')
  assert.match(await evaluate('document.querySelector(".med-check-summary").textContent'),/20 gotas.*Frasco pela metade/s)
  await next();await waitFor('location.pathname==="/medicamentos"&&!!document.querySelector(".medication-detail")')
  let s=await state(),med=s.medications[0],id=med.id
  assert.equal(med.stockLevel,'half');assert.equal(med.unitsPerDose,20);assert.equal(med.current,0)
  assert.equal(await evaluate('document.querySelector(".med-symbol [data-medication-format]").dataset.medicationFormat'),'drops')
  assert.doesNotMatch(await evaluate('document.querySelector(".med-stock-detail").textContent'),/gotas|dias|0,001/)
  await audit('drops-card-mobile');pass('drop_dose_and_observation_saved_separately_with_distinct_icon')
  await navigate('/');await waitFor('!!document.querySelector(".dose-row button")')
  assert.equal(await evaluate('document.querySelector(".dose-row button").disabled'),false)
  assert.equal(await evaluate('document.querySelector(".dose-info h3 [data-medication-format=drops]").getBoundingClientRect().width>0'),true)
  await evaluate('(()=>{const b=document.querySelector(".dose-row button");b.click();b.click()})()')
  await waitFor('!!document.querySelector(".dose-done")');s=await state()
  assert.equal(s.history.length,1);assert.equal(s.medications[0].current,0);assert.equal(s.medications[0].stockLevel,'half')
  await audit('drops-agenda-after-confirmation');pass('mobile_agenda_icon_visible_and_double_confirmation_preserves_observation')
  await navigate(`/editar/${id}`);await waitFor('!!document.querySelector("#med-name")')
  await next();await step(2)
  assert.equal(await evaluate('document.querySelector("#med-units").value'),'20')
  await click('input[value=liquid]');assert.equal(await evaluate('document.querySelector("#med-units").value'),'')
  await next();await waitFor('!!document.querySelector("#med-units-error")')
  pass('changing_from_drops_requires_new_measure_without_any_conversion')
  await navigate(`/editar/${id}`);await waitFor('!!document.querySelector("#med-name")')
  await next();await step(2);await next();await step(3);await next();await step(4)
  assert.equal(await evaluate('document.querySelector(".bottle-level-option input:checked").value'),'half')
  assert.equal(await evaluate('!!document.querySelector("#med-quantity")'),false)
  await next();await waitFor('location.pathname==="/medicamentos"')
  assert.equal((await state()).medications[0].takenCount,1);pass('editing_preserves_dose_count_and_bottle_observation')
  await button('Atualizar frasco');await waitFor('!!document.querySelector("dialog[open]")')
  assert.equal(await evaluate('!!document.querySelector("dialog[open] input[type=number]")'),false)
  await choose('low');await audit('bottle-update-dialog-mobile')
  await button('Salvar situação do frasco');await waitFor('!document.querySelector("dialog[open]")')
  assert.equal((await state()).medications[0].stockLevel,'low')
  await click('.filter-button');assert.equal(await evaluate('document.querySelectorAll(".medication-detail").length'),1)
  await navigate('/farmacias');await waitFor('!!document.querySelector(".pharmacy-restock-list")')
  const restock=await evaluate('document.querySelector(".pharmacy-restock-list").textContent')
  assert.match(restock,/Está acabando/);assert.doesNotMatch(restock,/0 gotas|20 gotas no estoque/)
  pass('manual_low_level_drives_filter_and_pharmacy_list_without_drop_counts')
  await openDrops('Frasco ficticio vazio');await choose('empty');await next()
  await waitFor('location.pathname==="/medicamentos"')
  const emptyId=(await state()).medications.find(m=>m.name==='Frasco ficticio vazio').id
  await navigate('/');await waitFor('document.querySelectorAll(".dose-row").length===2')
  assert.equal(await evaluate('[...document.querySelectorAll(".dose-row")].find(r=>r.textContent.includes("Frasco ficticio vazio")).querySelector("button").disabled'),true)
  pass('empty_bottle_blocks_confirmation')
  await navigate('/medicamentos');await waitFor('document.querySelectorAll(".medication-detail").length===2')
  await evaluate('[...document.querySelectorAll(".medication-detail")].find(r=>r.textContent.includes("Frasco ficticio vazio")).querySelector(".med-card-actions button").click()')
  await waitFor('!!document.querySelector("dialog[open]")');await choose('full');await button('Salvar situação do frasco')
  await waitFor('!document.querySelector("dialog[open]")');await navigate('/')
  await waitFor('[...document.querySelectorAll(".dose-row")].some(r=>r.textContent.includes("Frasco ficticio vazio")&&r.querySelector("button"))')
  await evaluate('[...document.querySelectorAll(".dose-row")].find(r=>r.textContent.includes("Frasco ficticio vazio")).querySelector("button").click()')
  await waitFor('document.querySelectorAll(".dose-done").length===2');s=await state()
  assert.equal(s.history.length,2);assert.equal(s.medications.find(m=>m.id===emptyId).stockLevel,'full')
  pass('reporting_new_full_bottle_allows_confirmation_without_automatic_level_change')
  // Legacy unknown stock and icon regressions use deliberately fictitious fixtures.
  await evaluate(`(()=>{const s=JSON.parse(sessionStorage.getItem('medcontrol_demo_data'));const legacy={...s.medications[0],id:'legacy-drops',name:'Legado ficticio',stockLevel:undefined,current:0};s.medications.push(legacy,{...legacy,id:'liquid',name:'Liquido ficticio',stockUnit:'mL',unitsPerDose:2.5,current:10,total:10},{...legacy,id:'solid',name:'Solido ficticio',stockUnit:'unidades',unitsPerDose:1,current:10,total:10});sessionStorage.setItem('medcontrol_demo_data',JSON.stringify(s))})()`)
  await navigate('/medicamentos');await waitFor('document.querySelectorAll(".medication-detail").length===5')
  const icons=await evaluate('[...document.querySelectorAll(".medication-detail")].map(c=>({name:c.querySelector("h2").textContent,format:c.querySelector("[data-medication-format]").dataset.medicationFormat,stock:c.querySelector(".med-stock-detail").textContent}))')
  assert.equal(icons.find(m=>m.name==='Legado ficticio').format,'drops');assert.match(icons.find(m=>m.name==='Legado ficticio').stock,/Nível não informado/)
  assert.equal(icons.find(m=>m.name==='Liquido ficticio').format,'liquid');assert.equal(icons.find(m=>m.name==='Solido ficticio').format,'solid')
  pass('legacy_drops_show_unknown_and_icons_follow_saved_format')
  await mkdir('docs/screenshots',{recursive:true})
  for(const [width,height]of [[375,667],[768,1024],[1440,1000]]){
    await page('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<=900})
    for(const large of [false,true]){
      await evaluate(`localStorage.setItem('medcontrol_large_text','${large}')`)
      await openDrops('Conferencia ficticia de frasco em gotas');await choose('unknown')
      assert.equal(await evaluate('innerWidth'),width);assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'),true)
      await audit(`drops-form-${width}-large-${large}`)
      await evaluate('document.querySelector(".med-form-continue").scrollIntoView({block:"center"})')
      assert.equal(await evaluate('(()=>{const r=document.querySelector(".med-form-continue").getBoundingClientRect(),n=document.querySelector(".mobile-nav").getBoundingClientRect();return r.top>=0&&r.bottom<=(n.height?n.top:innerHeight)})()'),true)
      if(!large){await evaluate('document.querySelector(".bottle-level-field").scrollIntoView({block:"start"})');const shot=await page('Page.captureScreenshot',{format:'png'});await writeFile(`docs/screenshots/bottle-level-${width}.png`,Buffer.from(shot.data,'base64'))}
    }
    pass(`responsive_bottle_choices_${width}_normal_and_large`)
  }
  assert.equal(browser.errors.length,0)
  assert.equal(browser.requests.filter(r=>/supabase\.co\/(rest|functions)\//.test(r.url)&&!['GET','HEAD','OPTIONS'].includes(r.method)).length,0)
  await writeFile('docs/drop-medications-qa.json',JSON.stringify({checkedAt:new Date().toISOString(),environment:'Local Chrome CDP, disposable demo; no real medicines/accounts',browser:browser.version,cases,accessibility:a11y,uncaughtErrors:browser.errors,visualRegression:'INCONCLUSIVE: no previous equivalent bottle-level baseline',limitations:['No participant usability study or physical device test','Legacy/icon regression fixtures are identified in the script','Backend RPC and policy behavior tested separately in PostgreSQL']},null,2)+'\n')
  console.log(JSON.stringify({result:'passed',cases:cases.length,accessibilityStates:a11y.length}))
}finally{await browser.dispose()}
