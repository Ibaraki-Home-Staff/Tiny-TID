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
    let items = build_traffic_items(&doc, &scope);
    // Fixture has kyoto+kobesanyo entries; both must surface prefixed.
    let texts: Vec<&String> = items.lines.iter().map(|i| &i.text).collect();
    assert!(
        texts.iter().any(|t| t.starts_with("[kyoto] ")),
        "{texts:?}"
    );
    assert!(texts.iter().any(|t| t.starts_with("[kobesanyo] ")));
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
    };
    let events = evaluate(&merged, &[vm], station_code, "kinki", "scope", &Prefs::default(), &prefs_down);
    assert_eq!(events.len(), 1);
    let ev = &events[0];
    assert!(ev.key.contains("999T"));
    assert!(ev.message.contains(&target_name));
    assert!(ev.message.ends_with("に接近"));
}
