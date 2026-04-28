// ========== もちPDF メインエントリ ==========
import { PDFDocument } from "pdf-lib";
import { PdfEngine } from "./pdf-engine.js";
import {
  pickFiles, saveFile, pickDirectory, writeBytesToDirectory, isTauri,
} from "./tauri-bridge.js";
import {
  $, $$, el, toast, setStatus, setFileStatus, showModal, hideModal,
  parsePageRange, downloadBlob, readFileAsBytes,
} from "./helpers.js";

const engine = new PdfEngine();
let currentPage = 0;             // viewer current page
let currentScale = 1.4;          // viewer zoom
let dirty = false;
let selectedPages = new Set();   // editor multi-selection
let lastSelectedPage = null;     // for shift-range selection
let currentView = "home";
let noteMode = false;            // 付箋配置モード

// ========== 起動 ==========
window.addEventListener("DOMContentLoaded", () => {
  bindContextMenuGuard();
  bindSidebarToggle();
  bindNavbar();
  bindHomeCards();
  bindViewerTopbar();
  bindViewerSide();
  bindEditorTopbar();
  bindEditorGridDnD();
  bindModals();
  bindDragDrop();
  bindKeyboard();
  setStatus(isTauri ? "準備OK" : "ブラウザモード");
  // localStorage から畳み状態を復元
  if (localStorage.getItem("sidebar-collapsed") === "1") {
    const app = document.getElementById("app");
    app.classList.remove("sidebar-expanded");
    app.classList.add("sidebar-collapsed");
    const label = $("#btn-sidebar-toggle .nav-label");
    if (label) label.textContent = "ひらく";
    $("#btn-sidebar-toggle").title = "サイドバーをひらく";
  }
});

function bindContextMenuGuard() {
  document.addEventListener("contextmenu", (ev) => {
    if (ev.target?.closest?.("input, textarea, [contenteditable='true']")) return;
    ev.preventDefault();
  });
}

// ========== サイドバー折りたたみ ==========
function bindSidebarToggle() {
  $("#btn-sidebar-toggle").addEventListener("click", () => {
    const app = $("#app");
    const collapsed = app.classList.toggle("sidebar-collapsed");
    app.classList.toggle("sidebar-expanded", !collapsed);
    localStorage.setItem("sidebar-collapsed", collapsed ? "1" : "0");
    const label = $("#btn-sidebar-toggle .nav-label");
    if (label) label.textContent = collapsed ? "ひらく" : "たたむ";
    $("#btn-sidebar-toggle").title = collapsed ? "サイドバーをひらく" : "サイドバーをたたむ";
  });
}

// ========== ビュー切替 ==========
function setView(name) {
  currentView = name;
  for (const v of $$(".view")) v.classList.toggle("active", v.dataset.view === name);
  for (const n of $$(".navbar-menu .nav-item")) {
    n.classList.toggle("active", n.dataset.view === name);
  }
  // view切替時にそのビューを最新化
  if (name === "editor" && engine.viewerDoc) refreshEditorGrid();
  if (name === "viewer" && engine.viewerDoc) renderViewerPage();
}

function bindNavbar() {
  for (const item of $$(".navbar-menu .nav-item")) {
    item.addEventListener("click", () => {
      const target = item.dataset.view;
      if (target === "merge") {
        openMergeModal();
      } else if (target === "viewer" || target === "editor") {
        if (engine.viewerDoc) {
          setView(target);
        } else {
          setView(target);
          openPdf();
        }
      } else {
        setView("home");
      }
    });
  }
}

function bindHomeCards() {
  for (const card of $$(".home-card")) {
    card.addEventListener("click", () => {
      const action = card.dataset.action;
      if (action === "merge") {
        openMergeModal();
      } else if (action === "viewer") {
        setView("viewer");
        if (!engine.viewerDoc) openPdf();
      } else if (action === "editor") {
        setView("editor");
        if (!engine.viewerDoc) openPdf();
      }
    });
  }
}

// ========== ファイル ==========
async function openPdf() {
  const sel = await pickFiles({ multi: false });
  if (!sel) return;
  await loadBytes(sel.bytes, sel.name);
}

async function loadBytes(bytes, name) {
  try {
    setStatus("読み込み中…");
    await engine.loadFromBytes(bytes, name);
    currentPage = 0;
    selectedPages.clear();
    lastSelectedPage = null;
    dirty = false;
    enableEditingUI(true);
    if (currentView === "home") setView("viewer");
    await refreshAll();
    setStatus(`${name} を開きました`);
    setFileStatus(`${name} (${engine.pageCount}p)`);
    toast("PDFを開きました", "success");
  } catch (e) {
    console.error(e);
    toast("PDFの読み込みに失敗しました", "error");
    setStatus("読み込み失敗");
  }
}

function enableEditingUI(on) {
  const ids = [
    "btn-save", "btn-save-editor",
    "btn-zoom-in", "btn-zoom-out", "btn-zoom-fit",
    "btn-page-prev", "btn-page-next", "page-input",
    "btn-add-note", "btn-add-bookmark",
    "btn-select-all", "btn-select-none",
    "btn-insert-blank", "btn-insert-image", "btn-insert-pdf",
    "btn-split",
  ];
  for (const id of ids) {
    const e = $("#" + id);
    if (e) e.disabled = !on;
  }
  refreshSelectionUI();
}

