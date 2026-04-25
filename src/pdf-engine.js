// ========== PDF エンジン: pdf.js (描画) + pdf-lib (編集) ==========
import * as pdfjsLib from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import {
  PDFDocument, degrees, rgb, StandardFonts,
  PDFName, PDFHexString,
} from "pdf-lib";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

export class PdfEngine {
  constructor() {
    this.bytes = null;        // Uint8Array (latest saved bytes)
    this.viewerDoc = null;    // pdf.js document
    this.editorDoc = null;    // pdf-lib document (may hold uncommitted edits)
    this.fileName = "untitled.pdf";
    this.pageCount = 0;
    this.notes = [];          // { id, page (0-based), x, y, text }
    this._noteSeq = 1;
    this.bookmarks = [];      // { id, title, page }
    this._bmSeq = 1;
  }

  async loadFromBytes(bytes, fileName = "document.pdf") {
    this.bytes = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    this.fileName = fileName;
    await this._reload();
    this.notes = [];
    this.bookmarks = await this._loadBookmarksFromOutline();
  }

  async _loadBookmarksFromOutline() {
    const outline = await this.getOutline();
    return outline
      .filter((o) => o.pageIndex != null)
      .map((o) => ({
        id: this._bmSeq++,
        title: o.title || "(無題)",
        page: o.pageIndex,
      }));
  }

  // ========== しおり ==========
  addBookmark(title, page) {
    const bm = {
      id: this._bmSeq++,
      title: (title || "").trim() || `ページ ${page + 1}`,
      page,
    };
    this.bookmarks.push(bm);
    this.bookmarks.sort((a, b) => a.page - b.page);
    return bm;
  }

  updateBookmark(id, patch) {
    const i = this.bookmarks.findIndex((b) => b.id === id);
    if (i >= 0) {
      this.bookmarks[i] = { ...this.bookmarks[i], ...patch };
      this.bookmarks.sort((a, b) => a.page - b.page);
    }
  }

  removeBookmark(id) {
    this.bookmarks = this.bookmarks.filter((b) => b.id !== id);
  }

  async _reload() {
    if (this.viewerDoc) {
      try { await this.viewerDoc.destroy(); } catch (e) {}
      this.viewerDoc = null;
    }
    // pdf.js consumes the buffer. clone so we keep originals.
    const viewerCopy = this.bytes.slice();
    this.viewerDoc = await pdfjsLib.getDocument({ data: viewerCopy }).promise;
    this.editorDoc = await PDFDocument.load(this.bytes, { ignoreEncryption: true });
    this.pageCount = this.editorDoc.getPageCount();
  }

  async commitEdits() {
    // Save editorDoc → bytes → reload viewerDoc.
    const out = await this.editorDoc.save({ useObjectStreams: true });
    this.bytes = out instanceof Uint8Array ? out : new Uint8Array(out);
    // viewer needs reload
    if (this.viewerDoc) {
      try { await this.viewerDoc.destroy(); } catch (e) {}
    }
    const viewerCopy = this.bytes.slice();
    this.viewerDoc = await pdfjsLib.getDocument({ data: viewerCopy }).promise;
    this.pageCount = this.editorDoc.getPageCount();
  }

  async renderPage(pageIndex, canvas, scale = 1.5) {
    if (!this.viewerDoc) return;
    const page = await this.viewerDoc.getPage(pageIndex + 1);
    const viewport = page.getViewport({ scale });
    const ctx = canvas.getContext("2d");
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.floor(viewport.width * ratio);
    canvas.height = Math.floor(viewport.height * ratio);
    canvas.style.width = `${Math.floor(viewport.width)}px`;
    canvas.style.height = `${Math.floor(viewport.height)}px`;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    await page.render({ canvasContext: ctx, viewport }).promise;
    return { width: viewport.width, height: viewport.height };
  }

  async renderThumb(pageIndex, canvas, targetWidth = 140) {
    if (!this.viewerDoc) return;
    const page = await this.viewerDoc.getPage(pageIndex + 1);
    const v0 = page.getViewport({ scale: 1 });
    const scale = targetWidth / v0.width;
    const viewport = page.getViewport({ scale });
    const ctx = canvas.getContext("2d");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
  }

