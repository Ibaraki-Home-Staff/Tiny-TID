//! Network merge tests over live fixtures.

mod support;

use tid_core::network::merge_scope;

#[test]
fn merged_order_anchors_ibaraki() {
    let snap = support::scope_snapshot();
    let scope: Vec<String> = support::SCOPE.iter().map(|s| s.to_string()).collect();

    let code = "0410"; // 茨木 on the kyoto line listing
    assert_eq!(
        snap.lines.get("kyoto").and_then(|m| m.get(code)).map(|s| s.name.clone()),
        Some("茨木".to_string())
    );

    let merged = merge_scope(&snap, &scope, "kyoto", "茨木");

    // Negative-index stations legitimately precede the anchor in `order`;
    // the anchor itself must sit exactly at index 0.
    assert!(merged.order.iter().any(|c| c == &code));
    let node = merged.by_code.get(code).unwrap();
    assert_eq!(node.name, "茨木");
    assert_eq!(node.index, 0.0);

    // Immediate neighbours on the primary kyoto order get opposite signs.
    let kyoto = &snap.orders["kyoto"];
    let i = kyoto.iter().position(|c| *c == code).unwrap();
    let neg_idx = merged.by_code.get(&kyoto[i - 1]).unwrap().index;
    let pos_idx = merged.by_code.get(&kyoto[i + 1]).unwrap().index;
    assert!(neg_idx < 0.0);
    assert!(pos_idx > 0.0);

    // Deterministic: no duplicate entries.
    let uniq: std::collections::HashSet<&String> = merged.order.iter().collect();
    assert_eq!(uniq.len(), merged.order.len());
}

#[test]
fn transfer_edges_bridge_scope_lines() {
    let snap = support::scope_snapshot();
    let scope: Vec<String> = support::SCOPE.iter().map(|s| s.to_string()).collect();

    // 山科 (0401) sits on both kyoto and hokurikubiwako via shared code;
    // kosei links to it by transfer. All three lines' nodes must be reachable
    // within a small hop radius from 山科.
    let yamashina = merge_scope(&snap, &scope, "kyoto", "0401");
    assert_eq!(yamashina.order.first().unwrap(), "0401");
    let near: Vec<_> = yamashina
        .by_code
        .values()
        .filter(|n| n.distance <= 1.0)
        .map(|n| n.code.clone())
        .collect();
    assert!(near.len() >= 3, "山科 must connect >=3 neighbours");
}

fn synth_item(code: &str, name: &str, links: &[(&str, &str)]) -> tid_core::model::StationsItem {
    tid_core::model::StationsItem {
        info: tid_core::model::StationInfo {
            code: code.to_string(),
            name: name.to_string(),
            transfer: Some(
                links
                    .iter()
                    .map(|(l, c)| tid_core::model::TransferItem {
                        link: Some(l.to_string()),
                        link_code: Some(c.to_string()),
                        ..Default::default()
                    })
                    .collect(),
            ),
            ..Default::default()
        },
        ..Default::default()
    }
}

#[test]
fn direction_points_at_same_line_dest() {
    // Travel rule, geography-free: when a train's destination code sits on
    // the same line listing outside its current segment, `direction` must
    // point at it (0 toward listing-start, 1 toward listing-end).
    // Cross-line destinations are skipped: through trains may run under the
    // destination line's datum (kyoto 2822M dir0 近江舞子行 is one).
    let docs = support::st_docs();
    let payloads = support::train_docs();
    let mut checked = 0;
    for ((line_id, st), payload) in docs.iter().zip(payloads.iter()) {
        let order: Vec<&str> = st.stations.iter().map(|s| s.info.code.as_str()).collect();
        let pos_of = |c: &str| order.iter().position(|o| *o == c);
        for t in &payload.trains {
            let pos = t.pos.as_str();
            let mut parts = pos.split('_');
            let (a, b) = (parts.next().unwrap_or(""), parts.next().unwrap_or(""));
            let dest_code: String = match t.dest.as_ref() {
                Some(tid_core::model::Dest::Obj(o)) => o.code.clone().unwrap_or_default(),
                _ => String::new(),
            };
            let (Some(pa), Some(pb), Some(di)) = (pos_of(a), pos_of(b), pos_of(dest_code.as_str())) else {
                continue;
            };
            let (lo, hi) = (pa.min(pb), pa.max(pb));
            if di < lo {
                assert_eq!(t.direction, 0, "{line_id} {} dest {dest_code} is start-ward", t.no);
                checked += 1;
            } else if di > hi {
                assert_eq!(t.direction, 1, "{line_id} {} dest {dest_code} is end-ward", t.no);
                checked += 1;
            }
            // Dest inside the current segment pins nothing (turnaround edge).
        }
    }
    assert!(checked > 10, "fixtures must pin the travel rule");
}

