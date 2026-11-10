/* ---------- كشف الحساب: بيانات التقرير، معاينة الطباعة، Excel ---------- */
function periodLabel(from, to) {
  if (from && to) return "من " + from + " إلى " + to;
  if (from) return "من " + from;
  if (to) return "حتى " + to;
  return "كل الفترات";
}
function nowStamp() { const d = new Date(); return todayStr() + " " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); }
function reportData() {
  const id = stmtCustodyId(); if (!id) return null;
  const c = custodyById(id), st = stmtRows(id, ui.from, ui.to, ui.stmtCC);
  const rows = st.rows.map(({ e, bal }) => ({
    date: e.date, ref: vno(e),
    desc: e.kind === "topup" ? (e.desc || "إضافة مبلغ") : ([e.beneficiary, e.desc].filter(Boolean).join(" — ") || "سند صرف"),
    category: e.kind === "topup" ? "" : (e.category || ""),
    cc: ccName(e.ccId),
    inn: e.kind === "topup" ? e.amount : null, out: e.kind === "voucher" ? e.amount : null, bal
  }));
  return {
    title: "كشف حساب عهدة", custody: c.name, cn: c.cn || 0,
    holder: c.holderId ? nameOf(c.holderId) : (c.holderLabel || "—"),
    period: periodLabel(ui.from, ui.to),
    ccLabel: ui.stmtCC === "none" ? "بدون مركز تكلفة" : ui.stmtCC ? ccName(ui.stmtCC) : "كل المراكز",
    opening: st.opening, rows, rec: st.rec, sp: st.sp, closing: st.closing, summary: ccSummary(st.rows),
    printedAt: nowStamp(), by: S.me ? S.me.name : ""
  };
}
function fileBase(rep) { return "statement-" + (rep.cn || "x") + "-" + todayStr(); }
function saveBlob(blob, filename) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 8000);
}

