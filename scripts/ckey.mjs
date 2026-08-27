/* Concept key: landing path + copy fingerprint, DCO tokens stripped.
 * Two ads share a concept when they make the same argument to the same page, even if the
 * image and ad id differ. Used to (a) diversify picks and (b) carry hand-written persona
 * annotations across weekly refreshes when a brand re-uploads the same idea. */
export function ckey(a) {
  let p = '';
  try {
    const u = new URL(a.link);
    p = u.hostname.replace(/^(www|try|get|store|link|hi|us|shop|pros)\./, '') + u.pathname.replace(/\/$/, '');
  } catch { p = a.link || ''; }
  const clean = (s, n) => (s || '').replace(/\{\{[^}]+\}\}/g, '').replace(/[^a-z0-9 ]/gi, '').toLowerCase().trim().slice(0, n);
  return p + '||' + clean(a.text, 70) + '||' + clean(a.title, 40);
}