// ========== 閲覧ビューのトップバー ==========
function bindViewerTopbar() {
  $("#btn-open").addEventListener("click", openPdf);
  $("#btn-save").addEventListener("click", saveCurrent);
  $("#btn-zoom-in").addEventListener("click", () => changeZoom(1.2));
  $("#btn-zoom-out").addEventListener("click", () => changeZoom(1 / 1.2));
  $("#btn-zoom-fit").addEventListener("click", fitWidth);
  $("#btn-page-prev").addEventListener("click", () => goToPage(currentPage - 1));
  $("#btn-page-next").addEventListener("click", () => goToPage(currentPage + 1));
  $("#page-input").addEventListener("change", (e) => {
    const v = parseInt(e.target.value, 10);
    if (!isNaN(v)) goToPage(v - 1);
  });
  $("#btn-toggle-side").addEventListener("click", toggleSidePanel);
  // localStorage から復元
  if (localStorage.getItem("side-hidden") === "1") {
    $("#viewer-body").classList.add("side-hidden");
  } else {
    $("#btn-toggle-side").classList.add("side-active");
  }
}

function toggleSidePanel() {
  const body = $("#viewer-body");
  const btn = $("#btn-toggle-side");
  const hidden = body.classList.toggle("side-hidden");
  btn.classList.toggle("side-active", !hidden);
  localStorage.setItem("side-hidden", hidden ? "1" : "0");
}

function bindViewerSide() {
  for (const tab of $$(".editor-tabs .etab")) {
    tab.addEventListener("click", () => {
      $$(".editor-tabs .etab").forEach((t) => t.classList.remove("active"));
      $$(".etab-panel").forEach((p) => p.classList.remove("active"));
      tab.classList.add("active");
      $(`.etab-panel[data-epanel="${tab.dataset.etab}"]`).classList.add("active");
    });
  }
  $("#btn-add-note").addEventListener("click", enterNoteMode);
  $("#btn-exit-note-mode").addEventListener("click", exitNoteMode);
  $("#btn-add-bookmark").addEventListener("click", addBookmarkHere);
}

function enterNoteMode() {
  if (!engine.viewerDoc) return;
  // 閲覧ビューに切り替え(編集ビューでボタン押された場合を想定)
  if (currentView !== "viewer") setView("viewer");
  noteMode = true;
  document.querySelector(".viewer-main")?.classList.add("note-mode");
  $("#note-mode-banner").hidden = false;
}

function exitNoteMode() {
  noteMode = false;
  document.querySelector(".viewer-main")?.classList.remove("note-mode");
  $("#note-mode-banner").hidden = true;
}

async function addBookmarkHere() {
  if (!engine.viewerDoc) return;
  const title = await askText({
    title: "しおりを追加",
    help: `現在のページ(${currentPage + 1})にしおりを挟みます`,
    defaultValue: `ページ ${currentPage + 1}`,
    placeholder: "しおりのタイトル",
  });
  if (title === null) return;
  engine.addBookmark(title, currentPage);
  dirty = true;
  refreshBookmarks();
  toast("しおりを追加しました", "success");
}

async function saveCurrent() {
  if (!engine.viewerDoc) return;
  setStatus("保存中…");
  try {
    const bytes = await engine.exportWithNotes();
    const suggested = engine.fileName.replace(/\.pdf$/i, "") + "_edited.pdf";
    const result = await saveFile(bytes, suggested);
    if (result) {
      dirty = false;
      toast("保存しました", "success");
      setStatus("保存完了");
    } else {
      setStatus("キャンセル");
    }
  } catch (e) {
    console.error(e);
    toast("保存に失敗しました", "error");
  }
}

// ========== 編集ビューのトップバー ==========
function bindEditorTopbar() {
  $("#btn-open-editor").addEventListener("click", openPdf);
  $("#btn-save-editor").addEventListener("click", saveCurrent);
  $("#btn-select-all").addEventListener("click", () => {
    selectedPages = new Set(Array.from({ length: engine.pageCount }, (_, i) => i));
    refreshSelectionUI();
  });
  $("#btn-select-none").addEventListener("click", () => {
    selectedPages.clear();
    refreshSelectionUI();
  });
  $("#btn-rotate-l-sel").addEventListener("click", () => rotateSelected(-90));
  $("#btn-rotate-r-sel").addEventListener("click", () => rotateSelected(90));
  $("#btn-delete-sel").addEventListener("click", deleteSelected);
  $("#btn-extract-sel").addEventListener("click", extractSelected);
  $("#btn-insert-blank").addEventListener("click", insertBlankPage);
  $("#btn-insert-image").addEventListener("click", insertImagePage);
  $("#btn-insert-pdf").addEventListener("click", insertPdfPages);
  $("#btn-split").addEventListener("click", () => showModal("#modal-split"));
}

async function rotateSelected(delta) {
  if (!engine.viewerDoc || selectedPages.size === 0) return;
  setStatus("回転中…");
  // ソート逆順で処理するのが安全(indexずれない)
  const indices = Array.from(selectedPages).sort((a, b) => a - b);
  for (const idx of indices) {
    await engine.rotatePage(idx, delta);
  }
  dirty = true;
  await refreshAll();
  toast(`${indices.length}ページを回転しました`, "success");
}

