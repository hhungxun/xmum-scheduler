#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // Fix WebKitGTK EGL crash on Wayland (Arch, Fedora, etc.)
    // WebKitGTK's GPU-accelerated Wayland renderer has EGL_BAD_PARAMETER
    // issues on many systems. Force XWayland as a reliable fallback.
    #[cfg(target_os = "linux")]
    {
        if std::env::var("GDK_BACKEND").is_err() {
            std::env::set_var("GDK_BACKEND", "x11");
        }
        if std::env::var("WEBKIT_DISABLE_DMABUF_RENDERER").is_err() {
            std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
        }
    }

    xmum_scheduler_lib::run();
}