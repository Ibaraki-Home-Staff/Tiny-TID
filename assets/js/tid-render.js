function escapeHtml(value){
  return String(value || '').replace(/[&<>"]/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;'
  }[char]));
}

export function renderTrafficInfo(container, line, data){
  if(!container) return;
  container.innerHTML = '';

  if(!data || typeof data !== 'object') return;

  const lineItems = [];
  const expressItems = [];

  if(data.lines && typeof data.lines === 'object'){
    const entry = data.lines[line];
    if(entry){
      const section = entry.section;
      let sectionText = '';
      if(typeof section === 'string') sectionText = section;
      else if(section && typeof section === 'object'){
        const from = section.from || section.start || '';
        const to = section.to || section.end || '';
        if(from || to) sectionText = `${from || ''} ~ ${to || ''}`.trim();
      }
      const cause = entry.cause || '';
      const status = entry.status || '';
      const url = entry.url || '';
      const text = `${sectionText ? sectionText + ': ' : ''}${cause ? `${cause} により ` : ''}${status}`.trim();
      if(text) lineItems.push({ text, url });
    }
  }

  if(data.express && typeof data.express === 'object'){
    const entry = data.express[line];
    if(entry){
      const name = entry.name || '';
      const cause = entry.cause || '';
      const status = entry.status || '';
      const url = entry.url || '';
      const text = `${name ? `特急 ${name}: ` : ''}${cause ? `${cause} により ` : ''}${status}`.trim();
      if(text) expressItems.push({ text, url });
    }
  }

  if(!lineItems.length && !expressItems.length) return;

  const buildSection = (title, items, kind) => {
    const section = document.createElement('section');
    section.className = 'traffic-section';

    const header = document.createElement('div');
    header.className = `traffic-section__header ${kind === 'express' ? 'traffic-section__header--express' : 'traffic-section__header--line'}`;
    header.textContent = title;

    const list = document.createElement('ul');
    list.className = 'traffic-list';

    for(const item of items){
      const li = document.createElement('li');
      li.className = `traffic-item ${kind === 'express' ? 'traffic-item--express' : 'traffic-item--line'}`;
      if(item.url){
        const link = document.createElement('a');
        link.href = item.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = item.text;
        li.appendChild(link);
      }else{
        li.textContent = item.text;
      }
      list.appendChild(li);
    }

    section.appendChild(header);
    section.appendChild(list);
    container.appendChild(section);
  };

  if(lineItems.length) buildSection('路線の運行情報', lineItems, 'line');
  if(expressItems.length) buildSection('特急の運行情報', expressItems, 'express');
}

export function renderTrainList(container, list, indexes, options){
  const {
    getDelayThreshold,
    getCarsThreshold,
    getDestText,
    getNickname,
    configuredTypeTextClass,
    trainCategoryFromDisplayType,
    typeTextClass
  } = options;

  if(!container) return;
  container.innerHTML = '';
  if(!list.length){
    container.textContent = '該当なし';
    return;
  }

  const table = document.createElement('table');
  table.className = 'train-table';

  const colgroup = document.createElement('colgroup');
  for(let i = 0; i < 7; i += 1){
    colgroup.appendChild(document.createElement('col'));
  }
  table.appendChild(colgroup);

  const thead = document.createElement('thead');
  thead.innerHTML = '<tr><th>列番</th><th>種別</th><th>愛称</th><th>両数</th><th>行先</th><th>位置</th><th>遅延</th></tr>';
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  for(const train of list){
    const tr = document.createElement('tr');
    const delayThreshold = getDelayThreshold();
    const typeLabel = String(train.displayType || '').trim();
    const colorClass = configuredTypeTextClass(typeLabel) || typeTextClass(trainCategoryFromDisplayType(train.displayType));
    const typeHtml = colorClass ? `<span class="${colorClass}">${escapeHtml(typeLabel)}</span>` : escapeHtml(typeLabel);
    const destText = escapeHtml(getDestText(train, indexes, 'dest'));
    const delayText = typeof train.delayMinutes === 'number' && train.delayMinutes > 0
      ? (train.delayMinutes >= delayThreshold
          ? `<span class="delay-bad" style="color:var(--color-danger,#c00);font-weight:700;">${train.delayMinutes}分</span>`
          : `${train.delayMinutes}分`)
      : '';
    const posPart = train.stopped
      ? escapeHtml(train.atName || '')
      : escapeHtml(train.direction === 0
          ? `${train.nextName || ''} → ${train.atName || ''}`
          : `${train.atName || ''} → ${train.nextName || ''}`);

    let carsText = train.numberOfCars != null ? escapeHtml(String(train.numberOfCars)) : '';
    try{
      const threshold = getCarsThreshold();
      const cars = Number(train.numberOfCars);
      if(Number.isFinite(cars) && cars >= threshold){
        carsText = `<span class="cars-emph">${carsText}</span>`;
      }
    }catch{}

    tr.innerHTML = `
      <td>${escapeHtml(train.no || '')}</td>
      <td>${typeHtml}</td>
      <td>${escapeHtml(getNickname(train))}</td>
      <td>${carsText}</td>
      <td>${destText}</td>
      <td>${posPart}</td>
      <td>${delayText}</td>
    `;
    tbody.appendChild(tr);
  }

  table.appendChild(tbody);
  container.appendChild(table);
}
