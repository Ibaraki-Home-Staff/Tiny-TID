//! Shared fixture loaders for integration tests.
#![allow(dead_code)]

use tid_core::model::{MasterDoc, StationsDoc, TrainPosDoc};
use tid_core::network::{build_snapshot, NetworkInputs};

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

/// Mini network snapshot covering only the six scope lines.
pub fn scope_snapshot() -> tid_core::network::NetworkSnapshot {
    let docs = st_docs();
    let master: MasterDoc =
        serde_json::from_str(include_str!("../fixtures/area_kinki_master.json")).unwrap();
    let masters: Vec<(String, MasterDoc)> = vec![("kinki".to_string(), master)];
    build_snapshot(
        "2026-08-25T00:00:00Z",
        &NetworkInputs {
            masters: &masters,
            st_docs: &docs,
        },
    )
}

pub fn parse_color_text(text: &str) -> std::collections::BTreeMap<String, String> {
    tid_core::category::parse_color_map(text)
}
