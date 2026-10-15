import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,mkdirSync,readFileSync,symlinkSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {validate,recovery,ownerPlan,summary,dispatch,writeSummary,main} from '../tools/workflow.mjs';

const head='a'.repeat(40),now=Date.now();
function fixture(){return{
 schema_version:1,project:{name:'Synthetic',repository:'owner/synthetic',profile:'greenfield'},
 scope:{active_phase:'Prototype',authority:['Synthetic tests only'],prohibited:['No live services']},
 workspace:{execution:'work',source_mode:'checkout',durability:'git',limitations:['Cannot operate owner PC']},
 current:{milestone:'Journey',outcome:'Complete one task',risk:'STANDARD',stage:'TESTING',next_action:'Run checks',blockers:[]},
 checks:{source_head:head,required:[{id:'regression',status:'PASS',head,evidence:'offline:test'}]},
 capabilities:[{id:'login',title:'Login',implemented:true,automated:'PASS',physical:'PARTIAL',released:true,operationally_enabled:false,evidence:[{kind:'automated',head,reference:'offline:test'},{kind:'release',head,reference:'offline:release'}]}],
 owner_session:{status:'READY',cleanup:'NOT_RUN',run_id:'synthetic-1',source_head:head,starts_at:now-10000,ends_at:now+15*60000,evidence:'offline:prepared'},
 uat:[{id:'native',mode:'OWNER',reason:'Actual device unlock',minutes:3,status:'NOT_RUN'},{id:'denial',mode:'AUTOMATED',reason:'Synthetic account denial',minutes:0,status:'PASS'}],
 metrics:{owner_interruptions:null,manual_commands:null,repeated_cases:null,recovery_minutes:null}};}
