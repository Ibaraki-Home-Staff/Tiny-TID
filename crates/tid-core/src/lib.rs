//! tid-core: Tiny-TID domain logic (Cloudflare-independent).
//!
//! Ported 1:1 from ver1 client JS:
//! - `model.rs`    upstream JSON shapes (`{line}.json`, `{line}_st.json`, traffic, master)
//! - `category.rs` display-type categories + color map (tid-category.js / color.txt)
//! - `network.rs`  all-area station graph snapshot + selected-station hop normalization
//!                 (buildMergedIndexesForLines / buildGraphMetrics port)
//! - `view.rs`     train enhancement, payload merge, view model, traffic items
//! - `alarm.rs`    approach evaluation for background push (tid-alarm.js trigger rules)

pub mod alarm;
pub mod category;
pub mod model;
pub mod network;
pub mod traffic;
pub mod view;
pub mod vmtypes;

/// Global station-name fallback extracted from the westjr reference library
/// (40 lines / 843 stations). Used when a code is absent from the built
/// network snapshot (e.g. destinations on lines of non-built areas).
pub const STATION_NAMES_JSON: &str = include_str!("station_names.json");
