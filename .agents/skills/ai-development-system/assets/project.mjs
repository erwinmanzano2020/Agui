#!/usr/bin/env node
import {dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {main} from './.ai-development/tools/workflow.mjs';
try{
 const [command='status',...rest]=process.argv.slice(2);
 console.log(JSON.stringify(main([command,dirname(fileURLToPath(import.meta.url)),...rest]),null,2));
}catch(e){console.error(JSON.stringify({status:'BLOCKED',code:/^[A-Z_]+$/.test(e.message)?e.message:'WORKFLOW_INPUT_INVALID'}));process.exitCode=1;}
