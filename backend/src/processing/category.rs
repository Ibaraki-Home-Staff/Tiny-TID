use once_cell::sync::Lazy;
use regex::Regex;
use std::collections::HashMap;

use crate::paths::PROJECT_ROOT;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
#[repr(u8)]
pub enum Category {
    Local = 0,
    RapidSpecial = 1,
    Rapid = 2,
    RapidSection = 3,
    RapidDirect = 4,
    LimitedExpress = 5,
    Express = 6,
    Sleeper = 7,
    SL = 8,
    Sightseeing = 9,
    Twilight = 10,
}

impl Category {
    #[allow(dead_code)]
    pub fn from_u8(v: u8) -> Option<Category> {
        match v {
            0 => Some(Category::Local),
            1 => Some(Category::RapidSpecial),
            2 => Some(Category::Rapid),
            3 => Some(Category::RapidSection),
            4 => Some(Category::RapidDirect),
            5 => Some(Category::LimitedExpress),
            6 => Some(Category::Express),
            7 => Some(Category::Sleeper),
            8 => Some(Category::SL),
            9 => Some(Category::Sightseeing),
            10 => Some(Category::Twilight),
            _ => None,
        }
    }
}

// Mapping for labels like "うX快○".
// Key: token between "う" and the trailing circle (○/◯/〇)
// Value: normalized display type.
static U_TOKEN_TYPE_MAP: Lazy<HashMap<&str, &str>> = Lazy::new(|| {
    HashMap::from([
        ("直快", "直通快速"),
        ("区快", "区間快速"),
        ("み快", "みやこ路快速"),
        ("新快", "新快速"),
    ])
});

// Ordered matchers for category classification (most specific first)
static CATEGORY_MATCHERS: Lazy<Vec<(Regex, Category)>> = Lazy::new(|| {
    vec![
        (Regex::new(r"新快速").unwrap(), Category::RapidSpecial),
        (Regex::new(r"区間快速").unwrap(), Category::RapidSection),
        (Regex::new(r"直通快速").unwrap(), Category::RapidDirect),
        (Regex::new(r"快速").unwrap(), Category::Rapid),
        (Regex::new(r"特急").unwrap(), Category::LimitedExpress),
        (Regex::new(r"急行").unwrap(), Category::Express),
        (Regex::new(r"寝台").unwrap(), Category::Sleeper),
        (Regex::new(r"\bSL\b").unwrap(), Category::SL),
        (Regex::new(r"観光").unwrap(), Category::Sightseeing),
        (Regex::new(r"瑞風").unwrap(), Category::Twilight),
        (Regex::new(r"普通").unwrap(), Category::Local),
    ]
});

static CATEGORY_LABELS: Lazy<HashMap<Category, &str>> = Lazy::new(|| {
    HashMap::from([
        (Category::Local, "普通"),
        (Category::RapidSpecial, "新快速"),
        (Category::Rapid, "快速"),
        (Category::RapidSection, "区間快速"),
        (Category::RapidDirect, "直通快速"),
        (Category::LimitedExpress, "特急"),
        (Category::Express, "急行"),
        (Category::Sleeper, "寝台"),
        (Category::SL, "SL"),
        (Category::Sightseeing, "観光"),
        (Category::Twilight, "瑞風"),
    ])
});

static CATEGORY_COLOR_CLASS: Lazy<HashMap<Category, &str>> = Lazy::new(|| {
    HashMap::from([
        (Category::LimitedExpress, "type-text-red"),
        (Category::Express, "type-text-red"),
        (Category::Sleeper, "type-text-red"),
        (Category::SL, "type-text-red"),
        (Category::Sightseeing, "type-text-red"),
        (Category::RapidSpecial, "type-text-blue"),
        (Category::RapidDirect, "type-text-bluegray"),
        (Category::Rapid, "type-text-orange"),
        (Category::RapidSection, "type-text-green"),
        (Category::Twilight, "type-text-emerald"),
    ])
});

/// Load type color overrides from config TOML.
/// Returns a map from type label to CSS class.
pub fn load_type_colors_from_config() -> HashMap<String, String> {
    let path = PROJECT_ROOT.join("backend/config/color.toml");
    if !path.exists() {
        // Fallback: try config/color.toml relative to project root
        let alt = PROJECT_ROOT.join("config/color.toml");
        if alt.exists() {
            return parse_color_config(&alt);
        }
        tracing::warn!("color.toml not found at {}, using built-in defaults", path.display());
        return HashMap::new();
    }
    parse_color_config(&path)
}

