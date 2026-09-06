//! View pipeline + alarm evaluation tests over live fixtures.

mod support;

use tid_core::alarm::{evaluate, Prefs};
use tid_core::traffic::build_traffic_items;
use tid_core::view::{build_view, MergedScopeSource, PassSetting, ViewInput};
use tid_core::vmtypes::TrainVm;

fn view_input<'a>(
    payload_pairs: &'a [(String, tid_core::model::TrainPosDoc)],
    cmap: &'a std::collections::BTreeMap<String, String>,
) -> ViewInput<'a> {
    ViewInput {
        station: "茨木",
        pass: PassSetting::Hide,
        trains_payloads: payload_pairs,
        server_time: "2026-08-25T03:00:00+09:00".to_string(),
        color_map: cmap,
    }
}

#[test]
fn view_pipeline_produces_sorted_direction_lists() {
    let snap = support::scope_snapshot();
    let scope: Vec<String> = support::SCOPE.iter().map(|s| s.to_string()).collect();
    let pairs = support::train_docs_tagged();
    let cmap = support::parse_color_text(include_str!("../../../assets/color.txt"));

    let source = MergedScopeSource {
        snapshot: &snap,
        lines: &scope,
        primary_line: "kyoto",
    };
    let resp = build_view(&source, &view_input(&pairs, &cmap));

    assert_eq!(resp.station.name, "茨木");
    assert!(!resp.update.is_empty());
    assert!(!resp.stations.is_empty());
    // Anchor sits at index 0 somewhere in the merged order (negatives precede).
    let anchor = resp
        .stations
        .iter()
        .find(|s| s.code == resp.station.code)
        .expect("anchor present");
    assert_eq!(anchor.index, 0.0);
    assert_eq!(anchor.name, "茨木");

    for (list, expect_asc) in [(&resp.up, true), (&resp.down, false)] {
        for w in list.windows(2) {
            if expect_asc {
                assert!(w[0].pos_index <= w[1].pos_index);
            } else {
                assert!(w[0].pos_index >= w[1].pos_index);
            }
        }
    }

    // Every train carries resolved labels and a category.
    let all = resp.up.iter().chain(resp.down.iter());
    for t in all {
        assert!(!t.no.is_empty());
        assert!(!t.category_label.is_empty());
        assert!(t.will_stop_here.is_some());
    }
}

#[test]
fn traffic_items_use_multiline_prefix() {
    let doc: tid_core::model::TrafficDoc =
        serde_json::from_str(include_str!("fixtures/area_kinki_trafficinfo.json")).unwrap();
    let scope: Vec<String> = support::SCOPE.iter().map(|s| s.to_string()).collect();
    let names: std::collections::BTreeMap<String, String> = [
        ("kyoto".to_string(), "JR京都線".to_string()),
        ("kobesanyo".to_string(), "JR神戸線・山陽線".to_string()),
    ]
    .into_iter()
    .collect();
    let items = build_traffic_items(&doc, &scope, &names);
    // Fixture has kyoto+kobesanyo entries; both must surface prefixed.
    let texts: Vec<&String> = items.lines.iter().map(|i| &i.text).collect();
    assert!(
        texts.iter().any(|t| t.starts_with("[JR京都線] ")),
        "{texts:?}"
    );
    assert!(texts.iter().any(|t| t.starts_with("[JR神戸線・山陽線] ")));
}

#[test]
fn alarm_fires_on_synthetic_geometry() {
    let snap = support::scope_snapshot();
    let scope: Vec<String> = support::SCOPE.iter().map(|s| s.to_string()).collect();
    let merged = tid_core::network::merge_scope(&snap, &scope, "kyoto", "茨木");

    let station_code = "0410";
    let pos = merged.order.iter().position(|c| c == station_code).unwrap();
    let target = merged.order[pos - 1].clone(); // down-side neighbour
    let target_name = merged.by_code.get(&target).unwrap().name.clone();

    // Down train just arriving at the down-side neighbour: atCode == target.
    let vm = TrainVm {
        no: "999T".to_string(),
        line_id: "kyoto".to_string(),
        direction: 1,
        at_unit: target.clone(),
        next_unit: String::new(),
        display_type: "快速".to_string(),
        nickname: String::new(),
        cars: Some(8),
        delay_minutes: 0,
        at_code: target.clone(),
        next_code: None,
        stopped: false,
        pos_index: -1.0,
        pos_label: String::new(),
        dest_text: "大阪".to_string(),
        category: 2,
        category_label: "快速".to_string(),
        color_class: String::new(),
        will_stop_here: Some(true),
    };

    let prefs_down = Prefs {
        cats: vec![2],
        pass: false,
        cars_min: 0.0,
        cars_filter_enabled: false,
        targets: Default::default(),
        pass_target: None,
    };
    let events = evaluate(&merged, &[vm], station_code, "kinki", "scope", &Prefs::default(), &prefs_down);
    assert_eq!(events.len(), 1);
    let ev = &events[0];
    assert!(ev.key.contains("999T"));
    assert!(ev.message.contains(&target_name));
    assert!(ev.message.ends_with("に接近"));
}

