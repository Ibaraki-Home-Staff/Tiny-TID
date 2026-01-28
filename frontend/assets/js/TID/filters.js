export function matchesDestinationFilters(train, filters, filterSet, lineMembership, destinationCodeSet){
  if(!train || typeof train !== 'object'){
    return false;
  }
  const dest = train.dest || {};
  const destCode = dest.code ? String(dest.code).trim() : '';

  if(destinationCodeSet && destinationCodeSet.size){
    if(!destCode || !destinationCodeSet.has(destCode)){
      return false;
    }
  }

  if(!filters || !filters.length){
    return true;
  }

  const effectiveSet = filterSet || new Set(filters);
  const candidateLines = [];
  if(dest.line) candidateLines.push(dest.line);
  if(Array.isArray(dest.lines)){
    for(const entry of dest.lines){
      if(entry) candidateLines.push(entry);
    }
  }
  for(const candidate of candidateLines){
    const normalized = String(candidate).trim().toLowerCase();
    if(normalized && effectiveSet.has(normalized)){
      return true;
    }
  }

  if(destCode && lineMembership){
    const membership = lineMembership.get(destCode);
    if(membership){
      for(const lineId of membership){
        const normalized = String(lineId).trim().toLowerCase();
        if(normalized && effectiveSet.has(normalized)){
          return true;
        }
      }
    }
  }

  const textCandidates = [];
  if(dest.text) textCandidates.push(dest.text);
  if(dest.longText && dest.longText !== dest.text) textCandidates.push(dest.longText);
  if(dest.nickname) textCandidates.push(dest.nickname);
  for(const candidate of textCandidates){
    const normalized = String(candidate).trim().toLowerCase();
    if(!normalized) continue;
    for(const filter of effectiveSet){
      if(normalized.includes(filter)){
        return true;
      }
    }
  }

  return false;
}

export function hasPassedReference(train, direction, stationLookup, referenceOrder){
  if(!Number.isFinite(referenceOrder)){
    return false;
  }
  if(!train || typeof train.pos !== 'string' || !train.pos.includes('_')){
    return false;
  }
  const parts = train.pos.split('_').filter((code) => code && code !== '####');
  if(!parts.length){
    return false;
  }
  const orders = [];
  if(stationLookup && stationLookup.order && typeof stationLookup.order.get === 'function'){
    for(const code of parts){
      const orderValue = stationLookup.order.get(code);
      if(Number.isFinite(orderValue)){
        orders.push(orderValue);
      }
    }
  }
  if(!orders.length){
    return false;
  }
  if(direction === 'up'){
    return Math.max(...orders) < referenceOrder;
  }
  if(direction === 'down'){
    return Math.min(...orders) > referenceOrder;
  }
  return false;
}

export function registerLineMembership(lineId, stationLookup, membershipMap){
  if(!stationLookup || !stationLookup.names || typeof stationLookup.names.keys !== 'function'){
    return;
  }
  const normalizedLineId = String(lineId || '').trim().toLowerCase();
  if(!normalizedLineId){
    return;
  }
  for(const code of stationLookup.names.keys()){
    const normalizedCode = String(code).trim();
    if(!normalizedCode) continue;
    let membership = membershipMap.get(normalizedCode);
    if(!membership){
      membership = new Set();
      membershipMap.set(normalizedCode, membership);
    }
    membership.add(normalizedLineId);
  }
}
