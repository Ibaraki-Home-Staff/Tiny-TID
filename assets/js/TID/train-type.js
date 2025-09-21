const TYPE_RULES = [
  { match: '特急', label: '特急', badgeClass: 'type-badge type-red', textClass: 'type-text-red' },
  { match: '新快速', label: '新快速', badgeClass: 'type-badge type-blue', textClass: 'type-text-blue' },
  { match: '新快', label: '新快速', badgeClass: 'type-badge type-blue', textClass: 'type-text-blue' },
  { match: '区間快速', label: '区間快速', badgeClass: 'type-badge type-green', textClass: 'type-text-green' },
  { match: '区快', label: '区間快速', badgeClass: 'type-badge type-green', textClass: 'type-text-green' },
  { match: '快速', label: '快速', badgeClass: 'type-badge type-green', textClass: 'type-text-green' },
  { match: '快', label: '快速', badgeClass: 'type-badge type-green', textClass: 'type-text-green' },
  { match: '臨時', label: '臨時', badgeClass: 'type-badge type-orange', textClass: 'type-text-orange' },
  { match: '普通', label: '普通', badgeClass: 'type-badge type-white', textClass: '' },
];

const SORTED_RULES = TYPE_RULES.slice().sort((a, b) => b.match.length - a.match.length);

const SPECIAL_CASES = {
  '関空紀州': { typeLabel: '快速', nickname: '関空紀州', badgeClass: 'type-badge type-green', textClass: 'type-text-green' },
  '普通２': { typeLabel: '普通', nickname: '2', badgeClass: 'type-badge type-white', textClass: '' },
};

const SPACE_PATTERN = /[\s\u3000]+/g;

function sanitizeNickname(value){
  if(!value) return '';
  return value.replace(SPACE_PATTERN, '');
}

function combineNicknames(values){
  const seen = [];
  for(const value of values){
    const trimmed = sanitizeNickname(value);
    if(!trimmed) continue;
    if(!seen.includes(trimmed)){
      seen.push(trimmed);
    }
  }
  return seen.join(' / ');
}

function splitAffixes(raw, match){
  const index = raw.indexOf(match);
  if(index === -1){
    return { prefix: '', suffix: '' };
  }
  const prefix = raw.slice(0, index);
  const suffix = raw.slice(index + match.length);
  return { prefix, suffix };
}

export function deriveTypeInfo(train){
  const displayType = (train && train.displayType) || '';
  const recordedNickname = (train && train.nickname) || '';

  if(!displayType){
    return {
      typeLabel: '',
      nickname: combineNicknames([recordedNickname]),
      badgeClass: '',
      textClass: '',
    };
  }

  const special = SPECIAL_CASES[displayType];
  if(special){
    return {
      typeLabel: special.typeLabel,
      nickname: combineNicknames([recordedNickname, special.nickname]),
      badgeClass: special.badgeClass,
      textClass: special.textClass,
    };
  }

  for(const rule of SORTED_RULES){
    if(displayType.includes(rule.match)){
      const { prefix, suffix } = splitAffixes(displayType, rule.match);
      const derivedNickname = sanitizeNickname(prefix + suffix);
      return {
        typeLabel: rule.label,
        nickname: combineNicknames([recordedNickname, derivedNickname]),
        badgeClass: rule.badgeClass,
        textClass: rule.textClass,
      };
    }
  }

  return {
    typeLabel: displayType,
    nickname: combineNicknames([recordedNickname]),
    badgeClass: '',
    textClass: '',
  };
}
