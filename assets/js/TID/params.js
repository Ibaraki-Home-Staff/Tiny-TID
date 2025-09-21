const ALLOWED_DIRECTIONS = new Set(['up', 'down', 'both']);

export function getQueryParams(){
  const url = new URL(window.location.href);
  const area = (url.searchParams.get('area') || '').trim();
  const line = (url.searchParams.get('line') || '').trim();
  const dir = (url.searchParams.get('dir') || 'both').trim().toLowerCase();
  const direction = ALLOWED_DIRECTIONS.has(dir) ? dir : 'both';
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
