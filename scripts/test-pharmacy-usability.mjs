// Focused local QA with fictitious establishments. No Google API or real GPS.
import assert from 'node:assert/strict'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { localBrowser } from './lib/local-browser.mjs'
const arg=name=>{const at=process.argv.indexOf(name);return at<0?undefined:process.argv[at+1]}
const axeSource=await readFile(arg('--axe-path')||'/tmp/medcontrol-pharmacy-a11y/node_modules/axe-core/axe.min.js','utf8')
const browser=await localBrowser(arg('--port')||'9338')
const {page,evaluate,waitFor,navigate,button}=browser,states=[]
try{
  await browser.grantPermissions(['geolocation'])
  await page('Emulation.setFocusEmulationEnabled',{enabled:true})
  await page('Emulation.setGeolocationOverride',{latitude:-22.90612,longitude:-47.06012,accuracy:35})
  await page('Page.addScriptToEvaluateOnNewDocument',{source:`
    window.__qaPharmacyRequests=[];
    const nativeFetch=window.fetch.bind(window);
    window.fetch=async(url,init)=>{
      if(!String(url).includes('ovp.dresel'))return nativeFetch(url,init);
      window.__qaPharmacyRequests.push(String(init.body));
      return new Response(JSON.stringify({elements:[
        {type:'node',id:9001,lat:-22.9061,lon:-47.0601,tags:{amenity:'pharmacy',name:'Farmácia fictícia Central (QA)','addr:street':'Rua de exemplo','addr:housenumber':'10',phone:'(19) 3333-4444'}},
        {type:'node',id:9002,lat:-22.907,lon:-47.061,tags:{amenity:'pharmacy',name:'Farmácia fictícia Bairro (QA)','addr:street':'Avenida de exemplo para conferir a leitura no celular','addr:housenumber':'20'}}
      ]}),{headers:{'Content-Type':'application/json'}});
    };
  `})
  await navigate('/login');await waitFor('!!document.querySelector(".demo-button")');await evaluate('document.querySelector(".demo-button").click()');await waitFor('!!document.querySelector(".routine-heading")')
  await mkdir('docs/screenshots',{recursive:true})
  for(const [width,height] of [[320,568],[375,812],[768,1024],[1440,1000]]){
    await page('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<900})
    for(const large of [false,true]){
      await navigate('/farmacias');await evaluate(`document.documentElement.classList.toggle('large-text',${large})`)
      await evaluate(axeSource+';true')
      for(const state of ['initial','results','routes']){
        if(state==='results'){
          await button('Usar minha localização');await waitFor('document.querySelectorAll(".pharmacy-card").length===2')
          await waitFor('document.activeElement.id==="pharmacy-results-title"')
        }
        if(state==='routes'){
          await evaluate('document.querySelector(".pharmacy-route-choice > summary").focus()')
          await page('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r',unmodifiedText:'\r'})
          await page('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13})
          await waitFor('document.querySelector(".pharmacy-route-choice").open')
          const urls=await evaluate('[...document.querySelector(".pharmacy-route-choice").querySelectorAll("a")].map(a=>a.href)')
          assert.equal(new URL(urls[0]).searchParams.get('destination'),'-22.9061,-47.0601')
          assert.equal(new URL(urls[1]).searchParams.get('ll'),'-22.9061,-47.0601')
        }
        const layout=await evaluate(`(()=>{
          const visible=e=>{if(!e.getClientRects().length)return false;for(let p=e;p;p=p.parentElement)if(p.tagName==='DETAILS'&&!p.open&&!p.querySelector(':scope > summary')?.contains(e))return false;return true};
          const clipped=[...document.querySelectorAll('.pharmacy-page *')].filter(visible).filter(e=>{const r=e.getBoundingClientRect();return r.left< -1||r.right>innerWidth+1}).map(e=>String(e.className));
          const b=document.querySelector('.pharmacy-search-panel > .btn').getBoundingClientRect();
          const nav=document.querySelector('.mobile-nav').getBoundingClientRect();
          return {width:innerWidth,documentWidth:document.documentElement.scrollWidth,clipped,primary:{top:b.top,bottom:b.bottom,visible:b.top>=0&&b.bottom<=(nav.height?nav.top:innerHeight)},visibleWaze:[...document.querySelectorAll('a[href*="waze.com"]')].filter(visible).length,providerRequests:window.__qaPharmacyRequests.length};
        })()`)
        assert.equal(layout.documentWidth,width);assert.deepEqual(layout.clipped,[])
        if(state==='initial'){assert.equal(layout.visibleWaze,0);assert.equal(layout.providerRequests,0);assert(layout.primary.visible,JSON.stringify({width,large,layout}))}
        if(state==='routes')assert.equal(layout.visibleWaze,1)
        const audit=await evaluate(`axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa','best-practice']}}).then(r=>({version:r.testEngine.version,violations:r.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))})),incomplete:r.incomplete.map(v=>({id:v.id,nodes:v.nodes.length}))}))`)
        assert.deepEqual(audit.violations,[],JSON.stringify({width,large,state,audit}))
        states.push({width,height,large,state,...layout,audit})
        if(width===375&&!large&&state!=='initial'){
          await evaluate(`document.querySelector(${JSON.stringify(state==='routes'?'.pharmacy-card':'.pharmacy-results')}).scrollIntoView({block:'start'})`)
          const shot=await page('Page.captureScreenshot',{format:'png'})
          await writeFile(`docs/screenshots/farmacias-${state==='routes'?'rotas':'lista'}-mobile.png`,Buffer.from(shot.data,'base64'))
        }
      }
    }
  }
  assert.equal(browser.errors.length,0,JSON.stringify(browser.errors))
  const report={checkedAt:new Date().toISOString(),environment:'Local disposable Chrome demo; provider results and coordinates are fictitious fixtures',states,unexpectedExceptions:browser.errors,limitations:['New layout has no matching pixel baseline; pixel regression comparison is inconclusive','Automated axe results do not certify WCAG compliance','No physical GPS or VoiceOver/TalkBack validation']}
  await writeFile('docs/pharmacy-usability-qa.json',JSON.stringify(report,null,2)+'\n')
  console.log(JSON.stringify({result:'passed',states:states.length,axeViolations:0,layoutOverflows:0,errors:0}))
}finally{await browser.dispose()}
