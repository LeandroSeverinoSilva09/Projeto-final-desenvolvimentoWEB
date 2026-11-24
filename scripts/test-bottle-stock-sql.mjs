// Real PostgreSQL engine in disposable memory, no network/database credentials.
// npm install --prefix /tmp/medcontrol-drop-qa --no-save --ignore-scripts @electric-sql/pglite
// node scripts/test-bottle-stock-sql.mjs --pglite-path /tmp/medcontrol-drop-qa/node_modules/@electric-sql/pglite/dist/index.js
import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

const at=process.argv.indexOf('--pglite-path')
assert(at>=0,'Informe o caminho de uma instalacao temporaria do PGlite com --pglite-path.')
const {PGlite}=await import(pathToFileURL(process.argv[at+1]).href)
const db=new PGlite(),cases=[]
const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222'
const ids={legacy:'00000000-0000-4000-8000-000000000001',half:'00000000-0000-4000-8000-000000000002',empty:'00000000-0000-4000-8000-000000000003',liquid:'00000000-0000-4000-8000-000000000004',foreign:'00000000-0000-4000-8000-000000000005'}
const row=async id=>(await db.query('select current,stock_level from public.medications where id=$1',[id])).rows[0]
const confirm=id=>db.query('select public.confirm_medication_dose($1, $2, $3)',[id,'00:00','UTC'])
const pass=name=>{cases.push({name,result:'passed'});console.log(JSON.stringify({check:name,result:'passed'}))}
try{
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
    create schema auth;create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth,public to authenticated,anon;
    insert into auth.users values('${owner}'),('${other}');`)
  for(const file of ['202611230001_medcontrol.sql','202611230002_fractional_stock.sql','202611230003_fractional_capacity.sql'])await db.exec(await readFile('supabase/migrations/'+file,'utf8'))
  await db.query(`insert into public.medications(id,user_id,name,dose,current,total,schedules,units_per_dose,stock_unit) values($1,$2,'Legado ficticio','20 gotas',123,200,ARRAY['00:00'],20,'gotas')`,[ids.legacy,owner])
  await db.exec(await readFile('supabase/migrations/202611240006_bottle_stock.sql','utf8'))
  assert.deepEqual(await row(ids.legacy),{current:'123.000',stock_level:'unknown'})
  pass('migration_preserves_legacy_balance_and_does_not_guess_bottle_level')
  await db.query(`insert into public.medications(id,user_id,name,dose,current,total,schedules,units_per_dose,stock_unit,stock_level) values
    ($1,$6,'Gotas ficticias','20 gotas',0,0.001,ARRAY['00:00'],20,'gotas','half'),
    ($2,$6,'Frasco vazio ficticio','20 gotas',200,200,ARRAY['00:00'],20,'gotas','empty'),
    ($3,$6,'Liquido ficticio','2,5 mL',10.5,10.5,ARRAY['00:00'],2.5,'mL','unknown'),
    ($4,$5,'Outra conta ficticia','1 unidade',10,10,ARRAY['00:00'],1,'unidades','unknown')`,[ids.half,ids.empty,ids.liquid,ids.foreign,other,owner])
  await db.exec('set role anon')
  await assert.rejects(confirm(ids.half),/permission denied/)
  pass('anonymous_cannot_execute_dose_rpc')
  await db.exec('reset role;set role authenticated')
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[owner])
  assert.equal((await db.query('select id from public.medications where id=$1',[ids.foreign])).rows.length,0)
  await assert.rejects(confirm(ids.foreign),/não encontrado/)
  assert.equal((await db.query("update public.medications set stock_level='full' where id=$1 returning id",[ids.foreign])).rows.length,0)
  pass('rls_and_rpc_ownership_remain_enforced')
  await confirm(ids.half)
  assert.deepEqual(await row(ids.half),{current:'0.000',stock_level:'half'})
  assert.equal((await db.query('select id from public.dose_records where medication_id=$1',[ids.half])).rows.length,1)
  await assert.rejects(confirm(ids.half),/já foi registrada/)
  pass('drop_dose_records_once_without_subtracting_or_changing_observation')
  await confirm(ids.legacy)
  assert.deepEqual(await row(ids.legacy),{current:'123.000',stock_level:'unknown'})
  pass('unknown_legacy_bottle_allows_explicit_confirmation_without_numeric_inference')
  await assert.rejects(confirm(ids.empty),/frasco.*vazio/)
  await assert.rejects(db.query('select public.restock_medication($1,10)',[ids.empty]),/atualize.*frasco/)
  pass('empty_bottle_blocks_dose_and_numeric_refill_is_rejected')
  await db.query("update public.medications set stock_level='full' where id=$1",[ids.empty])
  await confirm(ids.empty)
  assert.deepEqual(await row(ids.empty),{current:'200.000',stock_level:'full'})
  await assert.rejects(db.query("update public.medications set stock_level='invalid' where id=$1",[ids.empty]),/check constraint/)
  pass('user_can_report_new_bottle_and_invalid_levels_are_rejected')
  await confirm(ids.liquid)
  assert.equal((await row(ids.liquid)).current,'8.000')
  await db.query('select public.restock_medication($1,0.5)',[ids.liquid])
  assert.equal((await row(ids.liquid)).current,'8.500')
  pass('measured_liquid_still_subtracts_and_replenishes_exact_decimals')
  await db.exec('reset role')
  const permissions=(await db.query(`select has_function_privilege('anon','public.confirm_medication_dose(uuid,text,text)','execute') as anon,has_function_privilege('authenticated','public.confirm_medication_dose(uuid,text,text)','execute') as authenticated`)).rows[0]
  assert.deepEqual(permissions,{anon:false,authenticated:true})
  pass('migration_keeps_rpc_permissions')
  await writeFile('docs/bottle-stock-sql-qa.json',JSON.stringify({checkedAt:new Date().toISOString(),environment:'PGlite disposable in-memory PostgreSQL; no remote project mutations',cases,limitations:['No hosted Supabase Auth or PostgREST exercised','Single in-memory engine does not reproduce multi-process concurrency']},null,2)+'\n')
}finally{await db.close()}
