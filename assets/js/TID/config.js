const DEFAULT_API_BASE = '/api/v3/';
const DEFAULT_POLL_INTERVAL = 30000;

const DEFAULT_EXTRA_LINES = [];

const DEFAULT_DESTINATION_FILTERS = [];

const DEFAULT_DESTINATION_CODES = [];

const DEFAULT_REFERENCE_STOP_TYPES = [];
const DEFAULT_REFERENCE_STATION = null;
const DEFAULT_HIDE_PAST_REFERENCE = false;

function normalizeLineList(value){
  if(Array.isArray(value)){
    return value
      .map((entry) => (typeof entry === 'string' ? entry : String(entry ?? '')))
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  if(typeof value === 'string'){
    return value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return [];
}

export function getExtraLines(){
  const raw = readWindowConfig('TID_EXTRA_LINES', DEFAULT_EXTRA_LINES);
  const list = normalizeLineList(raw);
  if(!list.length){
    return DEFAULT_EXTRA_LINES.slice();
  }
  const seen = new Set();
  const result = [];
  for(const entry of list){
    if(seen.has(entry)) continue;
    seen.add(entry);
    result.push(entry);
  }
  return result;
}

export function getDestinationFilters(){
  const raw = readWindowConfig('TID_DESTINATION_FILTERS', DEFAULT_DESTINATION_FILTERS);
  const list = normalizeLineList(raw);
  if(!list.length){
    return DEFAULT_DESTINATION_FILTERS.slice();
  }
  const seen = new Set();
  const result = [];
  for(const entry of list){
    const normalized = entry.toLowerCase();
    if(seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

export function getDestinationCodes(){
  const raw = readWindowConfig('TID_DESTINATION_CODES', DEFAULT_DESTINATION_CODES);
  const list = normalizeLineList(raw);
  if(!list.length){
    return DEFAULT_DESTINATION_CODES.slice();
  }
  const seen = new Set();
  const result = [];
  for(const entry of list){
    const normalized = entry.toString().trim();
    if(!normalized){
      continue;
    }
    if(seen.has(normalized)){
      continue;
    }
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}
export function getReferenceStopTypes(){
  const raw = readWindowConfig('TID_REFERENCE_STOP_TYPES', DEFAULT_REFERENCE_STOP_TYPES);
  const list = normalizeLineList(raw);
  if(!list.length){
    return DEFAULT_REFERENCE_STOP_TYPES.slice();
  }
  const seen = new Set();
  const result = [];
  for(const entry of list){
    const normalized = entry.toString().trim();
    if(!normalized){
      continue;
    }
    const display = normalized;
    if(seen.has(display)){
      continue;
    }
    seen.add(display);
    result.push(display);
  }
  return result;
}


export function getReferenceStation(){
  const value = readWindowConfig('TID_REFERENCE_STATION', DEFAULT_REFERENCE_STATION);
  if(typeof value !== 'string'){
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function shouldHidePastReference(){
  const value = readWindowConfig('TID_HIDE_PAST_REFERENCE', DEFAULT_HIDE_PAST_REFERENCE);
  if(typeof value === 'string'){
    const normalized = value.trim().toLowerCase();
    if(!normalized){
      return DEFAULT_HIDE_PAST_REFERENCE;
    }
    if(normalized === 'true' || normalized === '1' || normalized === 'yes'){
      return true;
    }
    if(normalized === 'false' || normalized === '0' || normalized === 'no'){
      return false;
    }
  }
  return Boolean(value);
}

function readWindowConfig(key, fallback){
  if(typeof window === 'undefined') return fallback;
  const value = window[key];
  return value == null ? fallback : value;
}

export function getApiBase(){
  const override = readWindowConfig('TID_API_BASE', DEFAULT_API_BASE);
  if(typeof override !== 'string' || !override){
    return DEFAULT_API_BASE;
  }
  return override;
}

export function getPollInterval(){
  const value = Number(readWindowConfig('TID_POLL_INTERVAL', DEFAULT_POLL_INTERVAL));
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_POLL_INTERVAL;
}

export function resolveApiUrl(resource){
  if(typeof resource !== 'string' || !resource){
    throw new Error('API resource path is required');
  }
  if(/^https?:\/\//i.test(resource)){
    return resource;
  }
  const base = new URL(getApiBase(), window.location.origin);
  return new URL(resource, base).toString();
}

export function getAlarmSoundUrl(){
  const override = readWindowConfig('TID_ALARM_SOUND', '/assets/sound/alarm.mp3');
  return typeof override === 'string' && override ? override : '/assets/sound/alarm.mp3';
}





