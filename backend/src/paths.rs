use std::path::PathBuf;
use once_cell::sync::Lazy;

/// Auto-detected project root directory (where index.html lives).
/// Walks up from the executable until index.html is found.
pub static PROJECT_ROOT: Lazy<PathBuf> = Lazy::new(|| {
    let exe_dir = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|p| p.to_path_buf()));

    let mut dir = exe_dir;
    while let Some(d) = &dir {
        if d.join("index.html").exists() {
            return d.clone();
        }
        dir = d.parent().map(|p| p.to_path_buf());
    }

    PathBuf::from(".")
});
