// ========== Tauri / ブラウザ 共通ファイル I/O ブリッジ ==========
import { invoke, isTauri as detectTauri } from "@tauri-apps/api/core";
import {
  assertFileSize,
  downloadBlob,
  MAX_FILE_BYTES,
  readFileAsBytes,
  toast,
} from "./helpers.js";

export const isTauri = typeof window !== "undefined" && detectTauri();

function basenameNoExt(path, ext = ".pdf") {
  const name = (path || "").split(/[\\/]/).pop() || "untitled";
  return name.endsWith(ext) ? name.slice(0, -ext.length) : name;
}

function toBytes(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  return Uint8Array.from(value);
}

function notifyFileError(error) {
  console.error(error);
  toast(error?.message || String(error), "error", 5000);
}

async function readPickedFile(file) {
  const data = await invoke("mochi_read_picked_file", { id: file.id });
  const bytes = toBytes(data);
  assertFileSize(bytes.byteLength, file.name);
  return { bytes, name: file.name, path: file.path };
}

async function writeReservedFile(id, bytes) {
  const data = toBytes(bytes);
  if (data.byteLength > 512 * 1024 * 1024) {
    throw new Error("512MBを超えるファイルは保存できません");
  }
  await invoke("mochi_write_reserved_file", data, { headers: { id } });
}

// ファイル選択。multi=true なら配列、false なら単一。null/[] でキャンセル。
export async function pickFiles({ accept = "application/pdf", multi = false, exts = ["pdf"], title } = {}) {
  if (isTauri) {
    try {
      const picked = await invoke("mochi_pick_files", {
        options: { multi, exts, title },
      });
      if (!picked?.length) return null;
      const out = [];
      for (const file of picked) out.push(await readPickedFile(file));
      return multi ? out : out[0];
    } catch (error) {
      notifyFileError(error);
      return null;
    }
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
      try {
        for (const f of files) {
          out.push({ bytes: await readFileAsBytes(f), name: f.name, path: null });
        }
      } catch (error) {
        notifyFileError(error);
        return resolve(null);
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
    try {
      const reserved = await invoke("mochi_reserve_save_file", { suggestedName });
      if (!reserved) return null;
      await writeReservedFile(reserved.id, bytes);
      return reserved.path;
    } catch (error) {
      notifyFileError(error);
      return null;
    }
  }
  downloadBlob(bytes, suggestedName);
  return suggestedName;
}

// ディレクトリ選択(分割で複数ファイル一括保存用)
export async function pickDirectory(title = "保存先フォルダを選択") {
  if (isTauri) {
    try {
      return await invoke("mochi_pick_directory", { title });
    } catch (error) {
      notifyFileError(error);
      return null;
    }
  }
  return null;
}

export async function writeBytesToDirectory(dir, filename, bytes) {
  if (!isTauri) throw new Error("not in tauri");
  try {
    const reserved = await invoke("mochi_reserve_directory_file", {
      dirId: dir.id,
      filename,
    });
    await writeReservedFile(reserved.id, bytes);
    return reserved.path;
  } catch (error) {
    notifyFileError(error);
    throw error;
  }
}

export { basenameNoExt, MAX_FILE_BYTES };
