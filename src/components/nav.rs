use yew::prelude::*;
use yew_router::prelude::*;

use crate::route::Route;

#[function_component]
pub fn Navigation() -> Html {
    html! {
        <nav class="nav navbar">
            <div class="nav-wrapper">
                <Link<Route> to={Route::Train}>{ "一覧" }</Link<Route>>
                { " | " }
                <Link<Route> to={Route::Up}>{ "上り" }</Link<Route>>
                { " | " }
                <Link<Route> to={Route::Down}>{ "下り" }</Link<Route>>
            </div>
        </nav>
    }
}
