// ========== Tauri / ブラウザ 共通ファイル I/O ブリッジ ==========
import { open as openDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";
import { readFile, writeFile } from "@tauri-apps/plugin-fs";
import { join as pathJoin } from "@tauri-apps/api/path";
import { downloadBlob, readFileAsBytes } from "./helpers.js";

// Tauri 2 では window.__TAURI_INTERNALS__ が定義される
export const isTauri = typeof window !== "undefined"
  && (!!window.__TAURI_INTERNALS__ || !!window.__TAURI__);

function basenameNoExt(path, ext = ".pdf") {
  const name = (path || "").split(/[\\/]/).pop() || "untitled";
  return name.endsWith(ext) ? name.slice(0, -ext.length) : name;
}

// ファイル選択。multi=true なら配列、false なら単一。null/[] でキャンセル。
export async function pickFiles({ accept = "application/pdf", multi = false, exts = ["pdf"], title } = {}) {
  if (isTauri) {
    const sel = await openDialog({
      multiple: multi,
      title,
      filters: [{ name: exts.map((e) => e.toUpperCase()).join("/"), extensions: exts }],
    });
    if (!sel) return null;
    const list = Array.isArray(sel) ? sel : [sel];
    const out = [];
    for (const path of list) {
      const bytes = await readFile(path);
      const name = path.split(/[\\/]/).pop() || "file";
      out.push({ bytes, name, path });
    }
    return multi ? out : out[0];
  }
  // ブラウザフォールバック
  return await new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    if (multi) input.multiple = true;
    input.style.display = "none";
    document.body.appendChild(input);
    input.addEventListener("change", async () => {
      const files = Array.from(input.files || []);
      input.remove();
      if (!files.length) return resolve(null);
      const out = [];
      for (const f of files) {
        out.push({ bytes: await readFileAsBytes(f), name: f.name, path: null });
      }
      resolve(multi ? out : out[0]);
    });
    input.click();
  });
}

// ファイル保存。bytes を保存先に書き込み、保存先 path or filename を返す。
// キャンセル時は null。
export async function saveFile(bytes, suggestedName) {
  if (isTauri) {
    const path = await saveDialog({
      defaultPath: suggestedName,
      filters: [{ name: "PDF", extensions: ["pdf"] }],
    });
    if (!path) return null;
    await writeFile(path, bytes);
    return path;
  }
  downloadBlob(bytes, suggestedName);
  return suggestedName;
}

// ディレクトリ選択(分割で複数ファイル一括保存用)
export async function pickDirectory(title = "保存先フォルダを選択") {
  if (isTauri) {
    const dir = await openDialog({
      directory: true,
      multiple: false,
      title,
    });
    return dir || null;
  }
  return null;
}

export async function writeBytesToPath(path, bytes) {
  if (!isTauri) throw new Error("not in tauri");
  await writeFile(path, bytes);
}

export async function joinPath(...parts) {
  if (isTauri) return await pathJoin(...parts);
  return parts.join("/");
}

export { basenameNoExt };
