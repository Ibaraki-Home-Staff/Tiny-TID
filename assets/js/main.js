import { loadComponents } from './components.js?v=39';
import { initAreaAndLineSelectors } from './area.js?v=39';

document.addEventListener('DOMContentLoaded', () => {
  loadComponents();
  initAreaAndLineSelectors();
});
