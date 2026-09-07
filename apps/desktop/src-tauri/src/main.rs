// No console window alongside a release build on Windows. In debug it stays,
// because a panic with no console is a crash with no explanation.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    siksamitra_desktop_lib::run()
}
