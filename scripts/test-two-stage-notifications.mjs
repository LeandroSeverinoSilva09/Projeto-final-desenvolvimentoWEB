// Native open-app notification check, real wall clock: runs for roughly six minutes.
// Dedicated disposable Chrome only; observe native events without simulating their success.
import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { localBrowser, pause } from './lib/local-browser.mjs'
const arg=name=>{const at=process.argv.indexOf(name);return at<0?undefined:process.argv[at+1]}
const origin=arg('--origin')||'http://127.0.0.1:5173'
const browser=await localBrowser(arg('--port')||'9338',origin)
const {page,evaluate,waitFor,navigate,button}=browser
try{
  await browser.grantPermissions(['notifications'])
  await page('Emulation.setFocusEmulationEnabled',{enabled:true})
  await page('Page.addScriptToEvaluateOnNewDocument',{source:`
    window.__qaNotices=[];
    // Keep real observations across a Vite reload during a long-running check.
    window.__qaNotificationEvents=JSON.parse(sessionStorage.getItem('__qaNotificationEvents')||'[]');
    const recordEvent=event=>{window.__qaNotificationEvents.push(event);sessionStorage.setItem('__qaNotificationEvents',JSON.stringify(window.__qaNotificationEvents))};
    const NativeNotification=window.Notification;
    window.Notification=class extends NativeNotification {
      constructor(title,options){super(title,options);window.__qaNotices.push(this);
        const record=type=>recordEvent({type,title,tag:options?.tag,body:options?.body,time:Date.now()});
        record('created');this.addEventListener('show',()=>record('show'));this.addEventListener('error',()=>record('error'));
      }
    };
    if('ServiceWorkerRegistration' in window){
      const nativeShow=ServiceWorkerRegistration.prototype.showNotification;
      ServiceWorkerRegistration.prototype.showNotification=async function(title,options){
        recordEvent({type:'worker-created',title,tag:options?.tag,body:options?.body,time:Date.now()});
        await nativeShow.call(this,title,options);
        recordEvent({type:'worker-accepted',title,tag:options?.tag,body:options?.body,time:Date.now()});
      };
    }
  `})
  await navigate('/login');await waitFor('!!document.querySelector(".demo-button")')
  assert.equal(await evaluate('Notification.permission'),'granted')
  const planned=await evaluate(`(()=>{
    const due=new Date(Date.now()+6*60000);due.setSeconds(0,0);
    if(due.getTime()-5*60000-Date.now()<15000)due.setMinutes(due.getMinutes()+1);
    const time=due.toTimeString().slice(0,5);
    sessionStorage.setItem('medcontrol_demo_data',JSON.stringify({user:null,medications:[{id:'two-stage-native',name:'Remedio ficticio QA',dose:'Exemplo ficticio',current:10,total:10,unitsPerDose:1,schedules:time,frequency:24,takenCount:0,createdAt:new Date().toISOString()}],history:[],stats:{streakCount:0,lastStreakDate:null,totalDoses:0}}));
    localStorage.removeItem('medcontrol-notifications-disabled');document.querySelector('.demo-button').click();
    return {time,dueAt:due.getTime(),advanceAt:due.getTime()-5*60000,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone};
  })()`)
  await waitFor('!!document.querySelector(".routine-heading")')
  if(origin.endsWith(':4173'))await waitFor('navigator.serviceWorker.getRegistration().then(r=>!!r?.active)')
  await button('Enviar teste agora')
  const shown=title=>`window.__qaNotificationEvents.filter(e=>['show','worker-accepted'].includes(e.type)&&e.title===${JSON.stringify(title)})`
  await waitFor(shown('Teste de aviso local')+'.length===1')
  assert.equal(await evaluate('document.querySelector(".dose-row button").disabled'),true)
  const advanceTitle='Prepare-se para seu cuidado',dueTitle='Seu cuidado tem hora'
  assert.equal(await evaluate(shown(dueTitle)+'.length'),0)
  console.log(JSON.stringify({check:'real_clock_plan',origin,...planned}))
  await waitFor(shown(advanceTitle)+'.length===1',Math.max(1000,planned.advanceAt-Date.now()+45000))
  const advance=(await evaluate(shown(advanceTitle)))[0]
  assert(advance.time>=planned.advanceAt&&advance.time<=planned.advanceAt+30000,'O aviso antecipado deve ser solicitado no minuto de cinco minutos antes.')
  assert.equal(await evaluate('document.querySelector(".dose-row button").disabled'),true,'O aviso antecipado nao libera confirmacao antes do horario.')
  console.log(JSON.stringify({check:'native_five_minute_notice',origin,leadSeconds:(planned.dueAt-advance.time)/1000,event:advance.type}))
  await waitFor(shown(dueTitle)+'.length===1',Math.max(1000,planned.dueAt-Date.now()+45000))
  const due=(await evaluate(shown(dueTitle)))[0]
  assert(due.time>=planned.dueAt&&due.time<=planned.dueAt+30000)
  assert.notEqual(advance.tag,due.tag)
  await pause(16000)
  assert.equal(await evaluate(shown(advanceTitle)+'.length'),1)
  assert.equal(await evaluate(shown(dueTitle)+'.length'),1)
  assert.equal(await evaluate('JSON.parse(sessionStorage.getItem("medcontrol_demo_data")).history.length'),0)
  console.log(JSON.stringify({check:'native_due_notice_and_deduplication',origin,delaySeconds:(due.time-planned.dueAt)/1000}))
  const events=await evaluate('window.__qaNotificationEvents')
  await navigate('/configuracoes');await waitFor('[...document.querySelectorAll("button")].some(b=>b.textContent==="Desativar notificações")')
  await button('Desativar notificações');await waitFor('localStorage.getItem("medcontrol-notifications-disabled")==="true"')
  await evaluate(`(()=>{const s=JSON.parse(sessionStorage.getItem('medcontrol_demo_data'));s.medications[0].id='disabled-stage';s.medications[0].schedules=new Date(Date.now()+5*60000).toTimeString().slice(0,5);sessionStorage.setItem('medcontrol_demo_data',JSON.stringify(s));sessionStorage.removeItem('__qaNotificationEvents')})()`)
  await navigate('/');await pause(16000)
  assert.equal(await evaluate('window.__qaNotificationEvents.length'),0)
  assert.equal(browser.requests.filter(r=>r.url.includes('/push_subscriptions')).length,0)
  assert.equal(browser.errors.length,0)
  const report={checkedAt:new Date().toISOString(),origin,browser:browser.version,clock:'Real wall clock; Date and success events are not simulated',planned,advance,due,advanceLeadSeconds:(planned.dueAt-advance.time)/1000,dueDelaySeconds:(due.time-planned.dueAt)/1000,events,deduplication:'passed',disabled:'passed',remoteSubscriptionRequests:0,limitations:['Native browser acceptance is not visual confirmation of an OS banner','This is the open-app local path; server/provider delivery is validated separately','No physical-device or closed-browser receipt observed']}
  const path=origin.endsWith(':4173')?'docs/notification-two-stage-pwa-qa.json':'docs/notification-two-stage-desktop-qa.json'
  await writeFile(path,JSON.stringify(report,null,2)+'\n')
  console.log(JSON.stringify({result:'passed',path,advanceLeadSeconds:report.advanceLeadSeconds,dueDelaySeconds:report.dueDelaySeconds}))
}finally{await browser.dispose()}
