import { directionToLabel } from './params.js';
import { deriveTypeInfo } from './train-type.js';
import { decodeStopTrains } from './station-stop-types.js';

function cleanStationName(name){
  if(typeof name !== 'string'){
    return '';
  }
  let result = name.trim();
  result = result.replace(/[\s\u3000]+$/gu, '');
  result = result.replace(/(付近|附近)$/u, '');
  return result;
}

function orientByDirection(direction, firstName, secondName){
  if(direction === 'up'){
    return {
      origin: secondName || firstName || '',
      target: firstName || secondName || '',
    };
  }
  return {
    origin: firstName || secondName || '',
    target: secondName || firstName || '',
  };
}

function toLocaleDateTime(value, withDate = true){
  if(!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if(Number.isNaN(date.getTime())) return '';
  try{
    const options = withDate ? {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    } : {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    };
    return date.toLocaleString('ja-JP', options);
  }catch{
    return date.toISOString();
  }
}

function buildStationMap(stationsData){
  const names = new Map();
  const order = new Map();
  const stopTypes = new Map();
  if(!stationsData || !Array.isArray(stationsData.stations)){
    return { names, order, stopTypes };
  }
  for(let index = 0; index < stationsData.stations.length; index += 1){
    const station = stationsData.stations[index];
    const info = station && station.info;
    if(!info) continue;
    const code = info.code;
    if(!code) continue;
    const name = cleanStationName(info.name);
    if(name){
      names.set(code, name);
    }
    order.set(code, index);
    if(Array.isArray(info.stopTrains)){
      stopTypes.set(code, decodeStopTrains(info.stopTrains));
    }
  }
  return { names, order, stopTypes };
}

function stationName(code, stationLookup){
  if(!code || code === '####' || !stationLookup){
    return null;
  }
  const name = stationLookup.names.get(code);
  return name || null;
}

function describePosition(pos, stationLookup, direction, destCode){
  const result = {
    text: '',
    originName: null,
    targetName: null,
    originCode: null,
    targetCode: null,
  };
  if(typeof pos !== 'string' || !pos.includes('_')){
    return result;
  }
  const parts = pos.split('_');
  const firstCode = parts[0];
  const secondCode = parts[1];
  const firstName = stationName(firstCode, stationLookup);
  const secondName = stationName(secondCode, stationLookup);

  if(firstName && secondName){
    const destIndex = destCode ? stationLookup.order.get(destCode) : undefined;
    const firstOrder = stationLookup.order.get(firstCode);
    const secondOrder = stationLookup.order.get(secondCode);

    let originName = firstName;
    let originCode = firstCode;
    let targetName = secondName;
    let targetCode = secondCode;

    if(Number.isFinite(destIndex)){
      const firstDistance = Number.isFinite(firstOrder) ? Math.abs(destIndex - firstOrder) : Number.POSITIVE_INFINITY;
      const secondDistance = Number.isFinite(secondOrder) ? Math.abs(destIndex - secondOrder) : Number.POSITIVE_INFINITY;
      if(firstDistance !== secondDistance){
        if(firstDistance < secondDistance){
          targetName = firstName;
          targetCode = firstCode;
          originName = secondName;
          originCode = secondCode;
        }
      }else{
        const oriented = orientByDirection(direction, firstName, secondName);
        originName = oriented.origin;
        targetName = oriented.target;
        originCode = originName === firstName ? firstCode : secondCode;
        targetCode = targetName === secondName ? secondCode : firstCode;
      }
    }else{
      const oriented = orientByDirection(direction, firstName, secondName);
      originName = oriented.origin;
      targetName = oriented.target;
      originCode = originName === firstName ? firstCode : secondCode;
      targetCode = targetName === secondName ? secondCode : firstCode;
    }

    result.originName = originName;
    result.originCode = originCode;
    result.targetName = targetName;
    result.targetCode = targetCode;
    result.text = originName === targetName ? originName : originName + ' -> ' + targetName;
    return result;
  }

  if(firstName){
    result.originName = firstName;
    result.originCode = firstCode || null;
    result.text = firstName;
    return result;
  }
  if(secondName){
    result.originName = secondName;
    result.originCode = secondCode || null;
    result.text = secondName;
    return result;
  }

  return result;
}

function mapDirection(value){
  if(value === 0) return 'up';
  if(value === 1) return 'down';
  return 'both';
}

function formatDelay(delayMinutes){
  if(delayMinutes == null) return { text: '', minutes: null };
  const minutes = Number(delayMinutes);
  if(!Number.isFinite(minutes)){
    return { text: '', minutes: null };
  }
  if(minutes <= 0){
    return { text: '定時', minutes: 0 };
  }
  return { text: '+' + minutes + '分', minutes };
}

function joinRemarks(train){
  const parts = [];
  if(train.typeChange){ parts.push(train.typeChange); }
  if(train.via){ parts.push(train.via); }
  if(train.aSeatInfo){ parts.push(train.aSeatInfo); }
  return parts.join(' / ');
}

function normalizeTrains(posData, stationLookup, selectedDirection){
  if(!posData || !Array.isArray(posData.trains)){
    return [];
  }
  const trains = [];
  for(let index = 0; index < posData.trains.length; index += 1){
    const train = posData.trains[index];
    if(!train) continue;
    const dir = mapDirection(train.direction);
    if(selectedDirection !== 'both' && dir !== selectedDirection){
      continue;
    }
    const delay = formatDelay(train.delayMinutes);
    const typeInfo = deriveTypeInfo(train);
    const typeLabel = typeInfo.typeLabel || train.displayType || train.type || '';
    const destCode = train.dest && train.dest.code;
    const positionInfo = describePosition(train.pos, stationLookup, dir, destCode);
    const originStops = positionInfo.originCode ? (stationLookup.stopTypes.get(positionInfo.originCode) || []) : [];
    const targetStops = positionInfo.targetCode ? (stationLookup.stopTypes.get(positionInfo.targetCode) || []) : [];
    trains.push({
      id: train.no || ('train-' + index),
      number: train.no || '',
      type: typeLabel,
      typeBadgeClass: typeInfo.badgeClass || '',
      typeTextClass: typeInfo.textClass || '',
      nickname: typeInfo.nickname || '',
      destination: (train.dest && train.dest.text) || '',
      originStation: positionInfo.originName || '',
      targetStation: positionInfo.targetName || '',
      originStopTrains: originStops,
      targetStopTrains: targetStops,
      position: positionInfo.text || '',
      status: joinRemarks(train),
      cars: train.numberOfCars ? (String(train.numberOfCars) + '両') : '',
      delayText: delay.text,
      delayMinutes: delay.minutes,
    });
  }
  return trains;
}

function normalizeTraffic(trafficData, lineId){
  const items = [];
  if(trafficData && trafficData.lines){
    const entry = trafficData.lines[lineId];
    if(Array.isArray(entry)){
      for(let i = 0; i < entry.length; i += 1){
        const item = entry[i];
        if(!item) continue;
        const title = item.title || item.name || '運行情報';
        const detailParts = [item.status, item.cause, item.text, item.detail].filter(Boolean);
        items.push({
          id: lineId + '-line-' + i,
          title,
          detail: detailParts.join(' / '),
          type: 'line',
          href: item.url || '',
        });
      }
    }else if(entry && typeof entry === 'object'){
      const title = entry.title || entry.name || '運行情報';
      const detailParts = [entry.status, entry.cause, entry.text, entry.detail].filter(Boolean);
      items.push({
        id: lineId + '-line',
        title,
        detail: detailParts.join(' / '),
        type: 'line',
        href: entry.url || '',
      });
    }
  }
  if(trafficData && trafficData.express){
    const express = trafficData.express[lineId];
    if(express){
      const detailParts = [express.status, express.cause].filter(Boolean);
      items.push({
        id: lineId + '-express',
        title: express.name || '特急',
        detail: detailParts.join(' / '),
        type: 'express',
        href: express.url || '',
      });
    }
  }
  return items;
}

export function normalizeSnapshot(source, params){
  const stationLookup = buildStationMap(source.stationsData);
  const selectedDirection = params.direction || 'both';
  const trains = normalizeTrains(source.posData, stationLookup, selectedDirection);
  const traffic = normalizeTraffic(source.trafficData, params.line);
  const updatedAtIso = source.posData && (source.posData.update || source.posData.timestamp);
  return {
    lineTitle: (source.line && source.line.name) || params.line,
    lineSubtitle: (source.line && source.line.range) || '',
    directionLabel: directionToLabel(selectedDirection),
    updatedAt: toLocaleDateTime(updatedAtIso, true),
    updatedTime: toLocaleDateTime(updatedAtIso, false),
    traffic,
    trains,
    alert: null,
    boardUpdatedAt: toLocaleDateTime(updatedAtIso, true),
    raw: source,
  };
}
