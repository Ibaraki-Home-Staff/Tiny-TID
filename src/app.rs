use yew::prelude::*;
use yew_router::prelude::*;
use wasm_bindgen::prelude::*;
use wasm_bindgen_futures::spawn_local;

use crate::route::{switch, Route};
use crate::components::Navigation;

#[wasm_bindgen(inline_js = r#"
export async function ensure_materialize_and_init_main(src) {
  // Load script once
  if (!window.M || !window.M.AutoInit) {
    let existing = document.querySelector(`script[data-mz="materialize"][src="${src}"]`);
    if (!existing) {
      await new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = src;
        s.defer = true;
        s.dataset.mz = "materialize";
        s.onload = resolve;
        s.onerror = () => reject(new Error("failed to load materialize: " + src));
        document.head.appendChild(s);
        console.log("[MZ] loading script", src);
      });
    } else {
      // If script exists but M isn't ready yet, wait for load
      await new Promise((resolve) => {
        existing.addEventListener("load", resolve, { once: true });
      });
    }
  }

  const main = document.querySelector("main");
  if (!window.M || !window.M.AutoInit || !main) {
    console.warn("[MZ] not ready for init", {
      hasM: !!window.M,
      hasAutoInit: !!(window.M && window.M.AutoInit),
      hasMain: !!main
    });
    return;
  }

  // Init current DOM under main (for SPA route changes)
  window.M.AutoInit(main);
  console.log("[MZ] init main");
}
"#)]
extern "C" {
    async fn ensure_materialize_and_init_main(src: String);
}

#[function_component]
fn RootInner() -> Html {
    let route = use_route::<Route>();

    // ルートが変わるたびに再初期化
    use_effect_with(route, |_| {
        spawn_local(async {
            ensure_materialize_and_init_main("materialize.min.js".to_string()).await;
        });
        || ()
    });

    html! {
        <>
            <Navigation />
            <main>
                <Switch<Route> render={switch} />
            </main>
        </>
    }
}

#[component]
pub fn App() -> Html {
    html! {
        <BrowserRouter>
            <RootInner />
        </BrowserRouter>
    }
}