/* ---------- معاينة الطباعة ---------- */
function printHtml(rep) {
  const n = v => `<span class="num">${fmt(v)}</span>`;
  const meta = [["العهدة", rep.custody + (rep.cn ? " (ع" + rep.cn + ")" : "")], ["أمين العهدة", rep.holder], ["الفترة", rep.period], ["مركز التكلفة", rep.ccLabel], ["تاريخ الطباعة", rep.printedAt], ["أعدّه", rep.by]];
  return `<div class="ptool">
      <button class="btn primary" data-act="doprint">طباعة</button><button class="btn" data-act="pdf">تنزيل PDF</button><button class="btn" data-act="xlsx">تنزيل Excel</button><button class="btn" data-act="closeprint">إغلاق</button></div>
    <div class="pwrap"><div class="psheet" id="psheet">
      <div class="phead"><h1>${esc(rep.title)}</h1><div class="pbrand">دفتر العهد</div></div>
      <div class="pmeta">${meta.map(([k, v]) => `<div><b>${k}:</b><span>${esc(v)}</span></div>`).join("")}</div>
      <div class="pbox"><div><small>الرصيد الافتتاحي</small><b>${n(rep.opening)}</b></div><div><small>إجمالي الوارد</small><b>${n(rep.rec)}</b></div><div><small>إجمالي المنصرف</small><b>${n(rep.sp)}</b></div><div><small>الرصيد الختامي</small><b>${n(rep.closing)}</b></div></div>
      <table class="pt"><thead><tr><th>التاريخ</th><th>المرجع</th><th>البيان</th><th>البند</th><th>مركز التكلفة</th><th>وارد</th><th>منصرف</th><th>الرصيد</th></tr></thead><tbody>
        <tr><td colspan="7"><b>الرصيد الافتتاحي</b></td><td class="n">${n(rep.opening)}</td></tr>
        ${rep.rows.map(r => `<tr><td><span class="num">${esc(r.date)}</span></td><td><span class="num">${esc(r.ref)}</span></td><td>${esc(r.desc)}</td><td>${esc(r.category)}</td><td>${esc(r.cc)}</td><td class="n">${r.inn != null ? n(r.inn) : ""}</td><td class="n">${r.out != null ? n(r.out) : ""}</td><td class="n">${n(r.bal)}</td></tr>`).join("")}
      </tbody><tfoot><tr><td colspan="5">الإجمالي</td><td class="n">${n(rep.rec)}</td><td class="n">${n(rep.sp)}</td><td class="n">${n(rep.closing)}</td></tr></tfoot></table>
      ${rep.ccLabel !== "كل المراكز" ? `<div class="pnote">الرصيد في العمود الأخير هو رصيد العهدة الفعلي، وليس مقصوراً على المركز المختار.</div>` : ""}
      ${rep.summary.length ? `<h2 class="ph2">المصروف حسب مركز التكلفة</h2><table class="pt psum"><thead><tr><th>مركز التكلفة</th><th>عدد السندات</th><th>إجمالي المصروف</th></tr></thead><tbody>${rep.summary.map(x => `<tr><td>${esc(x.name)}</td><td class="n"><span class="num">${x.count}</span></td><td class="n">${n(x.total)}</td></tr>`).join("")}</tbody></table>` : ""}
      <div class="psign"><div>أمين العهدة</div><div>المحاسب</div><div>المدير المعتمد</div></div>
    </div></div>`;
}
function showPrint(html) {
  const layer = $("#printLayer");
  layer.innerHTML = html;
  layer.style.setProperty("--pz", String(Math.min(1, (window.innerWidth - 24) / 1122)));
  ui.printOpen = true; render(); window.scrollTo(0, 0);
}
function openPrint() {
  const rep = reportData(); if (!rep) return toast("لا توجد عهدة لعرضها");
  showPrint(printHtml(rep));
}
const ptool = pdf => `<div class="ptool"><button class="btn primary" data-act="doprint">طباعة</button>${pdf ? '<button class="btn" data-act="pdf">تنزيل PDF</button><button class="btn" data-act="xlsx">تنزيل Excel</button>' : ""}<button class="btn" data-act="closeprint">إغلاق</button></div>`;
function openPrintVoucher(id) {
  const e = S.entries.find(x => x.id === id); if (!e) return;
  const c = custodyById(e.custodyId), top = e.kind === "topup", x = e.status === "cancelled";
  const ref = vno(e);
  const f = [["العهدة", c ? c.name : "—"], ["أمين العهدة", c ? (c.holderId ? nameOf(c.holderId) : (c.holderLabel || "—")) : "—"], ["التاريخ", e.date]];
  if (!top) f.push(["المستفيد", e.beneficiary || "—"], ["البند", e.category || "—"], ["مركز التكلفة", ccName(e.ccId) || "—"]);
  f.push(["البيان", e.desc || "—"], ["سجّله", e.byName || nameOf(e.by) || "—"]);
  showPrint(ptool(false) + `<div class="pwrap"><div class="psheet" id="psheet">
    <div class="phead"><h1>${top ? "إيصال إضافة مبلغ" : "سند صرف"}</h1><div class="pbrand">رقم: <span class="num">${esc(ref)}</span></div></div>
    ${x ? '<div class="pstamp">ملغي</div>' : ""}
    <div class="pamt"><small>المبلغ</small><b><span class="num">${fmt(e.amount)}</span> ${CUR}</b></div>
    <div class="pvf">${f.map(([k, v]) => `<div><b>${k}</b><span>${k === "التاريخ" ? `<span class="num">${esc(v)}</span>` : esc(v)}</span></div>`).join("")}</div>
    <div class="psign">${(top ? ["المحاسب", "المدير المعتمد"] : ["المستلم", "أمين العهدة", "المحاسب", "المدير المعتمد"]).map(s => `<div>${s}</div>`).join("")}</div>
    <div class="pnote">طُبع بتاريخ ${nowStamp()}${S.me && S.me.name ? " — " + esc(S.me.name) : ""}</div></div></div>`);
}
function openPrintCC() {
  const [from, to] = periodRange(ui.period);
  const per = { month: "هذا الشهر", q: "آخر ٣ أشهر", year: "هذه السنة", all: "كل الفترات" }[ui.period] || "";
  const inP = new Map();
  S.entries.forEach(e => { if (e.kind !== "voucher" || e.status === "cancelled" || e.date < from || e.date >= to) return; const k = e.ccId || ""; inP.set(k, (inP.get(k) || 0) + e.amount); });
  const n = v => `<span class="num">${fmt(v)}</span>`;
  const list = S.costCenters.map(k => ({ name: ccName(k.id), budget: k.budget, p: inP.get(k.id) || 0, all: ccSpent(k.id), off: !k.active }));
  if (inP.get("")) list.push({ name: "بدون مركز تكلفة", budget: 0, p: inP.get(""), all: S.entries.reduce((a, e) => a + (e.kind === "voucher" && e.status !== "cancelled" && !e.ccId ? e.amount : 0), 0) });
  const tb = list.reduce((a, x) => a + x.budget, 0), tp = list.reduce((a, x) => a + x.p, 0), ta = list.reduce((a, x) => a + x.all, 0);
  showPrint(ptool(false) + `<div class="pwrap"><div class="psheet" id="psheet">
    <div class="phead"><h1>تقرير مراكز التكلفة</h1><div class="pbrand">دفتر العهد</div></div>
    <div class="pmeta"><div><b>الفترة:</b><span>${per}</span></div><div><b>تاريخ الطباعة:</b><span>${nowStamp()}</span></div><div><b>أعدّه:</b><span>${esc(S.me ? S.me.name : "")}</span></div></div>
    <table class="pt"><thead><tr><th>مركز التكلفة</th><th>الميزانية</th><th>مصروف الفترة</th><th>إجمالي المصروف</th><th>المتبقي</th><th>النسبة</th></tr></thead><tbody>
    ${list.map(x => `<tr><td>${esc(x.name)}${x.off ? " (موقوف)" : ""}</td><td class="n">${x.budget ? n(x.budget) : ""}</td><td class="n">${n(x.p)}</td><td class="n">${n(x.all)}</td><td class="n">${x.budget ? n(x.budget - x.all) : ""}</td><td class="n">${x.budget ? Math.round(x.all / x.budget * 100) + "%" : ""}</td></tr>`).join("")}
    </tbody><tfoot><tr><td>الإجمالي</td><td class="n">${n(tb)}</td><td class="n">${n(tp)}</td><td class="n">${n(ta)}</td><td class="n">${tb ? n(tb - ta) : ""}</td><td></td></tr></tfoot></table>
    <div class="pnote">الإجمالي والمتبقي يحسبان كل سندات الصرف غير الملغاة للمركز، ومصروف الفترة يخص الفترة المختارة فقط.</div></div></div>`);
}
function closePrint() { ui.printOpen = false; $("#printLayer").innerHTML = ""; render(); }