async function deleteSelected() {
  if (!engine.viewerDoc || selectedPages.size === 0) return;
  if (selectedPages.size >= engine.pageCount) {
    toast("全ページは削除できません", "error");
    return;
  }
  const indices = Array.from(selectedPages);
  await engine.deletePages(indices);
  dirty = true;
  selectedPages.clear();
  if (currentPage >= engine.pageCount) currentPage = engine.pageCount - 1;
  await refreshAll();
  toast(`${indices.length}ページを削除しました`);
}

async function extractSelected() {
  if (!engine.viewerDoc || selectedPages.size === 0) return;
  const indices = Array.from(selectedPages).sort((a, b) => a - b);
  setStatus("抽出中…");
  const bytes = await engine.extractPages(indices);
  const suggested = engine.fileName.replace(/\.pdf$/i, "") + `_extract_${indices.length}p.pdf`;
  await saveFile(bytes, suggested);
  toast(`${indices.length}ページを抽出しました`, "success");
  setStatus("抽出完了");
}

async function insertBlankPage() {
  if (!engine.viewerDoc) return;
  const afterIdx = selectedPages.size > 0
    ? Math.max(...Array.from(selectedPages))
    : engine.pageCount - 1;
  setStatus("空白ページを挿入中…");
  await engine.insertBlankPage(afterIdx);
  dirty = true;
  await refreshAll();
  toast("空白ページを追加しました", "success");
}

async function insertImagePage() {
  if (!engine.viewerDoc) return;
  const sel = await pickFiles({
    accept: "image/png,image/jpeg",
    exts: ["png", "jpg", "jpeg"],
  });
  if (!sel) return;
  const lower = sel.name.toLowerCase();
  const mime = lower.endsWith(".png") ? "image/png" : "image/jpeg";
  const afterIdx = selectedPages.size > 0
    ? Math.max(...Array.from(selectedPages))
    : engine.pageCount - 1;
  setStatus("画像ページを挿入中…");
  await engine.insertImagePage(afterIdx, sel.bytes, mime);
  dirty = true;
  await refreshAll();
  toast("画像ページを追加しました", "success");
}

async function insertPdfPages() {
  if (!engine.viewerDoc) return;
  const sel = await pickFiles({ multi: false });
  if (!sel) return;
  const afterIdx = selectedPages.size > 0
    ? Math.max(...Array.from(selectedPages))
    : engine.pageCount - 1;
  setStatus("PDFのページを挿入中…");
  await engine.insertPdfPages(afterIdx, sel.bytes);
  dirty = true;
  await refreshAll();
  toast(`${sel.name} のページを追加しました`, "success");
}

// ========== ズーム ==========
function changeZoom(factor) {
  currentScale = Math.max(0.4, Math.min(4, currentScale * factor));
  $("#zoom-label").textContent = `${Math.round((currentScale / 1.4) * 100)}%`;
  renderViewerPage();
}

async function fitWidth() {
  if (!engine.viewerDoc) return;
  const wrap = $("#viewer");
  const page = await engine.viewerDoc.getPage(currentPage + 1);
  const v = page.getViewport({ scale: 1 });
  const target = wrap.clientWidth - 48;
  currentScale = target / v.width;
  $("#zoom-label").textContent = `${Math.round((currentScale / 1.4) * 100)}%`;
  renderViewerPage();
}

// ========== 閲覧ページ描画 ==========
async function renderViewerPage() {
  if (!engine.viewerDoc) return;
  $("#viewer-empty").hidden = true;
  $("#canvas-wrap").hidden = false;
  const canvas = $("#page-canvas");
  const size = await engine.renderPage(currentPage, canvas, currentScale);
  $("#page-input").value = currentPage + 1;
  $("#page-total").textContent = engine.pageCount;
  renderNotesOverlay(size);
}

function renderNotesOverlay(pageSize) {
  const layer = $("#annot-layer");
  layer.innerHTML = "";
  if (!pageSize) return;
  const wrap = $("#canvas-wrap");
  wrap.style.width = `${pageSize.width}px`;
  wrap.style.height = `${pageSize.height}px`;
  for (const note of engine.notes) {
    if (note.page !== currentPage) continue;
    const noteEl = el("div", {
      class: "annot-note",
      title: "ドラッグで移動 / クリックで編集",
      style: { left: `${note.x * 100}%`, top: `${note.y * 100}%` },
    });
    const textEl = el("div", {
      class: note.text ? "annot-text" : "annot-text annot-text-empty",
    }, note.text || "(クリックで編集)");
    const delBtn = el("button", { class: "annot-del", title: "削除", type: "button" }, "✕");
    delBtn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      ev.preventDefault();
      engine.removeNote(note.id);
      dirty = true;
      renderViewerPage();
      refreshNoteList();
    });
    noteEl.append(textEl, delBtn);
    bindNoteDragAndEdit(noteEl, note.id);
    layer.appendChild(noteEl);
  }
  const canvas = $("#page-canvas");
  canvas.onclick = (ev) => {
    // 付箋モード中、または Cmd/Ctrl 修飾キー押下で付箋を配置
    if (!noteMode && !(ev.ctrlKey || ev.metaKey)) return;
    const rect = canvas.getBoundingClientRect();
    const rx = (ev.clientX - rect.left) / rect.width;
    const ry = (ev.clientY - rect.top) / rect.height;
    addNoteAt(rx, ry);
  };
}

