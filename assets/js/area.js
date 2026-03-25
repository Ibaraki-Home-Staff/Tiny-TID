import { fetchAreaMaster } from './tid-data.js';

const STORAGE_KEYS = Object.freeze({
  selectedArea: 'selectedArea',
  selectedLine: (area) => `selectedLine:${area}`,
  selectedDirection: (area, line) => `selectedDirection:${area}:${line}`
});

function storageGet(key){
  try{ return localStorage.getItem(key); }catch{ return null; }
}

function storageSet(key, value){
  try{ localStorage.setItem(key, value); }catch{}
}

export function initAreaAndLineSelectors(){
  const areaSelect = document.getElementById('areaSelect');
  const lineSelect = document.getElementById('lineSelect');
  const showButton = document.getElementById('showBtn');
  const directionInputs = Array.from(document.querySelectorAll('input[name="direction"]'));

  if(!areaSelect || !lineSelect) return;
  updateShowButtonState(showButton, false);

  restoreInitialSelection({ areaSelect, lineSelect, directionInputs, showButton });

  areaSelect.addEventListener('change', async () => {
    const area = areaSelect.value;
    storageSet(STORAGE_KEYS.selectedArea, area);

    await populateLinesForArea(area, lineSelect);
    const restored = restoreSavedLine(area, lineSelect);
    if(restored){
      restoreSavedDirection(area, lineSelect.value, directionInputs);
    } else {
      setDirection(directionInputs, 'both');
    }
    updateShowButtonState(showButton, Boolean(areaSelect.value && lineSelect.value));
  });

  lineSelect.addEventListener('change', () => {
    const area = areaSelect.value;
    const line = lineSelect.value;

    if(area && line){
      storageSet(STORAGE_KEYS.selectedLine(area), line);
      if(!restoreSavedDirection(area, line, directionInputs)){
        setDirection(directionInputs, 'both');
      }
    }
    updateShowButtonState(showButton, Boolean(area && line));
  });

  showButton?.addEventListener('click', () => {
    const area = areaSelect.value;
    const line = lineSelect.value;
    if(!area || !line) return;

    const url = new URL('/TID.html', window.location.origin);
    url.searchParams.set('area', area);
    url.searchParams.set('line', line);

    const direction = getDirection(directionInputs);
    if(direction !== 'both'){
      url.searchParams.set('dir', direction);
    }
    window.location.assign(url.toString());
  });
}

async function restoreInitialSelection({ areaSelect, lineSelect, directionInputs, showButton }){
  const savedArea = storageGet(STORAGE_KEYS.selectedArea);
  if(!savedArea || !hasOption(areaSelect, savedArea)) return;

  areaSelect.value = savedArea;
  await populateLinesForArea(savedArea, lineSelect);

  const hasRestoredLine = restoreSavedLine(savedArea, lineSelect);
  if(hasRestoredLine){
    restoreSavedDirection(savedArea, lineSelect.value, directionInputs);
    updateShowButtonState(showButton, true);
    return;
  }

  setDirection(directionInputs, 'both');
}

function hasOption(select, value){
  return Array.from(select.options).some((option) => option.value === value);
}

function restoreSavedLine(area, lineSelect){
  const savedLine = storageGet(STORAGE_KEYS.selectedLine(area));
  if(!savedLine || !hasOption(lineSelect, savedLine)) return false;
  lineSelect.value = savedLine;
  return true;
}

function setDirection(directionInputs, value){
  let matched = false;

  for(const input of directionInputs){
    if(input.value === value){
      input.checked = true;
      matched = true;
    }
  }

  if(!matched){
    const defaultDirection = directionInputs.find((input) => input.value === 'both');
    if(defaultDirection) defaultDirection.checked = true;
  }
}

function getDirection(directionInputs){
  const selected = directionInputs.find((input) => input.checked);
  return selected?.value || 'both';
}

function restoreSavedDirection(area, line, directionInputs){
  const savedDirection = storageGet(STORAGE_KEYS.selectedDirection(area, line));
  if(!savedDirection) return false;
  setDirection(directionInputs, savedDirection);
  return true;
}

function updateShowButtonState(button, enabled){
  if(!button) return;
  button.disabled = !enabled;
}

document.addEventListener('change', (event) => {
  const target = event.target;
  if(!(target instanceof HTMLInputElement) || target.name !== 'direction') return;

  const area = document.getElementById('areaSelect')?.value;
  const line = document.getElementById('lineSelect')?.value;
  if(!area || !line) return;

  storageSet(STORAGE_KEYS.selectedDirection(area, line), target.value);
});

async function populateLinesForArea(area, lineSelect){
  setSelectMessage(lineSelect, '読み込み中…', { disabled: true });

  try{
    const master = await fetchAreaMaster(area);
    const lines = normalizeLines(master?.lines);

    if(!lines.length){
      setSelectMessage(lineSelect, '路線データが見つかりません', { disabled: true });
      return;
    }

    renderLineOptions(lineSelect, lines);
  }catch(error){
    console.error('エリア取得に失敗', error);
    setSelectMessage(lineSelect, '取得に失敗しました', { disabled: true });
  }
}

function normalizeLines(lines){
  if(!lines) return [];

  const normalized = Array.isArray(lines)
    ? lines.map((line) => ({
      id: line?.id || line?.line || '',
      name: line?.name || line?.label || line?.id || '',
      range: line?.range || '',
      index: line?.index ?? 0
    }))
    : Object.entries(lines).map(([id, line]) => ({
      id,
      name: line?.name || id,
      range: line?.range || '',
      index: line?.index ?? 0
    }));

  return normalized
    .filter((line) => line.id && line.name)
    .sort((a, b) => a.index - b.index);
}

function renderLineOptions(select, lines){
  select.innerHTML = '';
  select.disabled = false;
  select.style.color = '';

  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = '路線を選択してください';
  placeholder.disabled = true;
  placeholder.selected = true;
  select.appendChild(placeholder);

  for(const line of lines){
    const option = document.createElement('option');
    option.value = line.id;
    option.textContent = [line.name, line.range].filter(Boolean).join(' ') || line.id;
    select.appendChild(option);
  }
}

function setSelectMessage(select, message, { disabled }){
  select.disabled = disabled;
  select.style.color = 'var(--color-muted)';
  select.innerHTML = `<option value="">${message}</option>`;
}
