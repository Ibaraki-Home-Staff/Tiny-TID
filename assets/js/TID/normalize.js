import { getDestinationFilters, getDestinationCodes, getReferenceStation, shouldHidePastReference, getReferenceStopTypes } from './config.js';
import { directionToLabel } from './params.js';
import { deriveTypeInfo } from './train-type.js';
import { buildStationMap, describePosition } from './station.js';
import { matchesDestinationFilters, hasPassedReference, registerLineMembership } from './filters.js';
import { toLocaleDateTime, formatDelay, mapDirection, joinRemarks } from './utils.js';

function normalizeTrains(posData, stationLookup, selectedDirection, lineContext, destinationFilters, destinationFilterSet, lineMembership, destinationCodeSet, referenceConfig){
  if(!posData || !Array.isArray(posData.trains)){
    return [];
  }
  const trains = [];
  const seenNumbers = new Set();
  const lineId = lineContext && lineContext.id ? lineContext.id : '';
  const lineName = lineContext && lineContext.name ? lineContext.name : lineId;
  const allowedTypes = referenceConfig && referenceConfig.allowedTypes instanceof Set ? referenceConfig.allowedTypes : null;
  const showPassing = Boolean(referenceConfig && referenceConfig.showPassing);
  const referenceOrder = referenceConfig && referenceConfig.hidePast && referenceConfig.stationCode && stationLookup && stationLookup.order
    ? stationLookup.order.get(referenceConfig.stationCode)
    : undefined;
  const enforceReference = Number.isFinite(referenceOrder);

  for(let index = 0; index < posData.trains.length; index += 1){
    const train = posData.trains[index];
    if(!train) continue;
    const numberKey = train.no && typeof train.no === 'string' ? train.no.trim() : '';
    if(numberKey){
      const uniqueKey = lineId ? lineId + ':' + numberKey : numberKey;
      if(seenNumbers.has(uniqueKey)){
        continue;
      }
      seenNumbers.add(uniqueKey);
    }
    const dir = mapDirection(train.direction);
    if(selectedDirection !== 'both' && dir !== selectedDirection){
      continue;
    }
    if(enforceReference && hasPassedReference(train, dir, stationLookup, referenceOrder)){
      continue;
    }
    if(!matchesDestinationFilters(train, destinationFilters, destinationFilterSet, lineMembership, destinationCodeSet)){
      continue;
    }
    const delay = formatDelay(train.delayMinutes);
    const typeInfo = deriveTypeInfo(train);
    const typeLabel = typeInfo.typeLabel || train.displayType || train.type || '';
    let typeKey = typeLabel.trim();
    if(!typeKey && train.displayType){
      typeKey = String(train.displayType).trim();
    }
    const stopsAtReference = allowedTypes && allowedTypes.size && typeKey ? allowedTypes.has(typeKey) : false;
    if(allowedTypes && allowedTypes.size && !showPassing && !stopsAtReference){
      continue;
    }
    const destCode = train.dest && train.dest.code;
    const positionInfo = describePosition(train.pos, stationLookup, dir, destCode);
    const originStops = positionInfo.originCode ? (stationLookup.stopTypes.get(positionInfo.originCode) || []) : [];
    const targetStops = positionInfo.targetCode ? (stationLookup.stopTypes.get(positionInfo.targetCode) || []) : [];
    const baseId = train.no || ('train-' + index);
    const uniqueId = lineId ? lineId + ':' + baseId : baseId;
    const destinationText = (train.dest && train.dest.text) || '';
    trains.push({
      id: uniqueId,
      number: train.no || '',
      type: typeLabel,
      typeBadgeClass: typeInfo.badgeClass || '',
      typeTextClass: typeInfo.textClass || '',
      nickname: typeInfo.nickname || '',
      destination: destinationText,
      originStation: positionInfo.originName || '',
      targetStation: positionInfo.targetName || '',
      originStopTrains: originStops,
      targetStopTrains: targetStops,
      position: positionInfo.text || '',
      stopsAtReference,
      status: joinRemarks(train),
      cars: train.numberOfCars ? (String(train.numberOfCars) + '両') : '',
      delayText: delay.text,
      delayMinutes: delay.minutes,
      lineId,
      lineName,
    });
  }
  return trains;
}

function normalizeTraffic(trafficData, lineRefs){
  const items = [];
  if(!trafficData || !Array.isArray(lineRefs) || !lineRefs.length){
    return items;
  }
  for(const ref of lineRefs){
    if(!ref) continue;
    const lineId = ref.id;
    if(!lineId) continue;
    const lineLabel = ref.name || '';
    const titlePrefix = lineLabel ? lineLabel + ' ' : '';

    if(trafficData.lines){
      const entry = trafficData.lines[lineId];
      if(Array.isArray(entry)){
        for(let i = 0; i < entry.length; i += 1){
          const item = entry[i];
          if(!item) continue;
          const baseTitle = item.title || item.name || '運行情報';
          const detailParts = [item.status, item.cause, item.text, item.detail].filter(Boolean);
          items.push({
            id: lineId + '-line-' + i,
            title: titlePrefix + baseTitle,
            detail: detailParts.join(' / '),
            type: 'line',
            href: item.url || '',
          });
        }
      }else if(entry && typeof entry === 'object'){
        const baseTitle = entry.title || entry.name || '運行情報';
        const detailParts = [entry.status, entry.cause, entry.text, entry.detail].filter(Boolean);
        items.push({
          id: lineId + '-line',
          title: titlePrefix + baseTitle,
          detail: detailParts.join(' / '),
          type: 'line',
          href: entry.url || '',
        });
      }
    }

    if(trafficData.express){
      const express = trafficData.express[lineId];
      if(express){
        const detailParts = [express.status, express.cause].filter(Boolean);
        const baseTitle = express.name || '特急';
        items.push({
          id: lineId + '-express',
          title: titlePrefix + baseTitle,
          detail: detailParts.join(' / '),
          type: 'express',
          href: express.url || '',
        });
      }
    }
  }
  return items;
}

