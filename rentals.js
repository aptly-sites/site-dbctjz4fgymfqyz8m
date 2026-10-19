/* Turman's intentionally public Aptly feed. No authenticated API credentials. */
(() => {
  'use strict';
  const PORTAL = 'https://portal.getaptly.com/search/DbctJZ4fgyMFqyZ8M/';
  const FEED = 'https://app.getaptly.com/api/portal/listings/DbctJZ4fgyMFqyZ8M';
  const MAP_TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  const $ = (q, root = document) => root.querySelector(q);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const https = v => { try { const u = new URL(v); return u.protocol === 'https:' && !u.username && !u.password ? u.href : ''; } catch { return ''; } };
  const plain = v => { const doc = new DOMParser().parseFromString(String(v || ''), 'text/html'); return doc.body.textContent.trim(); };
  const number = v => typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null;
  const money = v => number(v?.amount) === null ? 'Contact leasing' : new Intl.NumberFormat('en-US', {style:'currency', currency:/^[A-Z]{3}$/.test(v.currency) ? v.currency : 'USD', maximumFractionDigits:v.amount % 100 ? 2 : 0}).format(v.amount / 100);
  const missing = v => v === null || v === undefined || v === '' ? 'Contact leasing' : v;
  const norm = v => String(v || '').trim().toLowerCase();
  const photos = r => [...new Set([r.photo, r.marketingFiles].flatMap(v => Array.isArray(v) ? v : [v]).map(https).filter(Boolean))];
  const title = r => plain(r.marketingName) || (r.buildingType === 'Apartment' || r.buildingType === 'Duplex' ? r.name : r.address?.address) || r.name || 'Rental home';
  const cityLine = r => [r.address?.city, r.address?.stateCode, r.address?.postalCode].filter(Boolean).join(' ');
  const local = r => `home.html?id=${encodeURIComponent(r._id)}`;
  const canonical = r => new URL(local(r), location.href).href;
  const coords = r => { const p = r.address?.geopoint; return Array.isArray(p) && p.length === 2 && p.every(v => typeof v === 'number' && Number.isFinite(v) && v !== 0) && Math.abs(p[0]) <= 180 && Math.abs(p[1]) <= 90 ? [p[1],p[0]] : null; };
  const available = r => { const d = new Date(r.availableDate); if (!r.availableDate || Number.isNaN(d.getTime())) return 'For rent'; return d > new Date() ? `Available ${d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'})}` : 'Available now'; };
  const tour = r => r.aptlyShowings?.active && https(r.aptlyShowings.link) || '';
  const apply = r => r.aptlyScreening?.active && https(r.aptlyScreening.link) || PORTAL;
  const inquiry = r => `mailto:leasing@turmanco.com?subject=${encodeURIComponent('Tour inquiry: ' + title(r))}`;
  const actions = r => `<a class="rental-action" href="${esc(tour(r) || inquiry(r))}">${tour(r) ? 'Schedule tour' : 'Ask about a tour'}</a><a class="rental-action primary" href="${esc(apply(r))}">Apply</a>`;
  function moveInCosts(r) {
    const rent=number(r.marketRent?.amount), deposit=number(r.deposit?.amount), fee=number(r.applicationFee?.amount);
    const total=rent!==null&&deposit!==null ? {amount:rent+deposit+(fee??0),currency:r.marketRent.currency||'USD'} : null;
    return `<div class="booking-pricing"><p class="eyebrow">PLAN YOUR MOVE</p><h3>Move-in cost estimate</h3><dl><div><dt>First month's base rent</dt><dd>${esc(money(r.marketRent))}</dd></div><div><dt>Listed security deposit</dt><dd>${esc(money(r.deposit))}</dd></div><div><dt>Application fee${fee!==null?' (one applicant)':''}</dt><dd>${esc(money(r.applicationFee))}</dd></div></dl><div class="booking-total"><span>Estimated upfront amount</span><strong>${total?esc(money(total)):'Ask leasing'}</strong></div><p class="booking-cost-note">${fee===null?'Application fee is not included. ':''}Estimate assumes a full first month${fee!==null?' and one applicant':''}. Prorated rent, pet charges, utilities and other fees may apply. Confirm your final move-in amount with leasing.</p><a href="experience.html#zero-deposit">Explore the Zero Deposit option →</a></div>`;
  }
  let request;
  function feed(retry = false) {
    if (!request || retry) request = (async () => {
      const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 15000);
      try { const res = await fetch(FEED, {signal:controller.signal}); if (!res.ok) throw Error('Feed failed'); const data = await res.json(); if (!Array.isArray(data.data)) throw Error('Invalid feed'); return data.data.filter(r => r && typeof r._id === 'string' && r.publishedForRent !== false); }
      finally { clearTimeout(timer); }
    })();
    return request;
  }
  const loader = '<div class="rental-loader" role="status"><img src="assets/a2983432-Turman-Co-Monogram-SVG.svg" width="48" height="48" alt=""><p>Finding your next home…</p></div>';
  const failure = '<div class="rental-empty"><h2>We couldn’t load the homes.</h2><p>Please try again, or browse Turman’s rental portal.</p><button type="button" data-retry>Try again</button> <a href="'+PORTAL+'">Browse rental portal</a></div>';
  const selected = new Set();
  let homes = [], shown = [], map, markers, compareMaps = [];
  const photoCounter = (index,total) => `<span class="counter-dots" aria-hidden="true">${Array.from({length:Math.min(total,5)},(_,i)=>`<i class="${i===Math.min(4,index)?'active':''}"></i>`).join('')}</span><span class="counter-number">${index+1}/${total}</span>`;
  const shareIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M14 4h6v6M20 4l-10 10M10 5H5v14h14v-5"/></svg>';
  const compareIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
  const photoPlaceholder = (label = 'Photos coming soon', hidden = false) => `<div class="photo-missing branded-placeholder"${hidden?' hidden':''}><div class="placeholder-logo" role="img" aria-label="Turman Co."></div><span class="placeholder-label">${label}</span></div>`;
  function carousel(r, large = false) {
    const list = photos(r);
    return `<div class="rental-carousel ${large ? 'large' : ''}" data-home="${esc(r._id)}" data-photo="0">${list.length ? `<img src="${esc(list[0])}" alt="${esc(title(r))} — photo 1" ${large ? '' : 'loading="lazy"'}>${photoPlaceholder('Photo unavailable',true)}${list.length > 1 ? `<button type="button" data-photo-step="-1" aria-label="Previous photo of ${esc(title(r))}">‹</button><button type="button" data-photo-step="1" aria-label="Next photo of ${esc(title(r))}">›</button>` : ''}<span class="photo-count">${photoCounter(0,list.length)}</span>` : photoPlaceholder()}</div>`;
  }
  const facts = r => `${number(r.beds) === null ? 'Beds: ask leasing' : r.beds === 0 ? 'Studio' : r.beds+' beds'} <span>·</span> ${number(r.baths) === null ? 'Baths: ask leasing' : r.baths+' baths'}${number(r.squareFeet) !== null ? ' <span>·</span> '+r.squareFeet.toLocaleString()+' sq ft' : ''}`;
  function card(r) {
    const badge = available(r).startsWith('Available ') && available(r)!=='Available now' ? 'Coming soon' : available(r);
    const media=carousel(r);
    const overlays=`<span class="availability" title="${esc(available(r))}">${esc(badge)}</span><div class="card-tools"><button type="button" data-share="${esc(r._id)}" title="Share home" aria-label="Share ${esc(title(r))}">${shareIcon}</button><button type="button" data-compare="${esc(r._id)}" title="Compare home" aria-label="Compare ${esc(title(r))}" aria-pressed="${selected.has(r._id)}">${compareIcon}</button></div>`;
    return `<article class="rental-card" id="home-${esc(r._id)}" tabindex="-1"><div class="card-image">${media}${overlays}</div><div class="rental-card-copy"><p class="rental-price">${esc(money(r.marketRent))}<small>/mo</small></p><p class="rental-facts">${facts(r)}</p><h2><a href="${local(r)}">${esc(title(r))}</a></h2><p class="rental-city">${esc(cityLine(r))}</p><div class="card-actions">${actions(r)}</div><a class="rental-detail-link" href="${local(r)}">View details <span aria-hidden="true">→</span></a></div></article>`;
  }
  function initMap() {
    if (map || !window.L || !L.markerClusterGroup) return;
    map = L.map('rental-map',{scrollWheelZoom:false}).setView([32.46,-84.94],12);
    const layer = L.tileLayer(MAP_TILES,{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(map);
    let failed = false;
    layer.on('tileerror',()=>{failed=true;$('#map-note').textContent='Map tiles are unavailable. You can still browse every home in the list.';});
    layer.on('load',()=>{if (!failed) $('#map-note').textContent='';});
    markers = L.markerClusterGroup({maxClusterRadius:48,showCoverageOnHover:false,iconCreateFunction:c=>L.divIcon({html:`<span>${c.getChildCount()}<small>HOMES</small></span>`,className:'home-cluster',iconSize:[56,56],iconAnchor:[28,28]})});
    map.addLayer(markers);
    new ResizeObserver(()=>{map.invalidateSize();}).observe($('#rental-map'));
  }
  function fitMap() { if (map && markers?.getLayers().length) map.fitBounds(markers.getBounds(),{padding:[45,45],maxZoom:15}); }
  function drawMap() {
    initMap();
    if (!map) { $('#map-note').textContent='Map unavailable. Browse homes in the list.'; return; }
    markers.clearLayers();
    shown.forEach(r=>{ const point=coords(r); if (!point) return; const marker=L.marker(point,{title:`${title(r)} · ${money(r.marketRent)}`,icon:L.divIcon({className:'home-price-pin',html:esc(money(r.marketRent)),iconSize:[90,32],iconAnchor:[45,16]})});
      marker.on('click',()=>{setView('list');const card=document.getElementById('home-'+r._id);document.querySelectorAll('.rental-card.is-highlighted').forEach(c=>c.classList.remove('is-highlighted'));card.classList.add('is-highlighted');card.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'});card.focus({preventScroll:true});});markers.addLayer(marker); });
    map.invalidateSize();fitMap();
  }
  function setView(view) { $('.rental-layout')?.classList.toggle('show-map',view==='map');$('.rental-layout')?.classList.toggle('show-both',view==='both');document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===view)));if(view==='map'||view==='both')requestAnimationFrame(()=>{map?.invalidateSize();fitMap();}); }
  function filter() {
    const f = new FormData($('#rental-filters')), query=norm(f.get('q')), city=norm(f.get('city'));
    shown=homes.filter(r=>(!city || norm(r.address?.city)===city) && (!query || norm([r.address?.address,r.address?.postalCode,title(r)].join(' ')).includes(query)) && (!f.get('rent') || number(r.marketRent?.amount)!==null && r.marketRent.amount/100<=Number(f.get('rent'))) && (f.get('beds')==='' || number(r.beds)!==null && (f.get('beds')==='0'?r.beds===0:r.beds>=Number(f.get('beds')))) && (!f.get('baths') || number(r.baths)!==null && r.baths>=Number(f.get('baths'))) && (!f.get('type') || r.buildingType===f.get('type')));
    const sort=$('#rental-sort').value;if(sort!=='default')shown.sort((a,b)=>(number(a.marketRent?.amount)??Infinity)-(number(b.marketRent?.amount)??Infinity));if(sort==='high')shown.reverse();
    $('#results-count').textContent=`${shown.length} ${shown.length===1?'home':'homes'}${f.get('city')?' in '+f.get('city'):''}${query?' matching “'+f.get('q')+'”':''}`;
    $('#rental-cards').innerHTML=shown.length?shown.map(card).join(''):'<div class="rental-empty"><h2>No available properties.</h2><a href="rentals.html">Search all our listings.</a></div>';
    drawMap();
  }
  async function loadSearch(retry=false) {
    $('#rental-status').innerHTML=loader;$('.rental-layout').hidden=true;
    try {
      homes=await feed(retry);const f=$('#rental-filters');
      for(const [name,values] of [['city',[...new Set(homes.map(r=>r.address?.city).filter(Boolean))]],['type',[...new Set(homes.map(r=>r.buildingType).filter(Boolean))]]]) { const select=f.elements[name];const previous=select.value;select.length=1;values.sort().forEach(v=>select.add(new Option(v,v)));select.value=previous; }
      if(!retry){const params=new URLSearchParams(location.search);f.elements.q.value=params.get('area')||params.get('q')||'';const city=params.get('city');if(city){if(![...f.elements.city.options].some(o=>norm(o.value)===norm(city)))f.elements.city.add(new Option(city,city));f.elements.city.value=[...f.elements.city.options].find(o=>norm(o.value)===norm(city)).value;}}
      $('#rental-status').innerHTML='';$('.rental-layout').hidden=false;filter();
    } catch {$('#rental-status').innerHTML=failure;$('#results-count').textContent='Listings unavailable';}
  }
  function syncCompare() {
    $('#compare-bar').hidden=!selected.size;$('#compare-count').textContent=`${selected.size} of 3 homes selected`;
    document.querySelectorAll('[data-compare]').forEach(b=>b.setAttribute('aria-pressed',String(selected.has(b.dataset.compare))));
  }
  const detailRows = r => [['Monthly rent',money(r.marketRent)],['Bedrooms',missing(number(r.beds))],['Bathrooms',missing(number(r.baths))],['Square feet',missing(number(r.squareFeet))],['Availability',r.availableDate && !Number.isNaN(Date.parse(r.availableDate))?new Date(r.availableDate).toLocaleDateString('en-US',{timeZone:'UTC'}):'Contact leasing'],['Lease term',missing(r.leaseTerm)],['Pets',missing(plain(r.animalPolicy))],['Security deposit',money(r.deposit)],['Application fee',money(r.applicationFee)],['Laundry',missing(r.laundryType)],['Parking',missing(r.parkingType)]];
  function openCompare() {
    const list=homes.filter(r=>selected.has(r._id)), dialog=$('#compare-dialog');
    $('#compare-content').innerHTML=`<div class="comparison-scroll"><table class="comparison-table"><thead><tr>${list.map(r=>`<th scope="col">${carousel(r)}<h3>${esc(title(r))}</h3><p>${esc(cityLine(r))}</p><a href="${esc(tour(r)||inquiry(r))}">${tour(r)?'Schedule tour':'Ask about a tour'}</a><div class="comparison-links"><button type="button" data-share="${esc(r._id)}">Share</button><a href="${local(r)}">View details</a></div></th>`).join('')}</tr></thead><tbody>${detailRows(list[0]).map(([label],i)=>`<tr>${list.map(r=>`<td><span>${esc(label)}</span>${esc(detailRows(r)[i][1])}</td>`).join('')}</tr>`).join('')}<tr>${list.map(r=>`<td><span>Amenities</span>${esc((r.unitAmenities||[]).join(', ')||'Contact Turman for amenity details.')}</td>`).join('')}</tr><tr>${list.map((r,i)=>`<td><span>Location</span><div id="compare-map-${i}" class="compare-map">${coords(r)?'':'Map location unavailable'}</div><p>${esc(r.address?.formattedAddress||cityLine(r))}</p></td>`).join('')}</tr></tbody></table></div>`;
    $('#compare-feedback').textContent='';dialog.showModal();
    if(window.L)list.forEach((r,i)=>{if(!coords(r))return;const m=L.map('compare-map-'+i,{scrollWheelZoom:false}).setView(coords(r),14);L.tileLayer(MAP_TILES,{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).addTo(m);L.circleMarker(coords(r),{color:'#9a2b18',fillOpacity:1,radius:7}).addTo(m);compareMaps.push(m);});
  }
  async function share(button,id) {
    const r=homes.find(r=>r._id===id);if(!r)return;
    try {await navigator.clipboard.writeText(canonical(r));const old=button.innerHTML;button.innerHTML='<span aria-label="Copied">✓</span>';const label=button.getAttribute('aria-label');button.setAttribute('aria-label','Link copied');setTimeout(()=>{button.innerHTML=old;if(label)button.setAttribute('aria-label',label);},1800);}
    catch {let input=button.parentElement.querySelector('.share-url');if(!input){input=document.createElement('input');input.className='share-url';input.readOnly=true;input.setAttribute('aria-label','Copy home link');button.parentElement.append(input);}input.value=canonical(r);input.focus();input.select();}
  }
  function advance(car,step) {
    const r=homes.find(r=>r._id===car.dataset.home),list=photos(r);if(!list.length)return;
    const index=(Number(car.dataset.photo)+step+list.length)%list.length;car.dataset.photo=index;
    const img=$('img',car);img.hidden=false;$('.photo-missing',car).hidden=true;img.src=list[index];img.alt=`${title(r)} — photo ${index+1}`;$('.photo-count',car).innerHTML=photoCounter(index,list.length);
  }
  function virtual(r) {
    const u=https(r.virtualTourUrl);if(!u)return '';
    const parsed=new URL(u);const known=parsed.hostname==='my.matterport.com'&&parsed.pathname.startsWith('/show/');
    return `<section id="virtual-tour"><h2>Take a Look Inside.</h2>${known?`<iframe src="${esc(u)}" title="Virtual tour of ${esc(title(r))}" allow="fullscreen; xr-spatial-tracking" allowfullscreen loading="lazy"></iframe>`:''}<a href="${esc(u)}" target="_blank" rel="noopener">Open virtual tour in a new tab</a></section>`;
  }
  async function loadDetail(retry=false) {
    const root=$('#listing-detail');root.innerHTML=loader;
    try {
      homes=await feed(retry);const r=homes.find(r=>r._id===new URLSearchParams(location.search).get('id'));
      if(!r){root.innerHTML='<div class="rental-empty"><h1>This home is no longer listed.</h1><p>Let’s find another place for your next chapter.</p><a class="button" href="rentals.html">Browse available homes</a></div>';return;}
      document.title=title(r)+' | Turman Co.';
      const meta=$('meta[name="description"]');meta.content=`${title(r)}, ${cityLine(r)}. ${money(r.marketRent)} per month. Explore photos and rental details with Turman.`;
      const link=document.createElement('link');link.rel='canonical';link.href=canonical(r);document.head.append(link);
      for(const [property,content] of [['og:title',document.title],['og:url',canonical(r)],['og:image',photos(r)[0]||'']]){if(!content)continue;const tag=document.createElement('meta');tag.setAttribute('property',property);tag.content=content;document.head.append(tag);}
      const images=photos(r), index=homes.findIndex(h=>h._id===r._id);
      const neighbor=(offset)=>homes[(index+offset+homes.length)%homes.length];
      const homeName=esc(title(r)), address=esc(r.address?.formattedAddress||cityLine(r));
      const booking=`<p class="eyebrow">READY TO SEE IT?</p><h2>Make This Your<br>Next Home.</h2><p>Talk with our leasing team about a tour, or start your application through Turman’s secure portal.</p>${moveInCosts(r)}${actions(r)}<div class="booking-contact"><strong>Turman Co.</strong><a href="tel:+17066894545">(706) 689-4545</a><a href="mailto:leasing@turmanco.com">leasing@turmanco.com</a></div>`;
      const factItems=[['Monthly rent',money(r.marketRent)],['Bedrooms',missing(number(r.beds))],['Bathrooms',missing(number(r.baths))],['Square feet',missing(number(r.squareFeet))]];
      const featureIcon = label => {
        const paths={
          'Property type':'<path d="m3 10 9-7 9 7M5 9v12h14V9M9 21v-8h6v8"/>',
          Address:'<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.5"/>',
          Pets:'<ellipse cx="5" cy="9" rx="2" ry="3"/><ellipse cx="10" cy="5" rx="2" ry="3"/><ellipse cx="16" cy="5" rx="2" ry="3"/><ellipse cx="21" cy="10" rx="2" ry="3"/><path d="M7 16c2-6 8-6 10 0 4 7-3 5-5 4-2 1-8 3-5-4Z"/>',
          Parking:'<path d="M8 21V3h6a5 5 0 0 1 0 10H8"/>',
          Laundry:'<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M4 7h16M7 4.5h2"/><circle cx="12" cy="14" r="4"/>',
          'Security deposit':'<path d="m12 2 8 3v6c0 5-8 11-8 11S4 16 4 11V5Z"/><path d="m8 11 3 3 5-6"/>',
          Heating:'<path d="M9 14V5a3 3 0 0 1 6 0v9a5 5 0 1 1-6 0ZM12 8v9"/>',
          Cooling:'<path d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7M9 4l3 3 3-3M9 20l3-3 3 3"/>'
        };
        return `<svg class="feature-icon" viewBox="0 0 26 26" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[label]||paths['Property type']}</svg>`;
      };
      const featureItems=[['Property type',r.buildingType],['Address',r.address?.formattedAddress||cityLine(r)],['Pets',plain(r.animalPolicy)||'Ask leasing'],['Parking',r.parkingType||'Ask leasing'],['Laundry',r.laundryType||'Ask leasing'],['Security deposit',money(r.deposit)],['Heating',r.heatingType],['Cooling',r.coolingType]].filter(([,v])=>v);
      document.getElementById('listing-crumb-current').textContent=title(r);
      root.innerHTML=`      <div class="listing-switcher">${homes.length>1?`<a href="${local(neighbor(-1))}"><span class="switch-arrow" aria-hidden="true">←</span><span><small>Previous home</small>${esc(title(neighbor(-1)))}</span></a>`:'<span></span>'}<a class="switch-all" href="rentals.html">All available homes<small>${index+1} of ${homes.length}</small></a>${homes.length>1?`<a href="${local(neighbor(1))}"><span><small>Next home</small>${esc(title(neighbor(1)))}</span><span class="switch-arrow" aria-hidden="true">→</span></a>`:'<span></span>'}</div>
      <div class="detail-mosaic ${images.length<5?'few-photos':''}" style="--photo-count:${Math.min(images.length,5)||1}">${images.length?images.slice(0,5).map((src,i)=>`<button type="button" data-gallery-index="${i}" aria-label="Open photo ${i+1} of ${homeName}"><img src="${esc(src)}" alt="${homeName} — photo ${i+1}">${photoPlaceholder('Photo unavailable',true)}</button>`).join(''):photoPlaceholder()}${images.length?`<button type="button" id="gallery-open" class="gallery-count">View all ${images.length} photos</button>`:''}</div>
      <div class="detail-layout"><div class="detail-main-column">
      <section class="detail-overview"><div class="overview-top"><button type="button" data-share="${esc(r._id)}">Share home ↗</button></div><h1>${homeName}</h1><p class="overview-address">${address}</p><div class="detail-facts">${factItems.map(([label,value])=>`<div><strong>${esc(value)}</strong><small>${label}</small></div>`).join('')}</div></section>
      ${https(r.virtualTourUrl)?`<div class="detail-panel">${virtual(r)}</div>`:''}
      <section class="detail-tour" id="tour-options"><p class="eyebrow">COME TAKE A LOOK</p><h2>Picture Yourself Here.</h2><p>${tour(r)?'Choose a tour time through Turman’s scheduling portal.':'Our leasing team can help you explore this home and confirm the available tour options.'}</p><a class="button" href="${esc(tour(r)||inquiry(r))}">${tour(r)?'View available tour times':'Ask about a tour'} <span aria-hidden="true">↗</span></a></section>
      <section><p class="eyebrow">PROPERTY DETAILS</p><h2>Rental Features</h2><dl class="home-fact-list feature-grid">${featureItems.map(([k,v])=>`<div><dt>${featureIcon(k)}<span>${esc(k)}</span></dt><dd>${esc(v)}</dd></div>`).join('')}</dl>${Array.isArray(r.unitAmenities)&&r.unitAmenities.length?'<h3 class="amenities-heading">Amenities</h3><ul class="home-amenities">'+r.unitAmenities.map(a=>'<li>'+esc(a)+'</li>').join('')+'</ul>':''}</section>
      <section><h2>About This ${esc(r.address?.city||'Columbus')} Rental</h2><p class="home-description">${esc(plain(r.marketingDescription)||'Want to know more about this home? Our leasing team can answer your questions about the property, move-in timing and the next steps in making it yours.')}</p></section>
      <section class="detail-questions"><p class="eyebrow">QUICK ANSWERS</p><h2>Rental Questions Answered</h2><details open><summary>How much is the monthly rent?</summary><p>${number(r.marketRent?.amount)!==null?`${esc(money(r.marketRent))} per month is the advertised base rent. Ask leasing about additional fees and final lease terms.`:'Contact leasing for current pricing.'}</p></details><details><summary>How many bedrooms and bathrooms does this home have?</summary><p>${number(r.beds)!==null&&number(r.baths)!==null?`${r.beds===0?'This studio has':`This home has ${r.beds} bedrooms and`} ${r.baths} bathrooms.`:'Please contact leasing to confirm the layout of this home.'}</p></details><details><summary>Can I schedule a tour?</summary><p><a href="${esc(tour(r)||inquiry(r))}">${tour(r)?'View available tour times':'Contact our leasing team about tour options'}</a>.</p></details><details><summary>Are pets allowed?</summary><p>${esc(plain(r.animalPolicy)||'Contact leasing to confirm pet policies and any applicable fees for this home.')}</p></details></section>
      </div><aside class="detail-booking">${booking}${https(r.virtualTourUrl)?'<a href="#virtual-tour">View virtual tour ↓</a>':''}</aside></div>
      <section class="detail-schools"><p class="eyebrow">EXPLORE THE NEIGHBORHOOD</p><h2>Nearby Schools</h2><div class="schools-widget" data-school-listing="${esc(r._id)}" ${coords(r)?`data-school-lat="${coords(r)[0]}" data-school-lon="${coords(r)[1]}"`:''}><p role="status">Loading nearby school information…</p></div></section><section class="related-homes"><p class="eyebrow">MORE PLACES TO CALL HOME</p><h2>Similar Rentals You May Like</h2><div class="rental-cards">${homes.filter(h=>h._id!==r._id).sort((a,b)=>Number(norm(b.address?.city)===norm(r.address?.city))-Number(norm(a.address?.city)===norm(r.address?.city))).slice(0,3).map(card).join('')}</div></section><section class="detail-bottom-cta"><div><p class="eyebrow">YOUR NEXT CHAPTER</p><h2>Find Your Next Home.</h2><p>Talk to our leasing team.</p></div><div class="card-actions">${actions(r)}</div></section>`;
      // Details use the same live records and photo controls as rental search.
      root.querySelectorAll('[data-compare]').forEach(b=>b.remove());
      function openGallery(index=0){$('#photo-content').innerHTML=carousel(r,true);if(index)advance($('#photo-content .rental-carousel'),index);$('#photo-dialog').showModal();}
      $('#gallery-open')?.addEventListener('click',()=>openGallery());
      root.querySelectorAll('[data-gallery-index]').forEach(button=>button.addEventListener('click',()=>openGallery(Number(button.dataset.galleryIndex))));
    } catch {root.innerHTML=failure;}
  }
  document.addEventListener('error',e=>{if(e.target.matches?.('.rental-carousel img, .detail-mosaic img')){e.target.hidden=true;$('.photo-missing',e.target.parentElement).hidden=false;}},true);
  document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
    if(b.hasAttribute('data-retry')){if($('#rental-filters'))loadSearch(true);else loadDetail(true);}
    if(b.hasAttribute('data-photo-step'))advance(b.closest('.rental-carousel'),Number(b.dataset.photoStep));
    if(b.hasAttribute('data-share'))share(b,b.dataset.share);
    if(b.hasAttribute('data-close'))b.closest('dialog').close();
    if(b.hasAttribute('data-view'))setView(b.dataset.view);
    if(b.hasAttribute('data-compare')){const id=b.dataset.compare;if(selected.has(id))selected.delete(id);else if(selected.size<3)selected.add(id);else{$('#compare-count').textContent='Choose up to 3 homes. Remove one to add another.';return;}syncCompare();}
  });
  $('#photo-dialog')?.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();advance($('#photo-content .rental-carousel'),e.key==='ArrowLeft'?-1:1);}});
  $('#compare-dialog')?.addEventListener('close',()=>{compareMaps.forEach(m=>m.remove());compareMaps=[];});
  window.TurmanListings = {feed: async (...args) => { homes = await feed(...args); return homes; }, card};
  if($('#rental-filters')) {
    $('#rental-filters').addEventListener('submit',e=>e.preventDefault());$('#rental-filters').addEventListener('input',filter);$('#rental-filters').addEventListener('reset',()=>setTimeout(filter,0));$('#rental-sort').addEventListener('change',filter);$('#map-reset').addEventListener('click',fitMap);$('#compare-open').addEventListener('click',openCompare);$('#compare-clear').addEventListener('click',()=>{selected.clear();syncCompare();});loadSearch();
  } else if($('#listing-detail')){document.querySelector('nav a[href="rentals.html"]')?.setAttribute('aria-current','page');loadDetail();}
})();
