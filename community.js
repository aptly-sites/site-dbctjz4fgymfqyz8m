(async()=>{
 const norm=v=>String(v||'').trim().toLowerCase();
 if(location.pathname.endsWith('columbus-ga.html'))document.querySelector('nav a[href="areas.html"]')?.setAttribute('aria-current','page');
 const mapNode=document.getElementById('community-map');
 if(mapNode&&window.L){const map=L.map(mapNode,{scrollWheelZoom:false}).setView([32.460976,-84.987709],11);L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).addTo(map).on('tileerror',()=>{document.querySelector('.map-caption').textContent='Map tiles are unavailable. Explore Columbus using the city guide alongside.';});const marker=L.marker([32.460976,-84.987709],{title:'Explore Columbus',icon:L.divIcon({className:'city-map-pin',html:'Columbus →',iconSize:[130,38],iconAnchor:[65,19]})}).addTo(map);marker.on('click',()=>location.href='columbus-ga.html');}
 const cards=document.querySelector('[data-city-homes]'),summary=document.getElementById('city-feed-summary');
 try{
  const homes=await window.TurmanListings.feed();
  if(summary){const cities=[...new Set(homes.map(r=>norm(r.address?.city)).filter(Boolean))];summary.textContent=homes.length?`${homes.length} current homes · ${cities.length} ${cities.length===1?'city':'cities'}`:'Check back for available homes.';for(const city of cities){if(city==='columbus')continue;const a=document.createElement('a');a.className='text-link';a.href='rentals.html?city='+encodeURIComponent(city);a.textContent='Explore available homes in '+city;summary.after(a);}}
  if(cards){const local=homes.filter(r=>norm(r.address?.city)===norm(cards.dataset.cityHomes));document.getElementById('city-home-count').textContent=`${local.length} current ${local.length===1?'home':'homes'} in Columbus`;cards.innerHTML=local.length?local.slice(0,6).map(window.TurmanListings.card).join(''):'<p>No available properties. <a href="rentals.html">Search all our listings.</a></p>';cards.querySelectorAll('[data-compare]').forEach(b=>b.remove());}
 }catch{if(summary)summary.textContent='Explore our city guide; contact leasing for current availability.';if(cards){document.getElementById('city-home-count').textContent='Listings are temporarily unavailable.';cards.innerHTML='<a href="rentals.html?city=Columbus">Try the Columbus rental search →</a>';}}
})();
