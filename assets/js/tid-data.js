const AREA_LIST = ['kinki', 'hokuriku', 'okayama', 'hiroshima', 'sanin'];
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const globalStationsByCode = new Map();
const globalLineOrders = new Map();

function apiBase(){
  return (window.TID_API_BASE && String(window.TID_API_BASE)) || '/api/v3/';
}

function areaCacheKey(area){
  return `tid:areaStations:${area}`;
}

function areaCrossKey(area){
  return `tid:cross:${area}`;
}

async function fetchJsonWithFallbacks(url, fallbacks = []){
  try{
    const response = await fetch(url, { cache: 'no-store' });
    if(!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return await response.json();
  }catch(error){
    for(const fallback of fallbacks){
      try{
        const response = await fetch(fallback, { cache: 'no-store' });
        if(response.ok) return await response.json();
      }catch{}
    }
    throw error;
  }
}

export async function fetchAreaMaster(area){
  return await fetchJsonWithFallbacks(
    `${apiBase()}area_${area}_master.json`,
    [
      `/assets/data/area_${area}_master.json`,
      `/area_${area}_master.json`
    ]
  );
}

export async function fetchStations(line){
  return await fetchJsonWithFallbacks(
    `${apiBase()}${line}_st.json`,
    [
      `/assets/data/${line}_st.json`,
      `/${line}_st.json`
    ]
  );
}

export async function fetchTrains(line){
  return await fetchJsonWithFallbacks(
    `${apiBase()}${line}.json`,
    [
      `/assets/data/${line}.json`,
      `/${line}.json`
    ]
  );
}

export async function fetchTrafficInfo(area){
  return await fetchJsonWithFallbacks(
    `${apiBase()}area_${area}_trafficinfo.json`,
    [
      `/assets/data/area_${area}_trafficinfo.json`,
      `/area_${area}_trafficinfo.json`
    ]
  );
}

export function loadAreaStationsCache(area){
  try{
    const raw = localStorage.getItem(areaCacheKey(area));
    if(!raw) return null;
    const obj = JSON.parse(raw);
    if(!obj || !obj.updatedAt || !obj.stations) return null;
    const age = Date.now() - Number(obj.updatedAt);
    if(age > CACHE_TTL_MS) return null;
    return obj;
  }catch{
    return null;
  }
}

function saveAreaStationsCache(area, data){
  try{
    localStorage.setItem(areaCacheKey(area), JSON.stringify({
      updatedAt: Date.now(),
      stations: data.stations || {},
      lines: data.lines || {},
      lineStations: data.lineStations || {}
    }));
  }catch{}
}

function loadAreaCrossCache(area){
  try{
    const raw = localStorage.getItem(areaCrossKey(area));
    if(!raw) return null;
    const obj = JSON.parse(raw);
    if(!obj || !obj.updatedAt || !obj.lines) return null;
    const age = Date.now() - Number(obj.updatedAt);
    if(age > CACHE_TTL_MS) return null;
    return obj;
  }catch{
    return null;
  }
}

function saveAreaCrossCache(area, data){
  try{
    localStorage.setItem(areaCrossKey(area), JSON.stringify({
      updatedAt: Date.now(),
      lines: data.lines || {}
    }));
  }catch{}
}

function pairKey(left, right){
  const a = String(left);
  const b = String(right);
  return a < b ? `${a}_${b}` : `${b}_${a}`;
}

function getCrossPreferredLine(area, userLine, codeA, codeB){
  const cache = loadAreaCrossCache(area);
  if(!cache || !cache.lines) return null;
  const table = cache.lines[userLine];
  if(!table) return null;
  return table[pairKey(codeA, codeB)] || null;
}

function setCrossPreferredLine(area, userLine, codeA, codeB, chosenLine, dbg){
  try{
    const cache = loadAreaCrossCache(area) || { updatedAt: Date.now(), lines: {} };
    if(!cache.lines[userLine]) cache.lines[userLine] = {};
    cache.lines[userLine][pairKey(codeA, codeB)] = String(chosenLine);
    saveAreaCrossCache(area, cache);
    dbg?.('cross pair cached', { area, userLine, pair: pairKey(codeA, codeB), chosenLine });
  }catch{}
}

function extractTransferLinesFromInfo(info){
  const out = new Set();
  const transfers = Array.isArray(info?.transfer) ? info.transfer : [];
  for(const transfer of transfers){
    const link = transfer && transfer.link;
    const code = transfer && transfer.code;
    if(typeof link === 'string' && link) out.add(link);
    else if(typeof code === 'string' && code) out.add(code);
  }
  return Array.from(out);
}

export function buildStationIndexes(data){
  const byCode = new Map();
  const list = Array.isArray(data?.stations) ? data.stations : [];
  list.forEach((station, index) => {
    const info = station?.info || {};
    const code = info?.code;
    if(!code) return;
    byCode.set(String(code), {
      index,
      name: String(info?.name || ''),
      code: String(code),
      stopTrains: Array.isArray(info?.stopTrains) ? info.stopTrains.slice() : null,
      transferLines: extractTransferLinesFromInfo(info)
    });
  });
  return {
    byCode,
    order: list.map((station) => String(station?.info?.code || ''))
  };
}

export function buildIndexesFromCache(area, line, { dbg } = {}){
  const cached = loadAreaStationsCache(area);
  if(!cached || !cached.stations) return null;

  let order = (cached.lines && cached.lines[line]) || globalLineOrders.get(line) || null;
  if(!Array.isArray(order) || !order.length){
    const codes = Object.keys(cached.stations || {});
    if(!codes.length) return null;
    order = codes.sort();
    dbg?.('cache order fallback', { area, line, count: order.length });
  }

  const byCode = new Map();
  order.forEach((code, index) => {
    const record =
      (cached.lineStations && cached.lineStations[line] && cached.lineStations[line][code]) ||
      cached.stations[code] ||
      {};
    const name = record?.name || globalStationsByCode.get(code) || code;
    const stopTrains = Array.isArray(record?.stopTrains) ? record.stopTrains : [];
    byCode.set(String(code), {
      index,
      name: String(name),
      code: String(code),
      stopTrains
    });
  });

  dbg?.('buildIndexesFromCache OK', { area, line, size: byCode.size });
  return { byCode, order: order.map(String) };
}

function warmAreaFromCache(area){
  const cached = loadAreaStationsCache(area);
  if(!cached) return;

  for(const [code, value] of Object.entries(cached.stations || {})){
    const name = typeof value === 'string' ? value : value?.name;
    if(name) globalStationsByCode.set(String(code), String(name));
  }

  for(const [lineId, order] of Object.entries(cached.lines || {})){
    if(Array.isArray(order)) globalLineOrders.set(lineId, order.map(String));
  }
}

(function warmAllAreasFromCache(){
  try{
    AREA_LIST.forEach((area) => warmAreaFromCache(area));
  }catch{}
})();

export async function buildGlobalStationsForArea(area, { force = false, dbg } = {}){
  if(!area) return;

  if(!force){
    const cached = loadAreaStationsCache(area);
    if(cached){
      for(const [code, value] of Object.entries(cached.stations || {})){
        const name = typeof value === 'string' ? value : value?.name;
        if(name) globalStationsByCode.set(String(code), String(name));
      }
      for(const [lineId, order] of Object.entries(cached.lines || {})){
        if(Array.isArray(order)) globalLineOrders.set(lineId, order.map(String));
      }
      return;
    }
  }

  try{
    const master = await fetchAreaMaster(area);
    const lineIds = Object.keys(master?.lines || {});
    if(!lineIds.length) return;

    const results = await Promise.allSettled(
      lineIds.map((lineId) => fetchStations(lineId).then((data) => ({ lineId, data })))
    );

    const stationsToCache = {};
    const linesToCache = {};
    const lineStationsToCache = {};

    for(const result of results){
      if(result.status !== 'fulfilled') continue;

      const { lineId, data } = result.value;
      const stations = Array.isArray(data?.stations) ? data.stations : [];
      const orderCodes = [];
      const perLineStations = {};

      for(const station of stations){
        const info = station?.info || {};
        const code = info?.code;
        const name = info?.name;
        if(!code) continue;

        const stationCode = String(code);
        orderCodes.push(stationCode);

        if(!name) continue;

        const stationName = String(name);
        const stopTrains = Array.isArray(info?.stopTrains) ? info.stopTrains.slice() : undefined;
        const transferLines = extractTransferLinesFromInfo(info);

        globalStationsByCode.set(stationCode, stationName);
        stationsToCache[stationCode] = { name: stationName, stopTrains };
        perLineStations[stationCode] = { name: stationName, stopTrains, transferLines };
      }

      if(orderCodes.length){
        globalLineOrders.set(lineId, orderCodes);
        linesToCache[lineId] = orderCodes;
        lineStationsToCache[lineId] = perLineStations;
      }
    }

    saveAreaStationsCache(area, {
      stations: stationsToCache,
      lines: linesToCache,
      lineStations: lineStationsToCache
    });
  }catch(error){
    console.warn('エリア駅名の構築に失敗', error);
    dbg?.('buildGlobalStationsForArea failed', error);
  }
}

export function getStationNameByPriority(code, indexes, { area, line, dbg, warn, neighborCode } = {}){
  const stationCode = String(code);

  if(indexes && indexes.byCode && indexes.byCode.has(stationCode)){
    const hit = String(indexes.byCode.get(stationCode)?.name || '');
    dbg?.('station hit [line]', { line, area, code: stationCode, name: hit });
    return hit;
  }

  const areaObj = loadAreaStationsCache(area);
  if(areaObj){
    const lineStations = areaObj.lineStations && areaObj.lineStations[line];
    if(lineStations && lineStations[stationCode]){
      const value = lineStations[stationCode];
      const hit = typeof value === 'string' ? value : String(value?.name || '');
      dbg?.('station hit [area-line]', { line, area, code: stationCode, name: hit });
      return hit;
    }

    if(neighborCode){
      const neighbor = String(neighborCode);
      const linesMap = areaObj.lineStations || {};
      const orders = areaObj.lines || {};
      const preferredLine = getCrossPreferredLine(area, line, stationCode, neighbor);

      if(preferredLine && linesMap[preferredLine]){
        const preferredStations = linesMap[preferredLine] || {};
        const preferredOrder = orders[preferredLine] || [];
        if(preferredStations[stationCode] && Array.isArray(preferredOrder) && preferredOrder.includes(neighbor)){
          const value = preferredStations[stationCode];
          const hit = typeof value === 'string' ? value : String(value?.name || '');
          dbg?.('station hit [area-line-crosscache]', { area, lineId: preferredLine, code: stationCode, neighbor, name: hit });
          return hit;
        }
      }

      const neighborRecord = (linesMap[line] && linesMap[line][neighbor]) || null;
      const transferLines = Array.isArray(neighborRecord?.transferLines) ? neighborRecord.transferLines : [];
      for(const transferLine of transferLines){
        const order = orders[transferLine] || [];
        if(Array.isArray(order) && order.includes(neighbor)){
          const perLine = linesMap[transferLine] || {};
          const value = perLine[stationCode];
          if(value){
            const hit = typeof value === 'string' ? value : String(value?.name || '');
            dbg?.('station hit [area-line-transfer]', { area, lineId: transferLine, neighbor, code: stationCode, name: hit });
            setCrossPreferredLine(area, line, stationCode, neighbor, transferLine, dbg);
            return hit;
          }
        }
      }

      for(const lineId of Object.keys(linesMap)){
        const perLine = linesMap[lineId] || {};
        const order = orders[lineId] || [];
        if(perLine[stationCode] && Array.isArray(order) && order.includes(neighbor)){
          const value = perLine[stationCode];
          const hit = typeof value === 'string' ? value : String(value?.name || '');
          dbg?.('station hit [area-line-neighbor]', { area, lineId, code: stationCode, neighbor, name: hit });
          setCrossPreferredLine(area, line, stationCode, neighbor, lineId, dbg);
          return hit;
        }
      }
    }

    if(areaObj.stations && areaObj.stations[stationCode]){
      const value = areaObj.stations[stationCode];
      const hit = typeof value === 'string' ? value : String(value?.name || '');
      dbg?.('station hit [area-flat]', { area, code: stationCode, name: hit });
      return hit;
    }
  }

  for(const otherArea of AREA_LIST){
    const otherCache = loadAreaStationsCache(otherArea);
    if(!otherCache) continue;

    const lineStations = otherCache.lineStations;
    if(lineStations){
      const orders = otherCache.lines || {};

      if(neighborCode){
        const neighbor = String(neighborCode);
        for(const lineId of Object.keys(lineStations)){
          const perLine = lineStations[lineId] || {};
          const order = orders[lineId] || [];
          if(perLine[stationCode] && Array.isArray(order) && order.includes(neighbor)){
            const value = perLine[stationCode];
            const hit = typeof value === 'string' ? value : String(value?.name || '');
            dbg?.('station hit [other-area-line-neighbor]', { area: otherArea, lineId, code: stationCode, neighbor, name: hit });
            return hit;
          }
        }
      }

      for(const lineId of Object.keys(lineStations)){
        const value = lineStations[lineId] && lineStations[lineId][stationCode];
        if(!value) continue;
        const hit = typeof value === 'string' ? value : String(value?.name || '');
        dbg?.('station hit [other-area-line]', { area: otherArea, lineId, code: stationCode, name: hit });
        return hit;
      }
    }

    if(otherCache.stations && otherCache.stations[stationCode]){
      const value = otherCache.stations[stationCode];
      const hit = typeof value === 'string' ? value : String(value?.name || '');
      dbg?.('station hit [other-area-flat]', { area: otherArea, code: stationCode, name: hit });
      return hit;
    }
  }

  if(globalStationsByCode.has(stationCode)){
    const hit = String(globalStationsByCode.get(stationCode));
    dbg?.('station hit [global]', { code: stationCode, name: hit });
    return hit;
  }

  warn?.('station miss', { line, area, code: stationCode });
  return '';
}

export function clearAreaStationsCache(area){
  try{
    localStorage.removeItem(areaCacheKey(area));
  }catch{}
}

export function clearAreaCrossCache(area){
  try{
    localStorage.removeItem(areaCrossKey(area));
  }catch{}
}
