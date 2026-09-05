//! Area-master metadata: display names, upper/lower direction datum,
//! and listing normalization to upper→lower order.

mod support;

use tid_core::model::{area_name, parse_line_meta, MasterDoc};

fn norm(s: &str) -> String {
    s.trim().chars().filter(|c| !c.is_whitespace()).collect()
}

#[test]
fn parses_display_names_and_datum() {
    let doc: MasterDoc =
        serde_json::from_str(include_str!("fixtures/area_kinki_master.json")).expect("master parse");
    let meta = parse_line_meta(&doc);
    assert_eq!(meta.len(), 27);
    let kyoto = &meta["kyoto"];
    assert_eq!(kyoto.name, "JR京都線");
    assert_eq!(kyoto.upper, "京都");
    assert_eq!(kyoto.lower, "大阪");
    assert_eq!(meta["takarazuka"].name, "JR宝塚線");
    assert_eq!(area_name("kinki"), "近畿");
    assert_eq!(area_name("hokuriku"), "北陸");
    assert_eq!(area_name("okayama"), "岡山");
    assert_eq!(area_name("hiroshima"), "広島");
    assert_eq!(area_name("sanin"), "山陰");
    assert_eq!(area_name("xx-unknown"), "xx-unknown");
}

fn end_pos(names: &[String], want: &str) -> Option<usize> {
    let w = norm(want);
    if w.is_empty() {
        return None;
    }
    if let Some(i) = names.iter().position(|n| *n == w) {
        return Some(i);
    }
    for part in w.split(['・', '、', '/', '，']) {
        if part.is_empty() {
            continue;
        }
        if let Some(i) = names.iter().position(|n| *n == part) {
            return Some(i);
        }
    }
    None
}

#[test]
fn fixture_listings_run_upper_to_lower() {
    // Every scope line with both ends found must list the upper side first;
    // the travel rule (dir0 toward listing-start) rests on this datum.
    let meta = support::kinki_master_meta();
    let docs = support::st_docs();
    for (line_id, st) in docs.iter() {
        let lm = &meta[line_id.as_str()];
        let names: Vec<String> = st.stations.iter().map(|s| norm(&s.info.name)).collect();
        let up = end_pos(&names, &lm.upper)
            .unwrap_or_else(|| panic!("{line_id} upper {} not listed", lm.upper));
        let lo = end_pos(&names, &lm.lower)
            .unwrap_or_else(|| panic!("{line_id} lower {} not listed", lm.lower));
        assert!(up < lo, "{line_id} listing runs lower→upper");
    }
}

#[test]
fn reversed_listing_is_normalized() {
    let doc = support::stations_doc(vec![
        support::plain_item("B0", "BeeZero"),
        support::plain_item("B1", "BeeOne"),
    ]);
    let mut snap = tid_core::network::build_snapshot("t", &[("fl".to_string(), doc)]);
    assert_eq!(snap.orders["fl"], vec!["B0".to_string(), "B1".to_string()]);
    let mut meta = std::collections::BTreeMap::new();
    meta.insert(
        "fl".to_string(),
        tid_core::model::LineMeta {
            name: "FL".to_string(),
            upper: "BeeOne".to_string(),
            lower: "BeeZero".to_string(),
        },
    );
    tid_core::network::apply_line_meta(&mut snap, &meta);
    assert_eq!(snap.orders["fl"], vec!["B1".to_string(), "B0".to_string()]);
    assert_eq!(snap.line_meta["fl"].name, "FL");
}

#[test]
fn unknown_ends_leave_order_untouched() {
    let doc = support::stations_doc(vec![
        support::plain_item("B0", "BeeZero"),
        support::plain_item("B1", "BeeOne"),
    ]);
    let mut snap = tid_core::network::build_snapshot("t", &[("gl".to_string(), doc)]);
    let mut meta = std::collections::BTreeMap::new();
    meta.insert(
        "gl".to_string(),
        tid_core::model::LineMeta {
            name: "GL".to_string(),
            upper: "Nope".to_string(),
            lower: String::new(),
        },
    );
    tid_core::network::apply_line_meta(&mut snap, &meta);
    assert_eq!(snap.orders["gl"], vec!["B0".to_string(), "B1".to_string()]);
}

#[test]
fn area_index_lists_lines_in_master_order() {
    let doc: MasterDoc =
        serde_json::from_str(include_str!("fixtures/area_kinki_master.json")).expect("master parse");
    let masters = vec![("kinki".to_string(), doc)];
    let areas = tid_core::model::build_area_index(&masters);
    let kinki = &areas["kinki"];
    assert_eq!(kinki.name, "近畿");
    assert_eq!(kinki.lines.len(), 27);
    let kyoto = kinki.lines.iter().find(|l| l.id == "kyoto").expect("kyoto entry");
    assert_eq!(kyoto.name, "JR京都線");
    // Master `index` order ascending.
    assert_eq!(kinki.lines.first().unwrap().id, "hokurikubiwako");
    assert_eq!(kinki.lines.last().unwrap().id, "kinokuni");
}
