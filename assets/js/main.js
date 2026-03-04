import { loadComponents } from './components.js';
import { initAreaAndLineSelectors } from './area.js';

document.addEventListener('DOMContentLoaded', () => {
  loadComponents();
  initAreaAndLineSelectors();
});