// 付箋のドラッグ移動 + クリック(未移動)で編集
// 注: 閉包で note オブジェクトを保持するとエンジン側の更新(オブジェクト差し替え)で
// 参照が古くなるため、ID だけ保持して都度 engine.notes から参照解決する。
function bindNoteDragAndEdit(noteEl, noteId) {
  let dragging = false;
  let moved = false;
  let startMouseX = 0, startMouseY = 0;
  let startNoteX = 0, startNoteY = 0;
  let newX = 0, newY = 0;

  const getNote = () => engine.notes.find((n) => n.id === noteId);

  const onMouseMove = (ev) => {
    if (!dragging) return;
    const dx = ev.clientX - startMouseX;
    const dy = ev.clientY - startMouseY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved = true;
    const wrap = $("#canvas-wrap");
    const rect = wrap.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    newX = Math.max(0, Math.min(1, startNoteX + dx / rect.width));
    newY = Math.max(0, Math.min(1, startNoteY + dy / rect.height));
    noteEl.style.left = `${newX * 100}%`;
    noteEl.style.top = `${newY * 100}%`;
  };

  const onMouseUp = () => {
    if (!dragging) return;
    dragging = false;
    noteEl.classList.remove("dragging");
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);

    if (moved) {
      engine.updateNote(noteId, { x: newX, y: newY });
      dirty = true;
    } else {
      editNote(noteId);
    }
  };

  noteEl.addEventListener("mousedown", (ev) => {
    if (ev.target.closest(".annot-del")) return;
    const note = getNote();
    if (!note) return;
    ev.preventDefault();
    ev.stopPropagation();
    dragging = true;
    moved = false;
    startMouseX = ev.clientX;
    startMouseY = ev.clientY;
    startNoteX = note.x;
    startNoteY = note.y;
    newX = note.x;
    newY = note.y;
    noteEl.classList.add("dragging");
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  });
}

async function addNoteAt(x, y) {
  // 付箋モード中なら配置後にモードを抜ける
  const wasNoteMode = noteMode;
  if (wasNoteMode) exitNoteMode();
  const text = await askText({
    title: "付箋を追加",
    help: `ページ ${currentPage + 1} の指定位置にメモを残します`,
    defaultValue: "",
    placeholder: "例: ここ重要!",
  });
  if (text === null) return;
  engine.addNote(currentPage, x, y, text);
  dirty = true;
  renderViewerPage();
  refreshNoteList();
  toast("付箋を貼りました", "success");
}

async function editNote(id) {
  const note = engine.notes.find((n) => n.id === id);
  if (!note) return;
  const result = await askText({
    title: "付箋を編集",
    help: "空欄にして「OK」で削除できます",
    defaultValue: note.text || "",
    placeholder: "メモ内容",
    showDelete: true,
  });
  if (result === null) return;
  if (result === "__DELETE__" || result === "") engine.removeNote(id);
  else engine.updateNote(id, { text: result });
  dirty = true;
  renderViewerPage();
  refreshNoteList();
}

// ========== 共通入力モーダル ==========
function askText({ title = "入力", help = "", defaultValue = "", placeholder = "", showDelete = false } = {}) {
  return new Promise((resolve) => {
    const modal = $("#modal-input");
    $("#modal-input-title").textContent = title;
    const helpEl = $("#modal-input-help");
    if (help) { helpEl.textContent = help; helpEl.hidden = false; }
    else helpEl.hidden = true;
    const ta = $("#modal-input-textarea");
    ta.value = defaultValue;
    ta.placeholder = placeholder;

    const okBtn = $("#modal-input-ok");
    const cancelBtn = $("#modal-input-cancel");
    const delBtn = $("#modal-input-delete");
    delBtn.hidden = !showDelete;

    let done = false;
    const cleanup = () => {
      okBtn.removeEventListener("click", onOk);
      cancelBtn.removeEventListener("click", onCancel);
      delBtn.removeEventListener("click", onDelete);
      modal.removeEventListener("click", onBackdrop);
      modal.querySelector("[data-close-modal]")?.removeEventListener("click", onCancel);
      window.removeEventListener("keydown", onKey, true);
    };
    const finish = (val) => {
      if (done) return;
      done = true;
      modal.hidden = true;
      cleanup();
      resolve(val);
    };
    const onOk = () => finish(ta.value);
    const onCancel = () => finish(null);
    const onDelete = () => finish("__DELETE__");
    const onBackdrop = (ev) => { if (ev.target === modal) finish(null); };
    const onKey = (ev) => {
      if (ev.key === "Escape") { ev.preventDefault(); ev.stopPropagation(); finish(null); }
      else if (ev.key === "Enter" && (ev.metaKey || ev.ctrlKey)) { ev.preventDefault(); finish(ta.value); }
    };

    okBtn.addEventListener("click", onOk);
    cancelBtn.addEventListener("click", onCancel);
    delBtn.addEventListener("click", onDelete);
    modal.addEventListener("click", onBackdrop);
    modal.querySelector("[data-close-modal]")?.addEventListener("click", onCancel);
    window.addEventListener("keydown", onKey, true);

    modal.hidden = false;
    setTimeout(() => ta.focus(), 50);
  });
}

