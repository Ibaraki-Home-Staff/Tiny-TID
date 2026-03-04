const APP_VERSION_META_SELECTOR = 'meta[name="app:version"]';
const COMPONENTS = Object.freeze([
  { selector: '[data-include="header"]', path: '/components/header.html' },
  { selector: '[data-include="footer"]', path: '/components/footer.html' }
]);

function getAssetVersion(){
  const meta = document.querySelector(APP_VERSION_META_SELECTOR);
  return meta?.getAttribute('content')?.trim() || '';
}

function withVersion(url){
  const version = getAssetVersion();
  if(!version) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}v=${encodeURIComponent(version)}`;
}

export async function loadComponents(){
  await Promise.all(
    COMPONENTS.map(({ selector, path }) => include(selector, withVersion(path)))
  );
  setActiveNav();
  initNavToggle();
}

async function include(selector, url){
  const element = document.querySelector(selector);
  if(!element) return;

  try{
    const response = await fetch(url, { cache: 'no-store' });
    if(!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    element.innerHTML = await response.text();
  }catch(error){
    element.innerHTML = `<div class="component-error">読み込みエラー: ${url}</div>`;
    console.error('Component load failed', { selector, url, error });
  }
}

function setActiveNav(){
  const nav = document.querySelector('[data-nav]');
  if(!nav) return;

  const currentPath = new URL(window.location.href).pathname;
  for(const link of nav.querySelectorAll('a[href]')){
    const href = link.getAttribute('href');
    if(!href) continue;

    try{
      const linkPath = new URL(href, window.location.origin).pathname;
      if(linkPath === currentPath){
        link.classList.add('active');
        link.setAttribute('aria-current', 'page');
      }
    }catch{
      // Ignore malformed href values.
    }
  }
}

function initNavToggle(){
  const button = document.querySelector('[data-nav-toggle]');
  const nav = document.querySelector('[data-nav]');
  if(!button || !nav) return;

  button.addEventListener('click', () => {
    const expanded = button.getAttribute('aria-expanded') === 'true';
    button.setAttribute('aria-expanded', String(!expanded));
    nav.classList.toggle('open', !expanded);
  });
}
