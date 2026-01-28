import { decodeStopTrains } from './station-stop-types.js';
import { orientByDirection } from './utils.js';

export function cleanStationName(name){
  if(typeof name !== 'string'){
    return '';
  }
  let result = name.trim();
  result = result.replace(/[\s\u3000]+$/gu, '');
  result = result.replace(/(駅|停車)$/u, '');
  return result;
}

export function buildStationMap(stationsData){
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

export function getStationName(code, stationLookup){
  if(!code || code === '####' || !stationLookup){
    return null;
  }
  const name = stationLookup.names.get(code);
  return name || null;
}

export function describePosition(pos, stationLookup, direction, destCode){
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
  const firstName = getStationName(firstCode, stationLookup);
  const secondName = getStationName(secondCode, stationLookup);

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
    }

    result.originName = originName;
    result.originCode = originCode || null;
    result.targetName = targetName;
    result.targetCode = targetCode || null;
    result.text = originName === targetName ? originName : originName + ' → ' + targetName;
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
