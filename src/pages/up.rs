use yew::prelude::*;

#[function_component]
pub fn Up() -> Html {
    html! {
        <>
        <div class="container">
            <h2>{ "列車運行情報 上り" }</h2>
            <p>{ "This is the Up page." }</p>
        </div>
        </>
    }
}
