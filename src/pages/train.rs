use yew::prelude::*;

use super::Navigation;

#[function_component]
pub fn Train() -> Html {
    html! {
        <>
        <Navigation />
        <div>
            <h1>{ "Train" }</h1>
            <p>{ "This is the Train page." }</p>
        </div>
        </>
    }
}
