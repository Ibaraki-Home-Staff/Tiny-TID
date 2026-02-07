use yew::prelude::*;

use super::Navigation;

#[function_component]
pub fn Up() -> Html {
    html! {
        <>
        <Navigation />
        <div>
            <h1>{ "Up" }</h1>
            <p>{ "This is the Up page." }</p>
        </div>
        </>
    }
}
