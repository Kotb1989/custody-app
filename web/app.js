"use strict";
(function(){
"use strict";
/* ---------- core: state, helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const CUR = "ر.س";
const ROLES = { admin: "مدير", custodian: "أمين عهدة", pending: "بانتظار التفعيل" };
const CATS = ["مشتريات ومستلزمات", "نقل ومواصلات", "ضيافة", "صيانة", "اتصالات وإنترنت", "رسوم حكومية", "سفر وإقامة", "أخرى"];
const TABS = [
  ["home", "لوحة التحكم", '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'],
  ["custodies", "العهد", '<rect x="3" y="7" width="18" height="12" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2M3 13h18"/>'],
  ["vouchers", "السندات", '<path d="M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h5"/>'],
  ["statement", "كشف الحساب", '<path d="M4 4h16v16H4zM4 9h16M9 9v11"/>'],
  ["costcenters", "مراكز التكلفة", '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"/>'],
  ["users", "المستخدمون", '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5M16 5.2a3 3 0 0 1 0 5.6M18 14.8c1.8.6 3 2.3 3 5.2"/>']
];
const PALS = [["teal", "أخضر مزرق", "#0F5257"], ["blue", "أزرق", "#1F4E9C"], ["green", "أخضر", "#2F6B2A"], ["plum", "بنفسجي", "#6B2D7A"], ["rust", "برتقالي محروق", "#A34A1E"]];

const S = { session: null, me: null, profiles: {}, custodies: [], entries: [], costCenters: [], ccMissing: false, loaded: false, err: "", adminExists: true };
const ui = { tab: "home", period: "month", custody: "all", sheet: null, q: "", kind: "all", from: "", to: "", stmtCustody: "", stmtCC: "", printOpen: false, showVoucher: null, confirm: null, created: null, signup: false, busy: false, prefill: "" };
let curPal = "teal";

const todayStr = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
const fmt = n => (Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money = (n, cls = "") => `<span class="num ${cls}">${fmt(n)}</span><span class="cur">${CUR}</span>`;
const dnum = d => `<span class="num">${esc(d)}</span>`;
const pad = (n, w = 4) => String(n).padStart(w, "0");
const vno = e => { const c = S.custodies.find(x => x.id === e.custodyId); return (c && c.cn ? "ع" + c.cn + "/" : "") + (e.kind === "topup" ? "إ-" : "س-") + pad(e.seq || 0); };
const roleOf = () => (S.me && S.me.active ? S.me.role : null);
const isAdminRole = () => roleOf() === "admin";
const canWrite = () => true;
const nameOf = id => (id && S.profiles[id] && S.profiles[id].name) || (id ? "مستخدم" : "");
const custodyById = id => S.custodies.find(c => c.id === id);
const ccSpent = id => S.entries.reduce((a, e) => a + (e.kind === "voucher" && e.status !== "cancelled" && e.ccId === id ? e.amount : 0), 0);
const ccById = id => S.costCenters.find(c => c.id === id);
const ccName = id => { const c = id && ccById(id); return c ? (c.code ? c.code + " - " : "") + c.name : ""; };
const visibleCustodies = () => {
  const r = roleOf();
  if (r === "admin") return S.custodies;
  if (r === "custodian") return S.custodies.filter(c => c.holderId === S.me.id);
  return [];
};
const visibleIds = () => new Set(visibleCustodies().map(c => c.id));
function totals(custodyId) {
  let rec = 0, sp = 0, n = 0;
  for (const e of S.entries) {
    if (e.custodyId !== custodyId || e.status === "cancelled") continue;
    if (e.kind === "topup") rec += e.amount; else { sp += e.amount; n++; }
  }
  return { rec, sp, n, bal: rec - sp };
}
function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.hidden = false;
  clearTimeout(toast.h); toast.h = setTimeout(() => { t.hidden = true; }, 3000);
}
function errMsg(e) {
  const m = String((e && e.message) || e || "");
  if (m.includes("insufficient_balance")) return "المبلغ أكبر من رصيد العهدة المتاح";
  if (m.includes("would_overdraw")) return "لا يمكن إلغاء هذا المبلغ لأن الرصيد سيصبح سالباً";
  if (m.includes("forbidden") || m.includes("row-level security")) return "ليست لديك صلاحية لهذه العملية";
  if (m.includes("foreign key")) return "لا يمكن الحذف لوجود حركات أو عهد مرتبطة";
  if (m.includes("Invalid login")) return "اسم المستخدم أو كلمة المرور غير صحيحة";
  if (m.includes("Email not confirmed")) return "الحساب غير مفعّل. عطّل خيار Confirm email في إعدادات Supabase.";
  if (m.includes("already registered") || m.includes("already been registered")) return "اسم المستخدم مستخدم من قبل";
  if (m.includes("Password should be")) return "كلمة المرور قصيرة. استخدم ٦ أحرف على الأقل.";
  if (m.includes("Failed to fetch") || m.includes("NetworkError")) return "تعذر الاتصال. تحقق من الإنترنت.";
  return "تعذر تنفيذ العملية. " + m;
}
function nextSeq(kind, cid) {
  let m = 0; for (const e of S.entries) if (e.kind === kind && e.custodyId === cid && (e.seq || 0) > m) m = e.seq;
  return m + 1;
}
function periodRange(p) {
  const d = new Date(), y = d.getFullYear(), m = d.getMonth();
  const s = x => x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0");
  if (p === "month") return [s(new Date(y, m, 1)), "9999"];
  if (p === "q") return [s(new Date(y, m - 2, 1)), "9999"];
  if (p === "year") return [s(new Date(y, 0, 1)), "9999"];
  return ["0000", "9999"];
}
function csvCell(v) { v = String(v ?? ""); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
const APP_URL = () => location.origin + location.pathname;
function genPassword() {
  const a = "abcdefghjkmnpqrstuvwxyz", n = "23456789", all = a + a.toUpperCase() + n;
  const rnd = k => { const b = new Uint32Array(1); crypto.getRandomValues(b); return b[0] % k; };
  let p = ""; for (let i = 0; i < 9; i++) p += all[rnd(all.length)];
  return p + n[rnd(n.length)];
}

/* ---------- data layer (Supabase) ---------- */
const CFG = window.APP_CONFIG || {};
const configured = !!(CFG.supabaseUrl && CFG.supabaseAnonKey && !/YOUR_|xxxx/i.test(CFG.supabaseUrl + CFG.supabaseAnonKey));
const EMAIL_DOMAIN = "@athr-custody.com";
const toEmail = u => { u = String(u).trim(); return u.includes("@") ? u : u.toLowerCase() + EMAIL_DOMAIN; };
const validUser = u => /^[a-z0-9._-]{3,30}$/i.test(String(u).trim());
let sb = null;

const mapP = r => ({ id: r.id, username: r.username, name: r.full_name || r.username, role: r.role, active: r.active !== false });
const mapC = r => ({ id: r.id, cn: r.cn, name: r.name, holderId: r.holder_id, holderLabel: r.holder_label || "", note: r.note || "" });
const mapCC = r => ({ id: r.id, code: r.code || "", name: r.name, active: r.active !== false, budget: Number(r.budget) || 0 });
const mapE = r => ({ ccId: r.cost_center_id || null, id: r.id, custodyId: r.custody_id, kind: r.kind, amount: Number(r.amount), date: r.entry_date, category: r.category || "", beneficiary: r.beneficiary || "", desc: r.description || "", seq: r.seq, status: r.status, by: r.created_by, byName: r.created_by_name || "", createdAt: Date.parse(r.created_at) || 0 });

async function fetchAll(table, col, asc) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from(table).select("*").order(col, { ascending: asc }).order("id").range(from, from + 999);
    if (error) throw error;
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}
async function loadAll() {
  const uid = S.session.user.id;
  const { data: me, error } = await sb.from("profiles").select("*").eq("id", uid).maybeSingle();
  if (error) throw error;
  S.me = me ? mapP(me) : null;
  S.custodies = []; S.entries = []; S.profiles = {}; S.costCenters = [];
  if (S.me) S.profiles[S.me.id] = S.me;
  if (S.me && S.me.active && S.me.role !== "pending") {
    const admin = S.me.role === "admin";
    S.ccMissing = false;
    const ccP = fetchAll("cost_centers", "created_at", true).catch(e => { S.ccMissing = true; return []; });
    const [cs, es, ps, ccs] = await Promise.all([
      fetchAll("custodies", "cn", true),
      fetchAll("entries", "created_at", false),
      admin ? fetchAll("profiles", "created_at", true) : Promise.resolve([]),
      ccP
    ]);
    S.costCenters = ccs.map(mapCC);
    S.custodies = cs.map(mapC);
    S.entries = es.map(mapE);
    ps.forEach(p => { S.profiles[p.id] = mapP(p); });
  }
  S.loaded = true;
}
/* ---------- auth ---------- */
async function checkAdminExists() {
  try {
    const { data, error } = await sb.rpc("admin_exists");
    if (error) throw error;
    S.adminExists = !!data;
  } catch (e) { S.adminExists = true; }
}
async function doLogin(username, password) {
  const { data, error } = await sb.auth.signInWithPassword({ email: toEmail(username), password });
  if (error) throw error;
  S.session = data.session;
}
async function doSignup(username, fullName, password) {
  const { data, error } = await sb.auth.signUp({ email: toEmail(username), password, options: { data: { full_name: fullName } } });
  if (error) throw error;
  if (!data.session) throw new Error("Email not confirmed");
  S.session = data.session;
}
async function doLogout() {
  try { await sb.auth.signOut(); } catch (e) { /* ignore */ }
  S.session = null; S.me = null; S.custodies = []; S.entries = []; S.profiles = {}; S.loaded = false;
  ui.tab = "home"; ui.sheet = null; ui.showVoucher = null; ui.created = null;
  await checkAdminExists();
  render();
}
/* المدير ينشئ مستخدماً: عميل مؤقت لا يحفظ جلسة حتى لا يُسجَّل خروج المدير */
async function createUser(username, fullName, password, role) {
  const tmp = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: "tmp-" + Date.now() }
  });
  const { data, error } = await tmp.auth.signUp({ email: toEmail(username), password, options: { data: { full_name: fullName } } });
  if (error) throw error;
  if (!data.user) throw new Error("تعذر إنشاء المستخدم");
  const { error: e2 } = await sb.from("profiles").update({ role, full_name: fullName, active: true }).eq("id", data.user.id);
  if (e2) throw e2;
  return data.user.id;
}

