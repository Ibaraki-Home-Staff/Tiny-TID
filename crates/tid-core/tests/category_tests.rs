//! Unit tests for category/color ports.

use tid_core::category::{
    base_type_text_class, configured_type_text_class, normalize_display_type, parse_color_map,
    train_category,
};

#[test]
fn ureshito_and_aseat_normalization() {
    let mut nick = String::new();
    let dt = normalize_display_type("う普通○", &mut nick);
    assert_eq!(dt, "普通");
    assert_eq!(nick, "うれしート○");

    let mut nick = String::new();
    let dt = normalize_display_type("う直快◯", &mut nick);
    assert_eq!(dt, "直通快速");
    assert_eq!(nick, "うれしート◯");

    let mut nick = "こんこん".to_string();
    let dt = normalize_display_type("う快速×", &mut nick);
    assert_eq!(dt, "快速");
    assert_eq!(nick, "こんこん うれしート×");

    let mut nick = String::new();
    let dt = normalize_display_type("A新快○", &mut nick);
    assert_eq!(dt, "新快速");
    assert_eq!(nick, "Aシート○");

    let mut nick = String::new();
    let dt = normalize_display_type("A→新快", &mut nick);
    assert_eq!(dt, "新快速");
    assert_eq!(nick, "Aシート×");

    let mut nick = String::new();
    let dt = normalize_display_type("う謎種△", &mut nick);
    assert_eq!(dt, "う謎種△");
    assert_eq!(nick, "");
}

#[test]
fn category_matching_order() {
    assert_eq!(train_category("新快速"), 1);
    assert_eq!(train_category("区間快速"), 3);
    assert_eq!(train_category("直通快速"), 4);
    assert_eq!(train_category("快速"), 2);
    assert_eq!(train_category("特急こうのとり"), 5);
    assert_eq!(train_category("SLやまぐち"), 8);
    assert_eq!(train_category("SLE"), -1); // \bSL\b must not match inside SLE
    assert_eq!(train_category("普通"), 0);
    assert_eq!(train_category("丹波路快速"), 2);
}

#[test]
fn color_map_parsing() {
    let map = parse_color_map("# comment\n臨時,赤\n新快速,青\n普通,\n壊れた行\n");
    assert_eq!(map.get("臨時").unwrap(), "type-text-red");
    assert_eq!(map.get("新快速").unwrap(), "type-text-blue");
    assert!(!map.contains_key("普通"));
    assert_eq!(configured_type_text_class("新快速", &map), "type-text-blue");
    assert_eq!(base_type_text_class(train_category("特急")), "type-text-red");
}
