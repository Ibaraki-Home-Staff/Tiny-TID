use yew::prelude::*;
use yew_router::prelude::*;

use crate::route::{switch, Route};

use crate::components::Navigation;

#[component]
pub fn App() -> Html {
    html! {
        <>
        <BrowserRouter>
            <Navigation />
            <main>
                <Switch<Route> render={switch} />
            </main>
        </BrowserRouter>
        <script src="materialize.min.js"></script>
        </>
    }
}