export function normalizeSnapshot(source, params, options = {}){
  const selectedDirection = params.direction || 'both';
  const destinationFilters = getDestinationFilters();
  const destinationFilterSet = destinationFilters.length ? new Set(destinationFilters) : null;
  const destinationCodes = getDestinationCodes();
  const destinationCodeSet = destinationCodes.length
    ? new Set(destinationCodes.map((entry) => String(entry).trim()).filter(Boolean))
    : null;

  const referenceStationValue = getReferenceStation();
  const referenceStation = typeof referenceStationValue === 'string' ? referenceStationValue.trim() : '';
  const hidePastReference = Boolean(shouldHidePastReference() && referenceStation);
  const showPassing = Boolean(options.showPassing);

  const rawEntries = Array.isArray(source.lines) && source.lines.length ? source.lines : [{
    id: params.line,
    line: source.line,
    posData: source.posData,
    stationsData: source.stationsData,
  }];

  const lineMembership = new Map();
  const preparedEntries = [];

  for(const entry of rawEntries){
    if(!entry) continue;
    const lineId = entry.id || params.line;
    const lineName = (entry.line && entry.line.name) || lineId;
    const stationLookup = buildStationMap(entry.stationsData);
    registerLineMembership(lineId, stationLookup, lineMembership);
    preparedEntries.push({
      lineId,
      lineName,
      lineInfo: entry.line,
      posData: entry.posData,
      stationsData: entry.stationsData,
      stationLookup,
    });
  }

  const allowedStopTypesSet = new Set();
  const fallbackStopTypes = getReferenceStopTypes();
  if(Array.isArray(fallbackStopTypes)){
    for(const entry of fallbackStopTypes){
      const normalized = typeof entry === 'string' ? entry.trim() : '';
      if(normalized){
        allowedStopTypesSet.add(normalized);
      }
    }
  }
  if(referenceStation){
    for(const entry of preparedEntries){
      const stationLookup = entry && entry.stationLookup;
      if(!stationLookup || !stationLookup.stopTypes || typeof stationLookup.stopTypes.get !== 'function'){
        continue;
      }
      const stopTypes = stationLookup.stopTypes.get(referenceStation);
      if(Array.isArray(stopTypes)){
        for(const stopType of stopTypes){
          const normalized = typeof stopType === 'string' ? stopType.trim() : '';
          if(normalized){
            allowedStopTypesSet.add(normalized);
          }
        }
      }
    }
  }
  allowedStopTypesSet.add('普通');

  const referenceConfig = {
    stationCode: referenceStation || null,
    hidePast: hidePastReference,
    allowedTypes: allowedStopTypesSet,
    showPassing,
  };

  const trains = [];
  const lineRefs = [];
  const updatedCandidates = [];

  for(const entry of preparedEntries){
    const { lineId, lineName, posData, stationLookup } = entry;
    lineRefs.push({ id: lineId, name: lineName });
    const lineTrains = normalizeTrains(
      posData,
      stationLookup,
      selectedDirection,
      { id: lineId, name: lineName },
      destinationFilters,
      destinationFilterSet,
      lineMembership,
      destinationCodeSet,
      referenceConfig
    );
    trains.push(...lineTrains);
    const updated = posData && (posData.update || posData.timestamp);
    if(updated){
      updatedCandidates.push(updated);
    }
  }

  let updatedAtIso = null;
  if(updatedCandidates.length){
    updatedAtIso = updatedCandidates.reduce((latest, value) => {
      if(!latest) return value;
      const currentTime = new Date(value).getTime();
      if(Number.isNaN(currentTime)){
        return latest;
      }
      const latestTime = new Date(latest).getTime();
      if(Number.isNaN(latestTime) || currentTime > latestTime){
        return value;
      }
      return latest;
    }, null);
  }else if(source.posData){
    updatedAtIso = source.posData.update || source.posData.timestamp || null;
  }

  const traffic = normalizeTraffic(source.trafficData, lineRefs);
  const primaryLine = preparedEntries[0] || {};
  const lineTitle = (primaryLine.lineInfo && primaryLine.lineInfo.name)
    || (source.line && source.line.name)
    || params.line;
  const baseSubtitle = (primaryLine.lineInfo && primaryLine.lineInfo.range)
    || (source.line && source.line.range)
    || '';
  const additionalLineNames = lineRefs.slice(1).map((ref) => ref.name).filter(Boolean);
  const lineSubtitle = additionalLineNames.length
    ? [baseSubtitle, '対象路線: ' + additionalLineNames.join(', ')].filter(Boolean).join(' / ')
    : baseSubtitle;

  return {
    lineTitle,
    lineSubtitle,
    directionLabel: directionToLabel(selectedDirection),
    updatedAt: toLocaleDateTime(updatedAtIso, true),
    updatedTime: toLocaleDateTime(updatedAtIso, false),
    traffic,
    trains,
    alert: null,
    boardUpdatedAt: toLocaleDateTime(updatedAtIso, true),
    reference: {
      stationCode: referenceConfig.stationCode,
      hidePast: referenceConfig.hidePast,
      showPassing: referenceConfig.showPassing,
      allowedStopTypes: Array.from(referenceConfig.allowedTypes || []),
    },
    raw: source,
  };
}