fn parse_color_config(path: &std::path::Path) -> HashMap<String, String> {
    #[derive(serde::Deserialize)]
    struct ColorConfig {
        type_colors: Vec<TypeColorEntry>,
    }

    #[derive(serde::Deserialize)]
    struct TypeColorEntry {
        #[serde(rename = "type")]
        type_name: String,
        #[serde(default)]
        class: Option<String>,
    }

    match std::fs::read_to_string(path) {
        Ok(content) => {
            match toml::from_str::<ColorConfig>(&content) {
                Ok(config) => {
                    let mut map = HashMap::new();
                    for entry in config.type_colors {
                        if let Some(class) = entry.class {
                            if !class.is_empty() {
                                map.insert(entry.type_name, class);
                            }
                        }
                    }
                    tracing::info!("Loaded {} type color entries from config", map.len());
                    map
                }
                Err(e) => {
                    tracing::warn!("Failed to parse color.toml: {}", e);
                    HashMap::new()
                }
            }
        }
        Err(e) => {
            tracing::warn!("Failed to read color.toml: {}", e);
            HashMap::new()
        }
    }
}

/// Normalize a display type, handling special patterns.
/// Returns (normalized_display_type, optional_nickname_suffix).
pub fn normalize_display_type(display_type: &str) -> (String, Option<String>) {
    let dt = display_type.trim();

    // Handle "A 新快 ○" pattern (Aシート available)
    if let Some(caps) = Regex::new(r"^A[\s　]*新快[\s　]*([○◯〇×])").unwrap().captures(dt) {
        let mark = caps.get(1).unwrap().as_str();
        let suffix = format!("Aシート{}", mark);
        return ("新快速".to_string(), Some(suffix));
    }

    // Handle "A→新快" pattern (Aシート disabled)
    if Regex::new(r"^A→新快").unwrap().is_match(dt) {
        return ("新快速".to_string(), Some("Aシート×".to_string()));
    }

    // Handle "うX快○" pattern (うれしート)
    if let Some(caps) = Regex::new(r"^う[\s　]*([^\s○◯〇×]+)[\s　]*([○◯〇×])$")
        .unwrap()
        .captures(dt)
    {
        let token = caps.get(1).unwrap().as_str();
        let mark = caps.get(2).unwrap().as_str();

        // Resolve the token
        let resolved = if token == "快速" || token == "普通" {
            Some(token.to_string())
        } else {
            U_TOKEN_TYPE_MAP.get(token).map(|s| s.to_string())
        };

        if let Some(resolved_type) = resolved {
            let suffix = format!("うれしート{}", mark);
            return (resolved_type, Some(suffix));
        }
    }

    (dt.to_string(), None)
}

/// Classify a display type string into a Category.
pub fn classify_category(display_type: &str) -> Category {
    let label = display_type.trim();
    for (re, cat) in CATEGORY_MATCHERS.iter() {
        if re.is_match(label) {
            return *cat;
        }
    }
    Category::Local
}

/// Get the Japanese label for a category.
pub fn get_category_label(category: Category) -> &'static str {
    CATEGORY_LABELS.get(&category).copied().unwrap_or("不明")
}

/// Get the default CSS color class for a category.
pub fn default_color_class(category: Category) -> &'static str {
    CATEGORY_COLOR_CLASS
        .get(&category)
        .copied()
        .unwrap_or("")
}

/// Get the CSS color class for a type label, using config overrides.
pub fn type_color_class(
    display_type: &str,
    category: Category,
    type_colors: &HashMap<String, String>,
) -> String {
    let trimmed = display_type.trim();

    // Exact match in config first
    if let Some(cls) = type_colors.get(trimmed) {
        return cls.clone();
    }

    // Substring match fallback (matching JS behavior)
    for (key, cls) in type_colors {
        if trimmed.contains(key.as_str()) || key.contains(trimmed) {
            return cls.clone();
        }
    }

    // Fall back to category-based default
    default_color_class(category).to_string()
}

/// Get allowed categories for a station (from stopTrains array).
/// Always includes Local.
#[allow(dead_code)]
pub fn station_allowed_categories(stop_trains: &[u8]) -> Vec<Category> {
    let mut categories: Vec<Category> = stop_trains
        .iter()
        .filter_map(|&v| Category::from_u8(v))
        .collect();
    if !categories.contains(&Category::Local) {
        categories.push(Category::Local);
    }
    categories.sort_by_key(|c| *c as u8);
    categories
}