#[test]
fn pos_listing_convention_is_per_line() {
    // `pos` endpoint order is a per-line upstream convention, not travel
    // order: five scope lines list (before, after), kosei lists
    // (after, before) for every moving train. Pin both so a silent upstream
    // flip fails loudly instead of skewing boundary_match arms.
    // (boundary_match stays correct regardless: range matching is endpoint-
    // order independent, and stopped trains carry a single code.)
    let docs = support::st_docs();
    let payloads = support::train_docs();
    for ((line_id, st), payload) in docs.iter().zip(payloads.iter()) {
        let order: Vec<&str> = st.stations.iter().map(|s| s.info.code.as_str()).collect();
        let pos_of = |c: &str| order.iter().position(|o| *o == c);
        let mut asc = 0;
        let mut desc = 0;
        for t in &payload.trains {
            let pos = t.pos.as_str();
            let mut parts = pos.split('_');
            let (a, b) = (parts.next().unwrap_or(""), parts.next().unwrap_or(""));
            if b.is_empty() || b == "####" {
                continue;
            }
            let (Some(pa), Some(pb)) = (pos_of(a), pos_of(b)) else {
                continue;
            };
            if pa < pb {
                asc += 1;
            } else {
                desc += 1;
            }
        }
        if asc + desc == 0 {
            continue; // no moving trains in this snapshot (e.g. ako)
        }
        if line_id == "kosei" {
            assert!(desc > 0 && asc == 0, "kosei must stay reversed: asc={asc} desc={desc}");
        } else {
            assert!(asc > 0 && desc == 0, "{line_id} must stay ascending: asc={asc} desc={desc}");
        }
    }
}

#[test]
fn unsigned_branch_sorts_after_signed_neighbour() {
    // Anchor unit with two members (pa:A0 + br:A0 unioned by Rule A: same
    // code + same name). br order puts Y1 next to the anchor, so Y1 lands
    // adjacent to the anchor with sign 0 -> +1 default, sharing index +1.0
    // with the real neighbour A1. It must sort after A1 (its name would win
    // the plain name tiebreak) so the alarm ahead-window keeps A1.
    let pa = tid_core::model::StationsDoc {
        stations: vec![synth_item("A0", "Anchor", &[]), synth_item("A1", "Next", &[])],
    };
    let br = tid_core::model::StationsDoc {
        stations: vec![synth_item("A0", "Anchor", &[]), synth_item("Y1", "AAABranch", &[])],
    };
    let snap = tid_core::network::build_snapshot("t", &[("pa".to_string(), pa), ("br".to_string(), br)]);
    let merged = merge_scope(&snap, &["br".to_string(), "pa".to_string()], "pa", "A0");
    let order: Vec<&str> = merged.order.iter().map(|s| s.as_str()).collect();
    assert_eq!(order, vec!["A0", "A1", "Y1"]);
    assert!(merged.by_code["A1"].signed);
    assert!(!merged.by_code["Y1"].signed);
    assert_eq!(merged.by_code["Y1"].index, 1.0);
}

#[test]
fn anchor_prefers_primary_line_on_name_collision() {
    // Same station name, different codes, unlinked lines: separate units.
    // Component layout sorts the non-primary unit first, but a name query
    // must still anchor on the primary line's unit.
    let aa = tid_core::model::StationsDoc { stations: vec![synth_item("C1", "Same", &[])] };
    let zz = tid_core::model::StationsDoc { stations: vec![synth_item("C2", "Same", &[])] };
    let snap = tid_core::network::build_snapshot("t", &[("aa".to_string(), aa), ("zz".to_string(), zz)]);
    let merged = merge_scope(&snap, &["aa".to_string(), "zz".to_string()], "zz", "Same");
    assert_eq!(merged.order.first().unwrap(), "C2");
    assert_eq!(merged.by_code["C2"].index, 0.0);
}

#[test]
fn design_links_are_adjacency_not_identity() {
    // Tsukamoto-class regression: pa:A0 design-points at qb:Q0 (a track
    // neighbour, like Amagasaki next to Tsukamoto). They must stay separate
    // units with intact names, yet become graph-adjacent (distance 1.0).
    let pa = tid_core::model::StationsDoc {
        stations: vec![
            support::plain_item("A0", "Anchor"),
            support::plain_item("A1", "Next"),
        ],
    };
    let qb = tid_core::model::StationsDoc {
        stations: vec![
            support::neighbor_item("Q0", "Other", &[("pa", "A0")]),
            support::plain_item("Q1", "Side"),
        ],
    };
    let snap = tid_core::network::build_snapshot(
        "t",
        &[("pa".to_string(), pa), ("qb".to_string(), qb)],
    );
    let merged = merge_scope(&snap, &["pa".to_string(), "qb".to_string()], "pa", "A0");
    let order: Vec<&str> = merged.order.iter().map(|s| s.as_str()).collect();
    assert_eq!(order, vec!["A0", "A1", "Q0", "Q1"]);
    assert_eq!(merged.by_code["Q0"].name, "Other");
    assert_eq!(merged.by_code["Q0"].distance, 1.0);
    assert!(!merged.by_code["Q0"].signed);
    assert!(merged.by_code["A1"].signed);
}

#[test]
fn fallback_preserves_line_order() {
    // No anchor (all-trains mode): alphabetical would give A0,B0,C0 but the
    // listing runs C0,A0,B0 and must stay geographic for single-line scopes.
    let pa = tid_core::model::StationsDoc {
        stations: vec![
            support::plain_item("C0", "See"),
            support::plain_item("A0", "Ay"),
            support::plain_item("B0", "Bee"),
        ],
    };
    let snap = tid_core::network::build_snapshot("t", &[("pa".to_string(), pa)]);
    let merged = merge_scope(&snap, &["pa".to_string()], "pa", "ZZZ-missing");
    let order: Vec<&str> = merged.order.iter().map(|s| s.as_str()).collect();
    assert_eq!(order, vec!["C0", "A0", "B0"]);
}
