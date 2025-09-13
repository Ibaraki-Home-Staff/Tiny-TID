// API base (proxied in dev): override via window.TID_API_BASE if needed
const API_BASE = (typeof window !== 'undefined' && window.TID_API_BASE) || '/api/v3/';
const AREA_ENDPOINT = (area) => `${API_BASE}area_${area}_master.json`;

export function initAreaAndLineSelectors(){
  const areaSel = document.getElementById('areaSelect');
  const lineSel = document.getElementById('lineSelect');
  const showBtn = document.getElementById('showBtn');
  const dirInputs = Array.from(document.querySelectorAll('input[name="direction"]'));
  if(!areaSel || !lineSel) return;
  if(showBtn){ showBtn.disabled = true; }

  // restore saved area
  const savedArea = localStorage.getItem('selectedArea');
  if(savedArea && Array.from(areaSel.options).some(o => o.value === savedArea)){
    areaSel.value = savedArea;
    populateLinesForArea(savedArea, lineSel).then(() => {
      const restoredLine = restoreSavedLine(savedArea, lineSel);
      if(restoredLine){
        restoreSavedDirection(savedArea, lineSel.value, dirInputs);
        if(showBtn){ showBtn.disabled = false; }
      } else {
        // reset direction to default when no line restored
        setDirection(dirInputs, 'both');
      }
    });
  }

  areaSel.addEventListener('change', () => {
    const area = areaSel.value;
    localStorage.setItem('selectedArea', area);
    populateLinesForArea(area, lineSel).then(() => {
      // try to restore a previously selected line for this area
      const restored = restoreSavedLine(area, lineSel);
      if(restored){
        restoreSavedDirection(area, lineSel.value, dirInputs);
      } else {
        setDirection(dirInputs, 'both');
      }
      if(showBtn){ showBtn.disabled = !(areaSel.value && lineSel.value); }
    });
  });

  lineSel.addEventListener('change', () => {
    // persist selected line per area
    const area = areaSel.value;
    const line = lineSel.value;
    if(area && line){
      localStorage.setItem(lineKey(area), line);
      // reset/restore direction selection for this line
      if(!restoreSavedDirection(area, line, dirInputs)){
        setDirection(dirInputs, 'both');
      }
    }
    if(showBtn){ showBtn.disabled = !(area && line); }
  });

  if(showBtn){
    showBtn.addEventListener('click', () => {
      const area = areaSel.value;
      const line = lineSel.value;
      if(!area || !line){ return; }
      const url = new URL('/TID.html', window.location.origin);
      url.searchParams.set('area', area);
      url.searchParams.set('line', line);
      const dir = getDirection(dirInputs);
      if(dir && dir !== 'both'){
        url.searchParams.set('dir', dir);
      }
      window.location.assign(url.toString());
    });
  }
}

function lineKey(area){
  return `selectedLine:${area}`;
}

function restoreSavedLine(area, lineSel){
  const saved = localStorage.getItem(lineKey(area));
  if(!saved) return false;
  const has = Array.from(lineSel.options).some(o => o.value === saved);
  if(has){
    lineSel.value = saved;
    return true;
  }
  return false;
}

function dirKey(area, line){
  return `selectedDirection:${area}:${line}`;
}

function setDirection(dirInputs, value){
  let found = false;
  for(const input of dirInputs){
    if(input.value === value){
      input.checked = true;
      found = true;
    } else {
      // leave as is
    }
  }
  if(!found){
    // default
    const both = dirInputs.find(i => i.value === 'both');
    if(both) both.checked = true;
  }
}

function getDirection(dirInputs){
  const current = dirInputs.find(i => i.checked);
  return current ? current.value : 'both';
}

function restoreSavedDirection(area, line, dirInputs){
  const saved = localStorage.getItem(dirKey(area, line));
  if(!saved) return false;
  setDirection(dirInputs, saved);
  return true;
}

// Persist direction selection on change
document.addEventListener('change', (e) => {
  const t = e.target;
  if(!(t instanceof HTMLInputElement)) return;
  if(t.name !== 'direction') return;
  const areaSel = document.getElementById('areaSelect');
  const lineSel = document.getElementById('lineSelect');
  if(!areaSel || !lineSel) return;
  const area = areaSel.value; const line = lineSel.value;
  if(area && line){
    localStorage.setItem(dirKey(area, line), t.value);
  }
});

async function populateLinesForArea(area, lineSel){
  setLoading(lineSel, '読み込み中…');
  try{
    const master = await fetchAreaMaster(area);
    const lines = normalizeLines(master?.lines);
    if(!lines.length){
      setError(lineSel, '路線データが見つかりません');
      return;
    }
    renderLineOptions(lineSel, lines);
  }catch(err){
    console.error('エリア取得に失敗', err);
    setError(lineSel, '取得に失敗しました');
  }
}

async function fetchAreaMaster(area){
  const url = AREA_ENDPOINT(area);
  try{
    const res = await fetch(url, {cache: 'no-store'});
    if(!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return await res.json();
  }catch(err){
    // Local development fallbacks to avoid CORS issues.
    const candidates = [
      `/assets/data/area_${area}_master.json`,
      `/area_${area}_master.json`,
    ];
    for(const url of candidates){
      try{
        const res = await fetch(url, {cache:'no-store'});
        if(res.ok){
          return await res.json();
        }
      }catch{ /* try next */ }
    }
    throw err;
  }
}

function normalizeLines(lines){
  if(!lines) return [];
  // API returns an object keyed by line id; convert to array
  if(!Array.isArray(lines)){
    return Object.entries(lines)
      .map(([id, v]) => ({ id, name: v?.name || id, range: v?.range || '', index: v?.index ?? 0 }))
      .sort((a,b)=>a.index-b.index);
  }
  // If already array
  return lines
              .map(v => ({ id: v?.id || v?.line || '', name: v?.name || v?.label || v?.id || '', range: v?.range || '', index: v?.index ?? 0 }))
              .filter(v => v.id && v.name)
              .sort((a,b)=>a.index-b.index);
}

function renderLineOptions(selectEl, lines){
  selectEl.innerHTML = '';
  selectEl.disabled = false;
  selectEl.style.color = '';
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = '路線を選択してください';
  placeholder.disabled = true;
  placeholder.selected = true;
  selectEl.appendChild(placeholder);

  for(const line of lines){
    const opt = document.createElement('option');
    opt.value = line.id;
    const label = [line.name, line.range].filter(Boolean).join(' ');
    opt.textContent = label || line.name || line.id;
    selectEl.appendChild(opt);
  }
}

function setLoading(selectEl, text){
  selectEl.disabled = true;
  selectEl.style.color = 'var(--color-muted)';
  selectEl.innerHTML = `<option value="">${text}</option>`;
}

function setError(selectEl, text){
  selectEl.disabled = true;
  selectEl.style.color = 'var(--color-muted)';
  selectEl.innerHTML = `<option value="">${text}</option>`;
}
