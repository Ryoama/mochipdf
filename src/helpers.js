// ========== Helpers ==========

export const $ = (sel) => document.querySelector(sel);
export const $$ = (sel) => Array.from(document.querySelectorAll(sel));

export const MAX_FILE_BYTES = 250 * 1024 * 1024;

export function formatBytes(bytes) {
  const mb = bytes / 1024 / 1024;
  return `${Math.round(mb)}MB`;
}

export function assertFileSize(size, name = "ファイル", maxBytes = MAX_FILE_BYTES) {
  if (size > maxBytes) {
    throw new Error(`${name} は ${formatBytes(maxBytes)} を超えるため読み込めません`);
  }
}

export function el(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") e.className = v;
    else if (k === "style") Object.assign(e.style, v);
    else if (k.startsWith("on") && typeof v === "function") {
      e.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (v === true) e.setAttribute(k, "");
    else if (v !== false && v != null) e.setAttribute(k, v);
  }
  for (const c of children) {
    if (c == null) continue;
    e.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return e;
}

export function toast(msg, kind = "info", ms = 2400) {
  const c = $("#toast-container");
  const t = el("div", { class: `toast ${kind}` }, msg);
  c.appendChild(t);
  setTimeout(() => {
    t.style.transition = "opacity 0.3s, transform 0.3s";
    t.style.opacity = "0";
    t.style.transform = "translateY(8px)";
    setTimeout(() => t.remove(), 300);
  }, ms);
}

export function setStatus(msg) {
  $("#status-text").textContent = msg;
}

export function setFileStatus(msg) {
  $("#status-file").textContent = msg;
}

export function showModal(id) {
  $(id).hidden = false;
}
export function hideModal(id) {
  $(id).hidden = true;
}

// "1,3,5-8" → [0,2,4,5,6,7]  (0-based)
export function parsePageRange(spec, pageCount) {
  const out = new Set();
  for (const part of spec.split(",")) {
    const p = part.trim();
    if (!p) continue;
    const m = p.match(/^(\d+)\s*-\s*(\d+)$/);
    if (m) {
      const a = Math.max(1, parseInt(m[1], 10));
      const b = Math.min(pageCount, parseInt(m[2], 10));
      for (let i = a; i <= b; i++) out.add(i - 1);
    } else if (/^\d+$/.test(p)) {
      const n = parseInt(p, 10);
      if (n >= 1 && n <= pageCount) out.add(n - 1);
    }
  }
  return Array.from(out).sort((a, b) => a - b);
}

export function downloadBlob(bytes, filename) {
  const blob = bytes instanceof Blob ? bytes : new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 0);
}

export function basename(path, ext = ".pdf") {
  const name = (path || "").split(/[\\/]/).pop() || "untitled";
  return name.endsWith(ext) ? name.slice(0, -ext.length) : name;
}

export function readFileAsBytes(file, maxBytes = MAX_FILE_BYTES) {
  if (file?.size != null) assertFileSize(file.size, file.name, maxBytes);
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(new Uint8Array(r.result));
    r.onerror = reject;
    r.readAsArrayBuffer(file);
  });
}

export function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}