/* ---------- dashboard ---------- */
function monthKey(d) { return String(d).slice(0, 7); }
function monthLabel(key) {
  const [y, m] = key.split("-").map(Number);
  try { return new Date(y, m - 1, 1).toLocaleDateString("ar-SA-u-ca-gregory-nu-latn", { month: "short" }); } catch (e) { return String(m); }
}
function short(n) { return n >= 1e6 ? (n / 1e6).toFixed(1) + "م" : n >= 1e3 ? Math.round(n / 1e3) + "ك" : String(Math.round(n)); }
function monthlyChart(entries) {
  const keys = [], d = new Date();
  for (let i = 5; i >= 0; i--) { const x = new Date(d.getFullYear(), d.getMonth() - i, 1); keys.push(x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0")); }
  const rec = Object.fromEntries(keys.map(k => [k, 0])), sp = { ...rec };
  entries.forEach(e => { const k = monthKey(e.date); if (k in rec) (e.kind === "topup" ? rec : sp)[k] += e.amount; });
  const max = Math.max(1, ...keys.map(k => Math.max(rec[k], sp[k])));
  const W = 360, H = 190, R = 40, T = 12, B = 28, pw = W - R - 8, ph = H - T - B, step = pw / 6, bw = step * 0.32;
  const y = v => T + ph - (v / max) * ph;
  let g = "";
  [0, 0.5, 1].forEach(f => { const yy = y(max * f); g += `<line class="g" x1="8" x2="${W - R}" y1="${yy}" y2="${yy}"/><text x="${W - R + 6}" y="${yy + 4}" text-anchor="start">${short(max * f)}</text>`; });
  keys.forEach((k, i) => {
    const x0 = W - R - step * (i + 0.5);
    const hr = (rec[k] / max) * ph, hs = (sp[k] / max) * ph;
    g += `<rect x="${x0 - bw - 1}" y="${T + ph - hr}" width="${bw}" height="${hr}" rx="2" fill="var(--accent)"><title>${monthLabel(k)}: ${fmt(rec[k])}</title></rect>`;
    g += `<rect x="${x0 + 1}" y="${T + ph - hs}" width="${bw}" height="${hs}" rx="2" fill="var(--c2)"><title>${monthLabel(k)}: ${fmt(sp[k])}</title></rect>`;
    g += `<text x="${x0}" y="${H - 8}" text-anchor="middle">${esc(monthLabel(k))}</text>`;
  });
  return `<svg class="ch" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="المبالغ المضافة والمصروفة خلال آخر ستة أشهر">${g}</svg>`;
}
function dashHtml() {
  const vis = visibleCustodies();
  if (!vis.length) {
    return emptyBlock("لا توجد عهد بعد. أنشئ أول عهدة ثم أضف إليها مبلغاً وابدأ بسندات الصرف.",
      isAdminRole() && canWrite() ? `<div class="row"><button class="btn primary" data-act="sheet" data-type="custody">إنشاء عهدة</button></div>` : "");
  }
  const sel = ui.custody !== "all" && vis.some(c => c.id === ui.custody) ? ui.custody : "all";
  const ids = sel === "all" ? new Set(vis.map(c => c.id)) : new Set([sel]);
  const [from, to] = periodRange(ui.period);
  const all = S.entries.filter(e => e.status !== "cancelled" && ids.has(e.custodyId));
  const inP = all.filter(e => e.date >= from && e.date < to);
  const rec = inP.filter(e => e.kind === "topup").reduce((a, e) => a + e.amount, 0);
  const vs = inP.filter(e => e.kind === "voucher");
  const sp = vs.reduce((a, e) => a + e.amount, 0);
  const bal = [...ids].reduce((a, id) => a + totals(id).bal, 0);
  const cats = {}; vs.forEach(e => { const k = e.category || "أخرى"; cats[k] = (cats[k] || 0) + e.amount; });
  const catRows = Object.entries(cats).sort((a, b) => b[1] - a[1]);
  const maxC = catRows.length ? catRows[0][1] : 1;
  const ccRows = ccSummary(vs.map(e => ({ e }))).filter(x => x.total > 0);
  const maxCC = ccRows.length ? ccRows[0].total : 1;
  const low = vis.filter(c => { const t = totals(c.id); return t.rec > 0 && t.bal / t.rec < 0.15; });
  const recent = all.filter(e => e.kind === "voucher").sort((a, b) => (b.date + pad(b.seq)).localeCompare(a.date + pad(a.seq))).slice(0, 6);
  const per = [["month", "هذا الشهر"], ["q", "٣ أشهر"], ["year", "هذه السنة"], ["all", "الكل"]];
  return `
  <div class="title"><h2>لوحة التحكم</h2>
    <div class="row">${isAdminRole() && canWrite() ? `<button class="btn sm primary" data-act="sheet" data-type="custody">+ عهدة جديدة</button>` : ""}<select id="dashCustody" aria-label="العهدة" style="width:auto"><option value="all">كل العهد</option>${custodyOptions(sel)}</select></div></div>
  <div class="chips" role="group" aria-label="الفترة">${per.map(([k, l]) => `<button class="chip" data-act="period" data-p="${k}" aria-pressed="${ui.period === k}">${l}</button>`).join("")}</div>
  ${low.length ? `<div class="note">تنبيه: رصيد ${low.map(c => esc(c.name)).join("، ")} أقل من ١٥٪ من المبالغ المستلمة.</div>` : ""}
  <div class="grid">
    <div class="card kpi main"><small>الرصيد الحالي</small><b>${money(bal)}</b></div>
    <div class="card kpi"><small>المضاف في الفترة</small><b>${money(rec)}</b></div>
    <div class="card kpi"><small>المصروف في الفترة</small><b>${money(sp)}</b></div>
    <div class="card kpi"><small>عدد السندات</small><b><span class="num">${vs.length}</span></b></div>
  </div>
  <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr))">
    <div class="card"><div class="title"><h3>آخر ٦ أشهر</h3><span class="sub"><b style="color:var(--accent)">■</b> مضاف &nbsp;<b style="color:var(--c2)">■</b> مصروف</span></div>${monthlyChart(all)}</div>
    <div class="card"><h3 style="margin-bottom:10px">المصروف حسب البند</h3>${catRows.length ? catRows.map(([k, v]) => `
      <div style="margin-bottom:10px"><div class="row" style="justify-content:space-between;gap:8px"><span>${esc(k)}</span><span class="amt">${money(v)}</span></div>
      <div class="bar"><i style="width:${Math.max(3, v / maxC * 100)}%"></i></div></div>`).join("") : `<div class="empty">لا توجد سندات في هذه الفترة.</div>`}</div>
  </div>
  ${S.costCenters.length ? `<div class="card"><h3 style="margin-bottom:10px">المصروف حسب مركز التكلفة</h3>${ccRows.length ? ccRows.map(x => `
      <div style="margin-bottom:10px"><div class="row" style="justify-content:space-between;gap:8px"><span>${esc(x.name)}</span><span class="amt">${money(x.total)}</span></div>
      <div class="bar"><i style="width:${Math.max(3, x.total / maxCC * 100)}%"></i></div></div>`).join("") : `<div class="empty">لا توجد سندات في هذه الفترة.</div>`}</div>` : ""}
  <div class="card"><h3>أرصدة العهد</h3><div class="list">${vis.filter(c => sel === "all" || c.id === sel).map(c => {
    const t = totals(c.id), pct = t.rec ? Math.min(100, t.sp / t.rec * 100) : 0, cls = pct > 90 ? "bad" : pct > 75 ? "warn" : "";
    return `<div class="item"><div class="grow"><div class="t">${esc(c.name)}</div><div class="s">${esc(c.holderId ? nameOf(c.holderId) : c.holderLabel || "بدون أمين")}</div>
      <div class="bar ${cls}" style="margin-top:6px"><i style="width:${pct}%"></i></div></div><div class="amt">${money(t.bal)}</div></div>`;
  }).join("")}</div></div>
  <div class="card"><h3>آخر السندات</h3>${recent.length ? `<div class="list">${recent.map(voucherRow).join("")}</div>` : `<div class="empty">لا توجد سندات صرف بعد.</div>`}</div>`;
}
function voucherRow(e) {
  const c = custodyById(e.custodyId);
  return `<div class="item"><div class="grow"><div class="t"><span class="num">${vno(e)}</span> · ${esc(e.beneficiary || e.desc || "سند صرف")}</div>
    <div class="s">${esc(c ? c.name : "")} · ${esc(e.category || "")} · ${dnum(e.date)}</div></div>
    <div class="amt bad">${money(e.amount)}</div><button class="btn sm" data-act="showv" data-id="${esc(e.id)}">عرض</button></div>`;
}
/* ---------- custodies, vouchers, forms ---------- */
function canSpendFrom(c) { const r = roleOf(); return canWrite() && (r === "admin" || (r === "custodian" && c.holderId === S.me.id)); }
function custodiesHtml() {
  const vis = visibleCustodies(), adm = isAdminRole() && canWrite();
  return `<div class="title"><h2>العهد</h2>${adm ? `<div class="row"><button class="btn primary" data-act="sheet" data-type="custody">عهدة جديدة</button></div>` : ""}</div>` +
    (vis.length ? vis.map(c => {
      const t = totals(c.id), pct = t.rec ? Math.min(100, t.sp / t.rec * 100) : 0, cls = pct > 90 ? "bad" : pct > 75 ? "warn" : "";
      const holder = c.holderId ? nameOf(c.holderId) : (c.holderLabel || "بدون أمين عهدة");
      return `<div class="card"><div class="row" style="justify-content:space-between;align-items:flex-start">
        <div style="min-width:0"><h3>${esc(c.name)}</h3><div class="sub">أمين العهدة: ${esc(holder)}</div>${c.note ? `<div class="sub">${esc(c.note)}</div>` : ""}</div>
        <div style="text-align:end"><div class="sub">الرصيد</div><div class="amt" style="font-size:22px">${money(t.bal)}</div></div></div>
        <div class="bar ${cls}" style="margin:12px 0 6px"><i style="width:${pct}%"></i></div>
        <div class="row sub" style="justify-content:space-between"><span>المستلم: ${money(t.rec)}</span><span>المصروف: ${money(t.sp)} · <span class="num">${t.n}</span> سند</span></div>
        <div class="row" style="margin-top:12px">
          ${adm ? `<button class="btn sm" data-act="sheet" data-type="topup" data-id="${esc(c.id)}">إضافة مبلغ</button>` : ""}
          ${canSpendFrom(c) ? `<button class="btn sm primary" data-act="sheet" data-type="voucher" data-id="${esc(c.id)}">سند صرف</button>` : ""}
          <button class="btn sm" data-act="stmt" data-id="${esc(c.id)}">كشف الحساب</button>
          ${adm ? `<button class="btn sm" data-act="sheet" data-type="custody" data-id="${esc(c.id)}">تعديل</button>` : ""}
          ${adm && !S.entries.some(e => e.custodyId === c.id) ? `<button class="btn sm danger" data-act="delcustody" data-id="${esc(c.id)}">حذف</button>` : ""}
        </div></div>`;
    }).join("") : emptyBlock("لا توجد عهد لعرضها.", adm ? `<button class="btn primary" data-act="sheet" data-type="custody">إنشاء عهدة</button>` : ""));
}
function vouchersHtml() {
  const ids = visibleIds();
  const q = ui.q.trim().toLowerCase();
  let list = S.entries.filter(e => ids.has(e.custodyId) && (ui.kind === "all" || e.kind === ui.kind) && (ui.custody === "all" || e.custodyId === ui.custody));
  if (q) list = list.filter(e => [vno(e), e.beneficiary, e.desc, e.category].join(" ").toLowerCase().includes(q));
  list.sort((a, b) => (b.date + pad(b.seq)).localeCompare(a.date + pad(a.seq)));
  const kinds = [["voucher", "سندات الصرف"], ["topup", "المبالغ المضافة"], ["all", "الكل"]];
  const canNew = visibleCustodies().some(canSpendFrom);
  return `<div class="title"><h2>السندات</h2>${canNew ? `<button class="btn primary" data-act="sheet" data-type="voucher">سند صرف جديد</button>` : ""}</div>
    <div class="row"><input id="q" type="search" placeholder="بحث بالرقم أو المستفيد أو البيان" value="${esc(ui.q)}" style="flex:1;min-width:200px">
      <select id="vCustody" style="width:auto" aria-label="العهدة"><option value="all">كل العهد</option>${custodyOptions(ui.custody)}</select></div>
    <div class="chips">${kinds.map(([k, l]) => `<button class="chip" data-act="kind" data-k="${k}" aria-pressed="${ui.kind === k}">${l}</button>`).join("")}</div>
    <div class="card">${list.length ? `<div class="list">${list.map(entryRow).join("")}</div>` : `<div class="empty">لا توجد نتائج.</div>`}</div>`;
}
function entryRow(e) {
  const c = custodyById(e.custodyId), top = e.kind === "topup", x = e.status === "cancelled";
  return `<div class="item"><div class="grow"><div class="t"><span class="num">${vno(e)}</span> · ${esc(top ? (e.desc || "إضافة مبلغ للعهدة") : (e.beneficiary || e.desc || "سند صرف"))} ${x ? '<span class="pill bad">ملغي</span>' : ""}</div>
    <div class="s">${esc(c ? c.name : "")}${top ? "" : " · " + esc(e.category || "") + (e.ccId ? " · " + esc(ccName(e.ccId)) : "")} · ${dnum(e.date)}</div></div>
    <div class="amt ${top ? "good" : "bad"}" ${x ? 'style="text-decoration:line-through;opacity:.6"' : ""}>${top ? "+" : "−"}${money(e.amount)}</div>
    <button class="btn sm" data-act="showv" data-id="${esc(e.id)}">عرض</button></div>`;
}
function voucherCard(e) {
  const c = custodyById(e.custodyId), top = e.kind === "topup", x = e.status === "cancelled";
  const mine = e.by === S.me.id, canCancel = !x && canWrite() && (isAdminRole() || (mine && !top));
  return `<div class="voucher">${x ? '<div class="stamp">ملغي</div>' : ""}
    <div class="row" style="justify-content:space-between"><h3>${top ? "إيصال إضافة مبلغ" : "سند صرف"} <span class="num">${vno(e)}</span></h3><span class="row"><button class="btn sm" data-act="printv" data-id="${esc(e.id)}">معاينة الطباعة</button><button class="btn sm" data-act="closev">إغلاق</button></span></div>
    <dl><dt>العهدة</dt><dd>${esc(c ? c.name : "—")}</dd><dt>التاريخ</dt><dd>${dnum(e.date)}</dd><dt>المبلغ</dt><dd>${money(e.amount)}</dd>
    ${top ? "" : `<dt>المستفيد</dt><dd>${esc(e.beneficiary || "—")}</dd><dt>البند</dt><dd>${esc(e.category || "—")}</dd><dt>مركز التكلفة</dt><dd>${esc(ccName(e.ccId) || "—")}</dd>`}
    <dt>البيان</dt><dd>${esc(e.desc || "—")}</dd><dt>سجّله</dt><dd>${esc(e.byName || nameOf(e.by) || "—")}</dd></dl>
    ${canCancel ? (ui.confirm === e.id
      ? `<div class="row"><span class="sub">سيُستبعد هذا السند من الرصيد ويبقى ظاهراً كملغي.</span><button class="btn sm danger" data-act="cancelv" data-id="${esc(e.id)}">تأكيد الإلغاء</button><button class="btn sm" data-act="noconfirm">تراجع</button></div>`
      : `<div><button class="btn sm danger" data-act="askcancel" data-id="${esc(e.id)}">إلغاء السند</button></div>`) : ""}</div>`;
}
function sheetHtml() {
  let out = "";
  if (ui.showVoucher) { const e = S.entries.find(x => x.id === ui.showVoucher); if (e) out += voucherCard(e); }
  const s = ui.sheet; if (!s) return out;
  const close = `<button type="button" class="btn sm" data-act="closesheet">إغلاق</button>`;
  if (s.type === "custody") {
    const c = s.id ? custodyById(s.id) : null;
    const memberOpts = Object.values(S.profiles).filter(p => p.active && p.role !== "pending").map(p => p.id);
    return out + `<form class="card form" data-form="custody" data-id="${esc(s.id || "")}">
      <div class="full title"><h3>${c ? "تعديل العهدة" : "عهدة جديدة"}</h3>${close}</div>
      <div class="field"><label for="f_name">اسم العهدة</label><input id="f_name" name="name" required maxlength="80" value="${esc(c?.name || "")}" placeholder="مثال: عهدة المشاريع"></div>
      <div class="field"><label for="f_holder">أمين العهدة</label><select id="f_holder" name="holderId"><option value="">— بدون مستخدم —</option>
        ${memberOpts.map(id => `<option value="${esc(id)}"${c?.holderId === id ? " selected" : ""}>${esc(nameOf(id) || "مستخدم")}${id === S.me.id ? " (أنا)" : ""}</option>`).join("")}</select></div>
      <div class="field"><label for="f_label">أو اسم أمين العهدة (نص)</label><input id="f_label" name="holderLabel" maxlength="60" value="${esc(c?.holderLabel || "")}"></div>
      ${c ? "" : `<div class="field"><label for="f_open">المبلغ الافتتاحي (${CUR})</label><input id="f_open" name="opening" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0.00"></div>`}
      <div class="field full"><label for="f_note">ملاحظات</label><input id="f_note" name="note" maxlength="140" value="${esc(c?.note || "")}"></div>
      <div class="full"><button class="btn primary" type="submit">حفظ</button></div></form>`;
  }
  if (s.type === "topup") {
    const sel = s.id || visibleCustodies()[0]?.id;
    return out + `<form class="card form" data-form="topup"><div class="full title"><h3>إضافة مبلغ للعهدة</h3>${close}</div>
      <div class="field"><label for="f_c">العهدة</label><select id="f_c" name="custodyId" required>${custodyOptions(sel)}</select></div>
      <div class="field"><label for="f_amt">المبلغ (${CUR})</label><input id="f_amt" name="amount" type="number" min="0.01" step="0.01" inputmode="decimal" required></div>
      <div class="field"><label for="f_date">التاريخ</label><input id="f_date" name="date" type="date" required value="${todayStr()}"></div>
      <div class="field"><label for="f_desc">مصدر المبلغ / البيان</label><input id="f_desc" name="desc" maxlength="140" placeholder="مثال: تحويل بنكي من الخزينة"></div>
      <div class="full"><button class="btn primary" type="submit">إضافة المبلغ</button></div></form>`;
  }
  if (s.type === "voucher") {
    const list = visibleCustodies().filter(canSpendFrom), sel = s.id || list[0]?.id;
    if (!list.length) return out;
    return out + `<form class="card form" data-form="voucher"><div class="full title"><h3>سند صرف جديد <span class="sub num">${"س-" + pad(nextSeq("voucher", sel))}</span></h3>${close}</div>
      <div class="field"><label for="f_c">العهدة</label><select id="f_c" name="custodyId" required>${list.map(c => `<option value="${esc(c.id)}"${c.id === sel ? " selected" : ""}>${esc(c.name)} — الرصيد ${fmt(totals(c.id).bal)}</option>`).join("")}</select></div>
      <div class="field"><label for="f_amt">المبلغ (${CUR})</label><input id="f_amt" name="amount" type="number" min="0.01" step="0.01" inputmode="decimal" required></div>
      <div class="field"><label for="f_date">التاريخ</label><input id="f_date" name="date" type="date" required value="${todayStr()}"></div>
      <div class="field"><label for="f_cat">البند</label><select id="f_cat" name="category">${CATS.map(k => `<option>${esc(k)}</option>`).join("")}</select></div>
      ${S.costCenters.some(k => k.active) ? `<div class="field"><label for="f_cc">مركز التكلفة</label><select id="f_cc" name="costCenterId"><option value="">— بدون —</option>${S.costCenters.filter(k => k.active).map(k => `<option value="${esc(k.id)}">${esc(ccName(k.id))}</option>`).join("")}</select></div>` : ""}
      <div class="field"><label for="f_ben">المستفيد</label><input id="f_ben" name="beneficiary" maxlength="80" required placeholder="اسم المورد أو الجهة"></div>
      <div class="field"><label for="f_desc">البيان</label><input id="f_desc" name="desc" maxlength="160" placeholder="تفاصيل المصروف"></div>
      <div class="full"><button class="btn primary" type="submit">حفظ السند</button></div></form>`;
  }
  return out;
}
function stmtRows(custodyId, from, to, cc) {
  const all = S.entries.filter(e => e.custodyId === custodyId && e.status !== "cancelled")
    .sort((a, b) => (a.date + pad(a.createdAt || 0, 14) + pad(a.seq)).localeCompare(b.date + pad(b.createdAt || 0, 14) + pad(b.seq)));
  const sgn = e => e.kind === "topup" ? e.amount : -e.amount;
  let bal = 0, opening = 0, rec = 0, sp = 0; const rows = [];
  for (const e of all) {
    if (from && e.date < from) { bal += sgn(e); opening = bal; continue; }
    if (to && e.date > to) break;
    bal += sgn(e);
    if (cc === "none" ? e.ccId : (cc && e.ccId !== cc)) continue;
    if (e.kind === "topup") rec += e.amount; else sp += e.amount;
    rows.push({ e, bal });
  }
  return { opening, rows, rec, sp, closing: bal };
}
function ccSummary(rows) {
  const m = new Map();
  rows.forEach(({ e }) => { if (e.kind !== "voucher") return; const k = e.ccId || ""; const o = m.get(k) || { name: k ? ccName(k) : "بدون مركز تكلفة", count: 0, total: 0 }; o.count++; o.total += e.amount; m.set(k, o); });
  return [...m.values()].sort((a, b) => b.total - a.total);
}
function stmtCustodyId() {
  const vis = visibleCustodies();
  return vis.some(c => c.id === ui.stmtCustody) ? ui.stmtCustody : (vis[0]?.id || "");
}
function statementHtml() {
  const vis = visibleCustodies();
  if (!vis.length) return `<div class="title"><h2>كشف الحساب</h2></div>` + emptyBlock("لا توجد عهد لعرض كشف حسابها.");
  const id = stmtCustodyId(), c = custodyById(id), st = stmtRows(id, ui.from, ui.to, ui.stmtCC);
  const cancelled = S.entries.filter(e => e.custodyId === id && e.status === "cancelled").length;
  const sum = ccSummary(st.rows);
  return `<div class="title"><h2>كشف حساب العهدة</h2><div class="row">
      <button class="btn" data-act="printpreview">معاينة الطباعة</button><button class="btn" data-act="xlsx">Excel</button><button class="btn" data-act="pdf">PDF</button></div></div>
  <div class="card form"><div class="field"><label for="sCustody">العهدة</label><select id="sCustody">${custodyOptions(id)}</select></div>
    <div class="field"><label for="sFrom">من تاريخ</label><input id="sFrom" type="date" value="${esc(ui.from)}"></div>
    <div class="field"><label for="sTo">إلى تاريخ</label><input id="sTo" type="date" value="${esc(ui.to)}"></div>
    <div class="field"><label for="sCC">مركز التكلفة</label><select id="sCC"><option value="">كل المراكز</option><option value="none"${ui.stmtCC === "none" ? " selected" : ""}>بدون مركز تكلفة</option>${S.costCenters.map(k => `<option value="${esc(k.id)}"${ui.stmtCC === k.id ? " selected" : ""}>${esc(ccName(k.id))}</option>`).join("")}</select></div></div>
  <div class="card"><div class="row" style="justify-content:space-between"><div><h3>${esc(c.name)}</h3><div class="sub">أمين العهدة: ${esc(c.holderId ? nameOf(c.holderId) : c.holderLabel || "—")}</div></div>
    <div style="text-align:end"><div class="sub">الرصيد الختامي</div><div class="amt" style="font-size:22px">${money(st.closing)}</div></div></div></div>
  <div class="tbl"><table><thead><tr><th>التاريخ</th><th>المرجع</th><th>البيان</th><th>مركز التكلفة</th><th>وارد</th><th>منصرف</th><th>الرصيد</th></tr></thead><tbody>
    <tr><td colspan="6"><b>الرصيد الافتتاحي</b></td><td class="amt">${money(st.opening)}</td></tr>
    ${st.rows.map(({ e, bal }) => `<tr><td>${dnum(e.date)}</td><td><span class="num">${vno(e)}</span></td>
      <td class="wrapc">${esc(e.kind === "topup" ? (e.desc || "إضافة مبلغ") : [e.beneficiary, e.desc].filter(Boolean).join(" — ") || "سند صرف")}</td>
      <td>${esc(ccName(e.ccId))}</td>
      <td class="good">${e.kind === "topup" ? money(e.amount) : ""}</td><td class="bad">${e.kind === "voucher" ? money(e.amount) : ""}</td><td class="amt">${money(bal)}</td></tr>`).join("")}
    </tbody><tfoot><tr><td colspan="4">الإجمالي</td><td>${money(st.rec)}</td><td>${money(st.sp)}</td><td>${money(st.closing)}</td></tr></tfoot></table></div>
  ${ui.stmtCC ? `<div class="sub">الرصيد في العمود الأخير هو رصيد العهدة الفعلي، وليس مقصوراً على المركز المختار.</div>` : ""}
  ${sum.length ? `<div class="card"><h3 style="margin-bottom:8px">المصروف حسب مركز التكلفة</h3><div class="list">${sum.map(x => `<div class="item"><div class="grow"><div class="t">${esc(x.name)}</div><div class="s"><span class="num">${x.count}</span> سند</div></div><div class="amt">${money(x.total)}</div></div>`).join("")}</div></div>` : ""}
  ${cancelled ? `<div class="sub">لا يشمل الكشف <span class="num">${cancelled}</span> سنداً ملغياً.</div>` : ""}`;
}

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

/* ---------- shell, auth screens, users ---------- */
const brandHtml = `<div class="brand"><i><svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h3"/></svg></i><span>دفتر العهد</span></div>`;

function setupHtml() {
  return `<div class="auth">${brandHtml}<div class="card"><h2 style="margin-bottom:8px">الإعداد غير مكتمل</h2>
    <div class="sub">افتح الملف <b class="num">config.js</b> وضع فيه رابط مشروع Supabase والمفتاح العام (anon key)، ثم أعد تحميل الصفحة. الخطوات في ملف README.</div></div></div>`;
}
function loginHtml() {
  const first = !S.adminExists;
  return `<div class="auth">${brandHtml}
    <div class="card"><h2 style="margin-bottom:12px">${first && ui.signup ? "إنشاء حساب المدير" : "تسجيل الدخول"}</h2>
    ${first && ui.signup ? `
      <form data-form="signup"><div class="field"><label for="a_name">الاسم</label><input id="a_name" name="name" required maxlength="60" autocomplete="name"></div>
      <div class="field"><label for="a_user">اسم المستخدم (إنجليزي)</label><input id="a_user" name="username" required maxlength="30" autocapitalize="none" autocomplete="username" style="direction:ltr" placeholder="admin"></div>
      <div class="field"><label for="a_pass">كلمة المرور</label><input id="a_pass" name="password" type="password" required minlength="6" autocomplete="new-password" style="direction:ltr"></div>
      <button class="btn primary" type="submit"${ui.busy ? " disabled" : ""}>إنشاء الحساب</button>
      <button type="button" class="linkbtn" data-act="showlogin">لدي حساب بالفعل</button></form>` : `
      <form data-form="login"><div class="field"><label for="l_user">اسم المستخدم</label><input id="l_user" name="username" required autocapitalize="none" autocomplete="username" style="direction:ltr" value="${esc(ui.prefill)}"></div>
      <div class="field"><label for="l_pass">كلمة المرور</label><input id="l_pass" name="password" type="password" required autocomplete="current-password" style="direction:ltr"></div>
      <button class="btn primary" type="submit"${ui.busy ? " disabled" : ""}>دخول</button>
      ${first ? `<div class="note">لم يُنشأ حساب المدير بعد.</div><button type="button" class="linkbtn" data-act="showsignup">إنشاء حساب المدير الأول</button>` : ""}</form>`}
    </div><div class="sub" style="text-align:center">حسابات المستخدمين ينشئها المدير. إن نسيت كلمة المرور فاطلب من المدير.</div></div>`;
}

function viewHtml() {
  if (S.err && !S.loaded) return `<div class="card empty"><div>${esc(S.err)}</div><button class="btn" data-act="retry">إعادة المحاولة</button></div>`;
  if (!S.loaded) return `<div class="empty">جارٍ تحميل البيانات…</div>`;
  if (!S.me) return `<div class="card empty"><h2>الحساب غير مكتمل</h2><div>لم يُنشأ ملفك الشخصي بعد. تواصل مع المدير.</div></div>`;
  if (!S.me.active) return `<div class="card empty"><h2>الحساب موقوف</h2><div>أوقف المدير هذا الحساب. تواصل معه لإعادة التفعيل.</div></div>`;
  if (S.me.role === "pending") return `<div class="card empty"><h2>حسابك بانتظار التفعيل</h2><div>سيحدد المدير دورك ثم تظهر لك عهدتك هنا.</div></div>`;
  if ((ui.tab === "users" || ui.tab === "costcenters") && !isAdminRole()) ui.tab = "home";
  const body = { home: dashHtml, custodies: custodiesHtml, vouchers: vouchersHtml, statement: statementHtml, costcenters: costCentersHtml, users: usersHtml }[ui.tab]();
  const banner = (S.err ? `<div class="note">${esc(S.err)}</div>` : "") + (S.ccMissing && isAdminRole() ? `<div class="note">مراكز التكلفة غير مفعّلة بعد في قاعدة البيانات. شغّل الملف supabase/migration_002_cost_centers.sql من SQL Editor ثم حدّث الصفحة.</div>` : "");
  return banner + sheetHtml2() + body;
}
function sheetHtml2() {
  if (ui.sheet && ui.sheet.type === "cc") {
    const k = ui.sheet.id ? ccById(ui.sheet.id) : null;
    return `<form class="card form" data-form="cc" data-id="${esc(k ? k.id : "")}"><div class="full title"><h3>${k ? "تعديل مركز التكلفة" : "مركز تكلفة جديد"}</h3><button type="button" class="btn sm" data-act="closesheet">إغلاق</button></div>
      <div class="field"><label for="k_code">الرمز (اختياري)</label><input id="k_code" name="code" maxlength="20" value="${esc(k ? k.code : "")}" placeholder="مثال: P-101" style="direction:ltr"></div>
      <div class="field"><label for="k_name">اسم المركز</label><input id="k_name" name="name" required maxlength="80" value="${esc(k ? k.name : "")}" placeholder="مثال: مشروع برج الواحة"></div>
      <div class="field"><label for="k_budget">الميزانية (اختياري)</label><input id="k_budget" name="budget" type="number" min="0" step="0.01" inputmode="decimal" value="${k && k.budget ? k.budget : ""}" style="direction:ltr"></div>
      <div class="full"><button class="btn primary" type="submit">حفظ</button></div></form>`;
  }
  if (ui.sheet && ui.sheet.type === "ccbulk") {
    return `<form class="card form" data-form="ccbulk"><div class="full title"><h3>إضافة عدة مراكز دفعة واحدة</h3><button type="button" class="btn sm" data-act="closesheet">إغلاق</button></div>
      <div class="field full"><label for="k_bulk">سطر لكل مركز</label><textarea id="k_bulk" name="lines" rows="8" required placeholder="الاسم&#9;الميزانية&#10;حديد تسليح&#9;365640&#10;خرسانة&#9;164720"></textarea>
      <div class="sub">الأعمدة: الاسم فقط، أو الاسم ثم الميزانية، أو الرمز ثم الاسم ثم الميزانية. افصل بين الأعمدة بعلامة Tab (النسخ من Excel) أو بالرمز |</div></div>
      <div class="full"><button class="btn primary" type="submit">إضافة المراكز</button></div></form>`;
  }
  if (ui.sheet && ui.sheet.type === "pw") {
    return `<form class="card form" data-form="pw"><div class="full title"><h3>تغيير كلمة المرور</h3><button type="button" class="btn sm" data-act="closesheet">إغلاق</button></div>
      <div class="field"><label for="p_new">كلمة المرور الجديدة</label><input id="p_new" name="password" type="password" required minlength="6" autocomplete="new-password" style="direction:ltr"></div>
      <div class="field"><label for="p_new2">تأكيد كلمة المرور</label><input id="p_new2" name="password2" type="password" required minlength="6" autocomplete="new-password" style="direction:ltr"></div>
      <div class="full"><button class="btn primary" type="submit">حفظ</button></div></form>`;
  }
  return sheetHtml();
}
function emptyBlock(msg, btn) { return `<div class="card empty"><div>${msg}</div>${btn || ""}</div>`; }
function custodyOptions(sel, onlyWritable) {
  let list = visibleCustodies();
  if (onlyWritable && roleOf() === "custodian") list = list.filter(c => c.holderId === S.me.id);
  return list.map(c => `<option value="${esc(c.id)}"${c.id === sel ? " selected" : ""}>${esc(c.name)}</option>`).join("");
}

function costCentersHtml() {
  const [from, to] = periodRange(ui.period);
  const vs = S.entries.filter(e => e.kind === "voucher" && e.status !== "cancelled" && e.date >= from && e.date < to);
  const sum = new Map();
  vs.forEach(e => { const k = e.ccId || ""; const o = sum.get(k) || { count: 0, total: 0 }; o.count++; o.total += e.amount; sum.set(k, o); });
  const max = Math.max(1, ...[...sum.values()].map(x => x.total));
  const per = [["month", "هذا الشهر"], ["q", "٣ أشهر"], ["year", "هذه السنة"], ["all", "الكل"]];
  const row = (name, x, extra, badge, budget, all) => {
    const hasB = budget > 0, pct = hasB ? all / budget * 100 : 0, w = hasB ? Math.min(100, pct) : (x.total ? Math.max(3, x.total / max * 100) : 0);
    return `<div class="item"><div class="grow"><div class="t">${esc(name)} ${badge || ""}</div><div class="s"><span class="num">${x.count}</span> سند${hasB ? ` · الميزانية <span class="num">${fmt(budget)}</span> · المتبقي <span class="num">${fmt(budget - all)}</span> (<span class="num">${Math.round(pct)}%</span>)` : ""}</div>
      <div class="bar${hasB && pct > 100 ? " bad" : hasB && pct > 80 ? " warn" : ""}" style="margin-top:6px"><i style="width:${w}%"></i></div></div><div class="amt">${money(hasB ? all : x.total)}</div>${extra || ""}</div>`;
  };
  const un = sum.get("");
  return `<div class="title"><h2>مراكز التكلفة</h2><span class="row"><button class="btn" data-act="printcc">معاينة الطباعة</button><button class="btn" data-act="sheet" data-type="ccbulk">إضافة دفعة</button><button class="btn primary" data-act="sheet" data-type="cc">مركز جديد</button></span></div>
  <div class="chips" role="group" aria-label="الفترة">${per.map(([k, l]) => `<button class="chip" data-act="period" data-p="${k}" aria-pressed="${ui.period === k}">${l}</button>`).join("")}</div>
  <div class="card">${S.costCenters.length || un ? `<div class="list">${S.costCenters.map(k => {
    const used = S.entries.some(e => e.ccId === k.id);
    return row(ccName(k.id), sum.get(k.id) || { count: 0, total: 0 },
      `<button class="btn sm" data-act="sheet" data-type="cc" data-id="${esc(k.id)}">تعديل</button><button class="btn sm" data-act="cctoggle" data-id="${esc(k.id)}">${k.active ? "إيقاف" : "تفعيل"}</button>${used ? "" : `<button class="btn sm danger" data-act="ccdel" data-id="${esc(k.id)}">حذف</button>`}`,
      k.active ? "" : '<span class="pill warn">موقوف</span>', k.budget, ccSpent(k.id));
  }).join("")}${un ? row("بدون مركز تكلفة", un) : ""}</div>` : `<div class="empty">لا توجد مراكز تكلفة بعد. أضف مراكز مثل المشاريع أو الأقسام، ثم يختارها أمناء العهد عند تسجيل السند.</div>`}</div>
  <div class="sub">عند تحديد ميزانية للمركز يُقارن بها إجمالي مصروفه كله (وليس الفترة فقط). يحسب التقرير سندات الصرف غير الملغاة في الفترة المختارة. المركز الموقوف لا يظهر في نموذج السند لكن تبقى سنداته القديمة محسوبة.</div>`;
}

let rendering = false;
function render() {
  if (rendering) return; rendering = true;
  try {
    const authEl = $("#authView"), appEl = $("#app"), layer = $("#printLayer");
    if (ui.printOpen && configured && S.session) { appEl.hidden = true; authEl.hidden = true; layer.hidden = false; return; }
    layer.hidden = true;
    if (!configured || !S.session) {
      appEl.hidden = true; authEl.hidden = false;
      authEl.innerHTML = configured ? loginHtml() : setupHtml();
      return;
    }
    authEl.hidden = true; appEl.hidden = false;
    const r = roleOf();
    $("#whoName").textContent = S.me ? S.me.name : "";
    const wr = $("#whoRole"); wr.textContent = r ? ROLES[r] : (S.me ? "موقوف" : "");
    wr.className = "pill" + (r === "admin" || r === "custodian" ? "" : " warn");
    $("#pal").innerHTML = PALS.map(([k, label, col]) => `<button type="button" data-act="pal" data-p="${k}" style="background:${col}" title="${label}" aria-label="${label}" aria-pressed="${curPal === k}"></button>`).join("");
    $("#nav").innerHTML = TABS.filter(t => !["users", "costcenters"].includes(t[0]) || isAdminRole()).map(([k, label, ic]) =>
      `<button data-act="tab" data-tab="${k}"${ui.tab === k ? ' aria-current="page"' : ""}><svg viewBox="0 0 24 24">${ic}</svg><span>${label}</span></button>`).join("");
    $("#view").innerHTML = viewHtml();
  } catch (e) {
    console.error(e);
    $("#view").innerHTML = `<div class="empty">حدث خطأ أثناء العرض.</div>`;
  } finally { rendering = false; }
}

/* ---------- users (admin) ---------- */
function usersHtml() {
  const list = Object.values(S.profiles).sort((a, b) => a.name.localeCompare(b.name, "ar"));
  const created = ui.created;
  const msgOf = c => "مرحباً " + c.name + "\nرابط دفتر العهد: " + APP_URL() + "?u=" + c.username + "\nاسم المستخدم: " + c.username + "\nكلمة المرور: " + c.password + "\nيمكنك تغيير كلمة المرور بعد الدخول.";
  return `<div class="title"><h2>المستخدمون</h2></div>
  ${created ? `<div class="card"><div class="title"><h3>تم إنشاء حساب ${esc(created.name)}</h3><button class="btn sm" data-act="closecreated">إغلاق</button></div>
    <div class="credbox" style="margin:10px 0"><div>اسم المستخدم: <code>${esc(created.username)}</code></div><div>كلمة المرور: <code>${esc(created.password)}</code></div><div>الرابط: <code>${esc(APP_URL())}</code></div></div>
    <div class="row"><button class="btn" data-act="copycreated">نسخ البيانات</button><a class="btn primary" style="text-decoration:none" href="https://wa.me/?text=${encodeURIComponent(msgOf(created))}" target="_blank" rel="noopener">إرسال واتساب</a></div>
    <div class="note" style="margin-top:10px">كلمة المرور تظهر هنا مرة واحدة فقط. انسخها وأرسلها الآن.</div></div>` : ""}
  <div class="card"><div class="list">${list.map(p => {
    const mine = p.id === S.me.id;
    const held = S.custodies.filter(c => c.holderId === p.id).map(c => c.name).join("، ");
    return `<div class="item"><div class="grow"><div class="t">${esc(p.name)}${mine ? " (أنا)" : ""} <span class="pill ${p.role === "pending" || !p.active ? "warn" : ""}">${p.active ? esc(ROLES[p.role] || "") : "موقوف"}</span></div>
      <div class="s"><span class="num">${esc(p.username)}</span>${p.role === "custodian" ? " · العهد: " + esc(held || "لا توجد عهدة مسندة") : ""}</div></div>
      ${mine ? "" : `<select data-act="setrole" data-id="${esc(p.id)}" style="width:auto" aria-label="الدور"><option value="custodian"${p.role === "custodian" ? " selected" : ""}>أمين عهدة</option><option value="admin"${p.role === "admin" ? " selected" : ""}>مدير</option>${p.role === "pending" ? `<option value="pending" selected>بانتظار التفعيل</option>` : ""}</select>
      <button class="btn sm" data-act="toggleactive" data-id="${esc(p.id)}">${p.active ? "إيقاف" : "تفعيل"}</button>
      <a class="btn sm" style="text-decoration:none" href="https://wa.me/?text=${encodeURIComponent("مرحباً " + p.name + "، رابط دفتر العهد: " + APP_URL() + "?u=" + p.username + "\nاسم المستخدم: " + p.username)}" target="_blank" rel="noopener">إرسال الرابط</a>`}</div>`;
  }).join("")}</div></div>
  <div class="card"><h3 style="margin-bottom:6px">إضافة مستخدم</h3>
    <div class="sub" style="margin-bottom:10px">ينشئ المدير الحساب بكلمة مرور، ثم يرسل بيانات الدخول للمستخدم برابط خاص به. أمين العهدة لا يرى إلا عهدته ولا يستطيع إضافة رصيد.</div>
    <form data-form="createuser" class="form">
      <div class="field"><label for="u_name">الاسم</label><input id="u_name" name="name" required maxlength="60" placeholder="مثال: أحمد العلي"></div>
      <div class="field"><label for="u_user">اسم المستخدم (إنجليزي)</label><input id="u_user" name="username" required maxlength="30" autocapitalize="none" style="direction:ltr" placeholder="ahmed"></div>
      <div class="field"><label for="u_pass">كلمة المرور</label><div class="row" style="flex-wrap:nowrap"><input id="u_pass" name="password" required minlength="6" style="direction:ltr" value="${esc(genPassword())}"><button type="button" class="btn" data-act="genpw">توليد</button></div></div>
      <div class="field"><label for="u_role">الدور</label><select id="u_role" name="role"><option value="custodian">أمين عهدة</option><option value="admin">مدير</option></select></div>
      <div class="full"><button class="btn primary" type="submit"${ui.busy ? " disabled" : ""}>إنشاء الحساب</button></div></form></div>`;
}

/* ---------- actions ---------- */
const r2 = n => Math.round((Number(n) || 0) * 100) / 100;
async function q(p) { const r = await p; if (r.error) throw r.error; return r.data; }
function setPal(p, persist = true) {
  if (!PALS.some(x => x[0] === p)) p = "teal";
  curPal = p;
  if (p === "teal") document.documentElement.removeAttribute("data-pal"); else document.documentElement.setAttribute("data-pal", p);
  if (persist) { try { localStorage.setItem("pal", p); } catch (e) { /* optional */ } }
  render();
}
async function refresh(quiet) {
  if (!S.session || refresh.busy) return;
  refresh.busy = true;
  try { await loadAll(); S.err = ""; } catch (e) { if (!quiet) S.err = errMsg(e); }
  finally { refresh.busy = false; }
  const a = document.activeElement;
  const typing = quiet && (ui.sheet || (a && a.closest && a.closest("#view") && /^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName)));
  if (!typing) render();
}
function go(tab) {
  ui.tab = tab; ui.sheet = null; ui.showVoucher = null; ui.confirm = null;
  try { history.replaceState(null, "", "#" + tab); } catch (e) { /* optional */ }
  render(); window.scrollTo(0, 0);
}
async function run(fn, okMsg) {
  try { await fn(); if (okMsg) toast(okMsg); return true; }
  catch (e) { toast(errMsg(e)); return false; }
}
function adminCount() { return Object.values(S.profiles).filter(p => p.role === "admin" && p.active).length; }

async function submitForm(f) {
  const d = Object.fromEntries(new FormData(f).entries()), kind = f.dataset.form;
  if (kind === "login" || kind === "signup") {
    if (kind === "signup" && !validUser(d.username)) return toast("اسم المستخدم: ٣ إلى ٣٠ حرفاً إنجليزياً أو أرقاماً");
    ui.busy = true; render();
    try {
      if (kind === "login") await doLogin(d.username, d.password); else await doSignup(d.username, d.name.trim(), d.password);
      ui.busy = false; ui.signup = false; S.loaded = false; render(); await refresh();
    } catch (e) { ui.busy = false; render(); toast(errMsg(e)); }
    return;
  }
  if (kind === "pw") {
    if (d.password !== d.password2) return toast("كلمتا المرور غير متطابقتين");
    if (await run(async () => { const { error } = await sb.auth.updateUser({ password: d.password }); if (error) throw error; }, "تم تغيير كلمة المرور")) { ui.sheet = null; render(); }
    return;
  }
  if (kind === "createuser") {
    if (!validUser(d.username)) return toast("اسم المستخدم: ٣ إلى ٣٠ حرفاً إنجليزياً أو أرقاماً");
    ui.busy = true; render();
    const ok = await run(async () => { await createUser(d.username.trim(), d.name.trim(), d.password, d.role); ui.created = { name: d.name.trim(), username: d.username.trim().toLowerCase(), password: d.password }; }, "تم إنشاء الحساب");
    ui.busy = false;
    if (ok) await refresh(); else render();
    return;
  }
  if (kind === "ccbulk") {
    const rows = String(d.lines || "").split(/\r?\n/).map(l => l.split(/\t|\|/).map(x => x.trim())).filter(c => c.some(Boolean)).map(c => {
      const num = x => Number(String(x || "").replace(/,/g, "")) || 0;
      let code = "", name = c[0], budget = 0;
      if (c.length === 2) { name = c[0]; budget = num(c[1]); } else if (c.length >= 3) { code = c[0]; name = c[1]; budget = num(c[2]); }
      const r = { code, name }; if (budget > 0) r.budget = budget; return r;
    }).filter(r => r.name);
    if (!rows.length) return toast("لا توجد أسطر صالحة");
    if (rows.length > 300) return toast("الحد الأقصى ٣٠٠ مركز في المرة");
    const have = new Set(S.costCenters.map(k => k.name));
    const fresh = rows.filter(r => !have.has(r.name));
    if (!fresh.length) return toast("كل هذه المراكز موجودة مسبقاً");
    if (await run(() => q(sb.from("cost_centers").insert(fresh)), "تمت إضافة " + fresh.length + " مركز" + (rows.length > fresh.length ? " (تم تجاهل المكرر)" : ""))) { ui.sheet = null; await refresh(); }
    return;
  }
  if (kind === "cc") {
    const row = { code: (d.code || "").trim(), name: d.name.trim() };
    const bg = Number(d.budget) || 0; if (bg > 0 || f.dataset.id) row.budget = bg;
    const ok = await run(() => f.dataset.id ? q(sb.from("cost_centers").update(row).eq("id", f.dataset.id)) : q(sb.from("cost_centers").insert(row)), f.dataset.id ? "تم تحديث المركز" : "تمت إضافة المركز");
    if (ok) { ui.sheet = null; await refresh(); }
    return;
  }
  if (kind === "custody") {
    const base = { name: d.name.trim(), holder_id: d.holderId || null, holder_label: d.holderId ? "" : (d.holderLabel || "").trim(), note: (d.note || "").trim() };
    const ok = await run(async () => {
      if (f.dataset.id) { await q(sb.from("custodies").update(base).eq("id", f.dataset.id)); return; }
      const row = await q(sb.from("custodies").insert(base).select("id").single());
      const op = r2(d.opening);
      if (op > 0) await q(sb.from("entries").insert({ custody_id: row.id, kind: "topup", amount: op, entry_date: todayStr(), description: "رصيد افتتاحي" }));
    }, f.dataset.id ? "تم تحديث العهدة" : "تم إنشاء العهدة");
    if (ok) { ui.sheet = null; await refresh(); }
    return;
  }
  const amount = r2(d.amount);
  if (!(amount > 0)) return toast("أدخل مبلغاً صحيحاً");
  if (kind === "topup") {
    const ok = await run(() => q(sb.from("entries").insert({ custody_id: d.custodyId, kind: "topup", amount, entry_date: d.date, description: (d.desc || "").trim() })), "تمت إضافة المبلغ");
    if (ok) { ui.sheet = null; await refresh(); }
  } else if (kind === "voucher") {
    if (amount > totals(d.custodyId).bal + 0.0001) return toast("المبلغ أكبر من رصيد العهدة المتاح");
    const ok = await run(() => q(sb.from("entries").insert({ custody_id: d.custodyId, kind: "voucher", amount, entry_date: d.date, category: d.category, cost_center_id: d.costCenterId || null, beneficiary: d.beneficiary.trim(), description: (d.desc || "").trim() })), "تم حفظ سند الصرف");
    if (ok) { ui.sheet = null; await refresh(); }
  }
}
async function copyText(t) {
  try { await navigator.clipboard.writeText(t); toast("تم النسخ"); } catch (e) { toast("تعذر النسخ تلقائياً. حدد النص وانسخه."); }
}

/* ---------- events ---------- */
document.addEventListener("click", async ev => {
  const b = ev.target.closest("[data-act]"); if (!b || b.tagName === "SELECT") return;
  const a = b.dataset.act, id = b.dataset.id;
  if (a === "pal") return setPal(b.dataset.p);
  if (a === "tab") return go(b.dataset.tab);
  if (a === "logout") return doLogout();
  if (a === "retry") { S.err = ""; render(); return refresh(); }
  if (a === "showsignup") { ui.signup = true; return render(); }
  if (a === "showlogin") { ui.signup = false; return render(); }
  if (a === "pw") { ui.sheet = { type: "pw" }; ui.showVoucher = null; render(); return window.scrollTo(0, 0); }
  if (a === "sheet") { ui.sheet = { type: b.dataset.type, id }; ui.showVoucher = null; render(); return window.scrollTo(0, 0); }
  if (a === "closesheet") { ui.sheet = null; return render(); }
  if (a === "period") { ui.period = b.dataset.p; return render(); }
  if (a === "kind") { ui.kind = b.dataset.k; return render(); }
  if (a === "showv") { ui.showVoucher = id; ui.sheet = null; ui.confirm = null; render(); return window.scrollTo(0, 0); }
  if (a === "closev") { ui.showVoucher = null; ui.confirm = null; return render(); }
  if (a === "askcancel") { ui.confirm = id; return render(); }
  if (a === "noconfirm") { ui.confirm = null; return render(); }
  if (a === "cancelv") { if (await run(() => q(sb.rpc("cancel_entry", { p_id: id })), "تم إلغاء السند")) ui.confirm = null; return refresh(); }
  if (a === "stmt") { ui.stmtCustody = id; return go("statement"); }
  if (a === "printpreview") return openPrint();
  if (a === "printv") return openPrintVoucher(id);
  if (a === "printcc") return openPrintCC();
  if (a === "closeprint") return closePrint();
  if (a === "doprint") return window.print();
  if (a === "xlsx") return exportXlsx();
  if (a === "pdf") return exportPdf(b);
  if (a === "cctoggle") { const k = ccById(id); if (!k) return; return void (await run(() => q(sb.from("cost_centers").update({ active: !k.active }).eq("id", id)), k.active ? "تم إيقاف المركز" : "تم تفعيل المركز"), await refresh()); }
  if (a === "ccdel") {
    if (ui.confirm !== "k:" + id) { ui.confirm = "k:" + id; toast("اضغط مرة أخرى لتأكيد الحذف"); setTimeout(() => { if (ui.confirm === "k:" + id) ui.confirm = null; }, 4000); return; }
    ui.confirm = null;
    return void (await run(() => q(sb.from("cost_centers").delete().eq("id", id)), "تم حذف المركز"), await refresh());
  }
  if (a === "genpw") { const i = $("#u_pass"); if (i) i.value = genPassword(); return; }
  if (a === "closecreated") { ui.created = null; return render(); }
  if (a === "copycreated") { const c = ui.created; if (c) copyText("مرحباً " + c.name + "\nرابط دفتر العهد: " + APP_URL() + "?u=" + c.username + "\nاسم المستخدم: " + c.username + "\nكلمة المرور: " + c.password); return; }
  if (a === "toggleactive") {
    const p = S.profiles[id]; if (!p) return;
    if (p.active && p.role === "admin" && adminCount() <= 1) return toast("لا يمكن إيقاف المدير الوحيد");
    return void (await run(() => q(sb.from("profiles").update({ active: !p.active }).eq("id", id)), p.active ? "تم إيقاف الحساب" : "تم تفعيل الحساب"), await refresh());
  }
  if (a === "delcustody") {
    if (ui.confirm !== "d:" + id) { ui.confirm = "d:" + id; toast("اضغط مرة أخرى لتأكيد حذف العهدة"); setTimeout(() => { if (ui.confirm === "d:" + id) ui.confirm = null; }, 4000); return; }
    ui.confirm = null;
    return void (await run(() => q(sb.from("custodies").delete().eq("id", id)), "تم حذف العهدة"), await refresh());
  }
});
document.addEventListener("change", async ev => {
  const t = ev.target, i = t.id;
  if (i === "dashCustody" || i === "vCustody") { ui.custody = t.value; render(); }
  else if (i === "sCustody") { ui.stmtCustody = t.value; render(); }
  else if (i === "sCC") { ui.stmtCC = t.value; render(); }
  else if (i === "sFrom") { ui.from = t.value; render(); }
  else if (i === "sTo") { ui.to = t.value; render(); }
  else if (t.dataset && t.dataset.act === "setrole") {
    const p = S.profiles[t.dataset.id]; if (!p) return;
    if (p.role === "admin" && t.value !== "admin" && adminCount() <= 1) { toast("لا يمكن تغيير دور المدير الوحيد"); return render(); }
    await run(() => q(sb.from("profiles").update({ role: t.value }).eq("id", p.id)), "تم تحديث الدور"); await refresh();
  }
});
document.addEventListener("input", ev => {
  const t = ev.target;
  if (t.id === "q") { ui.q = t.value; const pos = t.selectionStart; render(); const el = $("#q"); if (el) { el.focus(); el.setSelectionRange(pos, pos); } }
});
document.addEventListener("submit", ev => { const f = ev.target.closest("form[data-form]"); if (f) { ev.preventDefault(); submitForm(f); } });

/* ---------- boot ---------- */
(async function boot() {
  try { const sp = localStorage.getItem("pal"); if (sp) { curPal = PALS.some(x => x[0] === sp) ? sp : "teal"; if (curPal !== "teal") document.documentElement.setAttribute("data-pal", curPal); } } catch (e) { /* optional */ }
  ui.prefill = (new URLSearchParams(location.search).get("u") || "").replace(/[^a-z0-9._-]/gi, "");
  const h = (location.hash || "").slice(1); if (TABS.some(t => t[0] === h)) ui.tab = h;
  if (!configured || !window.supabase) { render(); return; }
  sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey);
  try { const { data } = await sb.auth.getSession(); S.session = data.session; } catch (e) { S.session = null; }
  sb.auth.onAuthStateChange((evn, session) => { if (session) S.session = session; });
  if (S.session) { render(); await refresh(); } else { await checkAdminExists(); render(); }
  document.addEventListener("visibilitychange", () => { if (!document.hidden && S.session) refresh(true); });
  setInterval(() => { if (!document.hidden && S.session) refresh(true); }, 60000);
})();

})();
