export async function loadComponents(){
  await Promise.all([
    include('[data-include="header"]','/components/header.html'),
    include('[data-include="footer"]','/components/footer.html')
  ]);
  setActiveNav();
  initNavToggle();
}

async function include(selector, url){
  const el = document.querySelector(selector);
  if(!el) return;
  try{
    const res = await fetch(url, {cache:'no-store'});
    if(!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    el.innerHTML = await res.text();
  }catch(err){
    el.innerHTML = `<div class="component-error">読み込みエラー: ${url}</div>`;
    console.error('Component load failed', url, err);
  }
}

function setActiveNav(){
  const nav = document.querySelector('[data-nav]');
  if(!nav) return;
  const current = new URL(window.location.href);
  for(const link of nav.querySelectorAll('a[href]')){
    try{
      const url = new URL(link.getAttribute('href'), window.location.origin);
      if(url.pathname === current.pathname){
        link.classList.add('active');
        link.setAttribute('aria-current','page');
      }
    }catch{ /* noop */ }
  }
}

function initNavToggle(){
  const btn = document.querySelector('[data-nav-toggle]');
  const nav = document.querySelector('[data-nav]');
  if(!btn || !nav) return;
  const toggle = () => {
    const expanded = btn.getAttribute('aria-expanded') === 'true';
    btn.setAttribute('aria-expanded', String(!expanded));
    nav.classList.toggle('open', !expanded);
  };
  btn.addEventListener('click', toggle);
}

