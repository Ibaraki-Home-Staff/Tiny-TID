//! tid-worker entry: fetch + scheduled handlers.

mod cron;
mod network_job;
mod push;
mod routes;
mod upstream;
mod util;

use worker::*;

#[event(fetch)]
async fn fetch(req: Request, env: Env, _ctx: Context) -> Result<Response> {
    routes::handle_fetch(req, env).await
}

#[event(scheduled)]
async fn scheduled(controller: ScheduledEvent, env: Env, _ctx: ScheduleContext) {
    let origin = util::origin(&env);
    if controller.cron().as_str() == crate::util::NETWORK_CRON {
        match network_job::rebuild_network(&env, &origin).await {
            Ok(summary) => console_log!("network rebuilt: {summary}"),
            Err(e) => console_error!("network rebuild failed; keeping previous snapshot: {e}"),
        }
        return;
    }

    // The minutely cron doubles as deploy/bootstrap self-healing. If D1 is
    // empty, old-version, or contains a previously persisted partial graph,
    // rebuild it before evaluating push notifications.
    if let Err(e) = network_job::ensure_network(&env, &origin).await {
        console_error!("network ensure failed: {e}");
        return;
    }

    match cron::run(&env, &origin).await {
        Ok(sent) => {
            if sent > 0 {
                console_log!("push sent: {sent}");
            }
        }
        Err(e) => console_error!("push cron failed: {e}"),
    }
}