function refreshNoteList() {
  const list = $("#note-list");
  list.innerHTML = "";
  if (engine.notes.length === 0) {
    list.appendChild(el("div", { class: "empty-state" },
      "Cmd/Ctrl+クリックで\nページに付箋を追加"));
    return;
  }
  for (const note of engine.notes) {
    const item = el("div", { class: "note-item", title: "クリックでページに移動" },
      el("div", { class: "note-page" }, `📄 ページ ${note.page + 1}`),
      el("div", { class: "note-text" }, note.text || "(空)"),
    );
    const del = el("button", { class: "note-del", title: "削除" }, "✕");
    del.addEventListener("click", (ev) => {
      ev.stopPropagation();
      engine.removeNote(note.id);
      dirty = true;
      refreshNoteList();
      renderViewerPage();
    });
    item.appendChild(del);
    item.addEventListener("click", () => goToPage(note.page));
    list.appendChild(item);
  }
}

function goToPage(idx) {
  if (idx < 0 || idx >= engine.pageCount) return;
  currentPage = idx;
  if (currentView === "viewer") renderViewerPage();
  else setView("viewer");
}

// ========== 編集グリッド ==========
async function refreshEditorGrid() {
  const grid = $("#editor-grid");
  const empty = $("#editor-empty");
  grid.innerHTML = "";
  if (!engine.viewerDoc || engine.pageCount === 0) {
    empty.hidden = false;
    grid.hidden = true;
    return;
  }
  empty.hidden = true;
  grid.hidden = false;

  for (let i = 0; i < engine.pageCount; i++) {
    const tile = el("div", {
      class: "page-tile",
      "data-page": i,
      title: "ドラッグ&ドロップで並べ替え",
      "aria-label": `ページ ${i + 1}`,
      draggable: "true",
    });
    const canvasWrap = el("div", { class: "tile-canvas-wrap" });
    const canvas = el("canvas");
    canvasWrap.appendChild(canvas);

    const check = el("div", { class: "tile-check" }, "✓");
    const footer = el("div", { class: "tile-footer" });
    const num = el("div", { class: "tile-num" }, `ページ ${i + 1}`);
    const actions = el("div", { class: "tile-actions" });
    const rotBtn = el("button", { class: "tile-action", title: "右回転" }, "↻");
    const delBtn = el("button", { class: "tile-action tile-del", title: "削除" }, "🗑");

    rotBtn.addEventListener("click", async (ev) => {
      ev.stopPropagation();
      await engine.rotatePage(i, 90);
      dirty = true;
      await refreshAll();
    });
    delBtn.addEventListener("click", async (ev) => {
      ev.stopPropagation();
      if (engine.pageCount <= 1) {
        toast("最後のページは削除できません", "error");
        return;
      }
      await engine.deletePages([i]);
      dirty = true;
      selectedPages.delete(i);
      await refreshAll();
    });
    actions.append(rotBtn, delBtn);
    footer.append(num, actions);
    tile.append(canvasWrap, check, footer);

    tile.addEventListener("click", (ev) => {
      if (ev.shiftKey && lastSelectedPage !== null) {
        const a = Math.min(lastSelectedPage, i);
        const b = Math.max(lastSelectedPage, i);
        for (let k = a; k <= b; k++) selectedPages.add(k);
      } else if (ev.metaKey || ev.ctrlKey) {
        if (selectedPages.has(i)) selectedPages.delete(i);
        else selectedPages.add(i);
        lastSelectedPage = i;
      } else {
        selectedPages.clear();
        selectedPages.add(i);
        lastSelectedPage = i;
      }
      currentPage = i;
      refreshSelectionUI();
    });
    tile.addEventListener("dblclick", () => {
      currentPage = i;
      setView("viewer");
    });

    bindTileDrag(tile, i);

    grid.appendChild(tile);
    engine.renderThumb(i, canvas, 220).catch(() => {});
  }
  refreshSelectionUI();
}

function refreshSelectionUI() {
  const has = engine.viewerDoc != null;
  const n = selectedPages.size;
  const info = $("#selection-info");
  if (info) {
    info.textContent = !has ? "PDF未読込"
      : n === 0 ? "ページ未選択"
      : `${n}ページ選択中`;
  }
  // 選択系ボタンの有効化
  for (const id of ["btn-rotate-l-sel", "btn-rotate-r-sel", "btn-delete-sel", "btn-extract-sel"]) {
    const e = $("#" + id);
    if (e) e.disabled = !has || n === 0;
  }
  // タイルのクラス更新
  for (const t of $$(".page-tile")) {
    const p = parseInt(t.dataset.page, 10);
    t.classList.toggle("selected", selectedPages.has(p));
  }
}

// ========== タイル D&D ==========
// dragstart/dragend はタイル、dragover/drop はグリッドで集約して
// タイル間のギャップに落としても反応するようにする。
let tileDragFrom = null;

function bindTileDrag(tile, index) {
  tile.addEventListener("dragstart", (ev) => {
    tileDragFrom = index;
    if (!selectedPages.has(index)) {
      selectedPages.clear();
      selectedPages.add(index);
      refreshSelectionUI();
    }
    tile.classList.add("dragging");
    if (ev.dataTransfer) {
      ev.dataTransfer.effectAllowed = "move";
      ev.dataTransfer.setData("text/plain", String(index));
    }
  });
  tile.addEventListener("dragend", () => {
    tile.classList.remove("dragging");
    clearGridDropIndicator();
    tileDragFrom = null;
  });
}

