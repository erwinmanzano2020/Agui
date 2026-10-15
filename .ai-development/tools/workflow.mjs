#!/usr/bin/env node
import {readFileSync,realpathSync,existsSync,writeFileSync,renameSync,unlinkSync} from 'node:fs';
import {resolve,relative,isAbsolute,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const STATES=['NOT_PREPARED','INPUTS_PENDING','PREPARING','READY','ACTIVE','EXPIRED','CLEANUP_REQUIRED','COMPLETED','UNKNOWN'];
const RESULTS=['NOT_RUN','PASS','FAIL','PARTIAL','NOT_REQUIRED'];
const sha=/^[a-f0-9]{40}$/;
const fail=code=>{throw Error(code);};
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const text=v=>typeof v==='string'&&v.length>0&&v.length<=3000&&!/[\x00-\x1f\x7f]/.test(v);
const list=v=>Array.isArray(v)&&v.every(text);
const credentialKey=key=>/^(?:password|passwd|passphrase|token|accesstoken|refreshtoken|idtoken|sessiontoken|apikey|authorization|credentials|secret|clientsecret|servicerolekey|servicekey|privatekey|databaseurl|connectionstring|operatorcode|xvercelprotectionbypass|code)$/.test(key.toLowerCase().replace(/[^a-z0-9]/g,''));
function noSecrets(value){
 if(Array.isArray(value)){value.forEach(noSecrets);return;}
 if(object(value))for(const [key,v] of Object.entries(value)){
  if(credentialKey(key))fail('SECRET_FIELD_FORBIDDEN');
  noSecrets(v);
 }
 if(typeof value==='string'){
  if(/(?:sb_secret_|gh[pousr]_|github_pat_|sk[-_])[A-Za-z0-9_-]{12,}|\b(?:AKIA|ASIA)[A-Z0-9]{16}\b|\bBearer\s+\S{8,}|-----BEGIN .*PRIVATE KEY-----|postgres(?:ql)?:\/\/[^\s]+@|\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/i.test(value))fail('SECRET_VALUE_FORBIDDEN');
  try{
   const url=new URL(value);
   if(url.username||url.password||[...url.searchParams.keys(),...new URLSearchParams(url.hash.slice(1)).keys()].some(credentialKey))fail('SECRET_VALUE_FORBIDDEN');
  }catch(e){if(e.message==='SECRET_VALUE_FORBIDDEN')throw e;}
 }
}
function requireThat(ok,code){if(!ok)fail(code);}
function keys(value,allowed){requireThat(object(value)&&Object.keys(value).every(k=>allowed.includes(k)),'UNKNOWN_STATE_FIELD');}
export function validate(state){
 noSecrets(state);
 requireThat(object(state)&&state.schema_version===1,'STATE_VERSION_INVALID');
 keys(state,['schema_version','project','scope','workspace','current','checks','capabilities','owner_session','uat','metrics']);
 keys(state.project,['name','repository','profile']);keys(state.scope,['active_phase','authority','prohibited']);keys(state.workspace,['execution','source_mode','durability','limitations']);
 keys(state.current,['risk','milestone','outcome','stage','next_action','blockers']);keys(state.checks,['source_head','required']);
 keys(state.owner_session,['status','cleanup','run_id','source_head','starts_at','ends_at','evidence']);keys(state.metrics,['owner_interruptions','manual_commands','repeated_cases','recovery_minutes']);
 requireThat(object(state.project)&&text(state.project.name)&&text(state.project.repository)&&text(state.project.profile),'PROJECT_INVALID');
 requireThat(object(state.scope)&&text(state.scope.active_phase)&&list(state.scope.authority)&&list(state.scope.prohibited),'SCOPE_INVALID');
 requireThat(object(state.workspace)&&['work','owner','ci'].includes(state.workspace.execution)&&text(state.workspace.source_mode)&&text(state.workspace.durability)&&list(state.workspace.limitations),'WORKSPACE_INVALID');
 const c=state.current;
 requireThat(object(c)&&['FAST','STANDARD','CONTROLLED'].includes(c.risk)&&text(c.milestone)&&text(c.outcome)&&text(c.stage)&&text(c.next_action)&&list(c.blockers),'CURRENT_INVALID');
 requireThat(object(state.checks)&&sha.test(state.checks.source_head)&&Array.isArray(state.checks.required),'CHECKS_INVALID');
 requireThat(new Set(state.checks.required.map(x=>x.id)).size===state.checks.required.length,'DUPLICATE_CHECK');
 for(const check of state.checks.required){
  keys(check,['id','status','head','evidence','reason']);
  requireThat(object(check)&&text(check.id)&&RESULTS.includes(check.status),'CHECK_INVALID');
  if(check.status==='PASS')requireThat(check.head===state.checks.source_head&&text(check.evidence),'CHECK_HEAD_OR_EVIDENCE_INVALID');
  if(check.status==='NOT_REQUIRED')requireThat(text(check.reason),'CHECK_SKIP_REASON_REQUIRED');
 }
 requireThat(Array.isArray(state.capabilities)&&new Set(state.capabilities.map(x=>x.id)).size===state.capabilities.length,'CAPABILITIES_INVALID');
 for(const cap of state.capabilities){
  keys(cap,['id','title','implemented','released','operationally_enabled','automated','physical','physical_reason','evidence']);
  requireThat(object(cap)&&text(cap.id)&&text(cap.title)&&typeof cap.implemented==='boolean'&&typeof cap.released==='boolean'&&typeof cap.operationally_enabled==='boolean'&&RESULTS.includes(cap.automated)&&RESULTS.includes(cap.physical)&&Array.isArray(cap.evidence),'CAPABILITY_INVALID');
  for(const e of cap.evidence){keys(e,['kind','reference','head']);requireThat(object(e)&&['automated','physical','release','activation'].includes(e.kind)&&text(e.reference)&&sha.test(e.head),'CAPABILITY_EVIDENCE_INVALID');}
  for(const kind of ['automated','physical'])if(cap[kind]==='PASS')requireThat(cap.evidence.some(e=>e.kind===kind),'CAPABILITY_PROOF_REQUIRED');
  if(cap.physical==='NOT_REQUIRED')requireThat(text(cap.physical_reason),'PHYSICAL_SKIP_REASON_REQUIRED');
  if(cap.released)requireThat(cap.implemented&&cap.evidence.some(e=>e.kind==='release'),'RELEASE_PROOF_REQUIRED');
  if(cap.operationally_enabled)requireThat(cap.released&&cap.automated==='PASS'&&['PASS','NOT_REQUIRED'].includes(cap.physical)&&cap.evidence.some(e=>e.kind==='activation'),'ACTIVATION_PROOF_REQUIRED');
 }
 const s=state.owner_session;
 requireThat(object(s)&&STATES.includes(s.status)&&RESULTS.includes(s.cleanup),'SESSION_INVALID');
 if(s.status!=='NOT_PREPARED')requireThat(text(s.run_id)&&sha.test(s.source_head),'SESSION_BINDING_REQUIRED');
 if(['READY','ACTIVE','EXPIRED','CLEANUP_REQUIRED','COMPLETED'].includes(s.status))requireThat(text(s.evidence),'SESSION_EVIDENCE_REQUIRED');
 if(['READY','ACTIVE','EXPIRED'].includes(s.status))requireThat(Number.isSafeInteger(s.starts_at)&&Number.isSafeInteger(s.ends_at)&&s.ends_at>s.starts_at,'SESSION_TIMEBOX_INVALID');
 if(s.status==='COMPLETED')requireThat(s.cleanup==='PASS','SESSION_CLEANUP_REQUIRED');
 requireThat(Array.isArray(state.uat)&&new Set(state.uat.map(x=>x.id)).size===state.uat.length,'UAT_INVALID');
 for(const u of state.uat){keys(u,['id','mode','reason','minutes','status']);requireThat(object(u)&&text(u.id)&&['AUTOMATED','OWNER'].includes(u.mode)&&text(u.reason)&&Number.isFinite(u.minutes)&&u.minutes>=0&&RESULTS.includes(u.status),'UAT_CASE_INVALID');}
 const m=state.metrics;
 requireThat(object(m)&&['owner_interruptions','manual_commands','repeated_cases','recovery_minutes'].every(k=>m[k]===null||(Number.isFinite(m[k])&&m[k]>=0)),'METRICS_INVALID');
 return state;
}
export function recovery(state,now=Date.now()){
 validate(state);const s=state.owner_session;
 if(s.status==='COMPLETED')return{state:'COMPLETED',action:'Preserve evidence; never replay this run.'};
 if(s.status==='UNKNOWN')return{state:'UNKNOWN',action:'Inspect authoritative adapter evidence before any action.'};
 if(['READY','ACTIVE'].includes(s.status)&&now>=s.ends_at)return{state:'CLEANUP_REQUIRED',action:'Use the reviewed reconciliation adapter; do not start another run.'};
 return{state:s.status,action:{NOT_PREPARED:'No owner run is prepared. Continue offline work; prepare an adapter only if needed.',INPUTS_PENDING:'Use adapter recovery after canonical checks; empty files alone prove nothing.',PREPARING:'Inspect the existing worker and remote state; do not run a duplicate.',READY:'Check owner availability and remaining time before dispatch.',ACTIVE:'Continue the existing window and monitor cleanup.',EXPIRED:'Reconcile the expired run before any new window.',CLEANUP_REQUIRED:'Complete proof-bound cleanup; preserve all journals.'}[s.status]};
}
export function ownerPlan(state,now=Date.now()){
 validate(state);const pending=state.uat.filter(x=>x.mode==='OWNER'&&x.status!=='PASS'&&x.status!=='NOT_REQUIRED');
 const minutes=pending.reduce((sum,x)=>sum+x.minutes,0);
 const remaining=Number.isSafeInteger(state.owner_session.ends_at)?Math.max(0,(state.owner_session.ends_at-now)/60000):null;
 const checksReady=state.checks.required.length>0&&state.checks.required.every(x=>['PASS','NOT_REQUIRED'].includes(x.status));
 const automatedReady=state.uat.filter(x=>x.mode==='AUTOMATED').every(x=>['PASS','NOT_REQUIRED'].includes(x.status));
 return{cases:pending.map(({id,reason,minutes})=>({id,reason,minutes})),estimated_minutes:minutes,remaining_minutes:remaining,
  ready:pending.length>0&&automatedReady&&state.checks.source_head===state.owner_session.source_head&&state.owner_session.status==='READY'&&now>=state.owner_session.starts_at&&remaining!==null&&remaining>=minutes+5&&checksReady&&state.checks.required.some(x=>x.status==='PASS')&&state.current.blockers.length===0};
}
export function summary(state){
 validate(state);return{project:state.project.name,milestone:state.current.milestone,outcome:state.current.outcome,stage:state.current.stage,next_action:state.current.next_action,blockers:state.current.blockers,workspace:state.workspace,
  capabilities:state.capabilities.map(({id,title,implemented,automated,physical,released,operationally_enabled})=>({id,title,implemented,automated,physical,released,operationally_enabled})),recovery:recovery(state),owner_plan:ownerPlan(state),metrics:state.metrics};
}
function confined(root,path){
 requireThat(typeof path==='string'&&!isAbsolute(path),'PATH_INVALID');
 const actual=realpathSync(resolve(root,path)),rel=relative(realpathSync(root),actual);
 requireThat(rel!==''&&!rel.startsWith('..')&&!isAbsolute(rel),'PATH_OUTSIDE_PROJECT');return actual;
}
function readJson(path){const raw=readFileSync(path,'utf8');requireThat(raw.length<=256000,'FILE_TOO_LARGE');return JSON.parse(raw);}
function git(root,args){const r=spawnSync('git',['-C',root,...args],{encoding:'utf8',timeout:10000,shell:false});requireThat(r.status===0,'GIT_CHECK_FAILED');return r.stdout.trim();}
export function resolvePowerShell(platform=process.platform,programFiles=process.env.ProgramFiles,probe=executable=>spawnSync(executable,['-NoProfile','-NonInteractive','-Command','$PSVersionTable.PSVersion.Major'],{encoding:'utf8',timeout:10000,shell:false,stdio:['ignore','pipe','pipe']})){
 const candidates=platform==='win32'&&programFiles?[resolve(programFiles,'PowerShell/7/pwsh.exe'),'pwsh']:['pwsh'];
 for(const executable of candidates){const result=probe(executable);if(result.status===0&&Number(result.stdout.trim())>=7)return executable;}
 return null;
}
export function doctor(root){
 const major=Number(process.versions.node.split('.')[0]);
 const gitResult=spawnSync('git',['--version'],{encoding:'utf8',timeout:10000,shell:false});
 return{node20:major>=20,git:gitResult.status===0,powershell7:resolvePowerShell()!==null,project_state:existsSync(resolve(root,'.ai-development/state.json')),execution_host:process.platform};
}
/** Generic dispatcher is not a recovery or authorization adapter. The pinned
 * project worker must independently revalidate all original proofs and gates. */
export function dispatch(root,head,ready=false,planPath){
 requireThat(ready===true&&sha.test(head),'OWNER_READY_AND_HEAD_REQUIRED');
 requireThat(git(root,['rev-parse','HEAD'])===head&&git(root,['status','--porcelain','--untracked-files=all'])==='','CLEAN_PINNED_SOURCE_REQUIRED');
 const adapterRel='.ai-development/owner-adapter.json';
 requireThat(git(root,['ls-files','--error-unmatch',adapterRel])===adapterRel,'TRACKED_ADAPTER_REQUIRED');
 const adapter=readJson(confined(root,adapterRel));noSecrets(adapter);
 requireThat(adapter.enabled===true&&text(adapter.governance_reference)&&['node','pwsh'].includes(adapter.runtime),'REVIEWED_ADAPTER_UNAVAILABLE');
 const worker=confined(root,adapter.script);
 requireThat(git(root,['ls-files','--error-unmatch',adapter.script])===adapter.script,'TRACKED_WORKER_REQUIRED');
 requireThat(list(adapter.check_args)&&list(adapter.run_args)&&adapter.check_args.length>0&&adapter.run_args.length>0,'ADAPTER_ARGUMENTS_INVALID');
 // Prepared live plans are external non-secret files: a tracked file cannot
 // contain its own future commit SHA. They are indexes, never authority.
 requireThat(typeof planPath==='string'&&isAbsolute(planPath),'EXTERNAL_PLAN_REQUIRED');
 const plan=realpathSync(planPath),planRel=relative(realpathSync(root),plan);
 requireThat(planRel.startsWith('..')||isAbsolute(planRel),'PLAN_MUST_BE_OUTSIDE_SOURCE');
 const state=validate(readJson(plan));
 const project=validate(readJson(confined(root,'.ai-development/state.json')));
 requireThat(state.project.repository===project.project.repository,'PLAN_PROJECT_MISMATCH');
 requireThat(state.checks.source_head===head,'CHECK_SOURCE_MISMATCH');
 requireThat(ownerPlan(state).ready,'OWNER_PLAN_NOT_READY');
 requireThat(state.owner_session.source_head===head,'SESSION_SOURCE_MISMATCH');
 const env=doctor(root);requireThat(env.node20&&env.git&&(adapter.runtime!=='pwsh'||env.powershell7),'PREREQUISITES_MISSING');
 const executable=adapter.runtime==='node'?process.execPath:resolvePowerShell();requireThat(executable!==null,'PREREQUISITES_MISSING');
 const prefix=adapter.runtime==='node'?[worker]:['-NoProfile','-File',worker];
 const bind=args=>args.map(arg=>arg.replaceAll('{head}',head));
 const timeout=adapter.preflight_timeout_ms??30000;requireThat(Number.isSafeInteger(timeout)&&timeout>=100&&timeout<=60000,'PREFLIGHT_TIMEOUT_INVALID');
 const checkPrefix=adapter.runtime==='node'?[worker]:['-NoProfile','-NonInteractive','-File',worker];
 // Preflight gets no stdin and must terminate. Runtime alone inherits the
 // project's hidden-input ceremony. Neither phase is captured or logged here.
 let r=spawnSync(executable,[...checkPrefix,...bind(adapter.check_args)],{cwd:root,stdio:['ignore','inherit','inherit'],shell:false,timeout,killSignal:'SIGKILL'});requireThat(r.status===0,'ADAPTER_PREFLIGHT_FAILED');
 requireThat(git(root,['rev-parse','HEAD'])===head&&git(root,['status','--porcelain','--untracked-files=all'])==='','SOURCE_CHANGED_DURING_PREFLIGHT');
 const refreshed=validate(readJson(plan));requireThat(JSON.stringify(refreshed)===JSON.stringify(state)&&refreshed.owner_session.source_head===head&&ownerPlan(refreshed).ready,'OWNER_WINDOW_NO_LONGER_READY');
 r=spawnSync(executable,[...prefix,...bind(adapter.run_args)],{cwd:root,stdio:'inherit',shell:false});requireThat(r.status===0,'ADAPTER_STOPPED_PRESERVE_EVIDENCE');
 return{status:'ADAPTER_EXITED_ZERO',note:'Verify canonical cleanup evidence before recording completion.'};
}
export function writeSummary(root,state){
 confined(root,'.ai-development');
 const output=resolve(root,'.ai-development/STATUS.md');
 requireThat(!existsSync(output)||realpathSync(output)===output,'SUMMARY_SYMLINK_FORBIDDEN');
 const s=summary(state),lines=['<!-- Generated from state.json; verify evidence at source. -->',`# ${s.project}`,`Milestone: ${s.milestone}`,`Stage: ${s.stage}`,`Next: ${s.next_action}`,'','| Capability | Implemented | Automated | Physical | Released | Operational |','|---|---|---|---|---|---|'];
 const cell=v=>String(v).replaceAll('|','\\|');
 for(const c of s.capabilities)lines.push('| '+[c.title,c.implemented,c.automated,c.physical,c.released,c.operationally_enabled].map(cell).join(' | ')+' |');
 const temp=output+'.tmp-'+process.pid;
 try{writeFileSync(temp,lines.join('\n')+'\n',{flag:'wx'});renameSync(temp,output);}finally{if(existsSync(temp))unlinkSync(temp);}
 return{status:'SUMMARY_WRITTEN'};
}
export function main(args=process.argv.slice(2)){
 const [command='status',rootArg='.',head,ready,planPath]=args,root=realpathSync(resolve(rootArg));
 if(['help','--help','-h'].includes(command))return{commands:['status','check','doctor','render','recovery','owner-plan','run <head> --ready <absolute-plan-path>'],note:'Default is offline status. Live dispatch requires a separately reviewed project adapter.'};
 if(command==='doctor')return doctor(root);
 if(command==='run')return dispatch(root,head,ready==='--ready',planPath);
 const state=validate(readJson(confined(root,'.ai-development/state.json')));
 if(command==='check')return{status:'STATE_VALID',note:'Structural validity is not authorization or verified remote evidence.'};
 if(command==='status')return summary(state);
 if(command==='owner-plan')return ownerPlan(state);
 if(command==='recovery')return recovery(state);
 if(command==='render')return writeSummary(root,state);
 fail('UNKNOWN_COMMAND');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{console.log(JSON.stringify(main(),null,2));}catch(e){console.error(JSON.stringify({status:'BLOCKED',code:/^[A-Z_]+$/.test(e.message)?e.message:'WORKFLOW_INPUT_INVALID'}));process.exitCode=1;}
}
