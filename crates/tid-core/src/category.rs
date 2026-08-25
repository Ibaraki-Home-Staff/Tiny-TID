//! Display-type categories and the type-color map.
//! Port of assets/js/tid-category.js + tid.js color-map helpers.

use std::collections::BTreeMap;

pub const LOCAL: i8 = 0;
pub const RAPID_SPECIAL: i8 = 1;
pub const RAPID: i8 = 2;
pub const RAPID_SECTION: i8 = 3;
pub const RAPID_DIRECT: i8 = 4;
pub const LIMITED_EXPRESS: i8 = 5;
pub const EXPRESS: i8 = 6;
pub const SLEEPER: i8 = 7;
pub const SL: i8 = 8;
pub const SIGHTSEEING: i8 = 9;
pub const TWILIGHT: i8 = 10;

/// Unknown display type (JS returns -1).
pub const UNKNOWN: i8 = -1;

/// stopTrains numeric codes in `{line}_st.json` use this exact numbering
/// (confirmed against sample/westjr STOP_TRAINS tuple).
pub const CATEGORY_LABELS: [(i8, &str); 11] = [
    (LOCAL, "普通"),
    (RAPID_SPECIAL, "新快速"),
    (RAPID, "快速"),
    (RAPID_SECTION, "区間快速"),
    (RAPID_DIRECT, "直通快速"),
    (LIMITED_EXPRESS, "特急"),
    (EXPRESS, "急行"),
    (SLEEPER, "寝台"),
    (SL, "SL"),
    (SIGHTSEEING, "観光列車"),
    (TWILIGHT, "瑞風"),
];

/// Port of CATEGORY_MATCHERS order — first hit wins.
pub fn train_category(display_type: &str) -> i8 {
    let label = display_type.trim();
    if label.contains("新快速") {
        return RAPID_SPECIAL;
    }
    if label.contains("区間快速") {
        return RAPID_SECTION;
    }
    if label.contains("直通快速") {
        return RAPID_DIRECT;
    }
    if label.contains("快速") {
        return RAPID;
    }
    if label.contains("特急") {
        return LIMITED_EXPRESS;
    }
    if label.contains("急行") {
        return EXPRESS;
    }
    if label.contains("寝台") {
        return SLEEPER;
    }
    if has_word_sl(label) {
        return SL;
    }
    if label.contains("観光") {
        return SIGHTSEEING;
    }
    if label.contains("瑞風") {
        return TWILIGHT;
    }
    if label.contains("普通") {
        return LOCAL;
    }
    UNKNOWN
}

fn has_word_sl(s: &str) -> bool {
    let bytes = s.as_bytes();
    let mut i = 0;
    while i + 1 < bytes.len() {
        if bytes[i] == b'S' && bytes[i + 1] == b'L' {
            let prev_ok = i == 0 || !(bytes[i - 1].is_ascii_alphanumeric() || bytes[i - 1] == b'_');
            let next_ok =
                i + 2 >= bytes.len() || !(bytes[i + 2].is_ascii_alphanumeric() || bytes[i + 2] == b'_');
            if prev_ok && next_ok {
                return true;
            }
        }
        i += 1;
    }
    false
}

pub fn category_label(category: i8) -> String {
    for (cat, label) in CATEGORY_LABELS {
        if cat == category {
            return label.to_string();
        }
    }
    format!("種別{category}")
}

/// Base color class per category (CATEGORY_COLOR_CLASS).
pub fn base_type_text_class(category: i8) -> &'static str {
    match category {
        LIMITED_EXPRESS | EXPRESS | SLEEPER | SL | SIGHTSEEING => "type-text-red",
        RAPID_SPECIAL => "type-text-blue",
        RAPID_DIRECT => "type-text-bluegray",
        RAPID => "type-text-orange",
        RAPID_SECTION => "type-text-green",
        TWILIGHT => "type-text-emerald",
        _ => "",
    }
}

// ---------------------------------------------------------------------------
// color.txt map (assets/color.txt)
// ---------------------------------------------------------------------------

/// Parse `color.txt`: lines of `種別,色`, `#` comments. Mirrors parseTypeColorText.
pub fn parse_color_map(text: &str) -> BTreeMap<String, String> {
    let mut map = BTreeMap::new();
    for raw in text.split(['\n', '\r']) {
        let line = raw.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        let mut parts = line.splitn(2, ',');
        let ty = match parts.next() {
            Some(t) => t.trim(),
            None => continue,
        };
        let color = match parts.next() {
            Some(c) => c.trim(),
            None => continue,
        };
        let class = color_name_to_class(color);
        if !ty.is_empty() && !class.is_empty() {
            map.insert(ty.to_string(), class.to_string());
        }
    }
    map
}

