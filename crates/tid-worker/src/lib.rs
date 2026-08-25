//! tid-worker: Cloudflare Worker glue (workers-rs).
//! Domain logic lives in tid-core; this crate only routes, fetches upstream,
//! caches, persists subscriptions and sends Web Push.

pub mod routes;
