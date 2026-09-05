//! Shared fixture loaders for integration tests.
#![allow(dead_code)]

use tid_core::model::{StationsDoc, TrainPosDoc};
use tid_core::network::build_snapshot;

pub const SCOPE: [&str; 6] = [
    "kyoto",
    "kobesanyo",
    "hokurikubiwako",
    "ako",
    "kosei",
    "takarazuka",
];

const ST_JSON: [&str; 6] = [
    include_str!("../fixtures/kyoto_st.json"),
    include_str!("../fixtures/kobesanyo_st.json"),
    include_str!("../fixtures/hokurikubiwako_st.json"),
    include_str!("../fixtures/ako_st.json"),
    include_str!("../fixtures/kosei_st.json"),
    include_str!("../fixtures/takarazuka_st.json"),
];

const TRAINS_JSON: [&str; 6] = [
    include_str!("../fixtures/kyoto.json"),
    include_str!("../fixtures/kobesanyo.json"),
    include_str!("../fixtures/hokurikubiwako.json"),
    include_str!("../fixtures/ako.json"),
    include_str!("../fixtures/kosei.json"),
    include_str!("../fixtures/takarazuka.json"),
];

pub fn st_docs() -> Vec<(String, StationsDoc)> {
    SCOPE
        .iter()
        .zip(ST_JSON)
        .map(|(l, j)| (l.to_string(), serde_json::from_str(j).expect("st parse")))
        .collect()
}

pub fn train_docs() -> Vec<TrainPosDoc> {
    TRAINS_JSON
        .iter()
        .map(|j| serde_json::from_str(j).expect("trains parse"))
        .collect()
}

/// Master metadata for the fixture lines (display names + upper/lower).
pub fn kinki_master_meta() -> std::collections::BTreeMap<String, tid_core::model::LineMeta> {
    let doc: tid_core::model::MasterDoc =
        serde_json::from_str(include_str!("../fixtures/area_kinki_master.json")).expect("master parse");
    tid_core::model::parse_line_meta(&doc)
}

/// Mini network snapshot covering only the six scope lines.
pub fn scope_snapshot() -> tid_core::network::NetworkSnapshot {
    let docs = st_docs();
    let mut snap = build_snapshot("2026-08-25T00:00:00Z", &docs);
    tid_core::network::apply_line_meta(&mut snap, &kinki_master_meta());
    snap
}

pub fn parse_color_text(text: &str) -> std::collections::BTreeMap<String, String> {
    tid_core::category::parse_color_map(text)
}

/// Same as [`train_docs`] but paired with the source line id.
pub fn train_docs_tagged() -> Vec<(String, TrainPosDoc)> {
    SCOPE
        .iter()
        .zip(TRAINS_JSON)
        .map(|(l, j)| {
            (
                l.to_string(),
                serde_json::from_str::<TrainPosDoc>(j).expect("trains parse"),
            )
        })
        .collect()
}

/// Plain synthetic station (no links).
pub fn plain_item(code: &str, name: &str) -> tid_core::model::StationsItem {
    tid_core::model::StationsItem {
        info: tid_core::model::StationInfo {
            code: code.to_string(),
            name: name.to_string(),
            ..Default::default()
        },
        ..Default::default()
    }
}

/// Synthetic station with design-neighbour (track adjacency) links.
pub fn neighbor_item(
    code: &str,
    name: &str,
    design_links: &[(&str, &str)],
) -> tid_core::model::StationsItem {
    tid_core::model::StationsItem {
        info: tid_core::model::StationInfo {
            code: code.to_string(),
            name: name.to_string(),
            ..Default::default()
        },
        design: tid_core::model::Design {
            upside: Some(
                design_links
                    .iter()
                    .map(|(l, c)| tid_core::model::SideItem {
                        link_line: Some(l.to_string()),
                        link_station_code: Some(c.to_string()),
                        ..Default::default()
                    })
                    .collect(),
            ),
            ..Default::default()
        },
    }
}

pub fn stations_doc(
    items: Vec<tid_core::model::StationsItem>,
) -> tid_core::model::StationsDoc {
    tid_core::model::StationsDoc { stations: items }
}
