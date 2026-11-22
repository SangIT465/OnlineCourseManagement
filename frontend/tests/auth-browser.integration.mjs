import { adminCredentials } from "../../backend/tests/support/admin-credentials.mjs";
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const origin=process.env.COURSEFLOW_FRONTEND_URL || 'http://localhost:5173',suffix=Date.now().toString(36),password=crypto.randomBytes(18).toString('base64url')+'A1!';
const {email:adminEmail,password:adminPassword}=await adminCredentials();
// Connect only to a dedicated browser profile used for QA.
const debug=process.env.COURSEFLOW_BROWSER_DEBUG_URL || 'http://localhost:9333';
const pages=await fetch(debug+'/json/list').then(r=>r.json()),target=pages.find(p=>p.type==='page'&&p.url.startsWith(origin))||pages.find(p=>p.type==='page'&&p.url==='about:blank');
const ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));
let seq=0;const pending=new Map(),errors=[];
ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(new Error(m.error.message)):p.resolve(m.result);}}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);});
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
const ev=async expression=>{const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const wait=async(expression,label=expression)=>{const start=Date.now();while(Date.now()-start<45000){if(await ev(expression))return;await new Promise(r=>setTimeout(r,100));}throw new Error('Timed out: '+label);};
const ready=()=>wait("document.querySelector('#main-content')?.getAttribute('aria-busy')==='false' && !document.querySelector('.initial-loading')",'page ready');
const click=async selector=>{await wait(`Boolean(document.querySelector(${JSON.stringify(selector)}))`,'selector '+selector);await ev(`document.querySelector(${JSON.stringify(selector)}).click()`);};
const fill=(name,value)=>ev(`document.querySelector('#modal-form [name="${name}"]').value=${JSON.stringify(String(value))}`);
const submit=async()=>{await ev("document.querySelector('#modal-form').requestSubmit()");await wait("!document.querySelector('#app-dialog').open || !document.querySelector('#modal-form [type=submit]').disabled",'form submitted');const error=await ev("document.querySelector('#app-dialog').open && !document.querySelector('.form-error').hidden ? document.querySelector('.form-error').textContent : ''");if(error)throw new Error('Form failed: '+error);};
const route=async hash=>{await ev(`location.hash=${JSON.stringify('#/'+hash)}`);await new Promise(r=>setTimeout(r,50));await ready();};
const login=async(email,pass)=>{if(await ev("Boolean(document.querySelector('[data-action=logout]'))")){await click('[data-action=logout]');await submit();await ready();}await click('[data-action=login]');await fill('email',email);await fill('password',pass);await submit();await ready();};
async function api(endpoint,{token,method='GET',body}={}){const r=await fetch(origin+'/api'+endpoint,{method,headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body!==undefined?{'Content-Type':'application/json'}:{})},body:body!==undefined?JSON.stringify(body):undefined});if(!r.ok)throw new Error(method+' '+endpoint+' HTTP '+r.status);return r.status===204?null:r.json();}

let adminToken,createdId;
const check=(ok,message)=>{assert.ok(ok,message);console.log('PASS '+message);};
const fresh=async()=>{await call('Page.navigate',{url:origin+'/?authqa='+Date.now()});await new Promise(r=>setTimeout(r,300));await ready();};
const email='auth-ui-'+suffix+'@example.test';
try {
 await call('Runtime.enable');await call('Page.enable');await fresh();
 adminToken=(await api('/auth/login',{method:'POST',body:{email:adminEmail,password:adminPassword}})).token;
 await ev("window.originalFetch=window.fetch;window.fetch=async(...args)=>{if(String(args[0]).endsWith('/auth/login'))throw new TypeError('Simulated login network failure');return window.originalFetch(...args)}");
 await click('[data-action=login]');await click('[data-action=register]');await fill('fullName','Auth UI QA '+suffix);await fill('email',email);await fill('password',password);await submit();
 createdId=(await api('/users?SearchTerm='+encodeURIComponent(email),{token:adminToken})).items.find(u=>u.email===email)?.id;
 check(Boolean(createdId),'signup persists account even when the following login fails');
 check(await ev("document.querySelector('#app-dialog').textContent.includes('Tài khoản đã được tạo') && document.querySelector('#field-email').value==="+JSON.stringify(email)+" && !document.querySelector('#field-fullName')"),'failed automatic login offers sign-in for the created account');
 await ev('window.fetch=window.originalFetch');await fill('password',password);await submit();await ready();
 check(await ev("Boolean(document.querySelector('[data-action=logout]'))"),'new account can sign in from the recovery form');
 await fresh();check(await ev("Boolean(document.querySelector('[data-action=logout]'))"),'page reload restores the signed-in account');
 await ev("window.logoutTokenBefore=sessionStorage.getItem('courseflow.session')");
 await click('[data-action=logout]');
 check(await ev("document.querySelector('#app-dialog').open && document.querySelector('#app-dialog').textContent.includes('Bạn có muốn đăng xuất tài khoản không?') && sessionStorage.getItem('courseflow.session')===window.logoutTokenBefore"),'logout asks for confirmation before changing the session');
 await click('#app-dialog .form-footer [data-action=close-dialog]');
 check(await ev("!document.querySelector('#app-dialog').open && sessionStorage.getItem('courseflow.session')===window.logoutTokenBefore && Boolean(document.querySelector('[data-action=logout]'))"),'canceling logout preserves the signed-in account');
 await ev("window.originalFetch=window.fetch;window.fetch=async(...args)=>{if(String(args[0]).endsWith('/courses'))throw new TypeError('Simulated catalog network failure');return window.originalFetch(...args)}");
 await click('[data-action=logout]');await submit();await new Promise(r=>setTimeout(r,250));
 check(await ev("!sessionStorage.getItem('courseflow.session') && !document.querySelector('[data-action=logout]') && !document.querySelector('#main-content').textContent.includes("+JSON.stringify(email)+")"),'logout clears private UI even if public catalog is unavailable');
 await ev('window.fetch=window.originalFetch');await fresh();
 await ev("window.originalFetch=window.fetch;window.fetch=async(...args)=>{if(String(args[0]).endsWith('/courses'))throw new TypeError('Simulated catalog network failure');return window.originalFetch(...args)}");
 await click('[data-action=login]');await fill('email',email);await fill('password',password);await submit();await new Promise(r=>setTimeout(r,250));
 check(await ev("Boolean(sessionStorage.getItem('courseflow.session')) && Boolean(document.querySelector('[data-action=logout]')) && Boolean(document.querySelector('.error-panel'))"),'successful login updates the account UI when catalog loading fails');
 await ev('window.fetch=window.originalFetch');await fresh();await route('profile');
 await api('/users/'+createdId+'/reset-password',{token:adminToken,method:'PUT',body:{newPassword:password+'reset'}});
 await fresh();await wait("!sessionStorage.getItem('courseflow.session') && !document.querySelector('[data-action=logout]')");
 check(await ev("!document.querySelector('#main-content').textContent.includes("+JSON.stringify(email)+")"),'revoked session clears the profile on reload');
 check(errors.length===0,'no uncaught browser errors during authentication');
} finally {
 if(adminToken && !createdId) createdId=(await api('/users?SearchTerm='+encodeURIComponent(email),{token:adminToken})).items.find(u=>u.email===email)?.id;
 if(createdId) await api('/users/'+createdId,{token:adminToken,method:'DELETE'});
 await ev('sessionStorage.clear();location.href='+JSON.stringify(origin)).catch(()=>{});ws.close();console.log('Auth UI QA account cleaned up.');
}
