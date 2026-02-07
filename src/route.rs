use yew_router::prelude::*;

#[derive(Clone, Routable, PartialEq)]
pub enum Route {
    #[at("/up")]
    Up,
    #[at("/")]
    Train,
    #[at("/down")]
    Down,
}

pub fn switch(routes: Route) -> yew::Html {
    match routes {
        Route::Up => yew::html! { <crate::pages::Up /> },
        Route::Train => yew::html! { <crate::pages::Train /> },
        Route::Down => yew::html! { <crate::pages::Down /> },
    }
}