#[test]
fn pass_through_rule_keeps_arriving_trains() {
    // The port once inverted this predicate (`!` around ver1's keep
    // condition) and hid every arriving through train while keeping
    // diverging ones; the user pass-through rule now judges position and
    // destination on opposite sides. Pin with fixture trains:
    // 62M dir0 dest 京都 (arrives) stays; 3740M dir0 dest 大阪 (ends at
    // Osaka) goes; 3441M dir1 dest 姫路 (arrives) stays; kosei 2823M dir1
    // dest 京都 (ends at Kyoto) goes.
    let snap = support::scope_snapshot();
    let scope: Vec<String> = support::SCOPE.iter().map(|s| s.to_string()).collect();
    let pairs = support::train_docs_tagged();
    let cmap = support::parse_color_text(include_str!("../../../assets/color.txt"));
    let source = MergedScopeSource {
        snapshot: &snap,
        lines: &scope,
        primary_line: "kyoto",
    };
    let input = ViewInput {
        station: "茨木",
        pass: PassSetting::Show,
        trains_payloads: &pairs,
        server_time: "2026-08-25T03:00:00+09:00".to_string(),
        color_map: &cmap,
    };
    let resp = build_view(&source, &input);
    let up_nos: Vec<&str> = resp.up.iter().map(|t| t.no.as_str()).collect();
    let down_nos: Vec<&str> = resp.down.iter().map(|t| t.no.as_str()).collect();
    assert!(up_nos.contains(&"62M"), "arriving 62M must stay: {up_nos:?}");
    assert!(!up_nos.contains(&"3740M"), "Osaka-terminating 3740M must go: {up_nos:?}");
    assert!(down_nos.contains(&"3441M"), "arriving 3441M must stay: {down_nos:?}");
    assert!(!down_nos.contains(&"2823M"), "Kyoto-terminating 2823M must go: {down_nos:?}");
}

#[test]
fn snapshot_name_fallback_labels_foreign_code() {
    // Codes from lines outside the scope merge (tozai 1508 in a takarazuka
    // payload, live 4706C case) must resolve via the snapshot instead of
    // printing raw.
    let pa = support::stations_doc(vec![
        support::plain_item("A0", "A-Zero"),
        support::plain_item("A1", "A-One"),
        support::plain_item("A2", "A-Two"),
        support::plain_item("A3", "A-Three"),
    ]);
    let br = support::stations_doc(vec![support::plain_item("B0", "Bee")]);
    let snap = tid_core::network::build_snapshot(
        "t",
        &[("pa".to_string(), pa), ("br".to_string(), br)],
    );
    let scope = vec!["pa".to_string()];
    let payload = tid_core::model::TrainPosDoc {
        update: "2026-08-25T03:00:00+09:00".to_string(),
        trains: vec![tid_core::model::TrainsItem {
            no: "T1".to_string(),
            pos: "B0_A2".to_string(),
            direction: 0,
            display_type: "普通".to_string(),
            ..Default::default()
        }],
    };
    let pairs = vec![("pa".to_string(), payload)];
    let cmap = support::parse_color_text("");
    let source = MergedScopeSource {
        snapshot: &snap,
        lines: &scope,
        primary_line: "pa",
    };
    let input = ViewInput {
        station: "A1",
        pass: PassSetting::Hide,
        trains_payloads: &pairs,
        server_time: String::new(),
        color_map: &cmap,
    };
    let resp = build_view(&source, &input);
    assert_eq!(resp.up.len(), 1);
    assert_eq!(resp.up[0].pos_label, "A-Two → Bee");
}

#[test]
fn unresolvable_position_drops_from_both_lists() {
    // Live 4705C: a kyoto payload reporting at 0419 (a code kyoto doesn't
    // own) resolved to no unit. Such trains cannot be placed, so both lists
    // drop them (ver1 dropped NaN positions the same way).
    let pa = support::stations_doc(vec![
        support::plain_item("A0", "A-Zero"),
        support::plain_item("A1", "A-One"),
        support::plain_item("A2", "A-Two"),
        support::plain_item("A3", "A-Three"),
    ]);
    let snap = tid_core::network::build_snapshot("t", &[("pa".to_string(), pa)]);
    let scope = vec!["pa".to_string()];
    let mk = |no: &str, dir: i64| tid_core::model::TrainsItem {
        no: no.to_string(),
        pos: "ZX_ZY".to_string(),
        direction: dir,
        display_type: "普通".to_string(),
        ..Default::default()
    };
    let payload = tid_core::model::TrainPosDoc {
        update: String::new(),
        trains: vec![mk("U1", 0), mk("U2", 1)],
    };
    let pairs = vec![("pa".to_string(), payload)];
    let cmap = support::parse_color_text("");
    let source = MergedScopeSource {
        snapshot: &snap,
        lines: &scope,
        primary_line: "pa",
    };
    let input = ViewInput {
        station: "A1",
        pass: PassSetting::Hide,
        trains_payloads: &pairs,
        server_time: String::new(),
        color_map: &cmap,
    };
    let resp = build_view(&source, &input);
    assert!(resp.up.is_empty());
    assert!(resp.down.is_empty());
}

