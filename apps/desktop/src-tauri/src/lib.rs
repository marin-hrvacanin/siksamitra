//! The desktop shell.
//!
//! Deliberately thin. The whole application — the editor, the renderer, the
//! engine, the interop — is the SAME `apps/web` bundle, because a second
//! implementation of any of it would be a second thing to keep correct. What
//! lives here is only what a browser cannot do: own a window, own the menu,
//! hand the page a file the user picked, and say which files it was launched
//! with.
//!
//! Two rules govern additions:
//!
//!   1. **Nothing here may know about documents.** A command that understood
//!      the format would be a second engine. These commands move bytes.
//!   2. **Least privilege.** `capabilities/default.json` grants the window
//!      exactly what the app uses and no wildcard. A shell that can read the
//!      whole disk on behalf of a web page is a browser with the safety
//!      removed.

use std::path::PathBuf;
use tauri::{Emitter, Manager};

/// A file the app was asked to open — by double-clicking one, by a second
/// launch while a window is already up, or from the Open dialog.
#[derive(Clone, serde::Serialize)]
struct OpenedFile {
    path: String,
    name: String,
}

impl OpenedFile {
    fn of(path: &std::path::Path) -> Self {
        Self {
            path: path.to_string_lossy().into_owned(),
            name: path
                .file_name()
                .map(|n| n.to_string_lossy().into_owned())
                .unwrap_or_default(),
        }
    }
}

/// The files named on the command line that we are willing to open.
///
/// An allowlist of extensions, not "every argument": the app is registered as a
/// handler for `.vuchant` and `.smdoc`, and a launch argument is
/// attacker-influenced on a shared machine. Anything else is ignored rather
/// than guessed at.
fn openable(args: impl Iterator<Item = String>) -> Vec<PathBuf> {
    const KNOWN: [&str; 4] = ["vuchant", "smdoc", "docx", "pdf"];
    args.skip(1)
        .filter(|a| !a.starts_with('-'))
        .map(PathBuf::from)
        .filter(|p| {
            p.extension()
                .and_then(|e| e.to_str())
                .map(|e| KNOWN.contains(&e.to_ascii_lowercase().as_str()))
                .unwrap_or(false)
        })
        .filter(|p| p.is_file())
        .collect()
}

/// Read a file the user chose. Bytes in, bytes out — no interpretation.
#[tauri::command]
fn read_file(path: String) -> Result<Vec<u8>, String> {
    std::fs::read(&path).map_err(|e| format!("{path}: {e}"))
}

/// Write a file, atomically.
///
/// A save interrupted midway must leave the PREVIOUS file intact: writing in
/// place truncates first, so an interruption there is a lost document, and the
/// interruption people actually hit is closing the lid. Sibling temp file,
/// flush, rename — rename being the one widely available atomic primitive, and
/// a sibling because rename is only atomic within a filesystem.
#[tauri::command]
fn write_file_atomic(path: String, bytes: Vec<u8>) -> Result<(), String> {
    use std::io::Write;
    let target = PathBuf::from(&path);
    let dir = target.parent().ok_or_else(|| format!("{path}: no parent directory"))?;
    let tmp = dir.join(format!(
        ".{}.tmp",
        std::process::id()
    ));
    {
        let mut file = std::fs::File::create(&tmp).map_err(|e| format!("{path}: {e}"))?;
        file.write_all(&bytes).map_err(|e| format!("{path}: {e}"))?;
        // Durability before visibility: a rename can otherwise become visible
        // while the contents are still only in the page cache.
        file.sync_all().map_err(|e| format!("{path}: {e}"))?;
    }
    std::fs::rename(&tmp, &target).map_err(|e| {
        let _ = std::fs::remove_file(&tmp);
        format!("{path}: {e}")
    })
}

/// Which files this launch was asked to open. The page asks once, on startup.
#[tauri::command]
fn launch_files() -> Vec<OpenedFile> {
    openable(std::env::args())
        .iter()
        .map(|p| OpenedFile::of(p))
        .collect()
}

/// The application's own version, so the About box cannot drift from the build.
#[tauri::command]
fn app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        // A second launch hands its files to the running window rather than
        // starting another copy. Two windows editing one document is a conflict
        // nobody asked for.
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            let files: Vec<OpenedFile> = openable(argv.into_iter())
                .iter()
                .map(|p| OpenedFile::of(p))
                .collect();
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_focus();
                if !files.is_empty() {
                    let _ = window.emit("open-files", files);
                }
            }
        }))
        .invoke_handler(tauri::generate_handler![
            read_file,
            write_file_atomic,
            launch_files,
            app_version
        ])
        .run(tauri::generate_context!())
        .expect("error while running siksamitra");
}
