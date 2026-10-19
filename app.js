const menu = document.querySelector('.menu');
const navigation = document.querySelector('#navigation');
const siteHeader = document.querySelector('.site-header');
const updateHeader = () => siteHeader?.classList.toggle('is-scrolled', window.scrollY > 40);
window.addEventListener('scroll', updateHeader, { passive: true });
updateHeader();
menu?.addEventListener('click', () => {
  const expanded = menu.getAttribute('aria-expanded') === 'true';
  menu.setAttribute('aria-expanded', String(!expanded));
  navigation.classList.toggle('open', !expanded);
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && navigation?.classList.contains('open')) {
    navigation.classList.remove('open');
    menu.setAttribute('aria-expanded', 'false');
    menu.focus();
  }
});
const current = location.pathname.split('/').pop() || 'index.html';
document.querySelectorAll('nav a').forEach(a => {
  if (a.getAttribute('href') === current) a.setAttribute('aria-current', 'page');
});
const selectedArea = new URLSearchParams(location.search).get('area');
if (document.querySelector('#area-result') && ['31903','31904','31906','31907'].includes(selectedArea)) {
  document.querySelector('#area-result').textContent = `YOUR AREA OF INTEREST · COLUMBUS ${selectedArea}`;
}
function revealFaq() {
  const id = location.hash.slice(1);
  const target = document.getElementById(id);
  if (target?.tagName === 'DETAILS') target.open = true;
}
revealFaq();
window.addEventListener('hashchange', revealFaq);

// Keep the poster for mobile, reduced motion and unavailable playback.
const filmHero = document.querySelector('.hero-film');
const filmUrl = filmHero?.dataset.videoSrc;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const narrowScreen = window.matchMedia('(max-width: 760px)');
if (filmHero && filmUrl) {
  const video = document.createElement('video');
  video.muted = true;
  video.defaultMuted = true;
  video.loop = true;
  video.defaultPlaybackRate = 0.75;
  video.playbackRate = 0.75;
  video.playsInline = true;
  video.setAttribute('aria-hidden', 'true');
  video.preload = 'none';
  video.hidden = true;
  const toggle = filmHero.querySelector('.film-toggle');
  filmHero.querySelector('.hero-media').append(video);
  let manuallyPaused = false;
  let loaded = false;
  const scenes = [
    { at: 0, title: 'A place to live.<br>A place to belong.', copy: 'Find a place to make your own with Turman.' },
    { at: 4.25, title: 'Your next chapter.<br>Right here in Columbus.', copy: 'Discover the city you could call home.' },
    { at: 8.75, title: 'Make room for<br>everyday moments.', copy: 'Riverside walks. Fresh air. Time together.' },
    { at: 11.75, title: 'Find your new<br>favorite places.', copy: 'Explore the shops and local stops around Columbus.' },
    { at: 14.75, title: 'Put down roots.<br>Feel right at home.', copy: 'Find your place among Columbus’s neighborhoods.' },
    { at: 19.25, title: 'Room for the life<br>you love.', copy: 'Picture slow afternoons and time to unwind.' },
    { at: 24.75, title: 'Somewhere you’ll<br>love coming home to.', copy: 'Your next chapter starts with a conversation.' },
  ];
  const headline = filmHero.querySelector('.headline-visual');
  const sceneCopy = filmHero.querySelector('.hero-scene-copy');
  const progress = filmHero.querySelector('.film-progress');
  const progressTrack = progress?.querySelector('[role="progressbar"]');
  const segments = [...(progress?.querySelectorAll('.film-progress-segment i') || [])];
  let activeScene = -1;
  function showScene(index, animate = true) {
    if (activeScene === index || !headline) return;
    activeScene = index;
    headline.innerHTML = scenes[index].title;
    sceneCopy.textContent = scenes[index].copy;
    for (const element of [headline, sceneCopy]) {
      element.getAnimations().forEach(animation => animation.cancel());
      if (animate && !reducedMotion.matches) element.animate(
        [{ opacity: 0, transform: 'translateY(18px)' }, { opacity: 1, transform: 'translateY(0)' }],
        { duration: 650, easing: 'cubic-bezier(.2,.7,.2,1)' }
      );
    }
  }
  function syncStory() {
    if (video.hidden) return;
    const time = video.currentTime;
    let index = 0;
    for (let i = 1; i < scenes.length; i++) if (time >= scenes[i].at) index = i;
    showScene(index);
    const end = scenes[index + 1]?.at ?? 30;
    const fraction = Math.min(1, Math.max(0, (time - scenes[index].at) / (end - scenes[index].at)));
    segments.forEach((segment, i) => { segment.style.transform = `scaleX(${i < index ? 1 : i === index ? fraction : 0})`; });
    if (progressTrack) {
      progressTrack.setAttribute('aria-valuenow', (index + fraction).toFixed(2));
      progressTrack.setAttribute('aria-valuetext', `Scene ${index + 1} of 7; ${6 - index} remaining`);
      progress.querySelector('.film-step').textContent = `0${index + 1} / 07`;
      progress.querySelector('.film-remaining').textContent = index === 6 ? 'Final moment' : `${6 - index} moment${index === 5 ? '' : 's'} ahead`;
    }
  }
  video.addEventListener('timeupdate', syncStory);
  video.addEventListener('seeked', syncStory);
  video.addEventListener('pause', syncStory);
  const showPoster = () => {
    video.pause(); video.hidden = true; toggle.hidden = true;
    if (progress) progress.hidden = true;
    showScene(0, false);
  };
  const updateFilm = async () => {
    if (reducedMotion.matches || narrowScreen.matches) { showPoster(); return; }
    if (!loaded) { video.src = filmUrl; loaded = true; }
    if (manuallyPaused) {
      video.hidden = false;
      if (progress) progress.hidden = false;
      syncStory();
      toggle.hidden = false;
      toggle.textContent = 'Play background';
      toggle.setAttribute('aria-label', 'Play background video');
      return;
    }
    try { video.playbackRate = 0.75; await video.play(); video.hidden = false; if (progress) progress.hidden = false; syncStory(); toggle.hidden = false; toggle.textContent = 'Pause background'; toggle.setAttribute('aria-label', 'Pause background video'); }
    catch { showPoster(); }
  };
  toggle.addEventListener('click', async () => {
    if (video.paused) { manuallyPaused = false; await updateFilm(); }
    else { video.pause(); syncStory(); manuallyPaused = true; toggle.textContent = 'Play background'; toggle.setAttribute('aria-label', 'Play background video'); }
  });
  video.addEventListener('error', showPoster);
  reducedMotion.addEventListener('change', updateFilm);
  narrowScreen.addEventListener('change', updateFilm);
  updateFilm();
}