#[test]
fn diverging_branch_destination_is_excluded() {
    // User rule: br:B1 hangs off pa:A3 via a design edge. A dir-0 train
    // stopped at A3 (+2) with dest B1 (proxy +3, same side) never passes
    // A1 and must go; dest A0 (opposite side) stays; a train stopped AT A1
    // stays regardless (it is here).
    let pa = support::stations_doc(vec![
        support::plain_item("A0", "A-Zero"),
        support::plain_item("A1", "A-One"),
        support::plain_item("A2", "A-Two"),
        support::neighbor_item("A3", "A-Three", &[("br", "B0")]),
    ]);
    let br = support::stations_doc(vec![
        support::plain_item("B0", "Bee-Zero"),
        support::plain_item("B1", "Bee-One"),
    ]);
    let snap = tid_core::network::build_snapshot(
        "t",
        &[("pa".to_string(), pa), ("br".to_string(), br)],
    );
    let scope = vec!["pa".to_string()];
    let mk = |no: &str, pos: &str, dest_code: &str| tid_core::model::TrainsItem {
        no: no.to_string(),
        pos: pos.to_string(),
        direction: 0,
        display_type: "普通".to_string(),
        dest: Some(tid_core::model::Dest::Obj(tid_core::model::DestInfo {
            code: Some(dest_code.to_string()),
            ..Default::default()
        })),
        ..Default::default()
    };
    let payload = tid_core::model::TrainPosDoc {
        update: String::new(),
        trains: vec![
            mk("T-div", "A3", "B1"),
            mk("T-thru", "A2", "A0"),
            mk("T-here", "A1", "B1"),
        ],
    };
    let pairs = vec![("pa".to_string(), payload)];
    let cmap = support::parse_color_text("");
    let source = MergedScopeSource {
        snapshot: &snap,
        lines: &scope,
        primary_line: "pa",
    };
    let input = ViewInput {
        station: "A1",
        pass: PassSetting::Hide,
        trains_payloads: &pairs,
        server_time: String::new(),
        color_map: &cmap,
    };
    let resp = build_view(&source, &input);
    let up_nos: Vec<&str> = resp.up.iter().map(|t| t.no.as_str()).collect();
    assert!(!up_nos.contains(&"T-div"), "branch-diverging must go: {up_nos:?}");
    assert!(up_nos.contains(&"T-thru"), "through train must stay: {up_nos:?}");
    assert!(up_nos.contains(&"T-here"), "train at anchor must stay: {up_nos:?}");
}

#[test]
fn empty_station_shows_all_trains_in_line_order() {
    // view?line=pa with no station: no filtering, stations follow the
    // listing, up asc / down desc by line position.
    let pa = support::stations_doc(vec![
        support::plain_item("A0", "A-Zero"),
        support::plain_item("A1", "A-One"),
        support::plain_item("A2", "A-Two"),
        support::plain_item("A3", "A-Three"),
    ]);
    let snap = tid_core::network::build_snapshot("t", &[("pa".to_string(), pa)]);
    let scope = vec!["pa".to_string()];
    let mk = |no: &str, pos: &str, dir: i64| tid_core::model::TrainsItem {
        no: no.to_string(),
        pos: pos.to_string(),
        direction: dir,
        display_type: "普通".to_string(),
        ..Default::default()
    };
    let payload = tid_core::model::TrainPosDoc {
        update: String::new(),
        trains: vec![
            mk("U1", "A0_A1", 0),
            mk("U2", "A2_A3", 0),
            mk("D1", "A1_A2", 1),
        ],
    };
    let pairs = vec![("pa".to_string(), payload)];
    let cmap = support::parse_color_text("");
    let source = MergedScopeSource {
        snapshot: &snap,
        lines: &scope,
        primary_line: "pa",
    };
    let input = ViewInput {
        station: "",
        pass: PassSetting::Hide,
        trains_payloads: &pairs,
        server_time: String::new(),
        color_map: &cmap,
    };
    let resp = build_view(&source, &input);
    assert!(resp.station.code.is_empty());
    assert_eq!(
        resp.stations.iter().map(|s| s.code.as_str()).collect::<Vec<_>>(),
        vec!["A0", "A1", "A2", "A3"]
    );
    assert_eq!(resp.up.len(), 2);
    assert_eq!(resp.down.len(), 1);
    assert!(resp.up[0].pos_index <= resp.up[1].pos_index);
    assert_eq!(resp.down[0].no, "D1");
}
