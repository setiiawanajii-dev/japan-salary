import {
  DEFAULT_SETTINGS,
  JAPAN_STANDARD,
  DAY_TYPES,
  isLeave,
  validateSettings,
} from "./engine/settings.js";
import {
  calculateMonthlySalary,
  calculateHourlyBase,
} from "./engine/salaryEngine.js";
import {
  calculatePayPeriod,
  periodForDate,
  formatJPY as yen,
  formatMinutes as hm,
  parseDate,
  addDays,
  monthDate,
} from "./engine/payPeriodCalculator.js";
import {
  calculateWorkedMinutes,
  calculateBreakMinutes,
  calculateNightMinutes,
  validateEntry,
} from "./engine/timeCalculator.js";
import {
  loadData,
  saveData,
  emptyData,
  validateData,
  download,
  csvCell,
} from "./storage.js";
import { demoData } from "./demo.js";
const $ = (s) => document.querySelector(s),
  esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
let data;
let storageError = "";
try {
  data = loadData();
} catch (e) {
  data = emptyData();
  storageError = e.message;
}
const today = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());
let month = periodForDate(today, data.settings.closingDay),
  calendarMonth = today.slice(0, 7),
  page = "home",
  salaryTab = "slip",
  settingsTab = "company",
  wizard = 0,
  installPrompt = null;
const t = (id, ja) => (data.settings.language === "ja" ? ja : id);
const dayLabel = (k) =>
  ({
    normal: t("Kerja normal", "通常勤務"),
    saturday: t("Sabtu", "土曜日"),
    sunday: t("Minggu", "日曜日"),
    companyHoliday: t("Libur perusahaan", "会社休日"),
    statutoryHoliday: t("Libur statutory", "法定休日"),
    paidLeave: t("Cuti dibayar", "有給休暇"),
    absence: t("Tidak masuk", "欠勤"),
    specialLeave: t("Cuti khusus", "特別休暇"),
  })[k] || k;
const disclaimer = () =>
  t(
    "Perhitungan aplikasi ini merupakan estimasi. Gaji sebenarnya dapat berbeda tergantung kontrak kerja, peraturan perusahaan, sistem jam kerja, tunjangan, potongan, pajak, dan ketentuan lain yang berlaku.",
    "このアプリの計算結果は給与の目安です。実際の給与は勤務先の就業規則、雇用契約、給与明細等をご確認ください。",
  );
