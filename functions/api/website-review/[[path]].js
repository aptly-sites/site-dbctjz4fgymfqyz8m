// Generated from review-link-service/worker.mjs. Staged; REVIEW_ENABLED defaults off.
// Staged only. Dedicated review database; no Studio identity or storage bindings.
const COOKIE='__Host-aptly_review';
const PREFIX='/api/website-review';
const headers={'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'"};
const response=(data,status=200,extra={})=>Response.json(data,{status,headers:{...headers,...extra}});
class Failure extends Error {constructor(status,message){super(message);this.status=status}}
const fail=(status,text)=>{throw new Failure(status,text)};
export const digest=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,'0')).join('');
const random=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
const tokenOK=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const keyOK=x=>typeof x==='string'&&/^[a-zA-Z0-9_-]{16,80}$/.test(x);
const query=(db,sql,...args)=>db.prepare(sql).bind(...args);
async function readBody(req){
 if(!req.headers.get('Content-Type')?.startsWith('application/json'))fail(415,'JSON required.');
 const reader=req.body?.getReader();if(!reader)fail(400,'Request body required.');
 let size=0,text='';const decoder=new TextDecoder();
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>240000)fail(413,'Review request is too large.');text+=decoder.decode(value,{stream:true})}}finally{await reader.cancel().catch(()=>{})}
 try{const b=JSON.parse(text+decoder.decode());if(!b||typeof b!=='object'||Array.isArray(b))throw Error();return b}catch{fail(400,'Invalid request.');}
}
function publicState(row){return {project:row.project,version:JSON.parse(row.public_json),revision:row.revision,draft:JSON.parse(row.draft_json),submission:row.final_json?JSON.parse(row.final_json):null,status:row.final_json?'pending_verification':'draft',expires:row.effective_expires};}
function cleanDraft(draft,plan){
 if(!draft||!Array.isArray(draft.checks)||!Array.isArray(draft.feedback)||draft.feedback.length>50)fail(400,'Invalid draft.');
 const ids=new Set(plan.checklist.map(x=>x.id));
 if(draft.checks.length>ids.size||draft.checks.some(x=>!ids.has(x))||new Set(draft.checks).size!==draft.checks.length)fail(400,'Invalid checklist item.');
 const seen=new Set();
 const feedback=draft.feedback.map(f=>{if(!f||!keyOK(f.id)||seen.has(f.id)||!ids.has(f.itemId)||typeof f.text!=='string'||!f.text.trim()||f.text.length>4000)fail(400,'Invalid feedback.');seen.add(f.id);return {id:f.id,itemId:f.itemId,text:f.text.trim()}});
 return {checks:[...draft.checks].sort(),feedback};
}
const activeSQL=`SELECT p.*,g.id AS grant_id,MIN(p.expires,g.expires,s.expires) AS effective_expires
 FROM review_sessions s JOIN review_grants g ON g.id=s.grant_id
 JOIN review_packages p ON p.project=g.project AND p.version=g.version
 WHERE s.token_hash=? AND s.expires>? AND g.expires>? AND p.expires>?
 AND g.revoked_at IS NULL AND p.revoked_at IS NULL`;
// Repeat authorization inside the atomic write, not only in the preceding read.
const activeGate=`EXISTS(SELECT 1 FROM review_sessions s JOIN review_grants g ON g.id=s.grant_id
 WHERE s.token_hash=? AND s.expires>? AND g.expires>? AND g.revoked_at IS NULL
 AND g.project=review_packages.project AND g.version=review_packages.version)
 AND expires>? AND revoked_at IS NULL`;