  async getOutline() {
    if (!this.viewerDoc) return [];
    const raw = await this.viewerDoc.getOutline();
    if (!raw) return [];
    const flat = [];
    const walk = async (items, depth) => {
      for (const it of items) {
        let pageIdx = null;
        try {
          if (it.dest) {
            const dest = typeof it.dest === "string"
              ? await this.viewerDoc.getDestination(it.dest)
              : it.dest;
            if (dest && dest[0]) {
              pageIdx = await this.viewerDoc.getPageIndex(dest[0]);
            }
          }
        } catch (e) {}
        flat.push({ title: it.title || "(無題)", depth, pageIndex: pageIdx });
        if (it.items?.length) await walk(it.items, depth + 1);
      }
    };
    await walk(raw, 0);
    return flat;
  }

  // ========== ページ操作 (editorDoc 上で実行 → commitEdits) ==========
  _shiftPageAnchoredItems(items, transform) {
    // 付箋/しおり共通の page インデックス変換
    const out = [];
    for (const it of items) {
      const newPage = transform(it.page);
      if (newPage === null) continue; // 削除
      out.push({ ...it, page: newPage });
    }
    return out;
  }

  async deletePages(indices) {
    const sorted = [...indices].sort((a, b) => b - a);
    for (const i of sorted) this.editorDoc.removePage(i);
    const transform = (p) => {
      if (indices.includes(p)) return null;
      return p - indices.filter((i) => i < p).length;
    };
    this.notes = this._shiftPageAnchoredItems(this.notes, transform);
    this.bookmarks = this._shiftPageAnchoredItems(this.bookmarks, transform);
    await this.commitEdits();
  }

  async movePage(from, to) {
    if (from === to) return;
    const total = this.editorDoc.getPageCount();
    if (from < 0 || from >= total || to < 0 || to > total) return;
    const movedPage = this.editorDoc.getPage(from);
    this.editorDoc.removePage(from);
    const adjustedTo = Math.min(total - 1, to > from ? to - 1 : to);
    this.editorDoc.insertPage(adjustedTo, movedPage);
    const transform = (p) => {
      if (p === from) return adjustedTo;
      if (from < to) {
        if (p > from && p <= adjustedTo) return p - 1;
      } else {
        if (p >= adjustedTo && p < from) return p + 1;
      }
      return p;
    };
    this.notes = this._shiftPageAnchoredItems(this.notes, transform);
    this.bookmarks = this._shiftPageAnchoredItems(this.bookmarks, transform);
    await this.commitEdits();
  }

  async rotatePage(index, deltaDegrees) {
    const page = this.editorDoc.getPage(index);
    const cur = page.getRotation().angle;
    let next = (cur + deltaDegrees) % 360;
    if (next < 0) next += 360;
    page.setRotation(degrees(next));
    await this.commitEdits();
  }

  async insertBlankPage(afterIndex, width = 595, height = 842) {
    const idx = afterIndex + 1;
    this.editorDoc.insertPage(idx, [width, height]);
    const transform = (p) => (p >= idx ? p + 1 : p);
    this.notes = this._shiftPageAnchoredItems(this.notes, transform);
    this.bookmarks = this._shiftPageAnchoredItems(this.bookmarks, transform);
    await this.commitEdits();
  }

  async insertImagePage(afterIndex, imageBytes, mime) {
    const idx = afterIndex + 1;
    let img;
    if (mime === "image/png" || /\.png$/i.test(mime)) {
      img = await this.editorDoc.embedPng(imageBytes);
    } else {
      img = await this.editorDoc.embedJpg(imageBytes);
    }
    const A4_W = 595, A4_H = 842;
    const ratio = Math.min(A4_W / img.width, A4_H / img.height);
    const w = img.width * ratio;
    const h = img.height * ratio;
    const page = this.editorDoc.insertPage(idx, [A4_W, A4_H]);
    page.drawImage(img, {
      x: (A4_W - w) / 2,
      y: (A4_H - h) / 2,
      width: w,
      height: h,
    });
    const transform = (p) => (p >= idx ? p + 1 : p);
    this.notes = this._shiftPageAnchoredItems(this.notes, transform);
    this.bookmarks = this._shiftPageAnchoredItems(this.bookmarks, transform);
    await this.commitEdits();
  }

