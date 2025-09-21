const STOP_TRAIN_LABELS = [
  '',
  '新快速',
  '快速',
  '区間快速',
  '直通快速',
  '特急',
  '急行',
  '寝台',
  'SL',
  '観光列車',
  '瑞風',
];

function uniquePush(target, value){
  if(!value) return;
  if(!target.includes(value)){
    target.push(value);
  }
}

export function decodeStopTrains(values){
  if(!Array.isArray(values)){
    return [];
  }
  const labels = [];
  for(const entry of values){
    const index = Number(entry);
    if(!Number.isInteger(index)){
      continue;
    }
    const label = STOP_TRAIN_LABELS[index] || '';
    uniquePush(labels, label);
  }
  return labels;
}

export function hasStopTrain(values, label){
  if(!label) return false;
  const decoded = decodeStopTrains(values);
  return decoded.includes(label);
}