fn color_name_to_class(name: &str) -> &'static str {
    match name.trim() {
        "赤" => "type-text-red",
        "青" => "type-text-blue",
        "青灰" => "type-text-bluegray",
        "橙" => "type-text-orange",
        "緑" => "type-text-green",
        "エメラルドグリーン" => "type-text-emerald",
        _ => "",
    }
}

/// Port of configuredTypeTextClass: exact match, then substring either way.
pub fn configured_type_text_class(type_label: &str, map: &BTreeMap<String, String>) -> String {
    let trimmed = type_label.trim();
    if trimmed.is_empty() {
        return String::new();
    }
    if let Some(exact) = map.get(trimmed) {
        return exact.clone();
    }
    for (key, class) in map {
        if trimmed.contains(key.as_str()) || key.contains(trimmed) {
            return class.clone();
        }
    }
    String::new()
}

/// Port of normalizeTrain: A-Seat 新快速 and うれしート display expansion.
/// Mutates display_type / appends nickname suffix exactly like the JS.
pub fn normalize_display_type(display_type: &str, nickname: &mut String) -> String {
    let dt = display_type.trim();

    // A新快○ / A→新快
    if let Some(rest) = strip_a_seat(dt) {
        append_suffix(nickname, &format!("A\u{30b7}\u{30fc}\u{30c8}{}", rest.mark));
        return "新快速".to_string();
    }

    // う<token>mark
    if let Some((token, mark)) = parse_ureshito(dt) {
        let resolved = resolve_u_token(&token);
        if let Some(resolved) = resolved {
            append_suffix(nickname, &format!("うれしート{mark}"));
            return resolved;
        }
    }

    dt.to_string()
}

fn strip_a_seat(dt: &str) -> Option<ASeatMatch> {
    // ^A[\s　]*新快[\s　]*([○◯〇×])  or  ^A→新快
    let b = dt.char_indices();
    let mut chars = b.peekable();
    match chars.peek() {
        Some((_, 'A')) | Some((_, 'a')) => {}
        _ => return None,
    }
    let mut rest = &dt[1..];
    rest = trim_zenkaku_space(rest);
    if let Some(after) = rest.strip_prefix("新快") {
        let tail = trim_zenkaku_space(after);
        if let Some(mark) = tail.chars().next() {
            if matches!(mark, '○' | '◯' | '〇' | '×') && tail.chars().count() == 1 {
                return Some(ASeatMatch { mark });
            }
        }
        return None;
    }
    if let Some(after) = rest.strip_prefix("→新快") {
        let _ = after;
        return Some(ASeatMatch { mark: '×' });
    }
    None
}

struct ASeatMatch {
    mark: char,
}

fn trim_zenkaku_space(s: &str) -> &str {
    s.trim_matches(|c: char| c.is_whitespace() || c == '\u{3000}')
}

/// ^う[\s　]*([^\s○◯〇×]+)[\s　]*([○◯〇×])$
fn parse_ureshito(dt: &str) -> Option<(String, char)> {
    let s = trim_zenkaku_space(dt);
    let mut chars = s.chars();
    if chars.next()? != 'う' {
        return None;
    }
    let rest = trim_zenkaku_space(&s['う'.len_utf8()..]);
    if rest.is_empty() {
        return None;
    }
    let mark_char = rest.chars().last()?;
    if !matches!(mark_char, '○' | '◯' | '〇' | '×') {
        return None;
    }
    let token_raw = &rest[..rest.len() - mark_char.len_utf8()];
    let token = trim_zenkaku_space(token_raw);
    if token.is_empty() {
        return None;
    }
    if token.chars().any(|c| matches!(c, '○' | '◯' | '〇' | '×') || c.is_whitespace()) {
        return None;
    }
    Some((token.to_string(), mark_char))
}

/// Port of U_TOKEN_TYPE_MAP resolution (tid-rules.js):
/// 快速/普通 pass through; others map via the table.
fn resolve_u_token(token: &str) -> Option<String> {
    match token {
        "快速" | "普通" => Some(token.to_string()),
        "直快" => Some("直通快速".to_string()),
        "区快" => Some("区間快速".to_string()),
        "み快" => Some("みやこ路快速".to_string()),
        "新快" => Some("新快速".to_string()),
        _ => None,
    }
}

fn append_suffix(nickname: &mut String, suffix: &str) {
    if nickname.contains("Aシート") && suffix.starts_with("Aシート") {
        return;
    }
    if nickname.contains("うれしート") && suffix.starts_with("うれしート") {
        return;
    }
    *nickname = if nickname.is_empty() {
        suffix.to_string()
    } else {
        format!("{nickname} {suffix}")
    };
}
