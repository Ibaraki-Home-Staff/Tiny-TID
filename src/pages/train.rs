use yew::prelude::*;


#[function_component]
pub fn Train() -> Html {
    html! {
        <>
        <div class="container">
            <h4>{ "列車運行情報 一覧" }</h4>
            <div>
                <p>{ "This is the Train page." }</p>
            </div>
        </div>
        </>
    }
}
