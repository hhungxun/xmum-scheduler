use serde::{Deserialize, Serialize};

pub mod commands;

pub use commands::*;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AcademicOption {
    pub id: String,
    pub track: String,
    pub label: String,
    pub intake: Option<String>,
    pub semester: String,
    pub start_date: String,
    pub end_date: String,
    pub source_url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MoodleCourse {
    pub id: u64,
    pub fullname: String,
    pub shortname: Option<String>,
    pub category: Option<u64>,
    pub startdate: Option<u64>,
    pub enddate: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MoodleFile {
    pub course_id: u64,
    pub course_name: String,
    pub filename: String,
    pub fileurl: Option<String>,
    pub local_path: Option<String>,
    pub local_url: Option<String>,
    pub installed: Option<bool>,
    pub sync_error: Option<String>,
    pub timemodified: Option<u64>,
    pub filesize: Option<u64>,
    pub section: Option<String>,
    pub module_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MoodleSyncedCourse {
    pub id: u64,
    pub fullname: String,
    pub shortname: Option<String>,
    pub files: Vec<MoodleFile>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KnowledgeSyncResult {
    pub subject_count: usize,
    pub note_count: usize,
    pub root: String,
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            commands::academic_calendar,
            commands::moodle_login,
            commands::moodle_courses,
            commands::moodle_sync,
            commands::knowledge_sync,
            commands::upload_file,
            commands::get_moodle_file,
            commands::get_upload_file,
            commands::ai_chat,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}