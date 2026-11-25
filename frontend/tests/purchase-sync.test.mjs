import {test,beforeEach,afterEach} from "node:test";
import assert from "node:assert/strict";
import {purchasesPage,schedulePurchasePoll,stopPurchasePoll} from "../src/pages/purchases.js";
import {state,view} from "../src/state/store.js";

const original={fetch:globalThis.fetch,document:globalThis.document,location:globalThis.location,sessionStorage:globalThis.sessionStorage};
const order={id:10,status:"PendingPayment",courseId:2,amount:100000,originalPrice:100000};
let calls,latest,modalOpen;
beforeEach(()=>{
  calls=[];latest=order;modalOpen=false;
  state.user={id:1,role:"User"};view.renderVersion=1;
  globalThis.location={hash:"#/purchases"};
  globalThis.document={visibilityState:"visible",querySelector:()=>({open:modalOpen})};
  globalThis.sessionStorage={getItem:()=>"qa-session"};
  globalThis.fetch=async(url,options)=>{calls.push({url:String(url),method:options.method});return new Response(JSON.stringify(/\/purchases\/10/.test(url)?latest:[latest]),{headers:{"Content-Type":"application/json"}});};
});
afterEach(()=>{stopPurchasePoll();Object.assign(globalThis,original);});

for(const role of ["User","Admin"]) test(`${role} purchase list reloads when the server reports a cancellation`,async context=>{
  context.mock.timers.enable({apis:["setTimeout"]});state.user.role=role;
  await purchasesPage({params:new URLSearchParams()},1);
  let rendered=0;schedulePurchasePoll(undefined,1,()=>{rendered++;});
  latest={...order,status:"Cancelled"};context.mock.timers.tick(10000);
  await new Promise(setImmediate);
  assert.equal(rendered,1);
  assert.equal(calls.length,2);
  assert.ok(calls[1].url.includes(role==="Admin"?"/api/purchases?page=1":"/api/purchases/my?page=1"));
});

test("a pending demo bill polls database status even without a payOS link",async context=>{
  context.mock.timers.enable({apis:["setTimeout"]});location.hash="#/purchases/10";
  await purchasesPage({id:10},1);let rendered=0;
  schedulePurchasePoll(10,1,()=>{rendered++;});latest={...order,status:"Cancelled"};
  context.mock.timers.tick(10000);await new Promise(setImmediate);
  assert.equal(rendered,1);assert.equal(calls[1].method,"GET");
});

test("background refresh preserves an open cancellation dialog",async context=>{
  context.mock.timers.enable({apis:["setTimeout"]});
  await purchasesPage({params:new URLSearchParams()},1);let rendered=0;
  modalOpen=true;schedulePurchasePoll(undefined,1,()=>{rendered++;});
  context.mock.timers.tick(10000);await new Promise(setImmediate);
  assert.equal(calls.length,1);assert.equal(rendered,0);
  modalOpen=false;latest={...order,status:"Cancelled"};
  context.mock.timers.tick(10000);await new Promise(setImmediate);
  assert.equal(rendered,1);
});
