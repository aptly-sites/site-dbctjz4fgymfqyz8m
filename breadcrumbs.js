(() => {
  const labels = {
    'index.html': 'Home', 'rentals.html': 'Available Homes', 'home.html': 'Property Details', 'areas.html': 'Neighborhoods',
    'columbus-ga.html': 'Columbus Guide', 'experience.html': 'The Turman Experience',
    'about.html': 'Our Story', 'contact.html': 'Contact', 'faq.html': 'Rental Questions',
    'privacy.html': 'Privacy Policy', 'terms.html': 'Terms of Service', 'review.html': 'Film Review',
    'uptown-columbus-ga.html': 'Uptown', 'midtown-columbus-ga.html': 'MidTown',
    'lake-bottom-columbus-ga.html': 'Lake Bottom', 'hilton-woods-columbus-ga.html': 'Hilton Woods/Hilton Heights',
    'east-highlands-columbus-ga.html': 'East Highlands',
    'uptown-columbus-ga-restaurants.html': 'Uptown Dining',
    'uptown-columbus-ga-activities.html': 'Uptown Activities',
    'uptown-columbus-ga-commuting.html': 'Getting Around Uptown'
  };
  if (!document.referrer) return;
  let source;
  try { source = new URL(document.referrer); } catch { return; }
  if (source.origin !== location.origin) return;
  const file = source.pathname.split('/').pop() || 'index.html';
  if (source.pathname === location.pathname || !labels[file]) return;
  const nav = document.querySelector('main > .site-breadcrumb, main > .neighborhood-breadcrumb');
  if (!nav || [...nav.querySelectorAll('a')].some(a => new URL(a.href).pathname === source.pathname)) return;
  const link = document.createElement('a');
  link.className = 'breadcrumb-return';
  link.href = source.pathname + source.search;
  link.textContent = '← Back to ' + labels[file];
  nav.append(link);
})();
