import { U_TOKEN_TYPE_MAP } from './tid-rules.js';

// カテゴリ定数（列車種別のマッピング）
export const CATEGORY = {
  LOCAL: 0,
  RAPID_SPECIAL: 1,  // 新快速
  RAPID: 2,
  RAPID_SECTION: 3,  // 区間快速
  RAPID_DIRECT: 4,   // 直通快速
  LIMITED_EXPRESS: 5,
  EXPRESS: 6,
  SLEEPER: 7,
  SL: 8,
  SIGHTSEEING: 9,
  TWILIGHT: 10
};

/**
 * カテゴリ判定（バグ修正版）
 * 最長マッチ優先で判定を行う
 * @param {string} displayType - 列車の種別文字列
 * @returns {number} カテゴリ番号（-1は不明）
 */
export function trainCategoryFromDisplayType(displayType){
  const s = String(displayType || '').trim();

  // 最長マッチ優先（重要！）
  // 「新快速」を先にチェックしないと、「快速」にマッチしてしまう
  if(/新快速/.test(s)) return CATEGORY.RAPID_SPECIAL;
  if(/区間快速/.test(s)) return CATEGORY.RAPID_SECTION;
  if(/直通快速/.test(s)) return CATEGORY.RAPID_DIRECT;
  if(/快速/.test(s)) return CATEGORY.RAPID;
  if(/特急/.test(s)) return CATEGORY.LIMITED_EXPRESS;
  if(/急行/.test(s)) return CATEGORY.EXPRESS;
  if(/寝台/.test(s)) return CATEGORY.SLEEPER;
  if(/\bSL\b/.test(s)) return CATEGORY.SL;
  if(/観光/.test(s)) return CATEGORY.SIGHTSEEING;
  if(/瑞風/.test(s)) return CATEGORY.TWILIGHT;
  if(/普通/.test(s)) return CATEGORY.LOCAL;

  return -1; // 不明
}

/**
 * カテゴリラベル取得
 * @param {number} cat - カテゴリ番号
 * @returns {string} カテゴリのラベル
 */
export function getCategoryLabel(cat){
  switch(Number(cat)){
    case CATEGORY.LOCAL: return '普通';
    case CATEGORY.RAPID_SPECIAL: return '新快速';
    case CATEGORY.RAPID: return '快速';
    case CATEGORY.RAPID_SECTION: return '区間快速';
    case CATEGORY.RAPID_DIRECT: return '直通快速';
    case CATEGORY.LIMITED_EXPRESS: return '特急';
    case CATEGORY.EXPRESS: return '急行';
    case CATEGORY.SLEEPER: return '寝台';
    case CATEGORY.SL: return 'SL';
    case CATEGORY.SIGHTSEEING: return '観光';
    case CATEGORY.TWILIGHT: return '瑞風';
    default: return `種別${cat}`;
  }
}

/**
 * カテゴリに基づいて種別テキストのCSSクラスを取得
 * @param {number} cat - カテゴリ番号
 * @returns {string} CSSクラス名
 */
export function typeTextClass(cat){
  switch(Number(cat)){
    case CATEGORY.LIMITED_EXPRESS: // 特急
    case CATEGORY.EXPRESS: // 急行
    case CATEGORY.SLEEPER: // 寝台
    case CATEGORY.SL: // SL
    case CATEGORY.SIGHTSEEING: // 観光
      return 'type-text-red';
    case CATEGORY.RAPID_SPECIAL: // 新快速
      return 'type-text-blue';
    case CATEGORY.RAPID_DIRECT: // 直通快速
      return 'type-text-bluegray';
    case CATEGORY.RAPID: // 快速
      return 'type-text-orange';
    case CATEGORY.RAPID_SECTION: // 区間快速
      return 'type-text-green';
    case CATEGORY.TWILIGHT: // 瑞風
      return 'type-text-emerald';
    case CATEGORY.LOCAL: // 普通（デフォルト色を使う）
    default:
      return '';
  }
}

/**
 * 列車の愛称を取得
 * @param {Object} train - 列車オブジェクト
 * @returns {string} 愛称文字列
 */
export function getNickname(train){
  const n = train && train.nickname;
  if(n == null) return '';
  return String(n || '').trim();
}

/**
 * 列車データの正規化
 * A新快○/× や う{token}○/× などのパターンを標準形式に変換
 * @param {Object} train - 列車オブジェクト
 * @returns {Object} 正規化された列車オブジェクト
 */
export function normalizeTrain(train){
  try{
    const obj = { ...train };
    const label = String(obj.displayType || '').trim();
    const originalDisplayType = label;

    // A新快○/× → 新快速 + Aシート○/×（新快速はAシートありか愛称無しの二択）
    try{
      const mAshinkai = label.match(/^A[\s　]*新快[\s　]*([○◯〇×])/i);
      if(mAshinkai){
        obj.displayType = '新快速';
        const mark = mAshinkai[1];
        const nick = getNickname(obj);
        if(!/Aシート/i.test(nick)){
          obj.nickname = nick ? `${nick} Aシート${mark}` : `Aシート${mark}`;
        }
        // デバッグログは呼び出し側で出力（TID_DEBUGに依存するため）
      }
    }catch{}

    // 可変マップに基づく「う{token}○/×」→ displayType 正規化 + 愛称（うれしート○/×）付与
    try{
      const m = label.match(/^う[\s　]*([^\s○◯〇×]+)[\s　]*([○◯〇×])$/);
      if(m){
        const token = m[1];
        const mark = m[2]; // ○ or ×
        let targetType = null;

        // 快速・普通は直接マッピング
        if(token === '快速'){
          targetType = '快速';
        } else if(token === '普通'){
          targetType = '普通';
        } else {
          // その他はU_TOKEN_TYPE_MAPを使用
          targetType = U_TOKEN_TYPE_MAP ? U_TOKEN_TYPE_MAP[token] : undefined;
        }

        if(targetType){
          obj.displayType = String(targetType);
          const current = getNickname(obj);
          if(!/うれしート/i.test(current)){
            obj.nickname = current ? `${current} うれしート${mark}` : `うれしート${mark}`;
          }
          // デバッグログは呼び出し側で出力
        }
      }
    }catch{}

    return obj;
  }catch{ return train; }
}

/**
 * 駅に停車する列車カテゴリのセットを取得
 * @param {Object} stationData - 駅データ
 * @returns {Set<number>|null} 停車するカテゴリのセット、またはnull（フィルタなし）
 */
export function stationAllowedCategories(stationData){
  if(!stationData || !Array.isArray(stationData.stopTrains)) return null; // no filter
  // ユーザー定義リストに基づくカテゴリ: 0=普通（補完）,1=新快速,2=快速,...
  const set = new Set(stationData.stopTrains.map(n => Number(n)));
  // 「普通」対策: displayTypeが「普通」の列車を許可するため、0を含める
  set.add(CATEGORY.LOCAL);
  return set;
}