const paths = {
  home: "M3 10l9-7 9 7v10H3z M9 20v-7h6v7",
  clock: "M12 8v5l3 2 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
  calendar: "M4 5h16v16H4z M4 10h16 M8 3v4 M16 3v4 M8 14h2 M14 14h2 M8 18h2",
  wallet: "M3 6h17v15H3z M3 6l14-3v3 M15 12h6v5h-6z",
  settings:
    "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M12 2v3 M12 19v3 M2 12h3 M19 12h3 M5 5l2 2 M17 17l2 2 M5 19l2-2 M17 7l2-2",
  plus: "M12 5v14 M5 12h14",
  arrow: "M5 12h14 M14 7l5 5-5 5",
  chevron: "M9 5l7 7-7 7",
  moon: "M20 15A9 9 0 0 1 9 3a9 9 0 1 0 11 12",
  chart: "M4 20V10 M10 20V4 M16 20v-8 M22 20H2",
  check: "M5 12l4 4L19 6",
  shield: "M12 3l8 3v6c0 5-8 9-8 9s-8-4-8-9V6z M8 12l3 3 5-6",
  download: "M12 3v12 M7 10l5 5 5-5 M4 17v4h16v-4",
  trash: "M4 6h16 M9 6V3h6v3 M6 6l1 15h10l1-15 M10 10v7 M14 10v7",
  edit: "M4 16l12-12 4 4L8 20H4z M13 7l4 4",
  close: "M6 6l12 12 M6 18L18 6",
  info: "M12 11v6 M12 7v1 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
};
const icon = (k) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[k] || paths.clock}"/></svg>`;
function toast(msg) {
  $("#toast").textContent = msg;
  $("#toast").classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => $("#toast").classList.remove("show"), 4500);
}
function commit(next) {
  try {
    data = saveData(next);
    return true;
  } catch (e) {
    toast(t("Gagal menyimpan: ", "保存できません: ") + e.message);
    return false;
  }
}
let reportData = null;
const reportCache = new Map();
function report(m = month) {
  if (reportData !== data) {
    reportCache.clear();
    reportData = data;
  }
  if (!reportCache.has(m))
    reportCache.set(
      m,
      calculateMonthlySalary(
        data.entries,
        data.settings,
        m,
        data.allowances,
        data.deductions,
      ),
    );
  return reportCache.get(m);
}
const monthLabel = (m) =>
  new Intl.DateTimeFormat(t("id-ID", "ja-JP"), {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(parseDate(m + "-01"));
const dateLabel = (d, short = false) =>
  new Intl.DateTimeFormat(t("id-ID", "ja-JP"), {
    day: "numeric",
    month: short ? "short" : "long",
    ...(!short ? { year: "numeric" } : {}),
    timeZone: "UTC",
  }).format(parseDate(d));
const fmtDate = (d) => dateLabel(d, true);
const field = (name, label, value, type = "number", attrs = "") =>
  `<label class="field">${label}<input name="${name}" type="${type}" value="${esc(value)}" ${attrs}></label>`;
const options = (items, value) =>
  items
    .map(
      ([v, l]) =>
        `<option value="${esc(v)}" ${String(v) === String(value) ? "selected" : ""}>${esc(l)}</option>`,
    )
    .join("");
const select = (name, label, items, value) =>
  `<label class="field">${label}<select name="${name}">${options(items, value)}</select></label>`;
const line = (label, value, cls = "") =>
  `<div class="line ${cls}"><span>${label}</span><strong>${value}</strong></div>`;
function periodControl(cal = false) {
  return `<div class="period"><button data-action="month-prev" data-cal="${cal}" aria-label="${t("Bulan sebelumnya", "前月")}">‹</button><input aria-label="${t("Pilih bulan", "月を選択")}" type="month" id="${cal ? "calendar-month" : "period-month"}" value="${cal ? calendarMonth : month}" required><button data-action="month-next" data-cal="${cal}" aria-label="${t("Bulan berikutnya", "翌月")}">›</button></div>`;
}
const nav = () =>
  [
    ["home", "home", t("Beranda", "ホーム")],
    ["work", "clock", t("Jam kerja", "勤務")],
    ["calendar", "calendar", t("Kalender", "カレンダー")],
    ["salary", "wallet", t("Gaji", "給料")],
    ["settings", "settings", t("Pengaturan", "設定")],
  ]
    .map(
      ([p, i, l]) =>
        `<button class="nav-btn ${p === page ? "active" : ""}" data-page="${p}" ${p === page ? 'aria-current="page"' : ""}>${icon(i)}<span>${l}</span></button>`,
    )
    .join("");
function applyTheme() {
  document.documentElement.lang = data.settings.language;
  document.documentElement.removeAttribute("data-theme");
  if (data.settings.theme !== "system")
    document.documentElement.dataset.theme = data.settings.theme;
}
const closingDialogs = new WeakMap();
const regionMotions = new WeakMap();
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function cancelDialogClose(dialog) {
  const running = closingDialogs.get(dialog);
  if (running) { closingDialogs.delete(dialog); running.cancel(); }
}
async function closeDialog(dialog) {
  if (!dialog.open || closingDialogs.has(dialog)) return;
  if (reduceMotion() || !dialog.animate) { dialog.close(); return; }
  const animation = dialog.animate(
    [{opacity:1,transform:'translateY(0)'},{opacity:0,transform:'translateY(14px)'}],
    {duration:150,easing:'cubic-bezier(.4,0,1,1)',fill:'forwards'}
  );
  closingDialogs.set(dialog,animation);
  try { await animation.finished; } catch { return; }
  if (closingDialogs.get(dialog) !== animation) return;
  closingDialogs.delete(dialog);
  dialog.close();
  animation.cancel();
}
function toggleRegion(element, hidden, animate) {
  const running = regionMotions.get(element);
  if (running?.hidden === hidden) return;
  if (!running && element.hidden === hidden) return;
  const height = element.hidden ? 0 : element.getBoundingClientRect().height;
  if (running) { regionMotions.delete(element); running.animation.cancel(); }
  element.inert = hidden;
  element.setAttribute('aria-hidden', String(hidden));
  if (!animate || reduceMotion() || !element.animate) { element.hidden = hidden; return; }
  element.hidden = false;
  const target = hidden ? 0 : element.getBoundingClientRect().height;
  const animation = element.animate(
    [{height:height+'px',opacity:hidden?1:0,overflow:'hidden'},
     {height:target+'px',opacity:hidden?0:1,overflow:'hidden'}],
    {duration:200,easing:'cubic-bezier(.2,.8,.2,1)',fill:'both'}
  );
  regionMotions.set(element,{animation,hidden});
  animation.finished.then(() => {
    if (regionMotions.get(element)?.animation !== animation) return;
    element.hidden = hidden;
    regionMotions.delete(element);
    animation.cancel();
  }).catch(() => {});
}
$('#sheet').addEventListener('cancel', event => {
  event.preventDefault();
  closeDialog($('#sheet'));
});
function render() {
  applyTheme();
  if (!data.onboarded) {
    renderOnboarding();
    return;
  }
  $("#app").innerHTML =
    `<div class="layout"><aside class="sidebar"><div class="brand"><img src="./icon.svg" alt=""><div><b>Japan Salary<br>Calculator</b><small>日本給与計算</small></div></div><div class="eyebrow">${t("Ruang kerja", "ワークスペース")}</div><nav aria-label="${t("Navigasi utama", "メインナビゲーション")}">${nav()}</nav><div class="side-bottom"><span class="secure-dot"></span>${t("Tersimpan di perangkat", "この端末に保存")}<br><small>${t("Bekerja tenang. Hitung jelas.", "毎日の勤務を、もっと明確に。")}</small></div></aside><main class="main"><header class="topbar"><span class="crumb">${t("Ruang kerja saya", "マイワークスペース")} <span style="margin:0 8px">/</span> ${({home:t("Beranda","ホーム"),work:t("Jam kerja","勤務"),calendar:t("Kalender","カレンダー"),salary:t("Gaji","給料"),settings:t("Pengaturan","設定")})[page]}</span><span class="mobile-brand"><img src="./icon.svg" alt="">Japan Salary</span><div class="tools"><button data-action="language" class="language">${data.settings.language === "id" ? "🇮🇩 ID" : "🇯🇵 日本語"}</button><div class="avatar">${esc((data.settings.name || "JS").slice(0, 2).toUpperCase())}</div></div></header><div class="page-content">${page === "home" ? dashboard() : page === "work" ? workPage() : page === "calendar" ? calendarPage() : page === "salary" ? salaryPage() : settingsPage()}</div><p class="disclaimer">${icon("shield")}<span>${disclaimer()}</span></p></main><nav class="bottom-nav" aria-label="${t("Navigasi mobile", "モバイルナビゲーション")}">${nav()}</nav></div>`;
  bindForms();
}
function heading(title, subtitle, action = true) {
  return `<div class="heading"><div><h1 tabindex="-1">${title}</h1><p>${subtitle}</p></div>${action ? `<button class="primary" data-action="add">${icon("plus")}<span>${t("Tambah jam kerja", "勤務を追加")}</span></button>` : ""}</div>`;
}
function workRows(rows, limit = Infinity) {
  return rows.length
    ? `<div class="rows">${[...rows]
        .reverse()
        .slice(0, limit)
        .map(
          (e) =>
            `<div class="work-row" role="button" tabindex="0" data-entry="${esc(e.id)}"><div class="date-box">${e.date.slice(8)}<small>${new Intl.DateTimeFormat(t("id-ID", "ja-JP"), { month: "short", timeZone: "UTC" }).format(parseDate(e.date))}</small></div><div class="details"><strong>${isLeave(e.dayType) ? dayLabel(e.dayType) : `${esc(e.clockIn)} <span class="muted">→</span> ${esc(e.clockOut)}${e.clockOutNextDay || e.clockOut < e.clockIn ? " ⁺¹" : ""}`}</strong><small><span class="dot ${e.statutoryHolidayMinutes ? "red" : e.nightMinutes ? "purple" : e.statutoryOvertimeMinutes ? "orange" : ""}"></span>${dayLabel(e.dayType)}${e.statutoryOvertimeMinutes ? ` · ${t("Lembur", "残業")} ${hm(e.statutoryOvertimeMinutes)}` : ""}</small></div><div class="amount"><strong>${hm(e.workedMinutes)}</strong><small>${data.settings.salaryType === "monthly" ? t("Jam kerja", "勤務時間") : yen(e.pay.total)}</small></div>${icon("chevron")}</div>`,
        )
        .join("")}</div>`
    : `<div class="empty">${icon("clock")}<br>${t("Belum ada catatan di periode ini.", "この期間の勤務記録はありません。")}<br><button data-action="add" class="text-btn">${t("+ Catat jam kerja pertama", "+ 最初の勤務を記録")}</button></div>`;
}
function breakdown(r) {
  return `<div class="breakdown">${line(t("Gaji dasar", "基本給"), yen(r.base))}${line(t("Lembur perusahaan", "法定内残業"), yen(r.within))}${line(t("Lembur statutory", "法定外残業"), yen(r.overtime))}${line(t("Tambahan malam", "深夜手当"), yen(r.night))}${line(t("Kerja hari libur statutory", "法定休日勤務"), yen(r.holiday))}${line(t("Tunjangan", "手当"), yen(r.allowanceTotal), "positive")}${line(t("Gaji kotor", "総支給額"), yen(r.gross), "total")}${line(t("Potongan", "控除"), `− ${yen(r.deductionTotal)}`, "negative")}${line(t("Gaji bersih", "手取り"), yen(r.net), "total")}</div>`;
}
function dashboard() {
  const r = report(),
    days = Math.ceil(
      (+parseDate(r.period.paymentDate) - +parseDate(today)) / 86400000,
    );
  return `${heading(t(`Halo${data.settings.name ? ", " + esc(data.settings.name) : ""} 👋`, `こんにちは${data.settings.name ? "、" + esc(data.settings.name) : ""} 👋`), t("Setiap jam kerja Anda, tercatat dengan jelas.", "毎日の勤務と給与を、ひと目で。"))}<div class="section-head"><div class="eyebrow" style="margin:0">${t("Ringkasan periode", "給与期間の概要")}</div>${periodControl()}</div><div class="dashboard-grid"><section class="card hero"><div><div class="section-head"><span class="eyebrow" style="margin:0">${t("Estimasi gaji bersih", "予想手取り")}</span><span class="pill">${t("ESTIMASI", "目安")}</span></div><h2>${yen(r.net)}</h2><span class="pill">${t("Berdasarkan catatan tersimpan", "保存済みの勤務記録に基づく")}</span></div><div class="hero-foot"><div>${t("Gaji kotor", "総支給額")}<b>${yen(r.gross)}</b></div><div>${t("Total potongan", "控除合計")}<b>${yen(r.deductionTotal)}</b></div><div>${t("Hari kerja", "勤務日数")}<b>${r.workDays} ${t("hari", "日")}</b></div></div></section><section class="card payday"><div><div class="icon-circle">${icon("calendar")}</div><div class="eyebrow">${t("Tanggal gajian", "支給予定日")}</div><h2>${fmtDate(r.period.paymentDate)}</h2></div><div><p>${days >= 0 ? t(`${days} hari lagi`, `あと${days}日`) : t(`${-days} hari lalu`, `${-days}日前`)}</p><p style="margin-top:9px">${t("Periode kerja", "勤務期間")}<br><strong>${fmtDate(r.period.start)} – ${fmtDate(r.period.end)}</strong></p></div></section></div><div class="stats">${[
    [t("Total jam kerja", "総勤務時間"), "勤務時間", r.workedMinutes, "clock"],
    [
      t("Lembur statutory", "法定外残業"),
      "時間外労働",
      r.statutoryOvertimeMinutes,
      "chart",
    ],
    [t("Kerja malam", "深夜勤務"), "22:00–05:00", r.nightMinutes, "moon"],
    [t("Jam normal", "通常勤務"), "所定労働", r.normalMinutes, "check"],
  ]
    .map(
      ([l, j, v, i]) =>
        `<div class="card stat"><div class="stat-icon">${icon(i)}</div><b>${hm(v)} <span style="font-size:11px;font-weight:400" class="muted">${t("jam", "時間")}</span></b><small>${l}</small><div class="jp">${j === "22:00–05:00" ? esc(data.settings.nightStart + "–" + data.settings.nightEnd) : j}</div></div>`,
    )
    .join(
      "",
    )}</div><div class="dashboard-grid"><section class="card"><div class="section-head"><h2>${t("Aktivitas terbaru", "最近の勤務")}</h2><button class="text-btn" data-page="work">${t("Lihat semua", "すべて見る")} →</button></div>${workRows(r.entries, 4)}</section><section class="card"><div class="section-head"><h2>${t("Rincian gaji", "給与の内訳")}</h2><span class="pill">JPY</span></div>${breakdown(r)}</section><section class="card wide"><div class="section-head"><h2>${t("Perjalanan gaji Anda", "給与の推移")}</h2><small>${t("6 periode terakhir · data asli", "直近6期間 · 実際の記録")}</small></div>${chart()}</section></div>`;
}
function chart() {
  const [y, m] = month.split("-").map(Number);
  const rs = Array.from({ length: 6 }, (_, i) => {
    const key = monthDate(y, m - 6 + i, 1).slice(0, 7),
      r = report(key);
    return { month: key, r, hasData: r.entries.length > 0 };
  });
  const max = Math.max(
    1,
    ...rs.filter((x) => x.hasData).map((x) => Math.abs(x.r.net)),
  );
  return `<div class="chart">${rs.map((x) => `<div class="chart-bar"><b>${x.hasData ? yen(x.r.net) : "—"}</b><div class="bar" style="height:${x.hasData ? Math.max(2, (Math.abs(x.r.net) / max) * 80) : 2}px;${x.hasData && x.r.net < 0 ? "background:var(--red)" : ""}" title="${esc(monthLabel(x.month))}: ${x.hasData ? yen(x.r.net) : t("Belum ada catatan", "記録なし")}"></div><small>${fmtDate(x.month + "-01").replace(/^1\s/, "")}</small></div>`).join("")}</div>`;
}
function workPage() {
  const r = report();
  return `${heading(t("Jam kerja", "勤務記録"), t("Catat, periksa, dan kelola setiap shift.", "毎日の勤務を記録・確認。"))}<div class="section-head">${periodControl()}<span class="pill">${hm(r.workedMinutes)} · ${r.workDays} ${t("hari", "日")}</span></div><section class="card">${workRows(r.entries)}</section><p class="help">${t("Satu catatan per tanggal mulai shift. Untuk beberapa sesi kerja, masukkan waktu di antaranya sebagai istirahat.", "勤務開始日につき1件。分割勤務は間の時間を休憩として入力してください。")}</p>`;
}
function calendarPage() {
  const [y, m] = calendarMonth.split("-").map(Number),
    first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay(),
    n = new Date(Date.UTC(y, m, 0)).getUTCDate();
  let cells = "";
  for (let i = 0; i < first; i++) cells += "<div></div>";
  for (let day = 1; day <= n; day++) {
    const date = monthDate(y, m - 1, day),
      e = data.entries.find((x) => x.date === date);
    let color = "";
    if (e) {
      const row = report(
        periodForDate(date, data.settings.closingDay),
      ).entries.find((x) => x.id === e.id);
      color =
        e.dayType === "paidLeave" || e.dayType === "specialLeave"
          ? "blue"
          : row.statutoryHolidayMinutes
            ? "red"
            : row.nightMinutes
              ? "purple"
              : row.statutoryOvertimeMinutes
                ? "orange"
                : "";
    }
    cells += `<button class="cal-day ${date === today ? "today" : ""} ${e ? "has-entry" : ""}" ${e ? `data-entry="${esc(e.id)}"` : `data-action="add" data-date="${date}"`} aria-label="${date}${e ? " " + dayLabel(e.dayType) : ""}">${day}${e ? `<span class="dot ${color}"></span><small>${isLeave(e.dayType) ? dayLabel(e.dayType) : esc(e.clockIn)}</small>` : ""}</button>`;
  }
  return `${heading(t("Kalender kerja", "勤務カレンダー"), t("Satu bulan, semua aktivitas Anda.", "ひと月の勤務をまとめて確認。"))}<div class="section-head">${periodControl(true)}<button data-action="calendar-today" class="text-btn">${t("Bulan ini", "今月")}</button></div><section class="card calendar-card"><div class="calendar">${t(
    "Min,Sen,Sel,Rab,Kam,Jum,Sab",
    "日,月,火,水,木,金,土",
  )
    .split(",")
    .map((d) => `<div class="weekday">${d}</div>`)
    .join("")}${cells}</div><div class="legend">${[
    ["", t("Normal", "通常")],
    ["orange", t("Lembur", "残業")],
    ["purple", t("Malam", "深夜")],
    ["red", t("Libur statutory", "法定休日")],
    ["blue", t("Cuti", "休暇")],
  ]
    .map(([c, l]) => `<span><i class="dot ${c}"></i>${l}</span>`)
    .join("")}</div></section>`;
}
function salaryPage() {
  const r = report();
  return `${heading(t("Gaji Anda", "給与"), t("Rincian yang transparan untuk setiap periode.", "期間ごとの給与をわかりやすく。"), false)}<div class="section-head">${periodControl()}<button data-action="csv" class="text-btn">${icon("download")} CSV</button></div><div class="tabs salary-tabs no-print" role="group" aria-label="${t("Bagian gaji","給与メニュー")}">${[
    ["slip", t("Slip estimasi", "給与明細")],
    ["allowances", t("Tunjangan", "手当")],
    ["deductions", t("Potongan", "控除")],
    ["history", t("Riwayat", "履歴")],
    ["compare", t("Bandingkan", "比較")],
  ]
    .map(
      ([v, l]) =>
        `<button data-salary-tab="${v}" aria-pressed="${salaryTab === v}" class="${salaryTab === v ? "active" : ""}">${l}</button>`,
    )
    .join(
      "",
    )}</div>${salaryTab === "slip" ? slip(r) : salaryTab === "history" ? history() : salaryTab === "compare" ? comparison(r) : moneyList(salaryTab, r)}`;
}
function slip(r) {
  return `<section class="card slip"><div class="slip-title"><div class="eyebrow">${t("Slip gaji estimasi", "給与明細（目安）")}</div><h2>${monthLabel(month)}</h2><p>${esc(data.settings.name || "—")} · ${esc(data.settings.company || "—")}</p><p>${dateLabel(r.period.start)} – ${dateLabel(r.period.end)}</p><p>${t("Tanggal pembayaran", "支給日")}: ${dateLabel(r.period.paymentDate)}</p></div><div class="breakdown">${line(t("Hari kerja", "勤務日数"), `${r.workDays} ${t("hari", "日")}`)}${line(t("Total jam kerja", "総勤務時間"), hm(r.workedMinutes))}${line(t("Jam normal", "通常勤務"), hm(r.normalMinutes))}${line("法定内残業", hm(r.withinStatutoryOvertimeMinutes))}${line("法定外残業", hm(r.statutoryOvertimeMinutes))}${data.settings.mode === "advanced" ? line(t("Termasuk lembur mingguan", "うち週の法定時間超"), hm(r.weeklyOvertimeMinutes)) + line(t("Termasuk di atas 60 jam", "うち月60時間超"), hm(r.over60Minutes)) : ""}${line(t("Malam (termasuk jam di atas)", "深夜（上記時間に含む）"), hm(r.nightMinutes))}${line(t("Libur statutory", "法定休日"), hm(r.statutoryHolidayMinutes))}</div><h3>${t("Pendapatan", "支給")}</h3>${breakdown(r)}${r.allowances.length ? `<h3>${t("Rincian tunjangan", "手当内訳")}</h3><div class="breakdown">${r.allowances.map((a) => line(esc(a.name), yen(a.total))).join("")}</div>` : ""}${r.deductions.length ? `<h3>${t("Rincian potongan", "控除内訳")}</h3><div class="breakdown">${r.deductions.map((a) => line(esc(a.name), yen(a.total))).join("")}</div>` : ""}<div class="net"><div>${t("Gaji bersih", "手取り")}<br><small>${t("Estimasi periode ini", "この期間の目安")}</small></div><b>${yen(r.net)}</b></div><p class="help">${disclaimer()}</p><p class="help">${t("Nominal dibulatkan ke yen terdekat pada total akhir. Komponen tampilan dapat berbeda ¥1 akibat pembulatan.", "合計額を1円単位で四捨五入します。表示上の内訳の合計と1円程度異なる場合があります。")}</p><div class="actions no-print"><button data-action="print" class="primary">${icon("download")} ${t("Cetak / Simpan PDF", "印刷 / PDF保存")}</button></div></section>`;
}
function moneyList(kind, r) {
  const allowance = kind === "allowances",
    items = data[kind];
  return `<section class="card"><div class="section-head"><h2>${allowance ? t("Tunjangan", "手当") : t("Potongan manual", "控除（手入力）")}</h2><button data-action="money-add" data-kind="${kind}" class="primary">${icon("plus")} ${t("Tambah", "追加")}</button></div><p class="help">${allowance ? t("Transport dapat dihitung per hari kerja, tetap bulanan, atau nominal sekali bayar.", "交通費は出勤日ごと・月額・一時金に対応。") : t("Masukkan nominal dari slip gaji. Pajak dan asuransi tidak dihitung otomatis.", "給与明細の金額を入力してください。税金・保険料の自動計算は行いません。")}</p>${items.length ? items.map((a) => `<div class="item"><div class="grow"><b>${esc(a.name)}</b><small>${a.month ? monthLabel(a.month) : t("Setiap periode", "毎期間")}${allowance ? " · " + frequency(a.frequency) : ""}</small></div><strong>${yen(a.amount)}</strong><button class="icon-btn" data-action="money-edit" data-kind="${kind}" data-id="${esc(a.id)}" aria-label="${t("Edit", "編集")}">${icon("edit")}</button><button class="icon-btn danger" data-action="money-delete" data-kind="${kind}" data-id="${esc(a.id)}" aria-label="${t("Hapus", "削除")}">${icon("trash")}</button></div>`).join("") : `<div class="empty">${t("Belum ada item. Tambahkan sesuai kontrak atau slip gaji Anda.", "契約・給与明細に合わせて項目を追加してください。")}</div>`}${line(t("Total periode terpilih", "選択期間の合計"), yen(allowance ? r.allowanceTotal : r.deductionTotal), "total")}</section>`;
}
const frequency = (k) =>
  ({
    month: t("Per bulan", "月額"),
    day: t("Per hari masuk", "出勤日ごと"),
    hour: t("Per jam kerja", "勤務時間ごと"),
    once: t("Sekali bayar", "一時金"),
  })[k];
function history() {
  const months = [
    ...new Set([
      month,
      ...data.entries.map((e) =>
        periodForDate(e.date, data.settings.closingDay),
      ),
    ]),
  ]
    .sort()
    .reverse();
  return `<section class="card"><h2>${t("Riwayat estimasi", "給与予測の履歴")}</h2><p class="help">${t("Dihitung ulang menggunakan pengaturan saat ini. Ekspor backup untuk menyimpan versi perhitungan lama.", "現在の設定で再計算します。過去の計算設定はバックアップで保存してください。")}</p>${months
    .map((m) => {
      const r = report(m);
      return `<button class="item" style="width:100%;background:transparent;text-align:left;border-radius:0" data-action="history" data-month="${m}"><span class="grow"><b>${monthLabel(m)}</b><small>${r.workDays} ${t("hari kerja", "勤務日")} · ${hm(r.workedMinutes)}</small></span><strong>${yen(r.net)}</strong>${icon("chevron")}</button>`;
    })
    .join("")}</section>`;
}
function comparison(r) {
  const actual = data.comparisons[month];
  return `<section class="card slip"><h2>${t("Bandingkan dengan slip gaji", "給与明細との比較")}</h2><p class="help">${t("Bandingkan gaji bersih (手取り) untuk periode yang sama.", "同じ給与期間の手取り額を比較してください。")}</p><form id="comparison-form"><div class="form-grid">${field("actual", t("Gaji bersih dari perusahaan (¥)", "会社の手取り額 (¥)"), actual ?? "", "number", 'min="0" step="1" required')}<div class="note" style="margin:0">${t("Estimasi aplikasi", "アプリの予測")}<br><strong>${yen(r.net)}</strong></div></div><div class="actions"><button class="primary">${t("Simpan perbandingan", "比較を保存")}</button></div></form>${actual !== undefined ? `<div class="note">${t("Selisih (perusahaan − estimasi)", "差額（会社 − アプリ）")}: <strong>${yen(actual - r.net)}</strong></div>` : ""}<p class="help">${t("Selisih dapat berasal dari pembulatan, aturan perusahaan, tunjangan, atau potongan. Selisih saja tidak membuktikan pelanggaran.", "差額は端数処理・会社の規則・手当・控除などにより生じます。差額のみで違反とは判断できません。")}</p></section>`;
}
function salaryFields(s) {
  return `${select(
    "salaryType",
    t("Metode gaji", "給与形態"),
    [
      ["hourly", "時給 / " + t("Per jam", "時給")],
      ["monthly", "月給 / " + t("Bulanan", "月給")],
      ["daily", "日給 / " + t("Harian", "日給")],
    ],
    s.salaryType,
  )}${field("hourlyRate", t("Gaji per jam (¥)", "時給額 (¥)"), s.hourlyRate, "number", 'min="0" required step="1"')}${field("monthlySalary", t("Gaji bulanan (¥)", "月給額 (¥)"), s.monthlySalary, "number", 'min="0" required step="1"')}${field("dailySalary", t("Gaji harian (¥)", "日給額 (¥)"), s.dailySalary, "number", 'min="0" required step="1"')}${field("monthlyScheduledMinutes", t("Pembagi gaji bulanan (menit)", "月給の換算基準時間（分）"), s.monthlyScheduledMinutes, "number", 'min="1" required step="1"')}`;
}
function companyFields(s) {
  return `<div class="settings-section"><h3>${t("Profil & tempat kerja", "プロフィール・勤務先")}</h3><div class="form-grid">${field("name", t("Nama", "氏名"), s.name, "text", 'maxlength="80"')}${field("company", t("Nama perusahaan", "会社名"), s.company, "text", 'maxlength="120"')}${select(
    "employment",
    t("Status pekerjaan", "雇用形態"),
    [
      ["permanent", "正社員"],
      ["contract", "契約社員"],
      ["dispatch", "派遣社員"],
      ["part", "パート"],
      ["arubaito", "アルバイト"],
    ],
    s.employment,
  )}</div></div><div class="settings-section"><h3>${t("Metode gaji", "給与形態")}</h3><div class="form-grid">${salaryFields(s)}</div><p class="help">${t("Gaji bulanan ÷ (pembagi menit ÷ 60) = tarif dasar lembur. Default 9.600 menit = 160 jam; sesuaikan dengan rata-rata jam kerja bulanan perusahaan. Gaji bulanan tetap dibayar penuh; pengurangan absen dimasukkan manual di Potongan.", "月給 ÷（換算基準分 ÷ 60）＝ 時間単価。初期値9,600分＝160時間。会社の月平均所定労働時間に合わせてください。月給は固定支給として扱い、欠勤控除は手入力してください。")}</p></div><div class="settings-section"><h3>${t("Jadwal kerja", "勤務条件")}</h3><div class="form-grid">${field("scheduledMinutesPerDay", t("Jam perusahaan / hari (menit)", "1日の所定労働時間（分）"), s.scheduledMinutesPerDay, "number", 'min="1" max="1440" required')}${field("defaultBreakMinutes", t("Istirahat default (menit)", "標準休憩時間（分）"), s.defaultBreakMinutes, "number", 'min="0" max="1439" required')}${field("workDaysPerWeek", t("Hari kerja per minggu", "週の勤務日数"), s.workDaysPerWeek, "number", 'min="1" max="7" required')}${select("holidayWeekday", t("Hari libur statutory default", "標準の法定休日"), weekdays(), s.holidayWeekday)}</div><p class="help">${t("Hari libur default hanya mengisi pilihan awal. Periksa jenis hari setiap shift, termasuk hari berikutnya pada shift malam.", "標準休日は入力時の初期値です。翌日にまたがる勤務も含め、勤務区分を確認してください。")}</p></div>`;
}
function weekdays() {
  return t(
    "Minggu,Senin,Selasa,Rabu,Kamis,Jumat,Sabtu",
    "日曜日,月曜日,火曜日,水曜日,木曜日,金曜日,土曜日",
  )
    .split(",")
    .map((v, i) => [i, v]);
}
function payrollFields(s) {
  return `<div class="form-grid">${select(
    "payPreset",
    t("Preset periode", "締め・支給日プリセット"),
    [
      ["custom", "Custom"],
      ["end", "末締め・翌月10日払い"],
      ["20", "20日締め・翌月10日払い"],
      ["15", "15日締め・当月25日払い"],
    ],
    "custom",
  )}${field("closingDay", t("Tanggal tutup (31 = akhir bulan)", "締め日（31 = 月末）"), s.closingDay, "number", 'min="1" max="31" required')}${field("salaryPaymentDay", t("Tanggal gajian", "支給日"), s.salaryPaymentDay, "number", 'min="1" max="31" required')}${select(
    "paymentMonthOffset",
    t("Bulan pembayaran", "支給月"),
    [
      [0, t("Bulan penutupan", "当月")],
      [1, t("Bulan berikutnya", "翌月")],
      [2, t("Dua bulan berikutnya", "翌々月")],
    ],
    s.paymentMonthOffset,
  )}</div><p class="help">${t("Tanggal yang tidak ada disesuaikan ke akhir bulan. Pergeseran gajian karena bank/libur tidak dilakukan otomatis.", "存在しない日付は月末に調整。銀行休業日による支給日の変更は自動で行いません。")}</p>`;
}
function ruleFields(s) {
  return `<div class="note">🇯🇵 Japan Standard · ${t("Preset dapat disesuaikan dengan kontrak kerja.", "就業規則に合わせて変更できます。")}</div><div class="form-grid">${select(
    "mode",
    t("Mode tampilan", "表示モード"),
    [
      ["simple", "Simple"],
      ["advanced", "Advanced Japan"],
    ],
    s.mode,
  )}${field("statutoryMinutesPerDay", t("Batas statutory / hari (menit)", "1日の法定労働時間（分）"), s.statutoryMinutesPerDay, "number", 'min="1" max="1440" required')}${field("statutoryMinutesPerWeek", t("Batas statutory / minggu (menit)", "週の法定労働時間（分）"), s.statutoryMinutesPerWeek, "number", 'min="1" max="10080" required')}${select("weekStartsOn", t("Awal minggu kerja", "週の起算日"), weekdays(), s.weekStartsOn)}${[
    ["withinPremium", t("Tambahan 法定内 (%)", "法定内残業の割増 (%)")],
    ["overtimePremium", t("Tambahan lembur (%)", "時間外割増 (%)")],
    ["nightPremium", t("Tambahan malam (%)", "深夜割増 (%)")],
    ["holidayPremium", t("Tambahan libur (%)", "休日割増 (%)")],
    [
      "over60HoursPremium",
      t("Tambahan di atas 60 jam (%)", "月60時間超の割増 (%)"),
    ],
  ]
    .map(([k, l]) =>
      field(
        k,
        l,
        Number((s[k] * 100).toFixed(6)),
        "number",
        'min="0" step="0.01" required',
      ),
    )
    .join(
      "",
    )}${field("over60ThresholdMinutes", t("Ambang lembur tinggi (menit)", "高割増の閾値（分）"), s.over60ThresholdMinutes, "number", 'min="0" required')}${field("over60ClosingDay", t("Tanggal tutup akumulasi 60 jam", "60時間計算の月の締め日"), s.over60ClosingDay, "number", 'min="1" max="31" required')}${field("nightStart", t("Malam mulai", "深夜開始"), s.nightStart, "time", "required")}${field("nightEnd", t("Malam selesai", "深夜終了"), s.nightEnd, "time", "required")}</div><p class="help">${t("Simple menyederhanakan tampilan; perhitungan tetap memakai aturan yang sama. Akumulasi 60 jam dapat memiliki periode berbeda dari periode gaji. Shift berkelanjutan memakai tanggal mulai untuk batas harian dan periode gaji. Libur statutory dinilai per tanggal kalender.", "Simpleは表示を簡略化し、計算ルールは共通です。60時間の集計月は給与期間とは別に設定できます。連続勤務の日次計算・給与期間は開始日を基準とし、法定休日は暦日で判定します。")}</p><p class="help">${t("Preset ini tidak mengevaluasi sistem jam kerja variabel/fleksibel, lembur tetap (みなし残業), atau seluruh pengecualian hukum.", "変形・フレックスタイム制、みなし残業などの個別制度には対応していません。")} <a href="https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/roudouseisaku/chushoukigyou/joken_kankyou_rule.html" target="_blank" rel="noopener">${t("Referensi MHLW", "厚生労働省の資料")}</a></p><button type="button" data-action="restore-rules">${t("Pulihkan Japan Standard", "日本標準に戻す")}</button>`;
}
function settingsPage() {
  const s = data.settings;
  return `${heading(t("Pengaturan", "設定"), t("Sesuaikan perhitungan dengan tempat kerja Anda.", "勤務先の条件に合わせて設定。"), false)}<div class="tabs settings-tabs" role="group" aria-label="${t("Bagian pengaturan","設定メニュー")}">${[
    ["company", t("Tempat kerja", "勤務先")],
    ["period", t("Periode", "給与期間")],
    ["rules", t("Aturan & premium", "割増設定")],
    ["app", t("Aplikasi & backup", "アプリ・保存")],
  ]
    .map(
      ([v, l]) =>
        `<button data-settings-tab="${v}" aria-pressed="${settingsTab === v}" class="${settingsTab === v ? "active" : ""}">${l}</button>`,
    )
    .join("")}</div><section class="card"><form id="settings-form">${
    settingsTab === "company"
      ? companyFields(s)
      : settingsTab === "period"
        ? payrollFields(s)
        : settingsTab === "rules"
          ? ruleFields(s)
          : `<div class="form-grid">${select(
              "language",
              t("Bahasa", "言語"),
              [
                ["id", "🇮🇩 Indonesia"],
                ["ja", "🇯🇵 日本語"],
              ],
              s.language,
            )}${select(
              "theme",
              t("Tema", "テーマ"),
              [
                ["system", t("Ikuti sistem", "システム")],
                ["light", t("Terang", "ライト")],
                ["dark", t("Gelap", "ダーク")],
              ],
              s.theme,
            )}</div>`
  }<div class="actions"><button class="primary">${t("Simpan pengaturan", "設定を保存")}</button></div></form>${settingsTab === "app" ? `<div class="settings-section"><h3>${t("Backup & ekspor", "バックアップ・エクスポート")}</h3><p class="help">${t("Data hanya tersimpan di browser ini. Ekspor JSON secara berkala; tidak ada sinkronisasi akun atau cloud. Import mengganti seluruh data setelah konfirmasi.", "データはこのブラウザーだけに保存されます。定期的にJSONを保存してください。アカウント・クラウド同期はありません。読み込みは確認後に全データを置き換えます。")}</p><div class="actions" style="justify-content:flex-start"><button data-action="backup">Export JSON</button><button data-action="import">Import JSON</button><button data-action="csv">Export CSV</button><button data-action="install">${t("Pasang aplikasi", "アプリをインストール")}</button></div><input id="import-file" type="file" accept="application/json,.json" hidden></div><div class="settings-section"><h3>${t("Data contoh & reset", "サンプル・リセット")}</h3><p class="help">${t("Data contoh akan mengganti data saat ini hanya setelah konfirmasi.", "サンプルは確認後に現在のデータを置き換えます。")}</p><div class="actions" style="justify-content:flex-start"><button data-action="demo">${t("Muat data contoh", "サンプルを読み込む")}</button><button data-action="reset" class="danger">${t("Reset seluruh data", "全データをリセット")}</button></div></div>` : ""}</section>`;
}
function showDialog(html) {
  const d = $("#sheet");
  cancelDialogClose(d);
  d.innerHTML = `<div class="sheet-content">${html}</div>`;
  d.setAttribute("aria-labelledby", "sheet-title");
  if (!d.open) d.showModal();
}
function dialogHead(title) {
  return `<div class="dialog-head"><h2 id="sheet-title">${title}</h2><button class="icon-btn" data-action="close" aria-label="${t("Tutup", "閉じる")}">${icon("close")}</button></div>`;
}
function detail(id) {
  const source = data.entries.find((e) => e.id === id);
  if (!source) return;
  const r = report(periodForDate(source.date, data.settings.closingDay)),
    e = r.entries.find((e) => e.id === id);
  showDialog(
    `${dialogHead(dateLabel(e.date))}<span class="pill">${dayLabel(e.dayType)}</span><div class="breakdown" style="margin-top:25px">${!isLeave(e.dayType) ? line(t("Masuk → pulang", "出勤 → 退勤"), `${esc(e.clockIn)} → ${esc(e.clockOut)}${e.clockOutNextDay || e.clockOut < e.clockIn ? " (+1)" : ""}`) + line(t("Istirahat", "休憩"), hm(calculateBreakMinutes(e))) : ""}${line(t("Jam kerja", "勤務時間"), hm(e.workedMinutes))}${line(t("Normal", "通常"), hm(e.normalMinutes))}${line("法定内残業", hm(e.withinStatutoryOvertimeMinutes))}${line("法定外残業", hm(e.statutoryOvertimeMinutes))}${line(t("Malam", "深夜"), hm(e.nightMinutes))}${line(t("Libur statutory", "法定休日"), hm(e.statutoryHolidayMinutes))}${line(data.settings.salaryType === "monthly" ? t("Tambahan di luar gaji bulanan", "月給以外の追加額") : t("Estimasi gaji hari ini", "本日の給与目安"), yen(e.pay.total), "total")}</div>${e.notes ? `<p class="note">${esc(e.notes)}</p>` : ""}${e.breakMode === "simple" ? `<p class="help">${t("Istirahat sederhana ditempatkan di tengah shift (asumsi).", "簡易休憩は勤務の中央に配置（仮定）。")}</p>` : ""}<div class="actions"><button class="danger" data-action="delete-entry" data-id="${esc(id)}">${icon("trash")} ${t("Hapus", "削除")}</button><button class="primary" data-action="edit-entry" data-id="${esc(id)}">${icon("edit")} ${t("Edit", "編集")}</button></div>`,
  );
}
function breakRow(b = { start: "12:00", end: "13:00" }) {
  return `<div class="break-row"><input type="time" class="break-start" value="${esc(b.start)}" aria-label="${t("Mulai istirahat", "休憩開始")}" required><input type="time" class="break-end" value="${esc(b.end)}" aria-label="${t("Selesai istirahat", "休憩終了")}" required><button type="button" data-action="break-remove" class="icon-btn danger" aria-label="${t("Hapus istirahat", "休憩を削除")}">${icon("close")}</button></div>`;
}
function editEntry(id, date = today) {
  const old = data.entries.find((e) => e.id === id),
    s = data.settings;
  const e = old || {
    id: crypto.randomUUID(),
    date,
    clockIn: "08:00",
    clockOut: "17:30",
    clockOutNextDay: false,
    dayType:
      parseDate(date).getUTCDay() === s.holidayWeekday
        ? "statutoryHoliday"
        : "normal",
    nextDayType:
      parseDate(addDays(date, 1)).getUTCDay() === s.holidayWeekday
        ? "statutoryHoliday"
        : "normal",
    breakMode: "ranges",
    breaks: [
      {
        start: "12:00",
        end: `${String(12 + Math.floor(s.defaultBreakMinutes / 60)).padStart(2, "0")}:${String(s.defaultBreakMinutes % 60).padStart(2, "0")}`,
      },
    ],
    totalBreakMinutes: s.defaultBreakMinutes,
    scheduledMinutes: s.scheduledMinutesPerDay,
    notes: "",
  };
  showDialog(
    `${dialogHead(old ? t("Edit jam kerja", "勤務を編集") : t("Tambah jam kerja", "勤務を追加"))}<form id="entry-form" data-id="${esc(e.id)}"><div class="form-grid">${field("date", t("Tanggal mulai shift", "勤務開始日"), e.date, "date", "required")}${select(
      "dayType",
      t("Jenis hari", "勤務区分"),
      DAY_TYPES.map((k) => [k, dayLabel(k)]),
      e.dayType,
    )}</div><div id="work-inputs"><div class="form-grid time-fields" style="margin-top:16px">${field("clockIn", t("Jam masuk", "出勤"), e.clockIn, "time", "required")}${field("clockOut", t("Jam pulang", "退勤"), e.clockOut, "time", "required")}</div><label class="check"><input type="checkbox" name="clockOutNextDay" ${e.clockOutNextDay ? "checked" : ""}>${t("Pulang hari berikutnya (otomatis jika jam lebih kecil)", "翌日に退勤（時刻が早い場合は自動判定）")}</label><div class="form-grid">${select(
      "nextDayType",
      t("Jenis hari setelah tengah malam", "翌日0時以降の区分"),
      [
        ["normal", dayLabel("normal")],
        ["statutoryHoliday", dayLabel("statutoryHoliday")],
      ],
      e.nextDayType || "normal",
    )}${select(
      "breakMode",
      t("Mode istirahat", "休憩の入力"),
      [
        ["ranges", t("Rentang waktu (akurat)", "時間帯（正確）")],
        ["simple", t("Total menit (perkiraan)", "合計分（概算）")],
      ],
      e.breakMode || "ranges",
    )}</div><div id="break-ranges"><div id="break-rows">${(e.breaks || []).map(breakRow).join("")}</div><button type="button" data-action="break-add" class="text-btn">+ ${t("Tambah istirahat", "休憩を追加")}</button></div><div id="simple-break">${field("totalBreakMinutes", t("Total istirahat (menit)", "休憩合計（分）"), e.totalBreakMinutes ?? 60, "number", 'min="0" max="1439" step="1"')}<p class="help">${t("Asumsi: istirahat diletakkan di tengah shift. Gunakan rentang waktu agar perhitungan malam tepat.", "休憩を勤務の中央に配置します。正確な深夜計算には時間帯入力を使ってください。")}</p></div></div><div style="margin-top:14px">${field("scheduledMinutes", t("Jam perusahaan hari ini (menit)", "本日の所定労働時間（分）"), e.scheduledMinutes ?? s.scheduledMinutesPerDay, "number", 'min="0" max="1440" required step="1"')}</div><label id="special-paid" class="check"><input type="checkbox" name="specialLeavePaid" ${e.specialLeavePaid ? "checked" : ""}>${t("Cuti khusus ini dibayar", "この特別休暇は有給")}</label><label class="field full" style="margin-top:15px">${t("Catatan", "メモ")}<textarea name="notes" rows="2" maxlength="500">${esc(e.notes)}</textarea></label><div class="note" id="entry-preview"></div><p id="entry-error" class="error" role="alert"></p><div class="actions"><button type="button" data-action="close">${t("Batal", "キャンセル")}</button><button type="submit" class="primary">${t("Simpan catatan", "勤務を保存")}</button></div></form>`,
  );
  entryMode();
  previewEntry();
  $("#entry-form").addEventListener("input", previewEntry);
  $("#entry-form").addEventListener("change", () => {
    entryMode(true);
    previewEntry();
  });
  $("#entry-form").onsubmit = (ev) => {
    ev.preventDefault();
    try {
      const e = readEntry();
      validateEntry(e);
      const next = {
        ...data,
        entries: [...data.entries.filter((x) => x.id !== e.id), e],
      };
      if (commit(next)) {
        closeDialog($("#sheet"));
        month = periodForDate(e.date, s.closingDay);
        render();
        toast(t("Catatan tersimpan", "勤務を保存しました"));
      }
    } catch (err) {
      $("#entry-error").textContent = err.message;
    }
  };
}
function entryMode(animate = false) {
  const f = $("#entry-form");
  if (!f) return;
  const leave = isLeave(f.elements.dayType.value),
    simple = f.elements.breakMode.value === "simple";
  toggleRegion($("#work-inputs"), leave, animate);
  toggleRegion($("#break-ranges"), simple, animate && !leave);
  toggleRegion($("#simple-break"), !simple, animate && !leave);
  toggleRegion($("#special-paid"), f.elements.dayType.value !== "specialLeave", animate);
  for (const el of $("#work-inputs").querySelectorAll("input,select"))
    el.disabled = leave;
  for (const el of $("#break-ranges").querySelectorAll("input"))
    el.disabled = leave || simple;
  f.elements.totalBreakMinutes.disabled = leave || !simple;
}
function readEntry() {
  const f = $("#entry-form"),
    v = Object.fromEntries(new FormData(f));
  return {
    id: f.dataset.id,
    date: v.date,
    dayType: v.dayType,
    clockIn: v.clockIn || "08:00",
    clockOut: v.clockOut || "17:00",
    clockOutNextDay: !!v.clockOutNextDay,
    nextDayType: v.nextDayType || "normal",
    breakMode: v.breakMode || "ranges",
    breaks: [...$("#break-rows").children].map((el) => ({
      start: el.querySelector(".break-start").value,
      end: el.querySelector(".break-end").value,
    })),
    totalBreakMinutes: Number(v.totalBreakMinutes || 0),
    scheduledMinutes: Number(v.scheduledMinutes),
    specialLeavePaid: !!v.specialLeavePaid,
    notes: v.notes || "",
  };
}
function previewEntry() {
  try {
    const e = readEntry(),
      s = data.settings;
    const worked = calculateWorkedMinutes(e, s),
      night = calculateNightMinutes(e, s);
    $("#entry-error").textContent = "";
    $("#entry-preview").innerHTML =
      `<div class="preview-numbers"><div><small>${t("Jam efektif", "実働")}</small><b>${hm(worked)}</b></div><div><small>${t("Istirahat", "休憩")}</small><b>${hm(calculateBreakMinutes(e))}</b></div><div><small>${t("Malam", "深夜")}</small><b>${hm(night)}</b></div></div>`;
  } catch (e) {
    $("#entry-error").textContent = e.message;
    $("#entry-preview").textContent = t(
      "Lengkapi jam kerja dan istirahat.",
      "勤務・休憩時間を入力してください。",
    );
  }
}
function moneyForm(kind, id) {
  const allowance = kind === "allowances",
    a = data[kind].find((x) => x.id === id) || {
      id: crypto.randomUUID(),
      name: "",
      amount: 0,
      frequency: "month",
      month: "",
    };
  const names = allowance
    ? [
        "交通費 / Transport",
        "住宅手当 / Rumah",
        "資格手当 / Sertifikasi",
        "役職手当 / Jabatan",
        "皆勤手当 / Kehadiran",
        "家族手当 / Keluarga",
        "夜勤手当 / Shift malam",
        "食事手当 / Makan",
        "その他 / Lainnya",
      ]
    : [
        "健康保険 / Asuransi kesehatan",
        "厚生年金 / Pensiun",
        "雇用保険 / Asuransi kerja",
        "所得税 / Pajak penghasilan",
        "住民税 / Pajak penduduk",
        "寮費 / Asrama",
        "食費 / Makan",
        "組合費 / Serikat",
        "前借り / Kasbon",
        "その他 / Lainnya",
      ];
  showDialog(
    `${dialogHead(allowance ? t("Tunjangan", "手当") : t("Potongan", "控除"))}<form id="money-form"><div class="form-grid">${field("name", t("Nama kategori", "項目名"), a.name, "text", 'list="categories" required maxlength="100"')}<datalist id="categories">${names.map((n) => `<option>${esc(n)}</option>`).join("")}</datalist>${field("amount", t("Nominal (¥)", "金額 (¥)"), a.amount, "number", 'min="0" step="1" required')}${
      allowance
        ? select(
            "frequency",
            t("Frekuensi", "計算単位"),
            ["month", "day", "hour", "once"].map((k) => [k, frequency(k)]),
            a.frequency,
          )
        : ""
    }${field("month", t("Periode khusus (kosong = berulang)", "対象月（空欄 = 毎月）"), a.month, "month")}</div><p class="help">${t("Sekali bayar wajib memiliki periode khusus. Nominal per hari memakai jumlah hari masuk, bukan hari cuti.", "一時金には対象月が必要です。日額手当は出勤日数で計算し、有休は含みません。")}</p><p class="error" id="money-error"></p><div class="actions"><button class="primary">${t("Simpan", "保存")}</button></div></form>`,
  );
  $("#money-form").onsubmit = (e) => {
    e.preventDefault();
    const v = Object.fromEntries(new FormData(e.target));
    if (v.frequency === "once" && !v.month) {
      $("#money-error").textContent = t(
        "Pilih periode untuk sekali bayar.",
        "一時金の対象月を選択してください。",
      );
      return;
    }
    const item = { ...a, ...v, amount: Number(v.amount) };
    if (
      commit({
        ...data,
        [kind]: [...data[kind].filter((x) => x.id !== a.id), item],
      })
    ) {
      closeDialog($("#sheet"));
      render();
      toast(t("Tersimpan", "保存しました"));
    }
  };
}
function renderOnboarding() {
  const s = data.settings;
  const titles = [
    t("Selamat datang. ようこそ。", "ようこそ。Selamat datang."),
    t("Bagaimana Anda digaji?", "給与形態を選択"),
    t("Masukkan nominal gaji", "給与額を入力"),
    t("Atur jam kerja Anda", "所定労働時間を設定"),
    t("Kapan periode ditutup?", "締め日はいつですか？"),
    t("Kapan Anda menerima gaji?", "支給日はいつですか？"),
    t("Siap menghitung lebih jelas.", "給与をわかりやすく。"),
  ];
  let body = "";
  if (wizard === 0)
    body = `<p>${t("Catat kerja di Jepang, pahami estimasi gaji Anda. Pilih bahasa untuk memulai.", "日本での勤務を記録し、給与の目安を確認。言語を選んでください。")}</p><div class="choices">${[
      ["id", "🇮🇩 Bahasa Indonesia"],
      ["ja", "🇯🇵 日本語"],
    ]
      .map(
        ([v, l]) =>
          `<button type="button" data-wizard-language="${v}" class="choice ${s.language === v ? "selected" : ""}">${l}</button>`,
      )
      .join("")}</div>`;
  if (wizard === 1)
    body = `<div class="choices">${[
      ["hourly", "時給", t("Gaji per jam", "時間給")],
      ["monthly", "月給", t("Gaji bulanan", "月額固定給")],
      ["daily", "日給", t("Gaji harian", "日額固定給")],
    ]
      .map(
        ([v, l, sub]) =>
          `<button type="button" data-wizard-salary="${v}" class="choice ${s.salaryType === v ? "selected" : ""}">${l}<small>${sub}</small></button>`,
      )
      .join("")}</div>`;
  if (wizard === 2) {
    const k =
      s.salaryType === "hourly"
        ? "hourlyRate"
        : s.salaryType === "monthly"
          ? "monthlySalary"
          : "dailySalary";
    body = field(
      k,
      t("Nominal gaji (¥)", "給与額 (¥)"),
      s[k],
      "number",
      'min="0" step="1" required',
    );
    if (s.salaryType === "monthly")
      body += `<div style="margin-top:15px">${field("monthlyScheduledMinutes", t("Pembagi bulanan (menit)", "月給換算の基準（分）"), s.monthlyScheduledMinutes, "number", 'min="1" required')}</div><p class="help">9,600 ${t("menit = 160 jam. Sesuaikan kontrak.", "分 = 160時間。契約に合わせてください。")}</p>`;
  }
  if (wizard === 3)
    body = `${field("scheduledMinutesPerDay", t("Jam perusahaan per hari (menit)", "1日の所定労働時間（分）"), s.scheduledMinutesPerDay, "number", 'min="1" max="1440" required')}<p class="help">450 ${t("menit = 7 jam 30 menit.", "分 = 7時間30分。")}</p>`;
  if (wizard === 4)
    body = `${field("closingDay", t("Tanggal tutup", "締め日"), s.closingDay, "number", 'min="1" max="31" required')}<p class="help">${t("31 = akhir bulan. Contoh tanggal 20: periode 21 bulan lalu sampai 20 bulan ini.", "31 = 月末。20日締めは前月21日〜当月20日です。")}</p>`;
  if (wizard === 5)
    body = `<div class="form-grid">${field("salaryPaymentDay", t("Tanggal gajian", "支給日"), s.salaryPaymentDay, "number", 'min="1" max="31" required')}${select(
      "paymentMonthOffset",
      t("Bulan pembayaran", "支給月"),
      [
        [0, t("Bulan penutupan", "当月")],
        [1, t("Bulan berikutnya", "翌月")],
        [2, t("Dua bulan berikutnya", "翌々月")],
      ],
      s.paymentMonthOffset,
    )}</div>`;
  if (wizard === 6)
    body = `<div class="note">🇯🇵 <strong>Japan Standard</strong><br>8 ${t("jam/hari", "時間/日")} · 40 ${t("jam/minggu", "時間/週")}<br>${t("Lembur", "時間外")} +25% · ${t("Malam", "深夜")} +25%<br>${t("Libur statutory", "法定休日")} +35% · &gt;60h +50%</div><p>${t("Semua aturan dapat diubah di Pengaturan. Mulai dengan data kosong; data contoh tersedia di menu backup.", "各ルールは設定画面で変更できます。空の状態で開始します。サンプルデータはバックアップ画面から読み込めます。")}</p>`;
  $("#app").innerHTML =
    `<main class="onboarding"><div class="brand"><img src="./icon.svg" alt=""><div><b>Japan Salary Calculator</b><small>日本給与計算 · KALKULATOR GAJI JEPANG</small></div></div><section class="card"><div class="progress">${Array.from({ length: 7 }, (_, i) => `<i class="${i <= wizard ? "done" : ""}"></i>`).join("")}</div><div class="eyebrow">${t("Langkah", "ステップ")} ${wizard + 1} / 7</div><h1>${titles[wizard]}</h1>${storageError ? `<p class="error">${t("Data tersimpan tidak dapat dibaca. Unduh data mentah sebelum menggantinya.", "保存データを読み込めません。変更前に元データを保存してください。")}</p><button type="button" data-action="raw-backup">${t("Unduh data mentah", "元データを保存")}</button>` : ""}<form id="wizard-form">${body}<div class="actions">${wizard ? `<button type="button" data-action="wizard-back">${t("Kembali", "戻る")}</button>` : ""}<button class="primary">${wizard === 6 ? t("Mulai menggunakan", "利用を開始") : t("Lanjutkan", "次へ")} →</button></div></form></section><footer>${icon("shield")} ${t("Data Anda tersimpan di perangkat ini.", "データはこの端末に保存されます。")}<br>${t("Tanpa akun. Tanpa unggah data gaji.", "アカウント不要。給与データの送信なし。")}</footer></main>`;
  $("#wizard-form").onsubmit = async (e) => {
    e.preventDefault();
    const v = Object.fromEntries(new FormData(e.target));
    for (const [k, val] of Object.entries(v))
      s[k] = typeof DEFAULT_SETTINGS[k] === "number" ? Number(val) : val;
    if (wizard === 4) s.over60ClosingDay = s.closingDay;
    if (wizard < 6) {
      wizard++;
      render();
    } else if (
      storageError &&
      !(await ask(
        t(
          "Ganti data lama yang tidak terbaca? Pastikan sudah diunduh.",
          "読めない元データを置き換えますか？保存済みか確認してください。",
        ),
      ))
    )
      return;
    else if (commit({ ...data, onboarded: true })) {
      storageError = "";
      month = periodForDate(today, s.closingDay);
      render();
    }
  };
}
function bindForms() {
  const f = $("#settings-form");
  if (f) {
    f.onsubmit = (e) => {
      e.preventDefault();
      try {
        const v = Object.fromEntries(new FormData(f)),
          s = { ...data.settings };
        for (const [k, val] of Object.entries(v)) {
          if (k === "payPreset") continue;
          s[k] = typeof DEFAULT_SETTINGS[k] === "number" ? Number(val) : val;
          if (k.endsWith("Premium")) s[k] /= 100;
        }
        validateSettings(s);
        const p = calculatePayPeriod(month, s);
        if (p.paymentDate < p.end) {
          toast(
            t(
              "Tanggal gajian tidak boleh sebelum periode berakhir.",
              "支給日は締め日以降にしてください。",
            ),
          );
          return;
        }
        if (commit({ ...data, settings: s })) {
          render();
          toast(t("Pengaturan tersimpan", "設定を保存しました"));
        }
      } catch (err) {
        toast(err.message);
      }
    };
    const p = f.elements.payPreset;
    if (p)
      p.onchange = () => {
        if (p.value === "custom") return;
        f.elements.closingDay.value = p.value === "end" ? 31 : Number(p.value);
        f.elements.salaryPaymentDay.value = p.value === "15" ? 25 : 10;
        f.elements.paymentMonthOffset.value = p.value === "15" ? 0 : 1;
      };
  }
  const cf = $("#comparison-form");
  if (cf)
    cf.onsubmit = (e) => {
      e.preventDefault();
      if (
        commit({
          ...data,
          comparisons: {
            ...data.comparisons,
            [month]: Number(cf.elements.actual.value),
          },
        })
      ) {
        render();
        toast(t("Perbandingan tersimpan", "比較を保存しました"));
      }
    };
  for (const [id, cal] of [
    ["period-month", false],
    ["calendar-month", true],
  ]) {
    const el = $("#" + id);
    if (el)
      el.onchange = () => {
        if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(el.value)) return;
        if (cal) calendarMonth = el.value;
        else month = el.value;
        render();
      };
  }
  const imp = $("#import-file");
  if (imp)
    imp.onchange = async () => {
      const file = imp.files[0];
      if (!file) return;
      try {
        if (file.size > 10000000) throw Error("File > 10 MB");
        const next = validateData(JSON.parse(await file.text()));
        if (
          (await ask(
            t(
              `Ganti seluruh data dengan ${next.entries.length} catatan dari backup?`,
              `全データをバックアップの${next.entries.length}件で置き換えますか？`,
            ),
          )) &&
          commit(next)
        ) {
          month = periodForDate(today, data.settings.closingDay);
          render();
          toast(t("Backup berhasil dipulihkan", "バックアップを復元しました"));
        }
      } catch (err) {
        toast(t("Import ditolak: ", "読み込み失敗: ") + err.message);
      }
      imp.value = "";
    };
}
function exportCSV() {
  const r = report();
  const rows = [
    ["Japan Salary Calculator", "ESTIMATE"],
    ["Name", data.settings.name],
    ["Company", data.settings.company],
    ["Period start", r.period.start],
    ["Period end", r.period.end],
    ["Payment date", r.period.paymentDate],
    [],
    [
      "Date",
      "Type",
      "Clock in",
      "Clock out",
      "Worked minutes",
      "Normal minutes",
      "Within statutory minutes",
      "Statutory overtime minutes",
      "Weekly overtime minutes",
      "Over 60 minutes",
      "Night minutes",
      "Holiday minutes",
      "Daily earnings or monthly extras JPY",
      "Notes",
    ],
    ...r.entries.map((e) => [
      e.date,
      e.dayType,
      e.clockIn,
      e.clockOut,
      e.workedMinutes,
      e.normalMinutes,
      e.withinStatutoryOvertimeMinutes,
      e.statutoryOvertimeMinutes,
      e.weeklyOvertimeMinutes,
      e.over60Minutes,
      e.nightMinutes,
      e.statutoryHolidayMinutes,
      Math.round(e.pay.total),
      e.notes,
    ]),
    [],
    ["Component", "JPY"],
    ["Basic", r.base],
    ["Within statutory", r.within],
    ["Overtime", r.overtime],
    ["Night", r.night],
    ["Holiday", r.holiday],
    ...r.allowances.map((a) => [a.name, a.total]),
    ["Gross", r.gross],
    ...r.deductions.map((d) => [d.name, -d.total]),
    ["Deductions", r.deductionTotal],
    ["Net", r.net],
  ];
  download(
    "\ufeff" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n"),
    `japan-salary-${month}.csv`,
    "text/csv;charset=utf-8",
  );
}
document.addEventListener("click", async (ev) => {
  const target = ev.target.closest("button,[data-entry]");
  if (!target) return;
  const d = target.dataset;
  if (d.page) {
    if (page === d.page) return;
    page = d.page;
    render();
    window.scrollTo(0, 0);
    $(".heading h1")?.focus({preventScroll:true});
    return;
  }
  if (d.entry) {
    detail(d.entry);
    return;
  }
  if (d.salaryTab) {
    if (salaryTab === d.salaryTab) return;
    salaryTab = d.salaryTab;
    render();
    document.querySelector(`[data-salary-tab="${salaryTab}"]`)?.focus({preventScroll:true});
    return;
  }
  if (d.settingsTab) {
    if (settingsTab === d.settingsTab) return;
    settingsTab = d.settingsTab;
    render();
    document.querySelector(`[data-settings-tab="${settingsTab}"]`)?.focus({preventScroll:true});
    return;
  }
  if (d.wizardLanguage) {
    data.settings.language = d.wizardLanguage;
    render();
    return;
  }
  if (d.wizardSalary) {
    data.settings.salaryType = d.wizardSalary;
    render();
    return;
  }
  switch (d.action) {
    case "close":
      closeDialog($("#sheet"));
      break;
    case "language":
      if (
        commit({
          ...data,
          settings: {
            ...data.settings,
            language: data.settings.language === "id" ? "ja" : "id",
          },
        })
      )
        render();
      break;
    case "add":
      editEntry(null, d.date || today);
      break;
    case "edit-entry":
      editEntry(d.id);
      break;
    case "delete-entry":
      if (
        (await ask(
          t("Hapus catatan kerja ini?", "この勤務を削除しますか？"),
        )) &&
        commit({ ...data, entries: data.entries.filter((e) => e.id !== d.id) })
      ) {
        closeDialog($("#sheet"));
        render();
        toast(t("Catatan dihapus", "削除しました"));
      }
      break;
    case "break-add":
      $("#break-rows").insertAdjacentHTML("beforeend", breakRow());
      previewEntry();
      break;
    case "break-remove":
      target.closest(".break-row").remove();
      previewEntry();
      break;
    case "month-prev":
    case "month-next": {
      const cal = d.cal === "true",
        [y, m] = (cal ? calendarMonth : month).split("-").map(Number),
        v = monthDate(y, m - 1 + (d.action === "month-next" ? 1 : -1), 1).slice(
          0,
          7,
        );
      if (cal) calendarMonth = v;
      else month = v;
      render();
      break;
    }
    case "calendar-today":
      calendarMonth = today.slice(0, 7);
      render();
      break;
    case "print":
      window.print();
      break;
    case "csv":
      exportCSV();
      break;
    case "backup":
      download(
        JSON.stringify(data, null, 2),
        `japan-salary-backup-${today}.json`,
        "application/json",
      );
      break;
    case "raw-backup":
      download(
        localStorage.getItem("japan-salary-calculator:v1") || "",
        `japan-salary-recovery-${today}.json`,
        "application/json",
      );
      break;
    case "import":
      $("#import-file").click();
      break;
    case "reset":
      if (
        (await ask(
          t(
            "Hapus seluruh data, termasuk pengaturan? Ekspor backup terlebih dahulu.",
            "設定を含む全データを削除しますか？先にバックアップを保存してください。",
          ),
        )) &&
        commit(emptyData())
      ) {
        wizard = 0;
        render();
      }
      break;
    case "demo":
      if (
        (await ask(
          t(
            "Ganti data sekarang dengan data DEMO? Ekspor backup terlebih dahulu.",
            "現在のデータをサンプルで置き換えますか？先にバックアップしてください。",
          ),
        )) &&
        commit(demoData(month))
      ) {
        page = "home";
        render();
        toast(t("Data DEMO dimuat", "サンプルを読み込みました"));
      }
      break;
    case "money-add":
      moneyForm(d.kind);
      break;
    case "money-edit":
      moneyForm(d.kind, d.id);
      break;
    case "money-delete":
      if (
        (await ask(t("Hapus item ini?", "この項目を削除しますか？"))) &&
        commit({ ...data, [d.kind]: data[d.kind].filter((x) => x.id !== d.id) })
      )
        render();
      break;
    case "history":
      month = d.month;
      salaryTab = "slip";
      render();
      break;
    case "restore-rules": {
      const f = $("#settings-form");
      for (const [k, v] of Object.entries(JAPAN_STANDARD)) {
        if (f.elements[k])
          f.elements[k].value = k.endsWith("Premium") ? v * 100 : v;
      }
      toast(
        t(
          "Preset diisi. Tekan Simpan untuk menerapkan.",
          "標準値を入力しました。保存で適用します。",
        ),
      );
      break;
    }
    case "wizard-back":
      wizard = Math.max(0, wizard - 1);
      render();
      break;
    case "install":
      if (installPrompt) {
        await installPrompt.prompt();
        installPrompt = null;
      } else
        showDialog(
          `${dialogHead(t("Pasang aplikasi", "アプリをインストール"))}<p>${t("Android/Chrome: buka menu browser → Instal aplikasi / Tambahkan ke layar utama. iPhone/Safari: Bagikan → Tambahkan ke Layar Utama. Aplikasi harus dibuka melalui HTTPS atau localhost.", "Android/Chrome: ブラウザーメニュー → アプリをインストール。iPhone/Safari: 共有 → ホーム画面に追加。HTTPSまたはlocalhostで開いてください。")}</p><p class="help">${t("Dukungan pemasangan bergantung pada browser.", "インストール機能はブラウザーによって異なります。")}</p>`,
        );
      break;
  }
});
document.addEventListener("keydown", (e) => {
  if (
    (e.key === "Enter" || e.key === " ") &&
    e.target.matches("[data-entry]:not(button)")
  ) {
    e.preventDefault();
    detail(e.target.dataset.entry);
  }
});
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  installPrompt = e;
});
window.addEventListener("storage", (e) => {
  if (e.key === "japan-salary-calculator:v1") {
    try {
      data = loadData();
      closeDialog($("#sheet"));
      render();
      toast(t("Data diperbarui dari tab lain", "別のタブの変更を反映しました"));
    } catch (err) {
      toast(err.message);
    }
  }
});
render();
if ("serviceWorker" in navigator)
  navigator.serviceWorker
    .register("./sw.js")
    .catch(() =>
      toast(
        t(
          "Mode offline belum aktif. Gunakan HTTPS atau localhost.",
          "オフライン機能を利用できません。HTTPSまたはlocalhostで開いてください。",
        ),
      ),
    );

function ask(message) {
  return new Promise((resolve) => {
    const modal = document.createElement("dialog");
    modal.setAttribute("aria-label", t("Konfirmasi", "確認"));
    modal.innerHTML = `<h2>${t("Konfirmasi", "確認")}</h2><p>${esc(message)}</p><div class="actions"><button type="button" class="cancel-confirm">${t("Batal", "キャンセル")}</button><button type="button" class="primary accept-confirm">${t("Ya, lanjutkan", "はい、続行")}</button></div>`;
    document.body.append(modal);
    let finishing = false;
    const finish = async (value) => {
      if (finishing) return;
      finishing = true;
      await closeDialog(modal);
      modal.remove();
      resolve(value);
    };
    modal.querySelector(".cancel-confirm").onclick = () => finish(false);
    modal.querySelector(".accept-confirm").onclick = () => finish(true);
    modal.addEventListener("cancel", (event) => {
      event.preventDefault();
      finish(false);
    });
    modal.showModal();
  });
}