function clearGridDropIndicator() {
  $$(".page-tile").forEach((t) => t.classList.remove("drop-before", "drop-after"));
}

function findTileDropTarget(x, y) {
  const tiles = $$(".page-tile");
  if (tiles.length === 0) return null;
  let closest = null;
  let bestScore = Infinity;
  for (const tile of tiles) {
    const r = tile.getBoundingClientRect();
    const cx = (r.left + r.right) / 2;
    // 行の近さ(y方向)を重く、列の近さ(x方向)を軽く
    const dyOut = Math.max(0, Math.max(r.top - y, y - r.bottom));
    const dxOut = Math.max(0, Math.max(r.left - x, x - r.right));
    const score = dyOut * 4 + dxOut; // 同じ行なら dyOut=0
    if (score < bestScore) {
      bestScore = score;
      closest = { tile, r, cx };
    }
  }
  if (!closest) return null;
  const idx = parseInt(closest.tile.dataset.page, 10);
  const before = x < closest.cx;
  return { tile: closest.tile, index: idx, before };
}

function updateGridDropIndicator(pos) {
  clearGridDropIndicator();
  if (!pos) return;
  pos.tile.classList.toggle("drop-before", pos.before);
  pos.tile.classList.toggle("drop-after", !pos.before);
}

function getAdjustedMoveIndex(from, target) {
  const total = engine.pageCount;
  return Math.min(total - 1, target > from ? target - 1 : target);
}

function mapPageIndexAfterMove(page, from, target) {
  const movedTo = getAdjustedMoveIndex(from, target);
  if (page === from) return movedTo;
  if (from < target) {
    if (page > from && page <= movedTo) return page - 1;
  } else if (from > target) {
    if (page >= movedTo && page < from) return page + 1;
  }
  return page;
}

function bindEditorGridDnD() {
  const grid = $("#editor-grid");
  if (!grid) return;

  grid.addEventListener("dragover", (ev) => {
    if (tileDragFrom == null) return;
    ev.preventDefault();
    if (ev.dataTransfer) ev.dataTransfer.dropEffect = "move";
    const pos = findTileDropTarget(ev.clientX, ev.clientY);
    updateGridDropIndicator(pos);
  });

  grid.addEventListener("dragleave", (ev) => {
    // グリッド外(本当に離脱)のときのみクリア
    if (!grid.contains(ev.relatedTarget)) clearGridDropIndicator();
  });

  grid.addEventListener("drop", async (ev) => {
    ev.preventDefault();
    if (tileDragFrom == null) return;
    const pos = findTileDropTarget(ev.clientX, ev.clientY);
    clearGridDropIndicator();
    if (!pos) return;
    const from = tileDragFrom;
    const target = pos.before ? pos.index : pos.index + 1;
    // 実質的な no-op(自分の元位置へのドロップ)はスキップ
    if (target === from || target === from + 1) return;
    const movedTo = getAdjustedMoveIndex(from, target);
    const nextCurrentPage = mapPageIndexAfterMove(currentPage, from, target);
    setStatus("並べ替え中…");
    try {
      await engine.movePage(from, target);
      currentPage = nextCurrentPage;
      dirty = true;
      selectedPages.clear();
      selectedPages.add(movedTo);
      lastSelectedPage = movedTo;
      await refreshAll();
      setStatus("並べ替え完了");
      toast(`ページ ${from + 1} を移動しました`, "success");
    } catch (e) {
      console.error(e);
      setStatus("並べ替え失敗");
      toast("ページの並べ替えに失敗しました", "error");
    }
  });
}

// ========== しおり / 全体リフレッシュ ==========
function refreshBookmarks() {
  const list = $("#bookmark-list");
  list.innerHTML = "";
  if (!engine.bookmarks || engine.bookmarks.length === 0) {
    list.appendChild(el("div", { class: "empty-state" },
      "「＋今のページに追加」で\nしおりを挟めます"));
    return;
  }
  for (const bm of engine.bookmarks) {
    const item = el("div", { class: "bookmark-item" });
    const titleSpan = el("span", { class: "bm-title" }, bm.title);
    const pageBadge = el("span", { class: "bm-page" }, `p.${bm.page + 1}`);
    const actions = el("div", { class: "bm-actions" });
    const editBtn = el("button", { class: "bm-action", title: "名前を変更" }, "✎");
    const delBtn = el("button", { class: "bm-action bm-del", title: "削除" }, "✕");
    editBtn.addEventListener("click", async (ev) => {
      ev.stopPropagation();
      const next = await askText({
        title: "しおりの名前を変更",
        defaultValue: bm.title,
        placeholder: "しおりのタイトル",
      });
      if (next === null || !next.trim()) return;
      engine.updateBookmark(bm.id, { title: next.trim() });
      dirty = true;
      refreshBookmarks();
    });
    delBtn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      engine.removeBookmark(bm.id);
      dirty = true;
      refreshBookmarks();
    });
    actions.append(editBtn, delBtn);
    item.append(
      el("span", { class: "bm-icon" }, "🔖"),
      titleSpan,
      pageBadge,
      actions,
    );
    item.addEventListener("click", () => goToPage(bm.page));
    list.appendChild(item);
  }
}