  async insertPdfPages(afterIndex, otherBytes) {
    const other = await PDFDocument.load(otherBytes, { ignoreEncryption: true });
    const otherCount = other.getPageCount();
    const indices = Array.from({ length: otherCount }, (_, i) => i);
    const copied = await this.editorDoc.copyPages(other, indices);
    let insertAt = afterIndex + 1;
    for (const p of copied) {
      this.editorDoc.insertPage(insertAt, p);
      insertAt++;
    }
    const ins0 = afterIndex + 1;
    const transform = (p) => (p >= ins0 ? p + otherCount : p);
    this.notes = this._shiftPageAnchoredItems(this.notes, transform);
    this.bookmarks = this._shiftPageAnchoredItems(this.bookmarks, transform);
    await this.commitEdits();
  }

  // ========== 抽出 ==========
  async extractPages(indices) {
    const out = await PDFDocument.create();
    const copied = await out.copyPages(this.editorDoc, indices);
    for (const p of copied) out.addPage(p);
    return new Uint8Array(await out.save());
  }

  // ========== 分割 ==========
  async splitEvery(n) {
    const total = this.pageCount;
    const result = [];
    for (let start = 0; start < total; start += n) {
      const end = Math.min(start + n, total);
      const indices = Array.from({ length: end - start }, (_, i) => start + i);
      const out = await PDFDocument.create();
      const copied = await out.copyPages(this.editorDoc, indices);
      for (const p of copied) out.addPage(p);
      result.push({
        bytes: new Uint8Array(await out.save()),
        suffix: `_p${start + 1}-${end}`,
      });
    }
    return result;
  }

