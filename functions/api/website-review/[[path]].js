// Same-origin relay only. Review data is stored by Website Studio, never here.
const STUDIO='https://website-studio-unified.getaptly-8093.chatgpt.site';
const PROJECT='bba20e4a0ca94001b417e8e4ba05a773';
const ORIGIN='https://site-dbctjz4fgymfqyz8m.pages.dev';
const fail=(error,status)=>Response.json({error},{status,headers:{'Cache-Control':'no-store'}});
export async function onRequest({request,env}){
 const url=new URL(request.url);
 if(url.origin!==ORIGIN)return fail('Review origin mismatch.',403);
 const paths={'/api/website-review/exchange':'POST','/api/website-review/state':'GET','/api/website-review/draft':'POST','/api/website-review/submit':'POST'};
 if(paths[url.pathname]!==request.method||url.search)return fail('Review route not found.',404);
 if(request.method==='POST'&&request.headers.get('Origin')!==ORIGIN)return fail('Same-origin request required.',403);
 if(env.WEBSITE_REVIEW_ENABLED!=='true'||!env.STUDIO_REVIEW_SERVICE_TOKEN)return fail('Private review access is not enabled.',503);
 // Never forward visitor identity, arbitrary headers, destinations or Studio credentials.
 const headers=new Headers({'OAI-Sites-Authorization':'Bearer '+env.STUDIO_REVIEW_SERVICE_TOKEN,'X-Website-Review-Project':PROJECT,'Origin':ORIGIN});
 const cookie=(request.headers.get('Cookie')||'').split(';').map(s=>s.trim()).find(s=>/^__Host-aptly_review=[a-f0-9]{64}$/.test(s));
 if(cookie)headers.set('Cookie',cookie);
 headers.set('CF-Connecting-IP',request.headers.get('CF-Connecting-IP')||'unknown');
 let body;
 if(request.method==='POST'){
  if(!request.headers.get('Content-Type')?.startsWith('application/json'))return fail('JSON required.',415);
  const reader=request.body?.getReader();if(!reader)return fail('Request body required.',400);
  const chunks=[];let size=0;try{for(;;){const r=await reader.read();if(r.done)break;size+=r.value.length;if(size>240000)return fail('Review request is too large.',413);chunks.push(r.value)}}finally{await reader.cancel().catch(()=>{})}
  body=new Uint8Array(size);let offset=0;for(const chunk of chunks){body.set(chunk,offset);offset+=chunk.length}headers.set('Content-Type','application/json');
 }
 try{
  const upstream=await fetch(STUDIO+url.pathname,{method:request.method,headers,body,redirect:'manual',signal:AbortSignal.timeout(15000)});
  if(upstream.status>=300&&upstream.status<400||!upstream.headers.get('Content-Type')?.includes('application/json'))return fail('Website Studio review connection is unavailable.',503);
  const resultHeaders=new Headers({'Content-Type':'application/json','Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'});
  const session=upstream.headers.get('Set-Cookie');
  if(session&&/^__Host-aptly_review=[a-f0-9]{64}; Path=\/; Secure; HttpOnly; SameSite=Strict; Max-Age=\d+$/.test(session))resultHeaders.set('Set-Cookie',session);
  return new Response(upstream.body,{status:upstream.status,headers:resultHeaders});
 }catch{return fail('Website Studio is temporarily unavailable. Keep your text and retry.',503)}
}
