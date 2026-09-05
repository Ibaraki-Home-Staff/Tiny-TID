//! Server-side alarm target selection: UI-chosen targets must win over the
//! nearest-ahead default, stale entries must fall back, and boundary
//! matching must compare unit (representative) codes — never raw line-local
//! codes — because targets come from the merged order.

mod support;

use std::collections::HashMap;
use tid_core::alarm::{evaluate, Prefs};
use tid_core::vmtypes::TrainVm;

fn merged_ibaraki() -> tid_core::network::MergedIndex {
    let snap = support::scope_snapshot();
    let scope: Vec<String> = support::SCOPE.iter().map(|s| s.to_string()).collect();
    tid_core::network::merge_scope(&snap, &scope, "kyoto", "茨木")
}

/// dirs: 0 travels toward listing-start, so a dir-0 train between s1(+1) and
/// s2(+2) has listed-first `at` = s1 (ahead) and `next` = s2 (behind).
fn train_between(s1: &str, s2: &str, pos_index: f64, display_type: &str, category: i8) -> TrainVm {
    TrainVm {
        no: "100M".to_string(),
        line_id: "kyoto".to_string(),
        direction: 0,
        display_type: display_type.to_string(),
        nickname: String::new(),
        cars: Some(8),
        delay_minutes: 0,
        // Raw codes deliberately differ from unit reps: matching must use
        // at_unit/next_unit, never these.
        at_code: "RAW-A".to_string(),
        next_code: Some("RAW-B".to_string()),
        at_unit: s1.to_string(),
        next_unit: s2.to_string(),
        stopped: false,
        pos_index,
        pos_label: String::new(),
        dest_text: "京都".to_string(),
        category,
        category_label: display_type.to_string(),
        color_class: String::new(),
        will_stop_here: Some(true),
    }
}

fn prefs_with_target(cat_key: &str, target: &str) -> Prefs {
    let mut targets = HashMap::new();
    targets.insert(cat_key.to_string(), target.to_string());
    Prefs {
        cats: vec![2],
        pass: false,
        cars_min: 0.0,
        cars_filter_enabled: false,
        targets,
        pass_target: None,
    }
}

#[test]
fn saved_target_beats_nearest_ahead() {
    let merged = merged_ibaraki();
    let code = "0410";
    let pos = merged.order.iter().position(|c| c == code).unwrap();
    let (s1, s2) = (merged.order[pos + 1].clone(), merged.order[pos + 2].clone());

    // Train between s1 and s2 (pos 1.5): default target s1 matches neither
    // boundary (next s2 != s1) nor range ([0,1] excludes 1.5).
    let vm = train_between(&s1, &s2, 1.5, "快速", 2);
    let quiet = evaluate(&merged, &[vm.clone()], code, "kinki", "scope", &Prefs::default(), &Prefs::default());
    assert!(quiet.is_empty(), "no prefs, no events: {quiet:?}");

    let prefs = prefs_with_target("cat:2", &s2);
    let events = evaluate(&merged, &[vm], code, "kinki", "scope", &prefs, &Prefs::default());
    assert_eq!(events.len(), 1, "saved s2 must fire via unit-namespace boundary");
    assert_eq!(events[0].target_code, s2);
    assert!(events[0].key.contains(&s2));

    // Same geometry without a saved target stays silent.
    let plain = Prefs { cats: vec![2], ..Prefs::default() };
    let silent = evaluate(&merged, &[train_between(&s1, &s2, 1.5, "快速", 2)], code, "kinki", "scope", &plain, &Prefs::default());
    assert!(silent.is_empty(), "default target s1 is out of range: {silent:?}");
}

#[test]
fn stale_target_falls_back_to_ahead() {
    let merged = merged_ibaraki();
    let code = "0410";
    let pos = merged.order.iter().position(|c| c == code).unwrap();
    let (s1, s2) = (merged.order[pos + 1].clone(), merged.order[pos + 2].clone());

    // Train between selected and s1 (pos 0.5): stale target must degrade to
    // s1, whose boundary (next s1 == s1) fires.
    let vm = train_between(code, &s1, 0.5, "快速", 2);
    let prefs = prefs_with_target("cat:2", "ZZZ-removed");
    let events = evaluate(&merged, &[vm], code, "kinki", "scope", &prefs, &Prefs::default());
    assert_eq!(events.len(), 1, "stale target must fall back to {s1}");
    assert_eq!(events[0].target_code, s1);

    // Sanity: the s2 geometry from the previous test with a stale target is
    // silent (fallback s1 matches nothing at pos 1.5).
    let far = evaluate(
        &merged, &[train_between(&s1, &s2, 1.5, "快速", 2)], code, "kinki", "scope",
        &prefs, &Prefs::default(),
    );
    assert!(far.is_empty());
}

#[test]
fn pass_target_is_honored() {
    let merged = merged_ibaraki();
    let code = "0410";
    let pos = merged.order.iter().position(|c| c == code).unwrap();
    let (s1, s2) = (merged.order[pos + 1].clone(), merged.order[pos + 2].clone());

    // Pass alarm for a limited express running through: cat 5 is outside
    // Ibaraki's allowed {0, 2}, so the selected-station gate lets it pass.
    let vm = train_between(&s1, &s2, 1.5, "特急", 5);
    let prefs = Prefs {
        cats: vec![],
        pass: true,
        cars_min: 0.0,
        cars_filter_enabled: false,
        targets: Default::default(),
        pass_target: Some(s2.clone()),
    };
    let events = evaluate(&merged, &[vm], code, "kinki", "scope", &prefs, &Prefs::default());
    assert_eq!(events.len(), 1);
    assert_eq!(events[0].target_code, s2);
    assert_eq!(events[0].reason, "pass");
}
