import { resolveApiUrl } from './config.js';

async function fetchJson(url){
  const res = await fetch(url, { cache: 'no-store' });
  if(!res.ok){
    throw new Error('Fetch failed: ' + res.status + ' ' + res.statusText + ' (' + url + ')');
  }
  return res.json();
}

const areaMasterCache = new Map();

async function fetchAreaMaster(area){
  if(areaMasterCache.has(area)){
    return areaMasterCache.get(area);
  }
  const url = resolveApiUrl('area_' + encodeURIComponent(area) + '_master.json');
  const data = await fetchJson(url);
  areaMasterCache.set(area, data);
  return data;
}

function pickLine(master, lineId){
  const lines = master && master.lines;
  if(!lines || !lines[lineId]){
    return null;
  }
  return lines[lineId];
}

function safeFetchJson(url){
  if(!url) return Promise.resolve(null);
  return fetchJson(url).catch((err) => {
    console.warn('Fetch failed', url, err);
    return null;
  });
}

function resolveMaybeUrl(resource){
  if(!resource) return null;
  try{
    return resolveApiUrl(resource);
  }catch(err){
    console.warn('Invalid API resource', resource, err);
    return null;
  }
}

export async function fetchSnapshot(params){
  const master = await fetchAreaMaster(params.area);
  const line = pickLine(master, params.line);
  if(!line){
    throw new Error('指定された路線データが見つかりません');
  }
  const posUrl = resolveMaybeUrl(line.pos);
  if(!posUrl){
    throw new Error('選択した路線の運行データ URL が不明です');
  }
  const stationsUrl = resolveMaybeUrl(line.st);
  const trafficUrl = resolveMaybeUrl(master && master.trafficInfo && master.trafficInfo.url);
  const [posData, stationsData, trafficData] = await Promise.all([
    fetchJson(posUrl),
    safeFetchJson(stationsUrl),
    safeFetchJson(trafficUrl),
  ]);
  return {
    master,
    line,
    posData,
    stationsData,
    trafficData,
  };
}
