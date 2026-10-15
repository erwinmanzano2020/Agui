import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,mkdirSync,readFileSync,symlinkSync,rmSync,copyFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {validate,recovery,ownerPlan,summary,dispatch,writeSummary,main,resolvePowerShell,verifyPinnedFile} from '../tools/workflow.mjs';

const head='a'.repeat(40),now=Date.now();
async function projectDispatcher(root){
 const file=join(root,'.ai-development/tools/workflow.mjs');mkdirSync(join(root,'.ai-development/tools'),{recursive:true});
 copyFileSync(fileURLToPath(new URL('../tools/workflow.mjs',import.meta.url)),file);
 writeFileSync(join(root,'project.mjs'),"import './.ai-development/tools/workflow.mjs';\n");
 return(await import(pathToFileURL(file).href)).dispatch;
}
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
test('standard credential aliases, token formats and encoded URL parameters are blocked',()=>{
 for(const key of ['access_token','refreshToken','id-token','api_key','client_secret','credentials','authorization','serviceRoleKey']){
  const s=fixture();s.project[key]='PRIVATE_CANARY';assert.throws(()=>validate(s),e=>/SECRET/.test(e.message)&&!e.message.includes('PRIVATE_CANARY'));
 }
 for(const value of ['https://example.invalid/?access_token=PRIVATE_CANARY','https://example.invalid/?%61pi_key=PRIVATE_CANARY','https://example.invalid/#refresh_token=PRIVATE_CANARY','https://user:PRIVATE_CANARY@example.invalid/','sk-proj-'+ 'x'.repeat(30),'AKIA'+'X'.repeat(16),'Bearer PRIVATE_CANARY','eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.synthetic']){
  const s=fixture();s.current.outcome=value;assert.throws(()=>validate(s),/SECRET_VALUE_FORBIDDEN/);
 }
 const s=fixture();s.project.unrecognized='opaque';assert.throws(()=>validate(s),/UNKNOWN_STATE_FIELD/);
});
for(const status of ['FAIL','PARTIAL','NOT_RUN'])test('automated UAT '+status+' blocks owner readiness even with passing checks',()=>{
 const s=fixture();s.uat.find(x=>x.mode==='AUTOMATED').status=status;assert.equal(ownerPlan(s,now).ready,false);
});
test('PowerShell discovery prefers ProgramFiles then falls back to PATH',()=>{
 const calls=[],programFiles=resolve(tmpdir(),'synthetic-program-files');
 const selected=resolvePowerShell('win32',programFiles,executable=>{calls.push(executable);return executable==='pwsh'?{status:0,stdout:'7\n'}:{status:null,stdout:''};});
 assert.equal(selected,'pwsh');assert.deepEqual(calls,[resolve(programFiles,'PowerShell/7/pwsh.exe'),'pwsh']);
 const first=resolvePowerShell('win32',programFiles,executable=>({status:0,stdout:'7\n'}));assert.equal(first,resolve(programFiles,'PowerShell/7/pwsh.exe'));
 assert.equal(resolvePowerShell('win32',programFiles,()=>({status:0,stdout:'5\n'})),null);
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
test('pinned file comparison permits only checkout newline conversion, never replacement bytes',()=>{
 const root=mkdtempSync(join(tmpdir(),'workflow-bytes-'));
 const git=args=>{const r=spawnSync('git',['-C',root,...args],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout.trim();};
 try{
  git(['init','--quiet']);writeFileSync(join(root,'worker.mjs'),'// reviewed\nexport const value=1;\n');git(['add','.']);git(['-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','--quiet','-m','fixture']);const source=git(['rev-parse','HEAD']);
  verifyPinnedFile(root,source,'worker.mjs');writeFileSync(join(root,'worker.mjs'),'// reviewed\r\nexport const value=1;\r\n');verifyPinnedFile(root,source,'worker.mjs');
  writeFileSync(join(root,'worker.mjs'),'// reviewed\nexport const value=2;\n');assert.throws(()=>verifyPinnedFile(root,source,'worker.mjs'),/PINNED_EXECUTABLE_CHANGED/);
 }finally{rmSync(root,{recursive:true,force:true});}
});
for(const failure of ['preflight','worker','source-change','plan-change','timeout','stdin'])test('dispatcher preserves evidence and stops on '+failure,async()=>{
 const root=mkdtempSync(join(tmpdir(),'workflow-stop-')),outside=mkdtempSync(join(tmpdir(),'workflow-proof-'));
 const git=args=>{const r=spawnSync('git',['-C',root,...args],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout.trim();};
 try{
  git(['init','--quiet']);const dispatch=await projectDispatcher(root);writeFileSync(join(root,'.ai-development/state.json'),JSON.stringify(fixture()));
  const marker=join(outside,'ran'),planPath=join(outside,'plan.json');
  const worker=`import {writeFileSync,readFileSync} from 'node:fs';
   if(process.argv[2]==='--check'){
    if(${JSON.stringify(failure)}==='preflight')process.exit(7);
    if(${JSON.stringify(failure)}==='timeout')setInterval(()=>{},1000);
    if(${JSON.stringify(failure)}==='stdin'&&readFileSync(0).length===0)process.exit(7);
    if(${JSON.stringify(failure)}==='source-change')writeFileSync('changed-source','changed');
    if(${JSON.stringify(failure)}==='plan-change'){const p=JSON.parse(readFileSync(${JSON.stringify(planPath)},'utf8'));p.current.stage='CHANGED';writeFileSync(${JSON.stringify(planPath)},JSON.stringify(p));}
   }else{writeFileSync(${JSON.stringify(marker)},'ran');if(${JSON.stringify(failure)}==='worker')process.exit(9);}`;
  writeFileSync(join(root,'worker.mjs'),worker);writeFileSync(join(root,'.ai-development/owner-adapter.json'),JSON.stringify({enabled:true,governance_reference:'fixture:only',runtime:'node',script:'worker.mjs',check_args:['--check'],run_args:['--run'],preflight_timeout_ms:failure==='timeout'?200:30000}));
  git(['add','.']);git(['-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','--quiet','-m','fixture']);const source=git(['rev-parse','HEAD']);
  const plan=fixture();plan.owner_session.source_head=source;plan.checks.source_head=source;plan.checks.required[0].head=source;writeFileSync(planPath,JSON.stringify(plan));
  const codes={preflight:/PREFLIGHT_FAILED/,worker:/STOPPED_PRESERVE_EVIDENCE/,'source-change':/SOURCE_CHANGED/,'plan-change':/WINDOW_NO_LONGER_READY/,timeout:/PREFLIGHT_FAILED/,stdin:/PREFLIGHT_FAILED/};
  assert.throws(()=>dispatch(root,source,true,planPath),codes[failure]);
  if(failure!=='worker')assert.throws(()=>readFileSync(marker));
  assert.ok(readFileSync(planPath,'utf8').length>0);
 }finally{rmSync(root,{recursive:true,force:true});rmSync(outside,{recursive:true,force:true});}
});
test('dispatcher requires clean exact source and a reviewed adapter; external plan is bound to project and source',async()=>{
 const root=mkdtempSync(join(tmpdir(),'workflow-dispatch-')),outside=mkdtempSync(join(tmpdir(),'workflow-plan-'));
 const git=args=>{const r=spawnSync('git',['-C',root,...args],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout.trim();};
 try{
  git(['init','--quiet']);const dispatch=await projectDispatcher(root);writeFileSync(join(root,'.ai-development/state.json'),JSON.stringify(fixture()));
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
for(const flag of ['--assume-unchanged','--skip-worktree'])test('hidden executable changes with '+flag+' never reach the worker',async()=>{
 const root=mkdtempSync(join(tmpdir(),'workflow-hidden-')),outside=mkdtempSync(join(tmpdir(),'workflow-marker-'));
 const git=args=>{const r=spawnSync('git',['-C',root,...args],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout.trim();};
 try{
  git(['init','--quiet']);const dispatch=await projectDispatcher(root);writeFileSync(join(root,'.ai-development/state.json'),JSON.stringify(fixture()));
  const marker=join(outside,'ran');writeFileSync(join(root,'worker.mjs'),'// reviewed worker\n');writeFileSync(join(root,'.ai-development/owner-adapter.json'),JSON.stringify({enabled:true,governance_reference:'fixture:only',runtime:'node',script:'worker.mjs',check_args:['--check'],run_args:['--run']}));
  git(['add','.']);git(['-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','--quiet','-m','fixture']);const source=git(['rev-parse','HEAD']);
  const plan=fixture();plan.owner_session.source_head=source;plan.checks.source_head=source;plan.checks.required[0].head=source;const planPath=join(outside,'plan.json');writeFileSync(planPath,JSON.stringify(plan));
  git(['update-index',flag,'worker.mjs']);writeFileSync(join(root,'worker.mjs'),`import {writeFileSync} from 'node:fs';writeFileSync(${JSON.stringify(marker)},'unsafe');`);
  assert.equal(git(['status','--porcelain']),'');assert.throws(()=>dispatch(root,source,true,planPath),/INDEX_FLAGS_FORBIDDEN/);assert.throws(()=>readFileSync(marker));
 }finally{rmSync(root,{recursive:true,force:true});rmSync(outside,{recursive:true,force:true});}
});
