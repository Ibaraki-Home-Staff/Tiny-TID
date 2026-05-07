import { U_TOKEN_TYPE_MAP } from './tid-rules.js';

export const CATEGORY = Object.freeze({
  LOCAL: 0,
  RAPID_SPECIAL: 1,
  RAPID: 2,
  RAPID_SECTION: 3,
  RAPID_DIRECT: 4,
  LIMITED_EXPRESS: 5,
  EXPRESS: 6,
  SLEEPER: 7,
  SL: 8,
  SIGHTSEEING: 9,
  TWILIGHT: 10
});

const CATEGORY_MATCHERS = [
  { pattern: /新快速/, category: CATEGORY.RAPID_SPECIAL },
  { pattern: /区間快速/, category: CATEGORY.RAPID_SECTION },
  { pattern: /直通快速/, category: CATEGORY.RAPID_DIRECT },
  { pattern: /快速/, category: CATEGORY.RAPID },
  { pattern: /特急/, category: CATEGORY.LIMITED_EXPRESS },
  { pattern: /急行/, category: CATEGORY.EXPRESS },
  { pattern: /寝台/, category: CATEGORY.SLEEPER },
  { pattern: /\bSL\b/, category: CATEGORY.SL },
  { pattern: /観光/, category: CATEGORY.SIGHTSEEING },
  { pattern: /瑞風/, category: CATEGORY.TWILIGHT },
  { pattern: /普通/, category: CATEGORY.LOCAL }
];

const CATEGORY_LABELS = Object.freeze({
  [CATEGORY.LOCAL]: '普通',
  [CATEGORY.RAPID_SPECIAL]: '新快速',
  [CATEGORY.RAPID]: '快速',
  [CATEGORY.RAPID_SECTION]: '区間快速',
  [CATEGORY.RAPID_DIRECT]: '直通快速',
  [CATEGORY.LIMITED_EXPRESS]: '特急',
  [CATEGORY.EXPRESS]: '急行',
  [CATEGORY.SLEEPER]: '寝台',
  [CATEGORY.SL]: 'SL',
  [CATEGORY.SIGHTSEEING]: '観光',
  [CATEGORY.TWILIGHT]: '瑞風'
});

const CATEGORY_COLOR_CLASS = Object.freeze({
  [CATEGORY.LIMITED_EXPRESS]: 'type-text-red',
  [CATEGORY.EXPRESS]: 'type-text-red',
  [CATEGORY.SLEEPER]: 'type-text-red',
  [CATEGORY.SL]: 'type-text-red',
  [CATEGORY.SIGHTSEEING]: 'type-text-red',
  [CATEGORY.RAPID_SPECIAL]: 'type-text-blue',
  [CATEGORY.RAPID_DIRECT]: 'type-text-bluegray',
  [CATEGORY.RAPID]: 'type-text-orange',
  [CATEGORY.RAPID_SECTION]: 'type-text-green',
  [CATEGORY.TWILIGHT]: 'type-text-emerald'
});

export function trainCategoryFromDisplayType(displayType){
  const label = String(displayType || '').trim();

  for(const { pattern, category } of CATEGORY_MATCHERS){
    if(pattern.test(label)) return category;
  }
  return -1;
}

export function getCategoryLabel(category){
  return CATEGORY_LABELS[Number(category)] || `種別${category}`;
}

export function typeTextClass(category){
  return CATEGORY_COLOR_CLASS[Number(category)] || '';
}

export function getNickname(train){
  return String(train?.nickname || '').trim();
}

export function normalizeTrain(train){
  if(!train || typeof train !== 'object') return train;

  const normalized = { ...train };
  const displayType = String(normalized.displayType || '').trim();

  normalizeAShinkaisoku(displayType, normalized);
  normalizeUreshito(displayType, normalized);

  return normalized;
}

function normalizeAShinkaisoku(displayType, train){
  let match = displayType.match(/^A[\s　]*新快[\s　]*([○◯〇×])/i);
  if(match){
    train.displayType = '新快速';
    appendNicknameSuffix(train, `Aシート${match[1]}`, /Aシート/i);
    return;
  }

  match = displayType.match(/^A→新快/i);
  if(match){
    train.displayType = '新快速';
    appendNicknameSuffix(train, 'Aシート×', /Aシート/i);
    return;
  }
}

function normalizeUreshito(displayType, train){
  const match = displayType.match(/^う[\s　]*([^\s○◯〇×]+)[\s　]*([○◯〇×])$/);
  if(!match) return;

  const [, token, mark] = match;
  const resolvedType = resolveUTokenType(token);
  if(!resolvedType) return;

  train.displayType = resolvedType;
  appendNicknameSuffix(train, `うれしート${mark}`, /うれしート/i);
}

function resolveUTokenType(token){
  if(token === '快速' || token === '普通') return token;
  return U_TOKEN_TYPE_MAP?.[token];
}

function appendNicknameSuffix(train, suffix, alreadyHasPattern){
  const nickname = getNickname(train);
  if(alreadyHasPattern.test(nickname)) return;
  train.nickname = nickname ? `${nickname} ${suffix}` : suffix;
}

export function stationAllowedCategories(stationData){
  if(!Array.isArray(stationData?.stopTrains)) return null;

  const categories = new Set(stationData.stopTrains.map((value) => Number(value)));
  categories.add(CATEGORY.LOCAL);
  return categories;
}
