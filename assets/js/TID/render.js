import { state } from './state.js';

let domCache = null;

function queryDom(){
  if(domCache) return domCache;
  const root = document.querySelector('[data-tid-app]');
  if(!root){
    throw new Error('TID レイアウトが見つかりません');
  }
  domCache = {
    root,
    lineTitle: root.querySelector('[data-line-title]'),
    lineSubtitle: root.querySelector('[data-line-subtitle]'),
    directionLabel: root.querySelector('[data-direction-label]'),
    updatedAt: root.querySelector('[data-updated-at]'),
    statusContainer: root.querySelector('[data-status-message]'),
    boardContainer: root.querySelector('[data-board-container]'),
    boardUpdated: root.querySelector('[data-board-updated]'),
  };
  return domCache;
}

function clearElement(el){
  if(!el) return;
  while(el.firstChild){
    el.removeChild(el.firstChild);
  }
}

function renderStatusMessages(statusContainer, traffic){
  clearElement(statusContainer);
  if(!traffic.length){
    const empty = document.createElement('p');
    empty.textContent = '現在、特筆すべき運行情報はありません。';
    statusContainer.appendChild(empty);
    return;
  }
  const list = document.createElement('ul');
  list.className = 'traffic-list';
  for(const item of traffic){
    const li = document.createElement('li');
    li.className = 'traffic-item';
    if(item.type === 'express'){
      li.classList.add('traffic-item--express');
    }else if(item.type === 'line'){
      li.classList.add('traffic-item--line');
    }
    const title = document.createElement('strong');
    title.textContent = item.title;
    li.appendChild(title);
    if(item.detail){
      const detail = document.createElement('p');
      detail.textContent = item.detail;
      li.appendChild(detail);
    }
    if(item.href){
      const link = document.createElement('a');
      link.href = item.href;
      link.textContent = '詳細';
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      li.appendChild(link);
    }
    list.appendChild(li);
  }
  statusContainer.appendChild(list);
}

function renderTrainTable(boardContainer, trains){
  clearElement(boardContainer);
  if(!trains.length){
    const empty = document.createElement('p');
    empty.textContent = '表示できる列車データはありません。';
    boardContainer.appendChild(empty);
    return;
  }
  const table = document.createElement('table');
  table.className = 'train-table';

  const headers = ['列車', '種別', '愛称', '行先', '現在位置', '遅延', '備考', '編成'];

  const colgroup = document.createElement('colgroup');
  for(let i = 0; i < headers.length; i += 1){
    colgroup.appendChild(document.createElement('col'));
  }
  table.appendChild(colgroup);

  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  for(const text of headers){
    const th = document.createElement('th');
    th.scope = 'col';
    th.textContent = text;
    headerRow.appendChild(th);
  }
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  for(const train of trains){
    const tr = document.createElement('tr');

    const numberCell = document.createElement('td');
    numberCell.textContent = train.number || '---';
    tr.appendChild(numberCell);

    const typeCell = document.createElement('td');
    const typeValue = train.type || '';
    if(train.typeBadgeClass && typeValue){
      const badge = document.createElement('span');
      badge.className = train.typeBadgeClass;
      badge.textContent = typeValue;
      typeCell.appendChild(badge);
    }else{
      typeCell.textContent = typeValue || '---';
    }
    if(train.typeTextClass){
      typeCell.classList.add(train.typeTextClass);
    }
    tr.appendChild(typeCell);

    const nicknameCell = document.createElement('td');
    nicknameCell.textContent = train.nickname || '---';
    tr.appendChild(nicknameCell);

    const destinationCell = document.createElement('td');
    destinationCell.textContent = train.destination || '---';
    tr.appendChild(destinationCell);

    const positionCell = document.createElement('td');
    positionCell.textContent = train.position || '---';
    tr.appendChild(positionCell);

    const delayCell = document.createElement('td');
    delayCell.textContent = train.delayText || '---';
    if(train.delayMinutes && train.delayMinutes > 0){
      delayCell.classList.add('delay-bad');
    }
    tr.appendChild(delayCell);

    const statusCell = document.createElement('td');
    statusCell.textContent = train.status || '';
    tr.appendChild(statusCell);

    const carsCell = document.createElement('td');
    carsCell.textContent = train.cars || '';
    tr.appendChild(carsCell);

    tbody.appendChild(tr);
  }

  table.appendChild(tbody);
  boardContainer.appendChild(table);
}

export function renderLoading(){
  const dom = queryDom();
  if(dom.lineTitle){
    dom.lineTitle.textContent = '読み込み中…';
  }
  if(dom.lineSubtitle){
    dom.lineSubtitle.textContent = '';
    dom.lineSubtitle.style.display = 'none';
  }
  if(dom.directionLabel){
    dom.directionLabel.textContent = '--';
  }
  if(dom.updatedAt){
    dom.updatedAt.textContent = '--:--';
  }
  if(dom.statusContainer){
    clearElement(dom.statusContainer);
  }
  if(dom.boardContainer){
    clearElement(dom.boardContainer);
  }
  if(dom.boardUpdated){
    dom.boardUpdated.textContent = '更新: --';
  }
}

export function renderSnapshot(snapshot){
  const dom = queryDom();
  if(dom.lineTitle){
    dom.lineTitle.textContent = snapshot.lineTitle || (state.params && state.params.line) || '';
  }
  if(dom.lineSubtitle){
    const subtitle = snapshot.lineSubtitle || '';
    dom.lineSubtitle.textContent = subtitle;
    dom.lineSubtitle.style.display = subtitle ? '' : 'none';
  }
  if(dom.directionLabel){
    dom.directionLabel.textContent = snapshot.directionLabel || '--';
  }
  if(dom.updatedAt){
    dom.updatedAt.textContent = snapshot.updatedAt || snapshot.updatedTime || '--:--';
  }
  if(dom.boardUpdated){
    dom.boardUpdated.textContent = snapshot.boardUpdatedAt ? '更新: ' + snapshot.boardUpdatedAt : '更新: --';
  }
  if(dom.statusContainer){
    renderStatusMessages(dom.statusContainer, snapshot.traffic || []);
  }
  if(dom.boardContainer){
    renderTrainTable(dom.boardContainer, snapshot.trains || []);
  }
}

export function renderError(message){
  const dom = queryDom();
  if(dom.statusContainer){
    clearElement(dom.statusContainer);
    const error = document.createElement('p');
    error.textContent = message;
    dom.statusContainer.appendChild(error);
  }
  if(dom.boardContainer){
    clearElement(dom.boardContainer);
    const error = document.createElement('p');
    error.textContent = 'データテーブルを表示できません。';
    dom.boardContainer.appendChild(error);
  }
  if(dom.boardUpdated){
    dom.boardUpdated.textContent = '更新: --';
  }
}