/* ---------- Excel (xlsx) بدون مكتبات خارجية ---------- */
const CRC_T = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(u8) { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC_T[(c ^ u8[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function concatU8(list) { let n = 0; list.forEach(a => { n += a.length; }); const out = new Uint8Array(n); let o = 0; list.forEach(a => { out.set(a, o); o += a.length; }); return out; }
function zipStore(files) {
  const enc = new TextEncoder(), local = [], central = []; let off = 0;
  const u16 = v => [v & 255, (v >> 8) & 255], u32 = v => [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255];
  for (const f of files) {
    const name = enc.encode(f.name), data = f.data, crc = crc32(data), sz = data.length;
    const lh = new Uint8Array([0x50, 0x4b, 3, 4, ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x5021), ...u32(crc), ...u32(sz), ...u32(sz), ...u16(name.length), ...u16(0)]);
    local.push(lh, name, data);
    central.push(new Uint8Array([0x50, 0x4b, 1, 2, ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x5021), ...u32(crc), ...u32(sz), ...u32(sz), ...u16(name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(off)]), name);
    off += lh.length + name.length + sz;
  }
  const cd = concatU8(central);
  const end = new Uint8Array([0x50, 0x4b, 5, 6, ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length), ...u32(cd.length), ...u32(off), ...u16(0)]);
  return concatU8([...local, cd, end]);
}
const xmlEsc = s => String(s ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const colL = i => String.fromCharCode(65 + i);
const xs = (r, c, t, s) => `<c r="${colL(c)}${r}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${xmlEsc(t)}</t></is></c>`;
const xn = (r, c, v, s) => `<c r="${colL(c)}${r}" s="${s}"><v>${Number(v)}</v></c>`;
const xe = (r, c, s) => `<c r="${colL(c)}${r}" s="${s}"/>`;
const xdate = (r, c, ds) => { const [y, m, d] = String(ds).split("-").map(Number); return xn(r, c, Math.round((Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000), 9); };
const XS = { title: 1, head: 2, text: 3, num: 4, bold: 5, tlabel: 6, tnum: 7, center: 8 };
const XSTYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="2"><numFmt numFmtId="164" formatCode="#,##0.00"/><numFmt numFmtId="165" formatCode="yyyy\\-mm\\-dd"/></numFmts><fonts count="4"><font><sz val="11"/><name val="Arial"/></font><font><b/><sz val="11"/><name val="Arial"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Arial"/></font><font><b/><sz val="15"/><color rgb="FF0F5257"/><name val="Arial"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0F5257"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEEF3F2"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFBFCBC9"/></left><right style="thin"><color rgb="FFBFCBC9"/></right><top style="thin"><color rgb="FFBFCBC9"/></top><bottom style="thin"><color rgb="FFBFCBC9"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="10"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf><xf numFmtId="0" fontId="2" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center" wrapText="1"/></xf><xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf><xf numFmtId="0" fontId="1" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf><xf numFmtId="164" fontId="1" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
function sheetXml(rowsXml, widths, merges) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><sheetViews><sheetView rightToLeft="1" workbookViewId="0"/></sheetViews><sheetFormatPr defaultRowHeight="18"/><cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols><sheetData>${rowsXml.join("")}</sheetData>${merges.length ? `<mergeCells count="${merges.length}">${merges.map(m => `<mergeCell ref="${m}"/>`).join("")}</mergeCells>` : ""}<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/><pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>`;
}
function buildXlsx(rep) {
  const enc = new TextEncoder(), R = [], merges = [];
  const row = (r, cells, ht) => R.push(`<row r="${r}"${ht ? ` ht="${ht}" customHeight="1"` : ""}>${cells.join("")}</row>`);
  row(1, [xs(1, 0, rep.title, XS.title)], 26); merges.push("A1:H1");
  const meta = [["العهدة", rep.custody + (rep.cn ? " (ع" + rep.cn + ")" : "")], ["أمين العهدة", rep.holder], ["الفترة", rep.period], ["مركز التكلفة", rep.ccLabel], ["تاريخ الطباعة", rep.printedAt + (rep.by ? " - " + rep.by : "")]];
  meta.forEach(([k, v], i) => { const r = 2 + i; row(r, [xs(r, 0, k, XS.bold), xs(r, 1, v, XS.bold)]); merges.push(`B${r}:E${r}`); });
  let r = 8;
  row(r++, ["التاريخ", "المرجع", "البيان", "البند", "مركز التكلفة", "وارد", "منصرف", "الرصيد"].map((t, i) => xs(r, i, t, XS.head)), 22);
  row(r, [xe(r, 0, XS.text), xe(r, 1, XS.text), xs(r, 2, "الرصيد الافتتاحي", XS.bold), xe(r, 3, XS.text), xe(r, 4, XS.text), xe(r, 5, XS.text), xe(r, 6, XS.text), xn(r, 7, rep.opening, XS.num)]); r++;
  rep.rows.forEach(x => {
    row(r, [xdate(r, 0, x.date), xs(r, 1, x.ref, XS.center), xs(r, 2, x.desc, XS.text), xs(r, 3, x.category, XS.text), xs(r, 4, x.cc, XS.text), x.inn != null ? xn(r, 5, x.inn, XS.num) : xe(r, 5, XS.num), x.out != null ? xn(r, 6, x.out, XS.num) : xe(r, 6, XS.num), xn(r, 7, x.bal, XS.num)]); r++;
  });
  row(r, [xs(r, 0, "الإجمالي", XS.tlabel), xe(r, 1, XS.tlabel), xe(r, 2, XS.tlabel), xe(r, 3, XS.tlabel), xe(r, 4, XS.tlabel), xn(r, 5, rep.rec, XS.tnum), xn(r, 6, rep.sp, XS.tnum), xn(r, 7, rep.closing, XS.tnum)]); merges.push(`A${r}:E${r}`);
  const sheet1 = sheetXml(R, [12, 14, 46, 22, 26, 15, 15, 16], merges);
  const R2 = []; let q = 1;
  R2.push(`<row r="1" ht="22" customHeight="1">${["مركز التكلفة", "عدد السندات", "إجمالي المصروف"].map((t, i) => xs(1, i, t, XS.head)).join("")}</row>`);
  rep.summary.forEach(x => { q++; R2.push(`<row r="${q}">${xs(q, 0, x.name, XS.text)}${xn(q, 1, x.count, XS.center)}${xn(q, 2, x.total, XS.num)}</row>`); });
  q++; R2.push(`<row r="${q}">${xs(q, 0, "الإجمالي", XS.tlabel)}${xn(q, 1, rep.summary.reduce((a, x) => a + x.count, 0), XS.tnum)}${xn(q, 2, rep.summary.reduce((a, x) => a + x.total, 0), XS.tnum)}</row>`);
  const sheet2 = sheetXml(R2, [34, 16, 20], []);
  const H = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  const files = [
    ["[Content_Types].xml", H + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>'],
    ["_rels/.rels", H + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
    ["xl/workbook.xml", H + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="كشف الحساب" sheetId="1" r:id="rId1"/><sheet name="مراكز التكلفة" sheetId="2" r:id="rId2"/></sheets></workbook>'],
    ["xl/_rels/workbook.xml.rels", H + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'],
    ["xl/styles.xml", XSTYLES],
    ["xl/worksheets/sheet1.xml", sheet1],
    ["xl/worksheets/sheet2.xml", sheet2]
  ].map(([name, xml]) => ({ name, data: enc.encode(xml) }));
  return zipStore(files);
}
function exportXlsx() {
  const rep = reportData(); if (!rep) return toast("لا توجد عهدة لتصديرها");
  try {
    saveBlob(new Blob([buildXlsx(rep)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), fileBase(rep) + ".xlsx");
    toast("تم تنزيل ملف Excel");
  } catch (e) { console.error(e); toast("تعذر إنشاء ملف Excel"); }
}

/* ---------- PDF: صفحات A4 أفقية تُرسم على canvas (المتصفح يتولى تشكيل العربية) ثم تُضمَّن كصور JPEG ---------- */
const PW = 1754, PH = 1240, PM = 60, FONT = '"IBM Plex Sans Arabic","Segoe UI",Tahoma,"DejaVu Sans",Arial,sans-serif';
function drawStatementPages(rep) {
  const pages = []; let cv, g, y;
  const ink = "#16302f", teal = "#0F5257", line = "#bfcbc9", soft = "#eef3f2";
  const font = (sz, w) => { g.font = (w || 400) + " " + sz + "px " + FONT; };
  const txt = (s, x, yy, align, maxW) => {
    s = String(s ?? ""); g.textAlign = align || "right";
    if (maxW && g.measureText(s).width > maxW) { while (s.length > 1 && g.measureText(s + "…").width > maxW) s = s.slice(0, -1); s += "…"; }
    g.fillText(s, x, yy);
  };
  const newPage = first => {
    cv = document.createElement("canvas"); cv.width = PW; cv.height = PH; g = cv.getContext("2d");
    g.direction = "rtl"; g.textBaseline = "middle"; g.fillStyle = "#fff"; g.fillRect(0, 0, PW, PH);
    pages.push(cv); g.fillStyle = teal;
    if (first) {
      font(44, 700); txt(rep.title, PW - PM, 86); font(26, 600); g.fillStyle = "#5a6e6c"; txt("دفتر العهد", PM, 86, "left");
      g.fillStyle = teal; g.fillRect(PM, 122, PW - 2 * PM, 4);
      const meta = [["العهدة", rep.custody + (rep.cn ? " (ع" + rep.cn + ")" : "")], ["أمين العهدة", rep.holder], ["الفترة", rep.period], ["مركز التكلفة", rep.ccLabel], ["تاريخ الطباعة", rep.printedAt], ["أعدّه", rep.by || "—"]];
      meta.forEach(([k, v], i) => { const col = i % 3, rw = Math.floor(i / 3), cx = PW - PM - col * 545, yy = 162 + rw * 40; font(24, 700); const kw = g.measureText(k + ":").width; g.fillStyle = "#5a6e6c"; txt(k + ":", cx, yy); font(24, 500); g.fillStyle = ink; txt(v, cx - kw - 14, yy, "right", 520 - kw - 14); });
      const bw = (PW - 2 * PM - 3 * 20) / 4, items = [["الرصيد الافتتاحي", rep.opening], ["إجمالي الوارد", rep.rec], ["إجمالي المنصرف", rep.sp], ["الرصيد الختامي", rep.closing]];
      items.forEach(([k, v], i) => { const x = PW - PM - (i + 1) * bw - i * 20; g.fillStyle = soft; g.fillRect(x, 250, bw, 90); g.strokeStyle = line; g.strokeRect(x, 250, bw, 90); g.fillStyle = "#5a6e6c"; font(22, 500); txt(k, x + bw - 18, 276); g.fillStyle = teal; font(34, 700); txt(fmt(v), x + bw - 18, 314); });
      y = 370;
    } else { font(24, 600); g.fillStyle = "#5a6e6c"; txt(rep.title + " — " + rep.custody, PW - PM, 60); g.fillStyle = line; g.fillRect(PM, 86, PW - 2 * PM, 2); y = 110; }
  };
  const widths = [150, 200, 280, 250, 260, 150, 150, 194]; // يمين -> يسار
  const heads = ["التاريخ", "المرجع", "البيان", "البند", "مركز التكلفة", "وارد", "منصرف", "الرصيد"];
  const colX = i => { let x = PW - PM; for (let k = 0; k < i; k++) x -= widths[k]; return x; };
  const RH = 40, LIM = PH - 90;
  const head = () => { g.fillStyle = teal; g.fillRect(PM, y, PW - 2 * PM, RH + 4); g.fillStyle = "#fff"; font(22, 700); heads.forEach((h, i) => txt(h, colX(i) - widths[i] / 2, y + RH / 2 + 2, "center")); y += RH + 4; };
  const cell = (cells, o) => {
    o = o || {};
    if (o.bg) { g.fillStyle = o.bg; g.fillRect(PM, y, PW - 2 * PM, RH); }
    g.strokeStyle = "#dfe7e5"; g.beginPath(); g.moveTo(PM, y + RH); g.lineTo(PW - PM, y + RH); g.stroke();
    g.fillStyle = ink; font(21, o.bold ? 700 : 400);
    cells.forEach((v, i) => { if (v === "" || v == null) return; const num = i >= 5, ctr = i < 2; g.direction = ctr || num ? "ltr" : "rtl"; txt(v, num ? colX(i) - widths[i] + 12 : ctr ? colX(i) - widths[i] / 2 : colX(i) - 12, y + RH / 2 + 1, num ? "left" : ctr ? "center" : "right", widths[i] - 24); g.direction = "rtl"; });
    y += RH;
  };
  newPage(true); head();
  cell(["", "", "الرصيد الافتتاحي", "", "", "", "", fmt(rep.opening)], { bold: true, bg: soft });
  rep.rows.forEach(r => {
    if (y + RH > LIM) { newPage(false); head(); }
    cell([r.date, r.ref, r.desc, r.category, r.cc, r.inn != null ? fmt(r.inn) : "", r.out != null ? fmt(r.out) : "", fmt(r.bal)]);
  });
  if (y + RH > LIM) { newPage(false); head(); }
  cell(["الإجمالي", "", "", "", "", fmt(rep.rec), fmt(rep.sp), fmt(rep.closing)], { bold: true, bg: soft });
  if (rep.ccLabel !== "كل المراكز") { y += 10; g.fillStyle = "#5a6e6c"; font(20, 400); txt("الرصيد في العمود الأخير هو رصيد العهدة الفعلي، وليس مقصوراً على المركز المختار.", PW - PM, y + 12); y += 28; }
  if (rep.summary.length) {
    const need = 70 + (rep.summary.length + 1) * RH;
    if (y + need > LIM) { newPage(false); } else y += 30;
    g.fillStyle = teal; font(28, 700); txt("المصروف حسب مركز التكلفة", PW - PM, y + 20); y += 50;
    const sw = [700, 200, 260], sx = i => { let x = PW - PM; for (let k = 0; k < i; k++) x -= sw[k]; return x; };
    g.fillStyle = teal; g.fillRect(PW - PM - 1160, y, 1160, RH); g.fillStyle = "#fff"; font(21, 700);
    ["مركز التكلفة", "عدد السندات", "إجمالي المصروف"].forEach((h, i) => txt(h, sx(i) - sw[i] / 2, y + RH / 2 + 1, "center")); y += RH;
    rep.summary.forEach(x => {
      g.strokeStyle = "#dfe7e5"; g.beginPath(); g.moveTo(PW - PM - 1160, y + RH); g.lineTo(PW - PM, y + RH); g.stroke();
      g.fillStyle = ink; font(21, 400); txt(x.name, sx(0) - 12, y + RH / 2 + 1, "right", sw[0] - 24); txt(String(x.count), sx(1) - sw[1] / 2, y + RH / 2 + 1, "center"); txt(fmt(x.total), sx(2) - sw[2] + 12, y + RH / 2 + 1, "left"); y += RH;
    });
  }
  if (y + 110 > LIM + 40) newPage(false);
  y = Math.max(y + 60, PH - 170);
  ["أمين العهدة", "المحاسب", "المدير المعتمد"].forEach((s, i) => { const w = 420, x = PW - PM - i * 560; g.fillStyle = "#5a6e6c"; font(22, 500); txt(s, x, y); g.fillStyle = ink; g.fillRect(x - w, y + 50, w, 2); });
  pages.forEach((p, i) => { const q = p.getContext("2d"); q.direction = "rtl"; q.textBaseline = "middle"; q.fillStyle = "#7a8b89"; q.font = "400 20px " + FONT; q.textAlign = "center"; q.fillText("صفحة " + (i + 1) + " من " + pages.length, PW / 2, PH - 34); });
  return pages;
}
function dataUrlBytes(u) { const b = atob(u.split(",")[1]), a = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; }
function buildPdf(pages) {
  const enc = new TextEncoder(), parts = [], offs = []; let pos = 0;
  const add = x => { const u = typeof x === "string" ? enc.encode(x) : x; parts.push(u); pos += u.length; };
  const n = pages.length, obj = (id, body) => { offs[id] = pos; add(id + " 0 obj\n"); add(body); add("\nendobj\n"); };
  add("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
  obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
  obj(2, "<< /Type /Pages /Count " + n + " /Kids [" + pages.map((_, i) => (3 + i * 3) + " 0 R").join(" ") + "] >>");
  pages.forEach((jpg, i) => {
    const p = 3 + i * 3, c = p + 1, im = p + 2, cs = "q 842 0 0 595 0 0 cm /Im0 Do Q";
    obj(p, "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /XObject << /Im0 " + im + " 0 R >> >> /Contents " + c + " 0 R >>");
    obj(c, "<< /Length " + cs.length + " >>\nstream\n" + cs + "\nendstream");
    offs[im] = pos; add(im + " 0 obj\n<< /Type /XObject /Subtype /Image /Width " + PW + " /Height " + PH + " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length " + jpg.length + " >>\nstream\n"); add(jpg); add("\nendstream\nendobj\n");
  });
  const total = 3 + n * 3, xr = pos;
  add("xref\n0 " + total + "\n0000000000 65535 f \n");
  for (let i = 1; i < total; i++) add(String(offs[i]).padStart(10, "0") + " 00000 n \n");
  add("trailer\n<< /Size " + total + " /Root 1 0 R >>\nstartxref\n" + xr + "\n%%EOF\n");
  return concatU8(parts);
}
async function exportPdf(btn) {
  const rep = reportData(); if (!rep) return toast("لا توجد عهدة لتصديرها");
  const old = btn && btn.textContent; if (btn) { btn.disabled = true; btn.textContent = "جارٍ التجهيز…"; }
  try {
    try { await Promise.all([document.fonts.load('400 22px "IBM Plex Sans Arabic"'), document.fonts.load('700 22px "IBM Plex Sans Arabic"')]); } catch (e) { /* الخط الاحتياطي يكفي */ }
    const pages = drawStatementPages(rep).map(c => dataUrlBytes(c.toDataURL("image/jpeg", 0.92)));
    saveBlob(new Blob([buildPdf(pages)], { type: "application/pdf" }), fileBase(rep) + ".pdf");
    toast("تم تنزيل ملف PDF");
  } catch (e) { console.error(e); toast("تعذر إنشاء ملف PDF"); }
  if (btn) { btn.disabled = false; btn.textContent = old; }
}
