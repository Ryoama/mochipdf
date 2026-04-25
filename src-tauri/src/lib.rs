#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(FileAccessState::default())
        .invoke_handler(tauri::generate_handler![
            mochi_pick_files,
            mochi_read_picked_file,
            mochi_reserve_save_file,
            mochi_pick_directory,
            mochi_reserve_directory_file,
            mochi_write_reserved_file,
        ])
        .plugin(tauri_plugin_dialog::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    fs,
    io::Write,
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicU64, Ordering},
        Mutex,
    },
};
use tauri::{ipc::Response, AppHandle, State};
use tauri_plugin_dialog::DialogExt;

const MAX_IMPORT_BYTES: u64 = 250 * 1024 * 1024;
const MAX_WRITE_BYTES: usize = 512 * 1024 * 1024;

#[derive(Default)]
struct FileAccessState {
    next_id: AtomicU64,
    readable_files: Mutex<HashMap<String, PathBuf>>,
    writable_files: Mutex<HashMap<String, PathBuf>>,
    writable_dirs: Mutex<HashMap<String, PathBuf>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PickFilesOptions {
    #[serde(default)]
    multi: bool,
    #[serde(default = "default_pdf_exts")]
    exts: Vec<String>,
    title: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct PickedFile {
    id: String,
    name: String,
    path: String,
    size: u64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ReservedPath {
    id: String,
    path: String,
}

fn default_pdf_exts() -> Vec<String> {
    vec!["pdf".into()]
}

impl FileAccessState {
    fn token(&self, prefix: &str) -> String {
        let n = self.next_id.fetch_add(1, Ordering::Relaxed) + 1;
        format!("{prefix}{n}")
    }
}

#[tauri::command]
fn mochi_pick_files(
    app: AppHandle,
    state: State<'_, FileAccessState>,
    options: PickFilesOptions,
) -> Result<Option<Vec<PickedFile>>, String> {
    let exts = normalize_exts(options.exts);
    let mut dialog = app.dialog().file();
    if let Some(title) = options.title {
        dialog = dialog.set_title(title);
    }
    let ext_refs: Vec<&str> = exts.iter().map(String::as_str).collect();
    let filter_name = exts
        .iter()
        .map(|e| e.to_ascii_uppercase())
        .collect::<Vec<_>>()
        .join("/");
    dialog = dialog.add_filter(filter_name, &ext_refs);

    let paths = if options.multi {
        match dialog.blocking_pick_files() {
            Some(paths) => paths,
            None => return Ok(None),
        }
    } else {
        match dialog.blocking_pick_file() {
            Some(path) => vec![path],
            None => return Ok(None),
        }
    };

    let mut picked = Vec::with_capacity(paths.len());
    for path in paths {
        let path = path
            .into_path()
            .map_err(|_| "選択されたファイルパスを扱えません".to_string())?;
        picked.push(register_readable_file(&state, path, &exts)?);
    }
    Ok(Some(picked))
}

#[tauri::command]
fn mochi_read_picked_file(
    state: State<'_, FileAccessState>,
    id: String,
) -> Result<Response, String> {
    let path = state
        .readable_files
        .lock()
        .map_err(|_| "ファイル状態の取得に失敗しました".to_string())?
        .remove(&id)
        .ok_or_else(|| "ファイルの読込許可が見つかりません".to_string())?;
    let bytes = read_limited_file(&path)?;
    Ok(Response::new(bytes))
}

#[tauri::command]
fn mochi_reserve_save_file(
    app: AppHandle,
    state: State<'_, FileAccessState>,
    suggested_name: String,
) -> Result<Option<ReservedPath>, String> {
    let mut dialog = app.dialog().file().add_filter("PDF", &["pdf"]);
    let suggested = sanitize_filename(&suggested_name, "document.pdf")?;
    dialog = dialog.set_file_name(suggested);
    let Some(path) = dialog.blocking_save_file() else {
        return Ok(None);
    };
    let mut path = path
        .into_path()
        .map_err(|_| "保存先パスを扱えません".to_string())?;
    if path.extension().is_none() {
        path.set_extension("pdf");
    }
    let path = normalize_output_path(path)?;
    Ok(Some(register_writable_file(&state, path)?))
}

#[tauri::command]
fn mochi_pick_directory(
    app: AppHandle,
    state: State<'_, FileAccessState>,
    title: Option<String>,
) -> Result<Option<ReservedPath>, String> {
    let mut dialog = app.dialog().file();
    if let Some(title) = title {
        dialog = dialog.set_title(title);
    }
    let Some(path) = dialog.blocking_pick_folder() else {
        return Ok(None);
    };
    let path = path
        .into_path()
        .map_err(|_| "保存先フォルダを扱えません".to_string())?;
    let path =
        fs::canonicalize(path).map_err(|e| format!("保存先フォルダを確認できません: {e}"))?;
    if !path.is_dir() {
        return Err("保存先はフォルダではありません".into());
    }
    let id = state.token("d");
    state
        .writable_dirs
        .lock()
        .map_err(|_| "フォルダ状態の保存に失敗しました".to_string())?
        .insert(id.clone(), path.clone());
    Ok(Some(ReservedPath {
        id,
        path: path.to_string_lossy().into_owned(),
    }))
}

#[tauri::command]
fn mochi_reserve_directory_file(
    state: State<'_, FileAccessState>,
    dir_id: String,
    filename: String,
) -> Result<ReservedPath, String> {
    let dir = state
        .writable_dirs
        .lock()
        .map_err(|_| "フォルダ状態の取得に失敗しました".to_string())?
        .get(&dir_id)
        .cloned()
        .ok_or_else(|| "保存先フォルダの許可が見つかりません".to_string())?;
    let filename = sanitize_filename(&filename, "document.pdf")?;
    let mut path = dir.join(filename);
    if path.extension().is_none() {
        path.set_extension("pdf");
    }
    let parent = path
        .parent()
        .ok_or_else(|| "保存先ファイル名が不正です".to_string())?;
    let parent =
        fs::canonicalize(parent).map_err(|e| format!("保存先フォルダを確認できません: {e}"))?;
    if parent != dir {
        return Err("保存先フォルダの外には書き込めません".into());
    }
    register_writable_file(&state, path)
}

#[tauri::command]
fn mochi_write_reserved_file(
    state: State<'_, FileAccessState>,
    request: tauri::ipc::Request<'_>,
) -> Result<(), String> {
    let id = request
        .headers()
        .get("id")
        .and_then(|v| v.to_str().ok())
        .ok_or_else(|| "書込IDが指定されていません".to_string())?;
    let path = state
        .writable_files
        .lock()
        .map_err(|_| "ファイル状態の取得に失敗しました".to_string())?
        .remove(id)
        .ok_or_else(|| "ファイルの書込許可が見つかりません".to_string())?;

    match request.body() {
        tauri::ipc::InvokeBody::Raw(bytes) => write_limited_file(&path, bytes),
        tauri::ipc::InvokeBody::Json(serde_json::Value::Array(values)) => {
            let bytes = values
                .iter()
                .map(|v| {
                    v.as_u64()
                        .and_then(|n| u8::try_from(n).ok())
                        .ok_or_else(|| "書込データが不正です".to_string())
                })
                .collect::<Result<Vec<_>, _>>()?;
            write_limited_file(&path, &bytes)
        }
        _ => Err("書込データが不正です".into()),
    }
}

fn register_readable_file(
    state: &FileAccessState,
    path: PathBuf,
    allowed_exts: &[String],
) -> Result<PickedFile, String> {
    let path = fs::canonicalize(path).map_err(|e| format!("ファイルを確認できません: {e}"))?;
    let meta = fs::metadata(&path).map_err(|e| format!("ファイル情報を確認できません: {e}"))?;
    if !meta.is_file() {
        return Err("選択されたパスはファイルではありません".into());
    }
    if meta.len() > MAX_IMPORT_BYTES {
        return Err(format!(
            "{} を超えるファイルは読み込めません",
            format_bytes(MAX_IMPORT_BYTES)
        ));
    }
    let ext = path
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    if !allowed_exts.is_empty() && !allowed_exts.iter().any(|e| e == &ext) {
        return Err("許可されていないファイル形式です".into());
    }
    let name = path
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("file")
        .to_string();
    let id = state.token("r");
    state
        .readable_files
        .lock()
        .map_err(|_| "ファイル状態の保存に失敗しました".to_string())?
        .insert(id.clone(), path.clone());
    Ok(PickedFile {
        id,
        name,
        path: path.to_string_lossy().into_owned(),
        size: meta.len(),
    })
}

fn register_writable_file(state: &FileAccessState, path: PathBuf) -> Result<ReservedPath, String> {
    let id = state.token("w");
    state
        .writable_files
        .lock()
        .map_err(|_| "ファイル状態の保存に失敗しました".to_string())?
        .insert(id.clone(), path.clone());
    Ok(ReservedPath {
        id,
        path: path.to_string_lossy().into_owned(),
    })
}

fn read_limited_file(path: &Path) -> Result<Vec<u8>, String> {
    let meta = fs::metadata(path).map_err(|e| format!("ファイル情報を確認できません: {e}"))?;
    if meta.len() > MAX_IMPORT_BYTES {
        return Err(format!(
            "{} を超えるファイルは読み込めません",
            format_bytes(MAX_IMPORT_BYTES)
        ));
    }
    fs::read(path).map_err(|e| format!("ファイルを読み込めません: {e}"))
}

fn write_limited_file(path: &Path, bytes: &[u8]) -> Result<(), String> {
    if bytes.len() > MAX_WRITE_BYTES {
        return Err(format!(
            "{} を超えるファイルは保存できません",
            format_bytes(MAX_WRITE_BYTES as u64)
        ));
    }
    let mut file = fs::File::create(path).map_err(|e| format!("ファイルを作成できません: {e}"))?;
    file.write_all(bytes)
        .map_err(|e| format!("ファイルを書き込めません: {e}"))
}

fn normalize_output_path(path: PathBuf) -> Result<PathBuf, String> {
    let parent = path
        .parent()
        .ok_or_else(|| "保存先パスが不正です".to_string())?;
    let parent =
        fs::canonicalize(parent).map_err(|e| format!("保存先フォルダを確認できません: {e}"))?;
    let filename = path
        .file_name()
        .and_then(|s| s.to_str())
        .ok_or_else(|| "保存先ファイル名が不正です".to_string())?;
    Ok(parent.join(sanitize_filename(filename, "document.pdf")?))
}

fn sanitize_filename(input: &str, fallback: &str) -> Result<String, String> {
    let trimmed = input.trim();
    let name = if trimmed.is_empty() {
        fallback
    } else {
        trimmed
    };
    if name.contains('/') || name.contains('\\') || name == "." || name == ".." {
        return Err("ファイル名にパス区切りは使えません".into());
    }
    let Some(file_name) = Path::new(name).file_name().and_then(|s| s.to_str()) else {
        return Err("ファイル名が不正です".into());
    };
    if file_name != name {
        return Err("ファイル名が不正です".into());
    }
    Ok(file_name.to_string())
}

fn normalize_exts(exts: Vec<String>) -> Vec<String> {
    let mut out = Vec::new();
    for ext in exts {
        let ext = ext.trim().trim_start_matches('.').to_ascii_lowercase();
        if !ext.is_empty() && ext.chars().all(|c| c.is_ascii_alphanumeric()) && !out.contains(&ext)
        {
            out.push(ext);
        }
    }
    if out.is_empty() {
        out.push("pdf".into());
    }
    out
}

fn format_bytes(bytes: u64) -> String {
    let mib = bytes as f64 / 1024.0 / 1024.0;
    format!("{mib:.0}MB")
}
