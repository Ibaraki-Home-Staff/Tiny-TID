import { loadComponents } from './components.js';
import { initAreaAndLineSelectors } from './area.js';

function initIndexPage(){
  loadComponents();
  initAreaAndLineSelectors();
}

if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', initIndexPage, { once: true });
}else{
  initIndexPage();
}
