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
