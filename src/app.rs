use yew::prelude::*;
use yew_router::prelude::*;

use crate::route::{switch, Route};

#[component]
pub fn App() -> Html {
    html! {
        <main>
            <BrowserRouter>
                <Switch<Route> render={switch} />
            </BrowserRouter>
        </main>
    }
}
