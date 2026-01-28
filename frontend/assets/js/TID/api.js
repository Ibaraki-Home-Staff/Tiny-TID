import { resolveApiUrl, getExtraLines } from './config.js';

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
  const requestedLines = [params.line, ...getExtraLines()].filter(Boolean);
  const uniqueLineIds = [];
  for(const lineId of requestedLines){
    if(!uniqueLineIds.includes(lineId)){
      uniqueLineIds.push(lineId);
    }
  }
  if(!uniqueLineIds.length){
    throw new Error('路線が指定されていません');
  }

  const lineEntries = [];
  for(let index = 0; index < uniqueLineIds.length; index += 1){
    const lineId = uniqueLineIds[index];
    const line = pickLine(master, lineId);
    if(!line){
      if(index === 0){
        throw new Error('指定された路線データが見つかりません');
      }
      console.warn('Line data not found for optional line', lineId);
      continue;
    }
    const posUrl = resolveMaybeUrl(line.pos);
    if(!posUrl){
      if(index === 0){
        throw new Error('選択した路線の運行データ URL が不明です');
      }
      console.warn('Position data URL missing for optional line', lineId);
      continue;
    }
    const stationsUrl = resolveMaybeUrl(line.st);
    lineEntries.push({
      id: lineId,
      line,
      posUrl,
      stationsUrl,
      required: index === 0,
    });
  }

  if(!lineEntries.length){
    throw new Error('利用可能な路線データが見つかりません');
  }

  const trafficUrl = resolveMaybeUrl(master && master.trafficInfo && master.trafficInfo.url);

  const posList = await Promise.all(lineEntries.map((entry) => {
    if(entry.required){
      return fetchJson(entry.posUrl);
    }
    return safeFetchJson(entry.posUrl);
  }));
  const stationList = await Promise.all(lineEntries.map((entry) => safeFetchJson(entry.stationsUrl)));
  const trafficData = await safeFetchJson(trafficUrl);

  const usableEntries = [];
  for(let index = 0; index < lineEntries.length; index += 1){
    const entry = lineEntries[index];
    const posData = posList[index];
    if(!posData){
      if(entry.required){
        throw new Error('選択した路線の運行データを取得できませんでした');
      }
      console.warn('Skipping optional line with no position data', entry.id);
      continue;
    }
    usableEntries.push({
      id: entry.id,
      line: entry.line,
      posData,
      stationsData: stationList[index],
    });
  }

  if(!usableEntries.length){
    throw new Error('利用可能な路線データが取得できませんでした');
  }

  const primary = usableEntries[0];

  return {
    master,
    line: primary.line,
    posData: primary.posData,
    stationsData: primary.stationsData,
    trafficData,
    lines: usableEntries,
  };
}