test('valid partial acceptance never implies operational readiness',()=>{
 const s=fixture();assert.equal(validate(s),s);assert.equal(summary(s).capabilities[0].operationally_enabled,false);
 assert.equal(ownerPlan(s,now).cases.length,1);assert.equal(ownerPlan(s,now).ready,true);
});
for(const mutate of [s=>s.checks.required[0].head='b'.repeat(40),s=>s.capabilities[0].evidence=[],s=>s.capabilities[0].operationally_enabled=true,s=>s.capabilities[0].physical='NOT_REQUIRED',s=>s.owner_session.ends_at=s.owner_session.starts_at])test('incomplete or inconsistent evidence is rejected '+String(mutate),()=>{
 const s=fixture();mutate(s);assert.throws(()=>validate(s));
});
test('activation requires separate physical and activation evidence',()=>{
 const s=fixture(),cap=s.capabilities[0];cap.physical='PASS';cap.operationally_enabled=true;
 cap.evidence.push({kind:'physical',head,reference:'owner:observed'});assert.throws(()=>validate(s),/ACTIVATION/);
 cap.evidence.push({kind:'activation',head,reference:'governance:explicit'});assert.equal(validate(s),s);
});
test('time budget, future start, blockers, failed checks and empty physical plan block dispatch readiness',()=>{
 for(const mutate of [s=>s.owner_session.ends_at=now+6*60000,s=>s.owner_session.starts_at=now+1000,s=>s.current.blockers.push('Incomplete evidence'),s=>s.checks.required[0].status='FAIL',s=>s.uat[0].status='PASS',s=>s.owner_session.source_head='b'.repeat(40)]){
  const s=fixture();mutate(s);assert.equal(ownerPlan(s,now).ready,false);
 }
});
test('completed runs never replay and expired runs need cleanup',()=>{
 const s=fixture();assert.equal(recovery(s,s.owner_session.ends_at).state,'CLEANUP_REQUIRED');
 s.owner_session.status='COMPLETED';assert.throws(()=>recovery(s),/CLEANUP/);s.owner_session.cleanup='PASS';assert.equal(recovery(s).state,'COMPLETED');assert.equal(ownerPlan(s).ready,false);
});
for(const status of ['NOT_PREPARED','INPUTS_PENDING','PREPARING','UNKNOWN','CLEANUP_REQUIRED'])test('recovery preserves uncertain lifecycle '+status,()=>{
 const s=fixture();s.owner_session.status=status;assert.equal(recovery(s).state,status);assert.equal(ownerPlan(s).ready,false);
});
test('secret metadata and credentialed links rejected without echoing values',()=>{
 for(const value of [{password:'PRIVATE_CANARY'},{reference:'https://example.invalid/?token=PRIVATE_CANARY'},{reference:'postgres://user:PRIVATE_CANARY@host/db'}]){
  const s=fixture();s.extra=value;assert.throws(()=>validate(s),e=>!e.message.includes('PRIVATE_CANARY')&&/SECRET/.test(e.message));
 }
});
test('render is deterministic and cannot overwrite through an outside symlink',()=>{
 const root=mkdtempSync(join(tmpdir(),'workflow-render-')),outside=mkdtempSync(join(tmpdir(),'workflow-outside-'));
 try{
  mkdirSync(join(root,'.ai-development'));writeSummary(root,fixture());const text=readFileSync(join(root,'.ai-development/STATUS.md'),'utf8');writeSummary(root,fixture());assert.equal(readFileSync(join(root,'.ai-development/STATUS.md'),'utf8'),text);
  rmSync(join(root,'.ai-development/STATUS.md'));writeFileSync(join(outside,'target'),'preserve');symlinkSync(join(outside,'target'),join(root,'.ai-development/STATUS.md'));
  assert.throws(()=>writeSummary(root,fixture()));assert.equal(readFileSync(join(outside,'target'),'utf8'),'preserve');
 }finally{rmSync(root,{recursive:true,force:true});rmSync(outside,{recursive:true,force:true});}
});
test('CLI refuses unknown commands and does not expose malformed state',()=>{
 const root=mkdtempSync(join(tmpdir(),'workflow-cli-'));
 try{mkdirSync(join(root,'.ai-development'));writeFileSync(join(root,'.ai-development/state.json'),JSON.stringify(fixture()));assert.equal(main(['check',root]).status,'STATE_VALID');assert.throws(()=>main(['typo',root]),/UNKNOWN_COMMAND/);}finally{rmSync(root,{recursive:true,force:true});}
});
test('help works before a project has state',()=>{
 assert.ok(main(['--help',tmpdir()]).commands.includes('doctor'));
});
for(const failure of ['preflight','worker','source-change','plan-change'])test('dispatcher preserves evidence and stops on '+failure,()=>{
 const root=mkdtempSync(join(tmpdir(),'workflow-stop-')),outside=mkdtempSync(join(tmpdir(),'workflow-proof-'));
 const git=args=>{const r=spawnSync('git',['-C',root,...args],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout.trim();};
 try{
  git(['init','--quiet']);mkdirSync(join(root,'.ai-development'));writeFileSync(join(root,'.ai-development/state.json'),JSON.stringify(fixture()));
  const marker=join(outside,'ran'),planPath=join(outside,'plan.json');
  const worker=`import {writeFileSync,readFileSync} from 'node:fs';
   if(process.argv[2]==='--check'){
    if(${JSON.stringify(failure)}==='preflight')process.exit(7);
    if(${JSON.stringify(failure)}==='source-change')writeFileSync('changed-source','changed');
    if(${JSON.stringify(failure)}==='plan-change'){const p=JSON.parse(readFileSync(${JSON.stringify(planPath)},'utf8'));p.current.stage='CHANGED';writeFileSync(${JSON.stringify(planPath)},JSON.stringify(p));}
   }else{writeFileSync(${JSON.stringify(marker)},'ran');if(${JSON.stringify(failure)}==='worker')process.exit(9);}`;
  writeFileSync(join(root,'worker.mjs'),worker);writeFileSync(join(root,'.ai-development/owner-adapter.json'),JSON.stringify({enabled:true,governance_reference:'fixture:only',runtime:'node',script:'worker.mjs',check_args:['--check'],run_args:['--run']}));
  git(['add','.']);git(['-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','--quiet','-m','fixture']);const source=git(['rev-parse','HEAD']);
  const plan=fixture();plan.owner_session.source_head=source;plan.checks.source_head=source;plan.checks.required[0].head=source;writeFileSync(planPath,JSON.stringify(plan));
  const codes={preflight:/PREFLIGHT_FAILED/,worker:/STOPPED_PRESERVE_EVIDENCE/,'source-change':/SOURCE_CHANGED/,'plan-change':/WINDOW_NO_LONGER_READY/};
  assert.throws(()=>dispatch(root,source,true,planPath),codes[failure]);
  if(failure!=='worker')assert.throws(()=>readFileSync(marker));
  assert.ok(readFileSync(planPath,'utf8').length>0);
 }finally{rmSync(root,{recursive:true,force:true});rmSync(outside,{recursive:true,force:true});}
});
test('dispatcher requires clean exact source and a reviewed adapter; external plan is bound to project and source',()=>{
 const root=mkdtempSync(join(tmpdir(),'workflow-dispatch-')),outside=mkdtempSync(join(tmpdir(),'workflow-plan-'));
 const git=args=>{const r=spawnSync('git',['-C',root,...args],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout.trim();};
 try{
  git(['init','--quiet']);mkdirSync(join(root,'.ai-development'));writeFileSync(join(root,'.ai-development/state.json'),JSON.stringify(fixture()));
  const marker=join(outside,'ran');writeFileSync(join(root,'worker.mjs'),"import {writeFileSync} from 'node:fs'; if(process.argv[2]==='--run')writeFileSync(process.argv[3],'ran');");
  writeFileSync(join(root,'.ai-development/owner-adapter.json'),JSON.stringify({enabled:true,governance_reference:'fixture:only',runtime:'node',script:'worker.mjs',check_args:['--check'],run_args:['--run',marker]}));
  git(['add','.']);git(['-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','--quiet','-m','fixture']);const source=git(['rev-parse','HEAD']);
  const plan=fixture();plan.owner_session.source_head=source;const path=join(outside,'plan.json');writeFileSync(path,JSON.stringify(plan));
  assert.throws(()=>dispatch(root,source,false,path),/OWNER_READY/);
  assert.throws(()=>dispatch(root,head,true,path),/CLEAN_PINNED/);
  plan.project.repository='wrong/project';writeFileSync(path,JSON.stringify(plan));assert.throws(()=>dispatch(root,source,true,path),/PROJECT_MISMATCH/);
  plan.project.repository='owner/synthetic';writeFileSync(path,JSON.stringify(plan));assert.throws(()=>dispatch(root,source,true,path),/CHECK_SOURCE_MISMATCH/);
  plan.checks.source_head=source;plan.checks.required[0].head=source;writeFileSync(path,JSON.stringify(plan));assert.equal(dispatch(root,source,true,path).status,'ADAPTER_EXITED_ZERO');assert.equal(readFileSync(marker,'utf8'),'ran');
  writeFileSync(join(root,'untracked'),'unknown');assert.throws(()=>dispatch(root,source,true,path),/CLEAN_PINNED/);
 }finally{rmSync(root,{recursive:true,force:true});rmSync(outside,{recursive:true,force:true});}
});
