(()=>{
 const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const district='https://www.muscogee.k12.ga.us/about-us-clone/families-students/enrollment';
 const research='https://www.greatschools.org/georgia/columbus/';
 const citySource='https://ccggisprod.columbusga.org/server/rest/services/Base/MapServer/21';
 const observed=new WeakSet();
 const schoolFiles=['uptown','midtown','lake-bottom','hilton-woods','east-highlands'];
 const miles=(a,b)=>{const rad=Math.PI/180,dLat=(b[0]-a[0])*rad,dLon=(b[1]-a[1])*rad,h=Math.sin(dLat/2)**2+Math.cos(a[0]*rad)*Math.cos(b[0]*rad)*Math.sin(dLon/2)**2;return 3958.8*2*Math.asin(Math.min(1,Math.sqrt(h)));};
 async function listingFallback(node){
  const center=[Number(node.dataset.schoolLat),Number(node.dataset.schoolLon)];
  if(!center.every(Number.isFinite)||!center[0]||!center[1])throw Error('Listing location unavailable');
  const results=await Promise.allSettled(schoolFiles.map(name=>fetch(`data/${name}-schools.json`).then(r=>{if(!r.ok)throw Error('School data unavailable');return r.json();})));
  const unique=new Map();
  results.forEach(result=>{if(result.status!=='fulfilled')return;result.value.schools.forEach(s=>{if(!Array.isArray(s.coordinates)||s.coordinates.length!==2)return;const distance=miles(center,s.coordinates);if(distance>5)return;const key=[s.name,s.address].join('|');if(!unique.has(key)||distance<unique.get(key).distance)unique.set(key,{...s,distance});});});
  if(!unique.size)throw Error('No nearby schools available');
  return {provider:'city-gis',scope:'listing',center,radiusMiles:5,guideName:'this rental home',schools:[...unique.values()].sort((a,b)=>a.distance-b.distance).slice(0,25)};
 }
 async function getSchools(node){
  const query=node.dataset.schoolListing?'listing='+encodeURIComponent(node.dataset.schoolListing):'city='+encodeURIComponent(node.dataset.schoolCity);
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),16000);
  try{
   const response=await fetch('/api/schools?'+query,{cache:'no-store',signal:controller.signal});
   if(!response.ok)throw Error('GreatSchools data unavailable');
   const data=await response.json();
   if(!Array.isArray(data.schools))throw Error('Invalid school response');
   data.provider='greatschools';return data;
  }catch(error){
   const fallbackCity=node.dataset.schoolCity;
   if(node.dataset.schoolListing)return listingFallback(node);
   if(schoolFiles.includes(fallbackCity)){
    const response=await fetch(`data/${fallbackCity}-schools.json`,{cache:'no-store'});
    if(response.ok){const data=await response.json();data.provider='city-gis';return data;}
   }
   throw error;
  }finally{clearTimeout(timer);}
 }
 function render(node,data){
  const isCity=data.provider==='city-gis';
  const scope=data.scope==='neighborhood'?`within ${data.radiusMiles||5} miles of the approximate ${escape(data.guideName||'neighborhood')} guide point`:data.scope==='city'?'within five miles of the approximate Columbus center':'within five miles of this home';
  const source=isCity?`<p>Map pins: <a href="${citySource}" target="_blank" rel="noopener">Columbus Consolidated Government GIS school facilities layer</a>. Confirm school status and address with the district.</p>`:`<a href="https://www.greatschools.org/" target="_blank" rel="noopener"><img src="assets/greatschools-logo.png" alt="GreatSchools.org"></a><p>School data provided by <a href="https://www.greatschools.org/" target="_blank" rel="noopener">GreatSchools.org</a> © ${new Date().getFullYear()}. All rights reserved.</p>`;
  node.innerHTML=`<p class="school-scope">Showing ${data.schools.length} mapped ${isCity?'school facilities':'schools'} ${scope}. These nearby locations do not determine school assignment. Confirm eligibility with the district for a specific rental address.</p>${data.schools.length?`<div class="school-layout"><div class="school-map" role="img" aria-label="Map of nearby schools around ${escape(data.guideName||'Columbus')}"></div><ol class="school-list" aria-label="Nearby schools"></ol></div>`:'<p>No school results were returned for this area.</p>'}<div class="school-attribution">${source}</div><div class="school-resource-links"><a href="${research}" target="_blank" rel="noopener">Research Schools on GreatSchools.org ↗</a><a href="${district}" target="_blank" rel="noopener">Check District Enrollment ↗</a></div>`;
  let map;const points=[data.center];
  if(data.schools.length&&window.L){
   map=L.map(node.querySelector('.school-map'),{scrollWheelZoom:false}).setView(data.center,12);
   const tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).addTo(map);
   let warned=false;tiles.on('tileerror',()=>{if(!warned){const p=document.createElement('p');p.className='school-map-warning';p.textContent='Map tiles are unavailable. School details are listed alongside.';node.append(p);warned=true;}});
   L.circleMarker(data.center,{radius:8,color:'#9a2b18',fillColor:'#9a2b18',fillOpacity:1}).addTo(map).bindTooltip(data.scope==='neighborhood'?(data.guideName||'Neighborhood')+' guide point':data.scope==='city'?'Columbus center':'Rental home');
  }else if(data.schools.length){node.querySelector('.school-map').textContent='Map unavailable. School locations appear in the list.';}
  data.schools.forEach((school,index)=>{
   const item=document.createElement('li');
   const safeUrl=typeof school.url==='string'&&/^https:\/\/(www\.)?greatschools\.org\//.test(school.url)?school.url:'';
   item.innerHTML=`<span class="school-number">${index+1}</span><div>${safeUrl?`<a href="${escape(safeUrl)}" target="_blank" rel="noopener">${escape(school.name)}</a>`:`<strong>${escape(school.name)}</strong>`}<p>${escape(school.type)}${school.grades?' · Grades '+escape(school.grades):''}${typeof school.distance==='number'?' · '+school.distance.toFixed(1)+' mi':''}</p><p>${escape(school.address)}</p></div>`;
   node.querySelector('.school-list').append(item);
   if(map&&Array.isArray(school.coordinates)&&school.coordinates.length===2){
    points.push(school.coordinates);
    const marker=L.marker(school.coordinates,{title:school.name,icon:L.divIcon({className:'school-marker',html:String(index+1),iconSize:[30,30],iconAnchor:[15,15]})}).addTo(map);
    const popup=document.createElement('div');popup.textContent=school.name;marker.bindPopup(popup);marker.on('click',()=>item.scrollIntoView({block:'nearest'}));
   }
  });
  if(map){map.fitBounds(points,{padding:[35,35],maxZoom:14});const resize=new ResizeObserver(()=>map.invalidateSize());resize.observe(node);window.addEventListener('pagehide',()=>{resize.disconnect();map.remove();},{once:true});}
 }
 async function load(node){
  node.innerHTML='<p role="status">Loading nearby school information…</p>';
  try{render(node,await getSchools(node));}
  catch{node.innerHTML=`<div class="school-fallback"><h3>Explore School Options</h3><p>The interactive school directory isn’t available right now. Use these resources to research schools and enrollment.</p><a href="${research}" target="_blank" rel="noopener">Explore Columbus Schools on GreatSchools.org ↗</a><a href="${district}" target="_blank" rel="noopener">District Enrollment Information ↗</a><button type="button">Try Again</button></div>`;node.querySelector('button').onclick=()=>load(node);}
 }
 const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){observer.unobserve(entry.target);load(entry.target);}}),{rootMargin:'250px'});
 function discover(){document.querySelectorAll('.schools-widget').forEach(node=>{if(!observed.has(node)){observed.add(node);observer.observe(node);}});}
 new MutationObserver(discover).observe(document.body,{childList:true,subtree:true});discover();
})();
