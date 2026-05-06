use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::fs;
use regex::Regex;
use tokio::io::AsyncWriteExt;

const MOODLE_ORIGIN: &str = "https://l.xmu.edu.my";
const ACADEMIC_CALENDAR_URL: &str = "https://www.xmu.edu.my/admissions/academic-calendar";

fn slug(value: &str, fallback: &str) -> String {
    let cleaned: String = value
        .replace(|c: char| !c.is_alphanumeric() && c != '.' && c != '-' && c != ' ', "")
        .trim()
        .replace(" ", "-")
        .replace("--", "-");
    if cleaned.is_empty() {
        fallback.to_string()
    } else {
        cleaned.chars().take(96).collect()
    }
}

fn note_frontmatter(entries: &[(String, String)]) -> String {
    let mut lines = vec!["---".to_string()];
    for (key, value) in entries {
        if !value.is_empty() {
            lines.push(format!("{}: \"{}\"", key, value));
        }
    }
    lines.push("---".to_string());
    lines.push("".to_string());
    lines.join("\n")
}

fn safe_join(base: &Path, parts: &[&str]) -> Result<PathBuf, String> {
    let mut target = base.to_path_buf();
    for part in parts {
        target.push(part);
    }
    let base_canonical = base.canonicalize().unwrap_or_else(|_| base.to_path_buf());
    let target_canonical = target.canonicalize().unwrap_or_else(|_| target.clone());
    if !target_canonical.starts_with(&base_canonical) {
        return Err("Invalid file path".to_string());
    }
    Ok(target)
}

fn data_root() -> PathBuf {
    let root = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("xmum-scheduler");
    let _ = fs::create_dir_all(&root);
    root
}

fn knowledge_dir() -> PathBuf {
    let dir = data_root().join("knowledge");
    let _ = fs::create_dir_all(&dir);
    dir
}

fn moodle_dir() -> PathBuf {
    let dir = data_root().join("moodle");
    let _ = fs::create_dir_all(&dir);
    dir
}

