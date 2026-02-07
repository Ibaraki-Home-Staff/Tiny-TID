use yew::prelude::*;
use yew_router::prelude::*;

use crate::route::Route;

#[derive(Properties, PartialEq)]
pub struct NavItemProps {
    pub to: Route,
    pub label: AttrValue,
}

#[function_component]
fn NavItem(props: &NavItemProps) -> Html {
    html! {
        <li>
            <Link<Route>
                to={props.to.clone()}
                classes="blue-text text-darken-2"
            >
                { props.label.clone() }
            </Link<Route>>
        </li>
    }
}

#[function_component]
pub fn Navigation() -> Html {
    html! {
        <nav class="nav navbar grey darken-4">
            <div class="nav-wrapper">
                // materializeweb の例に合わせて right
                <a href="/" class="brand-logo left blue-text text-darken-2">{ "Tiny TID" }</a>

                // materializeweb の例に合わせて left + id="nav-mobile"
                <ul id="nav-mobile" class="right hide-on-med-and-down">
                    <NavItem to={Route::Train} label="一覧" />
                    <NavItem to={Route::Up}    label="上り" />
                    <NavItem to={Route::Down}  label="下り" />
                </ul>
            </div>
        </nav>
    }
}
