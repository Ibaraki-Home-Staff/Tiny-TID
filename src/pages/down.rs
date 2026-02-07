use yew::prelude::*;

use super::Navigation;

#[function_component]
pub fn Down() -> Html {
    html! {
        <>
        <Navigation />
        <div>
            <h1>{ "Down" }</h1>
            <p>{ "This is the Down page." }</p>
        </div>
        </>
    }
}
