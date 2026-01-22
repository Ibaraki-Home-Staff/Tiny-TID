export function toLocaleDateTime(value, withDate = true){
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

export function formatDelay(delayMinutes){
  if(delayMinutes == null) return { text: '', minutes: null };
  const minutes = Number(delayMinutes);
  if(!Number.isFinite(minutes)){
    return { text: '', minutes: null };
  }
  if(minutes <= 0){
    return { text: '定刻', minutes: 0 };
  }
  return { text: '+' + minutes + '分', minutes };
}

export function mapDirection(value){
  if(value === 0 || value === '0') return 'up';
  if(value === 1 || value === '1') return 'down';
  if(typeof value === 'string'){
    const normalized = value.trim().toLowerCase();
    if(normalized === 'up') return 'up';
    if(normalized === 'down') return 'down';
  }
  return 'both';
}

export function orientByDirection(direction, firstName, secondName){
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

export function joinRemarks(train){
  const parts = [];
  if(train.typeChange){ parts.push(train.typeChange); }
  if(train.via){ parts.push(train.via); }
  if(train.aSeatInfo){ parts.push(train.aSeatInfo); }
  return parts.join(' / ');
}