fn uploads_dir() -> PathBuf {
    let dir = data_root().join("uploads");
    let _ = fs::create_dir_all(&dir);
    dir
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AcademicCalendarResponse {
    pub source_page: String,
    pub discovered: Vec<String>,
    pub options: Vec<crate::AcademicOption>,
    pub warning: Option<String>,
}

#[tauri::command]
pub async fn academic_calendar() -> Result<AcademicCalendarResponse, String> {
    let options = vec![
        crate::AcademicOption {
            id: "foundation-apr-2026-s1".to_string(),
            track: "foundation".to_string(),
            label: "Foundation Students".to_string(),
            intake: Some("April 2026 Intake".to_string()),
            semester: "Semester 1".to_string(),
            start_date: "2026-04-01".to_string(),
            end_date: "2026-07-31".to_string(),
            source_url: "https://www.xmu.edu.my/sites/default/files/2025-12/Academic%20Calendar%20%28April%202026%20Intake%29.jpg".to_string(),
        },
        crate::AcademicOption {
            id: "foundation-dec-2025-s2".to_string(),
            track: "foundation".to_string(),
            label: "Foundation Students".to_string(),
            intake: Some("December 2025 Intake".to_string()),
            semester: "Semester 2".to_string(),
            start_date: "2026-04-01".to_string(),
            end_date: "2026-07-31".to_string(),
            source_url: "https://www.xmu.edu.my/sites/default/files/2025-11/Academic%20Calendar%20%28December%202025%20Intake%29%20v2.jpg".to_string(),
        },
        crate::AcademicOption {
            id: "foundation-aug-2025-s3".to_string(),
            track: "foundation".to_string(),
            label: "Foundation Students".to_string(),
            intake: Some("August 2025 Intake".to_string()),
            semester: "Semester 3".to_string(),
            start_date: "2026-04-01".to_string(),
            end_date: "2026-07-31".to_string(),
            source_url: "https://www.xmu.edu.my/sites/default/files/2025-11/Academic%20Calendar%20%28August%202025%20Intake%29%20v2.jpg".to_string(),
        },
        crate::AcademicOption {
            id: "ug-feb-2026".to_string(),
            track: "undergraduate".to_string(),
            label: "Undergraduate Students".to_string(),
            intake: None,
            semester: "February Semester".to_string(),
            start_date: "2026-02-20".to_string(),
            end_date: "2026-04-03".to_string(),
            source_url: "https://www.xmu.edu.my/sites/default/files/2025-08/2026-Undergraduate-Academic-Calendar.jpg".to_string(),
        },
        crate::AcademicOption {
            id: "ug-apr-2026".to_string(),
            track: "undergraduate".to_string(),
            label: "Undergraduate Students".to_string(),
            intake: None,
            semester: "April Semester".to_string(),
            start_date: "2026-04-03".to_string(),
            end_date: "2026-07-31".to_string(),
            source_url: "https://www.xmu.edu.my/sites/default/files/2025-08/2026-Undergraduate-Academic-Calendar.jpg".to_string(),
        },
        crate::AcademicOption {
            id: "ug-sep-2026".to_string(),
            track: "undergraduate".to_string(),
            label: "Undergraduate Students".to_string(),
            intake: None,
            semester: "September Semester".to_string(),
            start_date: "2026-09-25".to_string(),
            end_date: "2027-01-21".to_string(),
            source_url: "https://www.xmu.edu.my/sites/default/files/2025-08/2026-Undergraduate-Academic-Calendar.jpg".to_string(),
        },
    ];

    match reqwest::get(ACADEMIC_CALENDAR_URL).await {
        Ok(response) => {
            match response.text().await {
                Ok(html) => {
                    let re = Regex::new(r#"href="([^"]+(?:Academic|Undergraduate)[^"]+\.(?:jpg|png|pdf))""#).unwrap();
                    let discovered: Vec<String> = re
                        .captures_iter(&html)
                        .filter_map(|cap| cap.get(1).map(|m| m.as_str().replace("&amp;", "&")))
                        .map(|url| {
                            if url.starts_with("http") {
                                url
                            } else {
                                format!("{}/{}", ACADEMIC_CALENDAR_URL, url)
                            }
                        })
                        .collect();
                    Ok(AcademicCalendarResponse {
                        source_page: ACADEMIC_CALENDAR_URL.to_string(),
                        discovered,
                        options,
                        warning: None,
                    })
                }
                Err(e) => Ok(AcademicCalendarResponse {
                    source_page: ACADEMIC_CALENDAR_URL.to_string(),
                    discovered: vec![],
                    options,
                    warning: Some(e.to_string()),
                }),
            }
        }
        Err(e) => Ok(AcademicCalendarResponse {
            source_page: ACADEMIC_CALENDAR_URL.to_string(),
            discovered: vec![],
            options,
            warning: Some(e.to_string()),
        }),
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MoodleLoginRequest {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MoodleLoginResponse {
    pub token: String,
    pub username: String,
    pub fullname: String,
    pub userid: u64,
}

#[tauri::command]
pub async fn moodle_login(request: MoodleLoginRequest) -> Result<MoodleLoginResponse, String> {
    let client = reqwest::Client::new();
    let mut body = std::collections::HashMap::new();
    body.insert("username", request.username);
    body.insert("password", request.password);
    body.insert("service", "moodle_mobile_app".to_string());

    let response = client
        .post(format!("{}/login/token.php", MOODLE_ORIGIN))
        .form(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let payload: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;

    if payload.get("error").is_some() || payload.get("token").is_none() {
        return Err(payload["error"].as_str().unwrap_or("Moodle login failed").to_string());
    }

    let token = payload["token"].as_str().unwrap_or("").to_string();

    // Get site info
    let site_info = moodle_call(&token, "core_webservice_get_site_info", &std::collections::HashMap::new()).await?;

    Ok(MoodleLoginResponse {
        token,
        username: site_info["username"].as_str().unwrap_or("").to_string(),
        fullname: site_info["fullname"].as_str().unwrap_or("").to_string(),
        userid: site_info["userid"].as_u64().unwrap_or(0),
    })
}

async fn moodle_call(token: &str, wsfunction: &str, params: &std::collections::HashMap<String, String>) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::new();
    let mut body = std::collections::HashMap::new();
    body.insert("wstoken".to_string(), token.to_string());
    body.insert("moodlewsrestformat".to_string(), "json".to_string());
    body.insert("wsfunction".to_string(), wsfunction.to_string());
    for (key, value) in params {
        body.insert(key.clone(), value.clone());
    }

    let response = client
        .post(format!("{}/webservice/rest/server.php", MOODLE_ORIGIN))
        .form(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let payload: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;

    if payload.get("exception").is_some() {
        return Err(payload["message"].as_str().unwrap_or("Moodle call failed").to_string());
    }

    Ok(payload)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MoodleCoursesRequest {
    pub token: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MoodleCoursesResponse {
    pub courses: Vec<crate::MoodleCourse>,
}

#[tauri::command]
pub async fn moodle_courses(request: MoodleCoursesRequest) -> Result<MoodleCoursesResponse, String> {
    let site_info = moodle_call(&request.token, "core_webservice_get_site_info", &std::collections::HashMap::new()).await?;
    let userid = site_info["userid"].as_u64().unwrap_or(0).to_string();
    
    let mut params = std::collections::HashMap::new();
    params.insert("userid".to_string(), userid);
    
    let enrolled = moodle_call(&request.token, "core_enrol_get_users_courses", &params).await?;
    let courses = enrolled.as_array()
        .unwrap_or(&vec![])
        .iter()
        .map(|course| crate::MoodleCourse {
            id: course["id"].as_u64().unwrap_or(0),
            fullname: course["fullname"].as_str().unwrap_or("").to_string(),
            shortname: course["shortname"].as_str().map(|s| s.to_string()),
            category: course["category"].as_u64(),
            startdate: course["startdate"].as_u64(),
            enddate: course["enddate"].as_u64(),
        })
        .collect();

    Ok(MoodleCoursesResponse { courses })
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MoodleSyncRequest {
    pub token: String,
    pub course_ids: Vec<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MoodleSyncResponse {
    pub courses: Vec<crate::MoodleSyncedCourse>,
    pub files: Vec<crate::MoodleFile>,
    pub errors: Vec<MoodleSyncError>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MoodleSyncError {
    pub id: u64,
    pub fullname: String,
    pub error: String,
}

#[tauri::command]
pub async fn moodle_sync(request: MoodleSyncRequest) -> Result<MoodleSyncResponse, String> {
    let site_info = moodle_call(&request.token, "core_webservice_get_site_info", &std::collections::HashMap::new()).await?;
    let userid = site_info["userid"].as_u64().unwrap_or(0).to_string();
    
    let mut params = std::collections::HashMap::new();
    params.insert("userid".to_string(), userid);
    
    let enrolled = moodle_call(&request.token, "core_enrol_get_users_courses", &params).await?;
    let wanted: std::collections::HashSet<u64> = request.course_ids.iter().cloned().collect();
    
    let mut courses = vec![];
    let mut files = vec![];
    let mut errors = vec![];

    if let Some(course_list) = enrolled.as_array() {
        for course in course_list {
            let course_id = course["id"].as_u64().unwrap_or(0);
            if !wanted.is_empty() && !wanted.contains(&course_id) {
                continue;
            }

            let fullname = course["fullname"].as_str().unwrap_or("").to_string();
            let shortname = course["shortname"].as_str().map(|s| s.to_string());

            let mut course_params = std::collections::HashMap::new();
            course_params.insert("courseid".to_string(), course_id.to_string());

            match moodle_call(&request.token, "core_course_get_contents", &course_params).await {
                Ok(contents) => {
                    let course_files = flatten_files(course_id, &fullname, &request.token, &contents);
                    let mut installed_files = vec![];
                    for file in course_files {
                        installed_files.push(install_moodle_file(&file).await);
                    }
                    courses.push(crate::MoodleSyncedCourse {
                        id: course_id,
                        fullname: fullname.clone(),
                        shortname: shortname.clone(),
                        files: installed_files.clone(),
                    });
                    files.extend(installed_files);
                }
                Err(e) => {
                    errors.push(MoodleSyncError {
                        id: course_id,
                        fullname,
                        error: e,
                    });
                }
            }
        }
    }

    Ok(MoodleSyncResponse { courses, files, errors })
}

fn flatten_files(course_id: u64, course_name: &str, token: &str, contents: &serde_json::Value) -> Vec<crate::MoodleFile> {
    let mut files = vec![];
    if let Some(sections) = contents.as_array() {
        for section in sections {
            let section_name = section["name"].as_str().unwrap_or("").to_string();
            if let Some(modules) = section["modules"].as_array() {
                for module in modules {
                    let module_name = module["name"].as_str().unwrap_or("").to_string();
                    if let Some(module_contents) = module["contents"].as_array() {
                        for content in module_contents {
                            if content["type"] == "file" && content["filename"].is_string() {
                                let fileurl = content["fileurl"].as_str().unwrap_or("");
                                let url = if !fileurl.is_empty() {
                                    if fileurl.contains('?') {
                                        format!("{}&token={}", fileurl, token)
                                    } else {
                                        format!("{}?token={}", fileurl, token)
                                    }
                                } else {
                                    "".to_string()
                                };
                                files.push(crate::MoodleFile {
                                    course_id,
                                    course_name: course_name.to_string(),
                                    filename: content["filename"].as_str().unwrap_or("").to_string(),
                                    fileurl: Some(url),
                                    local_path: None,
                                    local_url: None,
                                    installed: None,
                                    sync_error: None,
                                    timemodified: content["timemodified"].as_u64(),
                                    filesize: content["filesize"].as_u64(),
                                    section: Some(section_name.clone()),
                                    module_name: Some(module_name.clone()),
                                });
                            }
                        }
                    }
                }
            }
        }
    }
    files
}

async fn install_moodle_file(file: &crate::MoodleFile) -> crate::MoodleFile {
    let fileurl = match &file.fileurl {
        Some(url) if !url.is_empty() => url,
        _ => {
            return crate::MoodleFile {
                installed: Some(false),
                sync_error: Some("No Moodle download URL.".to_string()),
                ..file.clone()
            };
        }
    };

    let rel_parts = vec![
        slug(&format!("{}-{}", file.course_name, file.course_id), &format!("course-{}", file.course_id)),
        slug(&file.section.clone().unwrap_or_else(|| "General".to_string()), "General"),
        slug(&file.module_name.clone().unwrap_or_else(|| "Files".to_string()), "Files"),
        slug(&file.filename, "file"),
    ];
    let rel_path = rel_parts.join("/");
    let mdir = moodle_dir();
    let absolute_path = match safe_join(&mdir, &rel_parts.iter().map(|s| s.as_str()).collect::<Vec<_>>()) {
        Ok(p) => p,
        Err(e) => {
            return crate::MoodleFile {
                installed: Some(false),
                sync_error: Some(e),
                ..file.clone()
            };
        }
    };

    match reqwest::get(fileurl).await {
        Ok(response) => {
            if !response.status().is_success() {
                return crate::MoodleFile {
                    installed: Some(false),
                    sync_error: Some(format!("HTTP {}", response.status())),
                    ..file.clone()
                };
            }
            match response.bytes().await {
                Ok(body) => {
                    if let Some(parent) = absolute_path.parent() {
                        let _ = fs::create_dir_all(parent);
                    }
                    match fs::write(&absolute_path, &body) {
                        Ok(_) => crate::MoodleFile {
                            installed: Some(true),
                            local_path: Some(rel_path.clone()),
                            local_url: Some(format!("/api/moodle/file?path={}", urlencoding::encode(&rel_path))),
                            filesize: Some(body.len() as u64),
                            ..file.clone()
                        },
                        Err(e) => crate::MoodleFile {
                            installed: Some(false),
                            sync_error: Some(e.to_string()),
                            ..file.clone()
                        },
                    }
                }
                Err(e) => crate::MoodleFile {
                    installed: Some(false),
                    sync_error: Some(e.to_string()),
                    ..file.clone()
                },
            }
        }
        Err(e) => crate::MoodleFile {
            installed: Some(false),
            sync_error: Some(e.to_string()),
            ..file.clone()
        },
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KnowledgeSyncRequest {
    pub subjects: Vec<SubjectSyncData>,
    pub root_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubjectSyncData {
    pub id: String,
    pub name: String,
    pub code: String,
    pub course_info: Option<String>,
    pub folders: Vec<FolderSyncData>,
    pub notes: Vec<NoteSyncData>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FolderSyncData {
    pub id: String,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NoteSyncData {
    pub id: String,
    pub title: String,
    pub content: Option<String>,
    pub folder_id: Option<String>,
    pub updated_at: Option<String>,
}

#[tauri::command]
pub async fn knowledge_sync(request: KnowledgeSyncRequest) -> Result<crate::KnowledgeSyncResult, String> {
    let kdir = match &request.root_path {
        Some(path) if !path.trim().is_empty() => {
            let p = PathBuf::from(path.trim());
            let _ = fs::create_dir_all(&p);
            p
        }
        _ => knowledge_dir(),
    };
    let _ = fs::remove_dir_all(&kdir);
    let _ = fs::create_dir_all(&kdir);

    let mut note_count = 0;
    let mut subject_count = 0;

    for subject in &request.subjects {
        let subject_name = &subject.name;
        let subject_code = &subject.code;
        let subject_id = &subject.id;
        let subject_dir = match safe_join(&kdir, &[&slug(&format!("{}-{}", subject_code, subject_id), "subject")]) {
            Ok(p) => p,
            Err(e) => return Err(e),
        };
        let _ = fs::create_dir_all(&subject_dir);
        subject_count += 1;

        if let Some(course_info) = &subject.course_info {
            let fm = note_frontmatter(&[
                ("id".to_string(), subject_id.clone()),
                ("type".to_string(), "course-info".to_string()),
                ("subject".to_string(), subject_name.clone()),
            ]);
            let _ = fs::write(subject_dir.join("_course-info.md"), format!("{}{}", fm, course_info));
        }

        let folders: std::collections::HashMap<String, String> = subject.folders.iter()
            .map(|f| (f.id.clone(), f.name.clone()))
            .collect();

        for note in &subject.notes {
            let folder_name = folders.get(&note.folder_id.clone().unwrap_or_default()).cloned().unwrap_or_else(|| "Unfiled".to_string());
            let folder_dir = match safe_join(&subject_dir, &[&slug(&folder_name, "Unfiled")]) {
                Ok(p) => p,
                Err(e) => return Err(e),
            };
            let _ = fs::create_dir_all(&folder_dir);
            let file_name = format!("{}-{}.md", slug(&note.title, "Untitled"), slug(&note.id, "note"));
            let markdown = format!("{}{}", note_frontmatter(&[
                ("id".to_string(), note.id.clone()),
                ("title".to_string(), note.title.clone()),
                ("subject".to_string(), subject_name.clone()),
                ("folder".to_string(), folder_name),
                ("updatedAt".to_string(), note.updated_at.clone().unwrap_or_default()),
            ]), note.content.clone().unwrap_or_default());
            let _ = fs::write(folder_dir.join(&file_name), markdown);
            note_count += 1;
        }
    }

    Ok(crate::KnowledgeSyncResult {
        subject_count,
        note_count,
        root: kdir.to_string_lossy().to_string(),
    })
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UploadRequest {
    pub scope: Option<String>,
    pub filename: String,
    pub mime: Option<String>,
    pub data_url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UploadResponse {
    pub id: String,
    pub name: String,
    pub mime: String,
    pub size: u64,
    pub local_path: String,
    pub local_url: String,
}

#[tauri::command]
pub async fn upload_file(request: UploadRequest) -> Result<UploadResponse, String> {
    let encoded = if request.data_url.contains(',') {
        request.data_url.split(',').last().unwrap_or("").to_string()
    } else {
        request.data_url
    };

    use base64::Engine;
    let buffer = base64::engine::general_purpose::STANDARD.decode(&encoded).map_err(|e| e.to_string())?;
    let safe_scope = slug(&request.scope.unwrap_or_else(|| "general".to_string()), "general");
    let file_name = format!("{}-{}", chrono::Utc::now().timestamp_millis(), slug(&request.filename, "upload"));
    let rel_path = format!("{}/{}", safe_scope, file_name);
    let udir = uploads_dir();
    let absolute_path = match safe_join(&udir, &[&safe_scope, &file_name]) {
        Ok(p) => p,
        Err(e) => return Err(e),
    };

    if let Some(parent) = absolute_path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    fs::write(&absolute_path, &buffer).map_err(|e| e.to_string())?;

    Ok(UploadResponse {
        id: format!("{}-{}-{}", safe_scope, chrono::Utc::now().timestamp_millis(), uuid::Uuid::new_v4().to_string()[..6].to_string()),
        name: request.filename,
        mime: request.mime.unwrap_or_else(|| "application/octet-stream".to_string()),
        size: buffer.len() as u64,
        local_path: rel_path.clone(),
        local_url: format!("/api/local-file?path={}", urlencoding::encode(&rel_path)),
    })
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetFileRequest {
    pub path: String,
}

#[tauri::command]
pub fn get_moodle_file(request: GetFileRequest) -> Result<Vec<u8>, String> {
    let mdir = moodle_dir();
    let absolute_path = safe_join(&mdir, &[&request.path])?;
    fs::read(&absolute_path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_upload_file(request: GetFileRequest) -> Result<Vec<u8>, String> {
    let udir = uploads_dir();
    let absolute_path = safe_join(&udir, &[&request.path])?;
    fs::read(&absolute_path).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn pick_directory(app: tauri::AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    let handle = std::thread::spawn(move || {
        app.dialog().file().blocking_pick_folder()
    });
    match handle.join().map_err(|e| format!("Thread join failed: {:?}", e))? {
        Some(path) => Ok(Some(path.to_string())),
        None => Ok(None),
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIChatRequest {
    pub provider: String,
    pub api_key: Option<String>,
    pub cli_command: Option<String>,
    pub model: Option<String>,
    pub system: Option<String>,
    pub messages: Vec<AIMessage>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIMessageImage {
    pub data: String,
    pub media_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIMessage {
    pub role: String,
    pub content: String,
    #[serde(default)]
    pub images: Vec<AIMessageImage>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIChatResponse {
    pub reply: String,
}

#[tauri::command]
pub async fn ai_chat(request: AIChatRequest) -> Result<AIChatResponse, String> {
    if request.provider.is_empty() {
        return Err("Provider required.".to_string());
    }
    if request.messages.is_empty() {
        return Err("messages required.".to_string());
    }

    let reply = match request.provider.as_str() {
        "openai" => {
            let api_key = request.api_key.ok_or("OpenAI API key required.")?;
            call_openai(&api_key, request.model.as_deref(), request.system.as_deref(), &request.messages).await?
        }
        "anthropic" => {
            let api_key = request.api_key.ok_or("Anthropic API key required.")?;
            call_anthropic(&api_key, request.model.as_deref(), request.system.as_deref(), &request.messages).await?
        }
        "claude-code" | "codex-cli" | "opencode" => {
            call_cli(&request.provider, request.cli_command.as_deref(), request.system.as_deref(), &request.messages).await?
        }
        _ => return Err(format!("Unknown provider: {}", request.provider)),
    };

    Ok(AIChatResponse { reply })
}

async fn call_openai(api_key: &str, model: Option<&str>, system: Option<&str>, messages: &[AIMessage]) -> Result<String, String> {
    let client = reqwest::Client::new();
    let mut msgs = vec![];
    if let Some(sys) = system {
        msgs.push(serde_json::json!({"role": "system", "content": sys}));
    }
    for msg in messages {
        if msg.images.is_empty() {
            msgs.push(serde_json::json!({"role": msg.role, "content": msg.content}));
        } else {
            // Multimodal message with images
            let mut content_parts = vec![
                serde_json::json!({"type": "text", "text": msg.content})
            ];
            for img in &msg.images {
                content_parts.push(serde_json::json!({
                    "type": "image_url",
                    "image_url": {
                        "url": format!("data:{};base64,{}", img.media_type, img.data),
                        "detail": "high"
                    }
                }));
            }
            msgs.push(serde_json::json!({"role": msg.role, "content": content_parts}));
        }
    }

    let response = client
        .post("https://api.openai.com/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&serde_json::json!({
            "model": model.unwrap_or("gpt-4o-mini"),
            "messages": msgs,
        }))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let payload: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;

    if payload.get("error").is_some() {
        return Err(payload["error"]["message"].as_str().unwrap_or("OpenAI request failed").to_string());
    }

    Ok(payload["choices"][0]["message"]["content"].as_str().unwrap_or("").to_string())
}

async fn call_anthropic(api_key: &str, model: Option<&str>, system: Option<&str>, messages: &[AIMessage]) -> Result<String, String> {
    let client = reqwest::Client::new();
    let msgs: Vec<_> = messages.iter()
        .map(|msg| {
            if msg.images.is_empty() {
                serde_json::json!({"role": msg.role, "content": msg.content})
            } else {
                // Multimodal message with images
                let mut content_parts = vec![
                    serde_json::json!({"type": "text", "text": msg.content})
                ];
                for img in &msg.images {
                    content_parts.push(serde_json::json!({
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": img.media_type,
                            "data": img.data
                        }
                    }));
                }
                serde_json::json!({"role": msg.role, "content": content_parts})
            }
        })
        .collect();

    let mut body = serde_json::json!({
        "model": model.unwrap_or("claude-3-5-haiku-latest"),
        "max_tokens": 4096,
        "messages": msgs,
    });
    if let Some(sys) = system {
        body["system"] = serde_json::Value::String(sys.to_string());
    }

    let response = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let payload: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;

    if payload.get("error").is_some() {
        return Err(payload["error"]["message"].as_str().unwrap_or("Anthropic request failed").to_string());
    }

    let content = payload["content"].as_array()
        .unwrap_or(&vec![])
        .iter()
        .map(|part| part["text"].as_str().unwrap_or(""))
        .collect::<Vec<_>>()
        .join("\n");

    Ok(content)
}

async fn call_cli(provider: &str, cli_command: Option<&str>, system: Option<&str>, messages: &[AIMessage]) -> Result<String, String> {
    let cmd = match cli_command {
        Some(c) if !c.is_empty() => c.to_string(),
        _ => match provider {
            "claude-code" => "claude".to_string(),
            "codex-cli" => "codex".to_string(),
            "opencode" => "opencode".to_string(),
            _ => return Err("CLI command not configured.".to_string()),
        }
    };

    let mut lines = vec![];
    if let Some(sys) = system {
        lines.push(format!("System:\n{}", sys));
    }
    for msg in messages {
        let label = match msg.role.as_str() {
            "user" => "User",
            "assistant" => "Assistant",
            _ => "System",
        };
        lines.push(format!("{}:\n{}", label, msg.content));
    }
    let prompt = lines.join("\n\n");

    let tokens: Vec<&str> = cmd.trim().split_whitespace().collect();
    if tokens.is_empty() {
        return Err("CLI command not configured.".to_string());
    }

    let program = tokens[0];
    let mut args: Vec<&str> = tokens[1..].to_vec();

    match provider {
        "claude-code" => args.push("-p"),
        "codex-cli" => {
            args.push("exec");
            args.push("--skip-git-repo-check");
            args.push("-");
        }
        "opencode" => args.push("run"),
        _ => {}
    }

    let mut output = tokio::process::Command::new(program)
        .args(&args)
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .kill_on_drop(true)
        .spawn()
        .map_err(|e| format!("Failed to spawn \"{}\". Is it installed? ({})", program, e))?;

    let mut stdin = output.stdin.take().ok_or("Failed to open stdin")?;
    stdin.write_all(prompt.as_bytes()).await.map_err(|e| e.to_string())?;
    drop(stdin);

    let result = tokio::time::timeout(
        std::time::Duration::from_secs(120),
        output.wait_with_output(),
    ).await.map_err(|_| format!("CLI command \"{}\" timed out after 120 seconds.", program))?;

    let output = result.map_err(|e| e.to_string())?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    } else {
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        let mut err_parts = vec![];
        if !stdout.is_empty() {
            err_parts.push(stdout);
        }
        if !stderr.is_empty() {
            err_parts.push(stderr);
        }
        if err_parts.is_empty() {
            Err(format!("\"{}\" exited with code {}.", program, output.status.code().unwrap_or(-1)))
        } else {
            Err(err_parts.join("\n---\n"))
        }
    }
}