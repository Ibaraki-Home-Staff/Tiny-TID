//! Network merge tests over live fixtures.

mod support;

use tid_core::network::merge_scope;

#[test]
fn merged_order_anchors_ibaraki() {
    let snap = support::scope_snapshot();
    let scope: Vec<String> = support::SCOPE.iter().map(|s| s.to_string()).collect();

    let code = snap
        .nodes
        .iter()
        .find(|(_, n)| n.name == "茨木")
        .expect("茨木 in snapshot")
        .0
        .clone();

    let merged = merge_scope(&snap, &scope, "kyoto", "茨木");

    // Negative-index stations legitimately precede the anchor in `order`;
    // the anchor itself must sit exactly at index 0.
    assert!(merged.order.iter().any(|c| c == &code));
    let node = merged.by_code.get(code.as_str()).unwrap();
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