export async function handle(req,env){
 try{
  if(env.REVIEW_ENABLED!=='true'||!env.REVIEW_DB)fail(503,'Private review access is not enabled.');
  const url=new URL(req.url),origin=env.REVIEW_ORIGIN;
  if(!origin||url.origin!==origin)fail(403,'Review origin mismatch.');
  if(url.protocol!=='https:'&&!(env.LOCAL_TEST==='true'&&url.hostname==='127.0.0.1'))fail(403,'HTTPS required.');
  if(req.method!=='GET'&&req.method!=='POST')fail(405,'Method not allowed.');
  if(req.method==='POST'&&req.headers.get('Origin')!==origin)fail(403,'Same-origin request required.');
  const db=env.REVIEW_DB,now=Math.floor(Date.now()/1000),route=url.pathname.slice(PREFIX.length);
  if(!url.pathname.startsWith(PREFIX+'/'))fail(404,'Not found.');
  // Edge supplies this header in production. Local fixtures share one bucket.
  const bucket=Math.floor(now/60),limKey=await digest((req.headers.get('CF-Connecting-IP')||'local')+':'+(route==='/exchange'?'exchange':'review')+':'+bucket);
  const limited=await query(db,'INSERT INTO review_limits(key,count,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 WHERE count<? RETURNING count',limKey,now+120,route==='/exchange'?20:180).first();
  if(!limited)fail(429,'Too many requests. Please wait one minute.');
  await query(db,'DELETE FROM review_limits WHERE expires<?',now).run();
  if(route==='/exchange'&&req.method==='POST'){
   const b=await readBody(req);if(!tokenOK(b.token))fail(401,'Review link is invalid or expired.');
   const g=await query(db,`SELECT g.id,MIN(g.expires,p.expires) AS expires FROM review_grants g JOIN review_packages p ON p.project=g.project AND p.version=g.version WHERE g.token_hash=? AND g.expires>? AND p.expires>? AND g.revoked_at IS NULL AND p.revoked_at IS NULL`,await digest(b.token),now,now).first();
   if(!g)fail(401,'Review link is invalid or expired.');
   const token=random(),expires=Math.min(g.expires,now+86400);
   await query(db,'INSERT INTO review_sessions(token_hash,grant_id,expires) VALUES(?,?,?)',await digest(token),g.id,expires).run();
   return response({ok:true},200,{'Set-Cookie':`${COOKIE}=${token}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${expires-now}`});
  }
  const cookie=(req.headers.get('Cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);
  if(!tokenOK(cookie))fail(401,'Open your private review link to continue.');
  const sessionHash=await digest(cookie),row=await query(db,activeSQL,sessionHash,now,now,now).first();
  if(!row)fail(401,'Your review link or session has expired or was revoked.');
  if(route==='/state'&&req.method==='GET')return response(publicState(row));
  if(req.method!=='POST'||!['/draft','/submit'].includes(route))fail(404,'Not found.');
  const b=await readBody(req);if(!keyOK(b.key))fail(400,'A request key is required.');
  const requestHash=await digest(JSON.stringify(b));
  if(route==='/submit'&&row.final_json){
   if(row.final_key===b.key&&row.final_hash===requestHash)return response(publicState(row));
   fail(409,'This website review has already been submitted. Only one submission is accepted.');
  }
  if(row.final_json)fail(409,'This review has been submitted and is read-only.');
  if(route==='/draft'){
   const prior=await query(db,'SELECT request_hash FROM review_draft_receipts WHERE project=? AND version=? AND request_key=?',row.project,row.version,b.key).first();
   if(prior){if(prior.request_hash!==requestHash)fail(409,'Request key already used.');return response(publicState(row));}
  }
  if(b.version!==row.version)fail(409,'The website review version does not match this link.');
  if(!Number.isSafeInteger(b.revision)||b.revision!==row.revision)fail(409,'The draft changed in another tab. Refresh before saving.');
  const gate=[sessionHash,now,now,now];
  if(route==='/draft'){
   const draft=cleanDraft(b.draft,JSON.parse(row.public_json));
   const results=await db.batch([
    query(db,`UPDATE review_packages SET draft_json=?,revision=revision+1 WHERE project=? AND version=? AND revision=? AND final_json IS NULL AND ${activeGate} AND NOT EXISTS(SELECT 1 FROM review_draft_receipts WHERE project=? AND version=? AND request_key=?)`,JSON.stringify(draft),row.project,row.version,row.revision,...gate,row.project,row.version,b.key),
    query(db,`INSERT OR IGNORE INTO review_draft_receipts(project,version,request_key,request_hash,revision) SELECT ?,?,?,?,? WHERE changes()=1`,row.project,row.version,b.key,requestHash,row.revision+1)
   ]);
   if(results[0].meta.changes!==1)fail(409,'The draft changed or access ended. Refresh before saving.');
  }else{
   const draft=JSON.parse(row.draft_json),plan=JSON.parse(row.public_json);
   if(draft.checks.length!==plan.checklist.length)fail(400,'Review every checklist item before submitting. Issues may be included in your feedback.');
   if(b.confirmed!==true||typeof b.name!=='string'||!b.name.trim()||b.name.length>100||!['changes_requested','ready_for_verification'].includes(b.outcome))fail(400,'Enter your name, review outcome and submission confirmation.');
   const submission={id:crypto.randomUUID(),project:row.project,version:row.version,versionLabel:plan.label,submittedAt:now,claimedName:b.name.trim(),identityVerified:false,assurance:'private_link',status:'pending_verification',outcome:b.outcome,grantId:row.grant_id,draft};
   const changed=await query(db,`UPDATE review_packages SET final_json=?,final_key=?,final_hash=?,submitted_at=?,revision=revision+1 WHERE project=? AND version=? AND revision=? AND final_json IS NULL AND ${activeGate} RETURNING project`,JSON.stringify(submission),b.key,requestHash,now,row.project,row.version,row.revision,...gate).first();
   if(!changed){const latest=await query(db,activeSQL,sessionHash,now,now,now).first();if(latest?.final_key===b.key&&latest.final_hash===requestHash)return response(publicState(latest));fail(409,'Another submission or draft change won. Refresh to see the result.');}
  }
  const latest=await query(db,activeSQL,sessionHash,now,now,now).first();if(!latest)fail(401,'Review access ended.');return response(publicState(latest));
 }catch(e){return response({error:e instanceof Failure?e.message:'Review storage is temporarily unavailable. Keep your text and retry.'},e instanceof Failure?e.status:503);}
}
export const onRequest=({request,env})=>handle(request,env);
