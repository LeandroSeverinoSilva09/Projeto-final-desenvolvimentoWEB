// Disposable PostgreSQL engine; validates the deployed schema without remote writes.
// node scripts/test-reminder-claims-sql.mjs --pglite-path /tmp/medcontrol-drop-qa/node_modules/@electric-sql/pglite/dist/index.js
import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
const at=process.argv.indexOf('--pglite-path')
assert(at>=0,'Informe a instalacao temporaria de PGlite com --pglite-path.')
const {PGlite}=await import(pathToFileURL(process.argv[at+1]).href)
const db=new PGlite(),cases=[]
const owner='11111111-1111-4111-8111-111111111111',med='22222222-2222-4222-8222-222222222222',sub='33333333-3333-4333-8333-333333333333'
const claim=async(time,date='2026-11-25')=>(await db.query('select public.claim_notification_delivery($1,$2,$3,$4) as token',[sub,med,date,time])).rows[0].token
const pass=name=>{cases.push({name,result:'passed'});console.log(JSON.stringify({check:name,result:'passed'}))}
try{
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
    create schema auth;create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth,public to authenticated,anon;
    insert into auth.users values('${owner}');`)
  for(const file of ['202611230001_medcontrol.sql','202611230005_push_delivery_leases.sql'])await db.exec(await readFile('supabase/migrations/'+file,'utf8'))
  await db.query(`insert into public.medications(id,user_id,name,dose,current,total,schedules) values($1,$2,'Ficticio QA','1 unidade',10,10,ARRAY['00:02'])`,[med,owner])
  await db.query(`insert into public.push_subscriptions(id,user_id,endpoint,subscription) values($1,$2,'https://example.invalid/fictitious','{}')`,[sub,owner])
  for(const role of ['anon','authenticated']){
    await db.exec('set role '+role)
    await assert.rejects(claim('before:00:02'),/permission denied/)
    await db.exec('reset role')
  }
  pass('anonymous_and_authenticated_clients_cannot_reserve_notifications')
  await db.exec('set role service_role')
  const advance=await claim('before:00:02')
  assert(advance);assert.equal(await claim('before:00:02'),null)
  pass('advance_claim_is_accepted_by_existing_schema_and_reserved_once')
  const due=await claim('00:02')
  assert(due);assert.notEqual(advance,due);assert.equal(await claim('00:02'),null)
  pass('due_claim_remains_independent_and_does_not_duplicate')
  await db.query("update public.notification_deliveries set delivered_at=now() where schedule_time='before:00:02'")
  await db.query("update public.notification_deliveries set claimed_at=now()-interval '60 seconds' where schedule_time='00:02'")
  const retried=await claim('00:02')
  assert(retried);assert.notEqual(retried,due)
  assert.equal((await db.query('delete from public.notification_deliveries where claim_token=$1 returning claim_token',[due])).rows.length,0)
  pass('abandoned_due_can_retry_without_stale_worker_releasing_new_claim')
  await db.query("update public.notification_deliveries set delivered_at=now(),claimed_at=now()-interval '60 seconds'")
  assert.equal(await claim('before:00:02'),null);assert.equal(await claim('00:02'),null)
  pass('completed_advance_and_due_cannot_be_reserved_again')
  assert(await claim('before:00:02','2026-11-26'));assert(await claim('00:02','2026-11-26'))
  const dates=(await db.query('select distinct scheduled_date::text as day from public.notification_deliveries order by day')).rows.map(r=>r.day)
  assert.deepEqual(dates,['2026-11-25','2026-11-26'])
  pass('target_dose_date_keeps_midnight_and_following_day_separate')
  await writeFile('docs/notification-claims-sql-qa.json',JSON.stringify({checkedAt:new Date().toISOString(),environment:'PGlite disposable in-memory PostgreSQL, migrations 001 and 005, no remote writes',cases,limitations:['No hosted Supabase Auth or PostgREST exercised','Single engine does not reproduce multiple remote processes']},null,2)+'\n')
}finally{await db.close()}
