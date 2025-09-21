const DEFAULT_API_BASE = '/api/v3/';
const DEFAULT_POLL_INTERVAL = 30000;

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
