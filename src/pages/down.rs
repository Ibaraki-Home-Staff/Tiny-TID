use yew::prelude::*;

#[function_component]
pub fn Down() -> Html {
    html! {
        <>
        <div class="container">
            <h2>{ "列車運行情報 下り" }</h2>
            <p>{ "This is the Down page." }</p>
        </div>
        </>
    }
}
