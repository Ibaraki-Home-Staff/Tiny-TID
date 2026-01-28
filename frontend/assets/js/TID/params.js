const ALLOWED_DIRECTIONS = new Set(['up', 'down', 'both']);
const DEFAULT_PARAMS = {
  area: 'kinki',
  line: 'kyoto',
  direction: 'up',
};

export function getQueryParams(){
  const url = new URL(window.location.href);
  const area = (url.searchParams.get('area') ?? DEFAULT_PARAMS.area).trim() || DEFAULT_PARAMS.area;
  const line = (url.searchParams.get('line') ?? DEFAULT_PARAMS.line).trim() || DEFAULT_PARAMS.line;
  const dirRaw = (url.searchParams.get('dir') ?? DEFAULT_PARAMS.direction).trim().toLowerCase() || DEFAULT_PARAMS.direction;
  const direction = ALLOWED_DIRECTIONS.has(dirRaw) ? dirRaw : DEFAULT_PARAMS.direction;
  return { area, line, direction };
}

export function validateParams(params){
  const issues = [];
  if(!params.area){
    issues.push('エリアが指定されていません');
  }
  if(!params.line){
    issues.push('路線が指定されていません');
  }
  return { ok: issues.length === 0, issues };
}

export function directionToLabel(direction){
  switch(direction){
    case 'up':
      return '上り';
    case 'down':
      return '下り';
    default:
      return '両方向';
  }
}
