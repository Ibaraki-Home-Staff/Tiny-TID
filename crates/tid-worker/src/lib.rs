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
            Err(e) => console_error!("network rebuild failed: {e}"),
        }
    } else {
        match cron::run(&env, &origin).await {
            Ok(sent) => {
                if sent > 0 {
                    console_log!("push sent: {sent}");
                }
            }
            Err(e) => console_error!("push cron failed: {e}"),
        }
    }
}