  async splitByBookmark() {
    const outline = await this.getOutline();
    const tops = outline.filter((o) => o.depth === 0 && o.pageIndex != null);
    if (tops.length === 0) return null;
    const total = this.pageCount;
    const result = [];
    for (let i = 0; i < tops.length; i++) {
      const start = tops[i].pageIndex;
      const end = i + 1 < tops.length ? tops[i + 1].pageIndex : total;
      if (start >= end) continue;
      const indices = Array.from({ length: end - start }, (_, k) => start + k);
      const out = await PDFDocument.create();
      const copied = await out.copyPages(this.editorDoc, indices);
      for (const p of copied) out.addPage(p);
      const safe = (tops[i].title || `bm${i + 1}`).replace(/[\\/:*?"<>|]/g, "_").slice(0, 60);
      result.push({
        bytes: new Uint8Array(await out.save()),
        suffix: `_${i + 1}_${safe}`,
      });
    }
    return result;
  }

  async splitBySize(maxBytes) {
    const total = this.pageCount;
    const result = [];
    let start = 0;
    while (start < total) {
      // 1ページずつ追加し、超えたら確定
      let end = start + 1;
      let bestBytes = null;
      while (end <= total) {
        const indices = Array.from({ length: end - start }, (_, k) => start + k);
        const out = await PDFDocument.create();
        const copied = await out.copyPages(this.editorDoc, indices);
        for (const p of copied) out.addPage(p);
        const bytes = new Uint8Array(await out.save());
        if (bytes.length > maxBytes && end - start > 1) {
          // 1個前で確定
          break;
        }
        bestBytes = { bytes, end };
        if (bytes.length > maxBytes) break; // 1ページでも超えたが採用
        end++;
      }
      if (!bestBytes) break;
      result.push({
        bytes: bestBytes.bytes,
        suffix: `_p${start + 1}-${bestBytes.end}`,
      });
      start = bestBytes.end;
    }
    return result;
  }

  // ========== 結合 ==========
  static async mergeBytes(items) {
    // items: [{ bytes, name }]
    const out = await PDFDocument.create();
    for (const it of items) {
      const src = await PDFDocument.load(it.bytes, { ignoreEncryption: true });
      const indices = Array.from({ length: src.getPageCount() }, (_, i) => i);
      const copied = await out.copyPages(src, indices);
      for (const p of copied) out.addPage(p);
    }
    return new Uint8Array(await out.save());
  }

  // ========== 付箋 ==========
  addNote(pageIndex, x, y, text = "") {
    const id = this._noteSeq++;
    const note = { id, page: pageIndex, x, y, text };
    this.notes.push(note);
    return note;
  }

  updateNote(id, patch) {
    const i = this.notes.findIndex((n) => n.id === id);
    if (i >= 0) this.notes[i] = { ...this.notes[i], ...patch };
  }

  removeNote(id) {
    this.notes = this.notes.filter((n) => n.id !== id);
  }

  // 保存時: 付箋を描画として焼き込み、しおりを PDF アウトラインとして埋め込み
  async exportWithNotes() {
    const out = await PDFDocument.load(await this.editorDoc.save());

    // 付箋の描画
    if (this.notes.length > 0) {
      const font = await out.embedFont(StandardFonts.Helvetica);
      for (const note of this.notes) {
        if (note.page < 0 || note.page >= out.getPageCount()) continue;
        const page = out.getPage(note.page);
        const { width: pw, height: ph } = page.getSize();
        const px = note.x * pw;
        const py = ph - note.y * ph; // y is from-top in our UI
        const w = 140, h = 60;
        page.drawRectangle({
          x: Math.max(2, Math.min(pw - w - 2, px - w / 2)),
          y: Math.max(2, Math.min(ph - h - 2, py - h)),
          width: w, height: h,
          color: rgb(1.0, 0.93, 0.66),
          borderColor: rgb(0.96, 0.81, 0.36),
          borderWidth: 1,
          opacity: 0.95,
        });
        const lines = (note.text || "").split("\n").slice(0, 4);
        lines.forEach((line, i) => {
          page.drawText(line.slice(0, 22), {
            x: Math.max(6, Math.min(pw - w + 4, px - w / 2 + 6)),
            y: Math.max(4, Math.min(ph - 18, py - 16 - i * 14)),
            size: 10,
            font,
            color: rgb(0.36, 0.31, 0.38),
          });
        });
      }
    }

    // しおり(アウトライン)の書き込み
    this._writeOutline(out);

    return new Uint8Array(await out.save());
  }

  _writeOutline(pdfDoc) {
    if (!this.bookmarks || this.bookmarks.length === 0) {
      // 既存のアウトラインはそのまま(消さない)
      return;
    }
    const context = pdfDoc.context;
    const pages = pdfDoc.getPages();
    if (pages.length === 0) return;

    // ref を先に確保
    const outlinesRef = context.nextRef();
    const itemRefs = this.bookmarks.map(() => context.nextRef());

    this.bookmarks.forEach((bm, i) => {
      const pageIdx = Math.max(0, Math.min(pages.length - 1, bm.page));
      const pageRef = pages[pageIdx].ref;
      const entries = {
        Title: this._pdfTextString(bm.title || `ページ ${bm.page + 1}`),
        Parent: outlinesRef,
        Dest: [pageRef, "Fit"],
      };
      if (i > 0) entries.Prev = itemRefs[i - 1];
      if (i < itemRefs.length - 1) entries.Next = itemRefs[i + 1];
      const item = context.obj(entries);
      context.assign(itemRefs[i], item);
    });

    const outlinesDict = context.obj({
      Type: "Outlines",
      First: itemRefs[0],
      Last: itemRefs[itemRefs.length - 1],
      Count: this.bookmarks.length,
    });
    context.assign(outlinesRef, outlinesDict);
    pdfDoc.catalog.set(PDFName.of("Outlines"), outlinesRef);
    // PageMode をアウトラインに
    pdfDoc.catalog.set(PDFName.of("PageMode"), PDFName.of("UseOutlines"));
  }

  // PDF テキスト文字列として安全にエンコード(UTF-16BE + BOM でどんな文字も通す)
  _pdfTextString(text) {
    const s = String(text);
    let hex = "FEFF"; // BOM
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      hex += c.toString(16).padStart(4, "0").toUpperCase();
    }
    return PDFHexString.of(hex);
  }
}