async function refreshAll() {
  refreshBookmarks();
  refreshNoteList();
  if (currentView === "editor") await refreshEditorGrid();
  if (currentView === "viewer") await renderViewerPage();
}

// ========== モーダル(イベント委譲方式) ==========
function bindModals() {
  document.addEventListener("click", onGlobalClick, true);

  let downOnBackdrop = null;
  document.addEventListener("mousedown", (ev) => {
    const bd = ev.target;
    downOnBackdrop = (bd?.classList?.contains("modal-backdrop")) ? bd : null;
  }, true);
  document.addEventListener("mouseup", (ev) => {
    if (downOnBackdrop && ev.target === downOnBackdrop && !downOnBackdrop.hidden) {
      downOnBackdrop.hidden = true;
    }
    downOnBackdrop = null;
  }, true);

  window.addEventListener("keydown", (ev) => {
    if (ev.key !== "Escape") return;
    const open = $$(".modal-backdrop").reverse().find((bd) => !bd.hidden);
    if (open) {
      ev.preventDefault();
      ev.stopPropagation();
      open.hidden = true;
    }
  }, true);
}

function onGlobalClick(ev) {
  const target = ev.target;
  if (!target || !target.closest) return;

  const closeEl = target.closest(
    "[data-close-modal], #modal-split-cancel, #modal-merge-cancel"
  );
  if (closeEl) {
    const bd = closeEl.closest(".modal-backdrop");
    if (bd) bd.hidden = true;
    return;
  }

  if (target.closest("#modal-split-run")) { runSplit(); return; }
  if (target.closest("#modal-merge-run")) { runMerge(); return; }
  if (target.closest("#merge-add-file"))  { mergeAddFile(); return; }
}

// ========== 分割 ==========
async function runSplit() {
  const mode = $$("input[name=split-mode]").find((r) => r.checked)?.value;
  hideModal("#modal-split");
  setStatus("分割中…");
  let parts = null;
  try {
    if (mode === "every") {
      const n = Math.max(1, parseInt($("#split-every-n").value, 10) || 1);
      parts = await engine.splitEvery(n);
    } else if (mode === "bookmark") {
      parts = await engine.splitByBookmark();
      if (!parts) {
        toast("しおりが見つかりません", "error");
        setStatus("");
        return;
      }
    } else if (mode === "size") {
      const mb = Math.max(0.1, parseFloat($("#split-size-mb").value) || 5);
      parts = await engine.splitBySize(Math.floor(mb * 1024 * 1024));
    }
  } catch (e) {
    console.error(e);
    toast("分割に失敗しました", "error");
    return;
  }
  if (!parts || !parts.length) {
    toast("分割できませんでした", "error");
    return;
  }
  const baseName = engine.fileName.replace(/\.pdf$/i, "");
  if (isTauri) {
    const dir = await pickDirectory("保存先フォルダを選択");
    if (!dir) { setStatus("キャンセル"); return; }
    for (const p of parts) {
      await writeBytesToDirectory(dir, `${baseName}${p.suffix}.pdf`, p.bytes);
    }
    toast(`${parts.length}ファイルに分割しました`, "success");
  } else {
    for (const p of parts) {
      downloadBlob(p.bytes, `${baseName}${p.suffix}.pdf`);
    }
    toast(`${parts.length}ファイルをダウンロード`, "success");
  }
  setStatus("分割完了");
}

// ========== 結合 ==========
let mergeFiles = [];
let mergeSeq = 1;

async function openMergeModal() {
  mergeFiles = [];
  if (engine.viewerDoc) {
    const bytes = await engine.exportWithNotes();
    mergeFiles.push({
      id: mergeSeq++,
      bytes, name: engine.fileName, pageCount: engine.pageCount,
    });
  }
  refreshMergeList();
  showModal("#modal-merge");
}

async function mergeAddFile() {
  const sel = await pickFiles({ multi: true });
  if (!sel) return;
  const arr = Array.isArray(sel) ? sel : [sel];
  for (const item of arr) {
    try {
      const doc = await PDFDocument.load(item.bytes, { ignoreEncryption: true });
      mergeFiles.push({
        id: mergeSeq++,
        bytes: item.bytes, name: item.name, pageCount: doc.getPageCount(),
      });
    } catch (e) {
      console.error(e);
      toast(`${item.name} の読み込みに失敗`, "error");
    }
  }
  refreshMergeList();
}

function refreshMergeList() {
  const list = $("#merge-list");
  list.innerHTML = "";
  if (!mergeFiles.length) {
    list.appendChild(el("div", { class: "empty-state" }, "ファイルを追加してください"));
    return;
  }
  for (let i = 0; i < mergeFiles.length; i++) {
    const f = mergeFiles[i];
    const item = el("div", {
      class: "merge-item", "data-id": f.id, draggable: "true",
    },
      el("span", { class: "merge-handle" }, "≡"),
      el("span", { class: "merge-name" }, `${i + 1}. ${f.name}`),
      el("span", { class: "merge-pages" }, `${f.pageCount}p`),
    );
    const rm = el("button", { class: "merge-remove", title: "外す" }, "✕");
    rm.addEventListener("click", () => {
      mergeFiles = mergeFiles.filter((x) => x.id !== f.id);
      refreshMergeList();
    });
    item.appendChild(rm);
    bindMergeDrag(item, f.id);
    list.appendChild(item);
  }
}

