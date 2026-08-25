//! Tests for the implicit same-station union rules (snapshot post-pass).

use tid_core::model::{StationsDoc, StationsItem, StationInfo, Design};
use tid_core::network::{build_snapshot, merge_scope};

fn st(_line_marker: &str, code: &str, name: &str) -> StationsItem {
    StationsItem {
        info: StationInfo {
            name: name.to_string(),
            code: code.to_string(),
            ..Default::default()
        },
        design: Design::default(),
    }
}

fn doc(stations: Vec<StationsItem>) -> StationsDoc {
    StationsDoc { stations }
}

#[test]
fn rule_a_same_code_same_name_merges() {
    let docs = vec![
        ("a".into(), doc(vec![st("a", "0100", "甲"), st("a", "0101", "乙")])),
        ("b".into(), doc(vec![st("b", "0101", "乙"), st("b", "0102", "丙")])),
    ];
    let snap = build_snapshot("t", &docs);
    let scope = vec!["a".to_string(), "b".to_string()];
    let m = merge_scope(&snap, &scope, "a", "乙");
    // 乙 component spans both lines; 甲 and 丙 are its ±1 neighbours.
    let yi = m.by_code.values().find(|u| u.name == "乙").unwrap();
    assert_eq!(yi.index, 0.0);
    let names: Vec<&str> = m.order.iter().map(|c| m.by_code[c].name.as_str()).collect();
    assert!(names.contains(&"甲") && names.contains(&"丙"));
    assert_eq!(m.order.len(), 3);
}

#[test]
fn same_code_different_name_stays_split() {
    let docs = vec![
        ("a".into(), doc(vec![st("a", "0100", "茨木")])),
        ("b".into(), doc(vec![st("b", "0100", "広野")])),
    ];
    let snap = build_snapshot("t", &docs);
    let scope = vec!["a".to_string(), "b".to_string()];
    let m = merge_scope(&snap, &scope, "a", "茨木");
    assert_eq!(m.order.len(), 2); // two separate units
}

#[test]
fn rule_b_same_name_different_code_requires_direct_link() {
    // a↔b linked at 境界; 新三田(a:0409) and 新三田(b:1613) then merge.
    let mut boundary = st("a", "0999", "境界");
    boundary.design.upside = Some(vec![Default::default()]);
    // use transfer-style link via info.transfer instead of design for simplicity
    boundary.info.transfer = Some(vec![tid_core::model::TransferItem {
        name: "b".into(),
        r#type: 0,
        code: "b".into(),
        link: Some("b".into()),
        link_code: Some("0999".into()),
        substitute: None,
    }]);
    let docs = vec![
        ("a".into(), doc(vec![
            st("a", "0409", "新三田"),
            st("a", "0408", "谷"),
            boundary,
        ])),
        ("b".into(), doc(vec![
            st("b", "0999", "境界"),
            st("b", "1613", "新三田"),
            st("b", "1614", "広野"),
        ])),
    ];
    let snap = build_snapshot("t", &docs);
    let scope = vec!["a".to_string(), "b".to_string()];
    let m = merge_scope(&snap, &scope, "a", "新三田");
    let units: Vec<&str> = m.order.iter().map(|c| m.by_code[c].name.as_str()).collect();
    // 新三田 merged into one unit; 広野(b) and 谷(a) remain separate.
    assert_eq!(units.iter().filter(|n| **n == "新三田").count(), 1);
    assert_eq!(m.order.len(), 4);
}

#[test]
fn rule_b_negative_same_name_without_link_stays_split() {
    // 柏原 case: two different corridors, same name, no link anywhere.
    let docs = vec![
        ("a".into(), doc(vec![st("a", "0420", "柏原")])),
        ("b".into(), doc(vec![st("b", "3012", "柏原")])),
    ];
    let snap = build_snapshot("t", &docs);
    let scope = vec!["a".to_string(), "b".to_string()];
    let m = merge_scope(&snap, &scope, "a", "柏原");
    assert_eq!(m.order.len(), 2);
}

#[test]
fn url_and_dangling_links_are_pruned() {
    let mut s = st("a", "0100", "甲");
    s.info.transfer = Some(vec![
        tid_core::model::TransferItem {
            name: "shinkansen".into(), r#type: 1, code: "u".into(),
            link: Some("https://example.com".into()), link_code: Some("X".into()), substitute: None,
        },
        tid_core::model::TransferItem {
            name: "gone".into(), r#type: 0, code: "g".into(),
            link: Some("gone".into()), link_code: Some("9999".into()), substitute: None,
        },
    ]);
    let docs = vec![("a".into(), doc(vec![s]))];
    let snap = build_snapshot("t", &docs);
    assert!(snap.lines["a"]["0100"].transfers.is_empty());
}