let mergeDragId = null;
function bindMergeDrag(item, id) {
  item.addEventListener("dragstart", (ev) => {
    mergeDragId = id;
    item.classList.add("dragging");
    ev.dataTransfer.effectAllowed = "move";
  });
  item.addEventListener("dragend", () => {
    item.classList.remove("dragging");
    $$(".merge-item").forEach((m) => m.classList.remove("drop-target"));
    mergeDragId = null;
  });
  item.addEventListener("dragover", (ev) => {
    if (mergeDragId == null) return;
    ev.preventDefault();
    item.classList.add("drop-target");
  });
  item.addEventListener("dragleave", () => item.classList.remove("drop-target"));
  item.addEventListener("drop", (ev) => {
    ev.preventDefault();
    if (mergeDragId == null || mergeDragId === id) return;
    const fromIdx = mergeFiles.findIndex((x) => x.id === mergeDragId);
    const toIdx = mergeFiles.findIndex((x) => x.id === id);
    if (fromIdx < 0 || toIdx < 0) return;
    const [moved] = mergeFiles.splice(fromIdx, 1);
    mergeFiles.splice(toIdx, 0, moved);
    refreshMergeList();
  });
}

async function runMerge() {
  if (mergeFiles.length < 2) {
    toast("2つ以上のファイルが必要です", "error");
    return;
  }
  hideModal("#modal-merge");
  setStatus("結合中…");
  const bytes = await PdfEngine.mergeBytes(mergeFiles);
  const suggested = "merged_" + new Date().toISOString().slice(0, 10) + ".pdf";
  await saveFile(bytes, suggested);
  toast(`${mergeFiles.length}ファイルを結合しました`, "success");
  setStatus("結合完了");
}

// ========== ドラッグ&ドロップ(ファイル) ==========
function bindDragDrop() {
  const overlay = $("#drop-overlay");
  let counter = 0;
  window.addEventListener("dragenter", (ev) => {
    if (!ev.dataTransfer?.types?.includes("Files")) return;
    counter++;
    overlay.hidden = false;
  });
  window.addEventListener("dragleave", () => {
    counter--;
    if (counter <= 0) { counter = 0; overlay.hidden = true; }
  });
  window.addEventListener("dragover", (ev) => {
    if (ev.dataTransfer?.types?.includes("Files")) ev.preventDefault();
  });
  window.addEventListener("drop", async (ev) => {
    ev.preventDefault();
    counter = 0;
    overlay.hidden = true;
    const files = Array.from(ev.dataTransfer?.files || [])
      .filter((f) => f.name.toLowerCase().endsWith(".pdf"));
    if (!files.length) return;
    if (!engine.viewerDoc) {
      const f = files[0];
      await loadBytes(await readFileAsBytes(f), f.name);
      return;
    }
    // PDFが既に開いていればマージ候補に追加
    for (const f of files) {
      try {
        const bytes = await readFileAsBytes(f);
        const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
        mergeFiles.push({
          id: mergeSeq++,
          bytes, name: f.name, pageCount: doc.getPageCount(),
        });
      } catch (e) { console.error(e); }
    }
    if (!mergeFiles.find((m) => m.name === engine.fileName)) {
      const cur = await engine.exportWithNotes();
      mergeFiles.unshift({
        id: mergeSeq++,
        bytes: cur, name: engine.fileName, pageCount: engine.pageCount,
      });
    }
    refreshMergeList();
    showModal("#modal-merge");
  });
}

// ========== キーボード ==========
function bindKeyboard() {
  window.addEventListener("keydown", (ev) => {
    const tag = ev.target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    // 編集ビューの選択系ショートカット
    if (currentView === "editor" && engine.viewerDoc) {
      if ((ev.metaKey || ev.ctrlKey) && ev.key === "a") {
        ev.preventDefault();
        selectedPages = new Set(Array.from({ length: engine.pageCount }, (_, i) => i));
        refreshSelectionUI();
        return;
      }
      if ((ev.key === "Delete" || ev.key === "Backspace") && selectedPages.size > 0) {
        ev.preventDefault();
        deleteSelected();
        return;
      }
      if (ev.key === "Escape") { selectedPages.clear(); refreshSelectionUI(); return; }
    }
    // 付箋モード終了
    if (ev.key === "Escape" && noteMode) {
      ev.preventDefault();
      exitNoteMode();
      return;
    }
    // 閲覧ビューのページ操作
    if (currentView === "viewer") {
      if (ev.key === "ArrowLeft" || ev.key === "PageUp") goToPage(currentPage - 1);
      else if (ev.key === "ArrowRight" || ev.key === "PageDown") goToPage(currentPage + 1);
    }
    // 共通
    if ((ev.metaKey || ev.ctrlKey) && ev.key === "o") { ev.preventDefault(); openPdf(); }
    else if ((ev.metaKey || ev.ctrlKey) && ev.key === "s") { ev.preventDefault(); saveCurrent(); }
    else if ((ev.metaKey || ev.ctrlKey) && ev.key === "=") { ev.preventDefault(); changeZoom(1.2); }
    else if ((ev.metaKey || ev.ctrlKey) && ev.key === "-") { ev.preventDefault(); changeZoom(1 / 1.2); }
  });
}
