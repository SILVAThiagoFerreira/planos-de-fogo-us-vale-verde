/* =====================================================================
   Planos de Fogo — Previsto × Realizado · US Vale Verde
   Lê os dados compactos gerados a partir dos arquivos do Google Drive:
     • Previsto  (planejamento dos desmontes)
     • Realizado (execução dos desmontes)
   Casa os planos pelo identificador de "Plano" e compara cada aspecto
   (séries temporais, precisão do plano, tabela). O GitHub Actions sincroniza
   os arquivos de origem e publica a versão atualizada no GitHub Pages.
   ===================================================================== */

const DATA_URL = (name) => `./data/${name}.json?v=${Date.now()}`;

/* --- Cores (mesma identidade do hub) --- */
const C = {
  prev: "#38424B",   /* grafite — Previsto */
  real: "#E20613",   /* vermelho ENAEX — Realizado */
  match: "#1f6feb",  /* azul — plano casado */
  ok: "#107c10",
  amber: "#c47b00",
  text: "#6c747b",
  grid: "rgba(56,66,75,0.08)",
};

/* --- Aspectos comparáveis entre as duas bases.
       Cada aspecto tem candidatos de rótulo para Previsto e Realizado
       (resolvidos por rótulo normalizado → robusto a acentos/símbolos). --- */
const ASPECTS = [
  { key: "diametro",  label: "Diâmetro",                unit: "pol",   dec: 1, agg: "mean",
    prev: ["Diâmetro"],                                 real: ["Diâmetro (pol)", "Diâmetro"] },
  { key: "afast",     label: "Afastamento",             unit: "m",     dec: 2, agg: "mean",
    prev: ["Afastamento"],                              real: ["Afastamento (m)", "Afastamento"] },
  { key: "espac",     label: "Espaçamento",             unit: "m",     dec: 2, agg: "mean",
    prev: ["Espaçamento"],                              real: ["Espaçamento (m)", "Espaçamento"] },
  { key: "subfur",    label: "Sub-furação",             unit: "m",     dec: 2, agg: "mean",
    prev: ["Sub.furação", "Subfuração", "Sub-Furação"], real: ["Sub-Furação (m)", "Sub-Furação", "Subfuração"] },
  { key: "tampao",    label: "Tampão",                  unit: "m",     dec: 2, agg: "mean",
    prev: ["Tampão"],                                   real: ["Tampão Utilizado (m)", "Tampão"] },
  { key: "perfmed",   label: "Média de Perfuração",     unit: "m",     dec: 1, agg: "mean",
    prev: ["Média de Perfuração"],                      real: ["Média de Perfuração (m)", "Média de Perfuração"] },
  { key: "perfesp",   label: "Perfuração Específica",   unit: "m/m³",  dec: 3, agg: "mean",
    prev: ["Perfuração Específica"],                    real: ["Perfuração Específica (m/m³)", "Perfuração Específica"] },
  { key: "nfuros",    label: "Nº de Furos",             unit: "furos", dec: 0, agg: "mean",
    prev: ["Nº de Furos", "Numero de Furos"],           real: ["Nº de Furos", "Numero de Furos"] },
  { key: "cargamax",  label: "Carga Máx. por Espera",   unit: "kg",    dec: 1, agg: "mean",
    prev: ["Carga Máxima por Espera"],                  real: ["Carga Máxima por Espera (kg)", "Carga Máxima por Espera"] },
  { key: "densexpl",  label: "Densidade do Explosivo",  unit: "g/cm³", dec: 2, agg: "mean",
    prev: ["Densidade do Explosivo"],                   real: ["Densidade do Explosivo"] },
  { key: "densrocha", label: "Densidade da Rocha",      unit: "g/cm³", dec: 2, agg: "mean",
    prev: ["Densidade da Rocha"],                       real: ["Dens. Rocha (g/cm³)", "Densidade da Rocha", "Dens. Rocha"] },
  { key: "rlcarga",   label: "Razão Linear de Carga",   unit: "kg/m",  dec: 2, agg: "mean",
    prev: ["Razão Linear de Carga Prevista", "Razão Linear de Carga"], real: ["RL. De Carga (kg/m)", "Razão Linear de Carga"] },
  { key: "rc",        label: "Razão de Carga (RC)",     unit: "g/m³",  dec: 0, agg: "mean",
    prev: ["Razão de Carga"],                           real: ["RC. Realizada (g/m³)"] },
  { key: "volume",    label: "Volume Desmontado",       unit: "m³",    dec: 0, agg: "sum",
    prev: ["Volume Total Desmontado"],                  real: ["Volume Total Desm. (m³)", "Volume Total Desmontado"] },
  { key: "explosivos",label: "Total de Explosivos",     unit: "kg",    dec: 0, agg: "sum",
    prev: ["Total Explosivos Realizado", "Total Explosivos"], real: ["Total Explosivos Realizados (kg)", "Total Explosivos Realizados"] },
];

const MON = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const MONTH_NAMES_FULL = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

/* ---------- Helpers ---------- */
const norm = (s) =>
  (s == null ? "" : s).toString().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toUpperCase().replace(/\s+/g, " ").trim();
const cleanNorm = (s) => norm(s).replace(/[^A-Z0-9 ]/g, "").replace(/\s+/g, " ").trim();

const fmtInt = (n) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(n || 0);
const fmtNum = (n, d = 0) =>
  new Intl.NumberFormat("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d }).format(
    isFinite(n) ? n : 0
  );

const MAT_MAP = {
  "ESTERIL": "Estéril", "ESTERIIL": "Estéril", "ESTERIO": "Estéril", "ESTERIL ": "Estéril",
  "OXIDADO": "Oxidado",
  "SULFETADO": "Sulfetado",
  "MINERIO": "Minério",
  "REFRATARIO": "Refratário",
  "NAO": "—", "NAO ": "—",
};
function canonMaterial(v) {
  if (v == null || v === "") return null;
  const n = norm(v);
  if (MAT_MAP[n] !== undefined) return MAT_MAP[n];
  return v.toString().trim();
}

function parseDateCell(v) {
  if (!v) return null;
  const m = String(v).match(/^Date\((\d+),(\d+),(\d+)(?:,(\d+),?(\d*)?,?(\d*)?)?\)$/);
  if (!m) return null;
  const Y = +m[1], Mo = +m[2], D = +m[3], h = m[4] ? +m[4] : 0;
  return new Date(Y, Mo, D, h, 0, 0);
}
const num = (v) => {
  if (v == null || v === "") return null;
  if (typeof v === "number") return isFinite(v) ? v : null;
  const n = parseFloat(String(v).replace(/\s/g, "").replace(",", "."));
  return isFinite(n) ? n : null;
};
function planKey(v) {
  if (v == null || v === "") return null;
  if (typeof v === "number") return isFinite(v) ? String(Math.round(v)) : null;
  const raw = String(v).trim();
  if (!raw) return null;
  if (/^\d+(?:\.0+)?$/.test(raw)) return raw.replace(/\.0+$/, "");
  return raw.toUpperCase().replace(/\s+/g, " ");
}

/* ---------- Resolução de colunas por rótulo normalizado ---------- */
function resolveCol(labels, cands) {
  const cleaned = labels.map(cleanNorm);
  for (const c of cands) {
    const t = cleanNorm(c);
    const i = cleaned.indexOf(t);
    if (i >= 0) return i;
  }
  for (const c of cands) {
    const t = cleanNorm(c);
    const i = cleaned.findIndex((l) => l.includes(t));
    if (i >= 0) return i;
  }
  return -1;
}
function resolveMaterialCols(labels) {
  const out = [];
  labels.forEach((l, i) => {
    const c = cleanNorm(l);
    if (c === "MATERIAL" || /^MATERIAL \d+$/.test(c)) out.push(i);
  });
  return out;
}

/* ---------- Parse JSON do pipeline -> registros ----------
   `sheet` = "prev" | "real" decide quais rótulos buscar por aspecto. */
function parseGviz(payload, sheet) {
  const table = payload && payload.table;
  if (!table || !Array.isArray(table.cols) || !Array.isArray(table.rows)) {
    throw new Error(`dados ${sheet}: formato inesperado`);
  }

  const labels = table.cols.map((c) => c.label || c.id || "");
  const iPlano = resolveCol(labels, ["Plano"]);
  const iData = resolveCol(labels, ["Data"]);
  const iMalha = resolveCol(labels, ["Malha Mista", "Malha"]);
  const matIdxs = resolveMaterialCols(labels);
  const aspectIdx = {};
  for (const a of ASPECTS) aspectIdx[a.key] = resolveCol(labels, sheet === "real" ? a.real : a.prev);

  const records = [];
  for (const row of table.rows) {
    const c = row.c || [];
    const get = (i) => (i >= 0 && c[i] ? c[i].v : null);

    const plano = planKey(get(iPlano));
    const date = parseDateCell(get(iData));
    if (plano == null && date == null) continue; // linha vazia

    let material = null;
    for (const mi of matIdxs) {
      const mv = get(mi);
      if (mv != null && String(mv).trim() !== "") { material = canonMaterial(mv); break; }
    }
    let malha = null;
    if (iMalha >= 0) {
      const mv = get(iMalha);
      if (mv != null && String(mv).trim() !== "") malha = norm(mv);
    }

    const vals = {};
    for (const a of ASPECTS) vals[a.key] = num(get(aspectIdx[a.key]));

    records.push({
      plano,
      date,
      year: date ? date.getFullYear() : null,
      month: date ? date.getMonth() + 1 : null,
      material,
      malha,
      vals,
      source: sheet,
    });
  }
  return { labels, records, aspectIdx };
}

/* ---------- Estado ---------- */
const state = {
  ready: false,
  lastUpdatedAt: null,
  prev: [],   // records previsto
  real: [],   // records realizado
  fPrev: [],  // filtrado previsto
  fReal: [],  // filtrado realizado
  matched: [],
  aspect: "rlcarga",
  year: "Todos", month: "Todos", material: "Todos", malha: "Todos",
  search: "",
  sort: { key: "plano", dir: 1 },
};

/* ---------- Filtragem ---------- */
function passes(rec, isPrev) {
  if (state.year !== "Todos" && rec.year !== +state.year) return false;
  if (state.month !== "Todos" && rec.month !== MON.indexOf(state.month) + 1) return false;
  if (state.material !== "Todos" && rec.material !== state.material) return false;
  if (isPrev && state.malha !== "Todos" && rec.malha !== norm(state.malha)) return false;
  return true;
}

function applyFilters() {
  state.fPrev = state.prev.filter((r) => passes(r, true));
  state.fReal = state.real.filter((r) => passes(r, false));
  // Casamento por número de plano dentro dos conjuntos filtrados
  const realByPlano = new Map();
  for (const r of state.fReal) {
    if (r.plano == null) continue;
    if (!realByPlano.has(r.plano)) realByPlano.set(r.plano, []);
    realByPlano.get(r.plano).push(r);
  }
  const seen = new Set();
  state.matched = [];
  for (const p of state.fPrev) {
    if (p.plano == null) continue;
    const reals = realByPlano.get(p.plano);
    if (reals && reals.length) {
      if (seen.has(p.plano)) continue;
      seen.add(p.plano);
      state.matched.push({ plano: p.plano, prev: p, reals });
    }
  }
}

/* ---------- Agregações ---------- */
function monthlyMap(records) {
  const m = new Map();
  for (const r of records) {
    if (!r.date) continue;
    const k = `${r.year}-${String(r.month).padStart(2, "0")}`;
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(r);
  }
  return m;
}
function aggAspect(records, aspect) {
  const vals = records.map((r) => r.vals[aspect.key]).filter((v) => v != null && isFinite(v));
  if (!vals.length) return null;
  if (aspect.agg === "sum") return vals.reduce((s, v) => s + v, 0);
  return vals.reduce((s, v) => s + v, 0) / vals.length;
}
function unionMonthKeys(a, b) {
  const keys = new Set([...a.keys(), ...b.keys()]);
  return [...keys].sort();
}
const monthLabel = (k) => {
  const [y, mm] = k.split("-");
  return `${MON[+mm - 1]}/${y.slice(2)}`;
};

/* ---------- Render: KPIs ---------- */
function renderKPIs() {
  const nPrev = state.fPrev.length;
  const nReal = state.fReal.length;
  const realiz = nPrev ? Math.round((state.matched.length / nPrev) * 100) : 0;

  const volAspect = ASPECTS.find((a) => a.key === "volume");
  const explAspect = ASPECTS.find((a) => a.key === "explosivos");
  const vol = aggAspect(state.fReal, volAspect) || 0;
  const expl = (aggAspect(state.fReal, explAspect) || 0) / 1000; // kg -> t

  setText("kpi-prev", fmtInt(nPrev));
  setText("kpi-prev-hint", `${state.prev.length} planos na base`);
  setText("kpi-real", fmtInt(nReal));
  setText("kpi-real-hint", `${state.real.length} desmontes na base`);
  setText("kpi-realiz", nPrev ? `${fmtInt(realiz)}%` : "—");
  setText("kpi-realiz-hint", `${fmtInt(state.matched.length)} de ${fmtInt(nPrev)} planos casados`);
  setText("kpi-vol", fmtInt(vol));
  setText("kpi-expl", `${fmtNum(expl, 0)} t`);
}

/* ---------- Render: filtros ativos (chips) ---------- */
function renderChips() {
  const el = document.getElementById("active-filters");
  const items = [];
  if (state.year !== "Todos") items.push(["Ano", state.year]);
  if (state.month !== "Todos") items.push(["Mês", state.month]);
  if (state.material !== "Todos") items.push(["Material", state.material]);
  if (state.malha !== "Todos") items.push(["Malha", `${state.malha} (só Prev.)`]);
  if (!items.length) { el.style.display = "none"; el.innerHTML = ""; return; }
  el.style.display = "flex";
  el.innerHTML = items.map(([k, v], i) =>
    `<span class="chip" data-i="${i}"><span class="chip__k">${k}</span><span class="chip__v">${v}</span><span class="chip__x">×</span></span>`
  ).join("");
  el.querySelectorAll(".chip").forEach((chip) => {
    chip.onclick = () => {
      const [k] = items[+chip.dataset.i];
      if (k === "Ano") state.year = "Todos";
      if (k === "Mês") state.month = "Todos";
      if (k === "Material") state.material = "Todos";
      if (k === "Malha") state.malha = "Todos";
      syncSelects(); render();
    };
  });
}

/* ---------- Charts ---------- */
let charts = {};
let miniCharts = [];

const baseScales = (unit) => ({
  x: { grid: { color: C.grid }, ticks: { color: C.text, maxRotation: 0, autoSkipPadding: 16 } },
  y: { grid: { color: C.grid }, ticks: { color: C.text }, title: { display: !!unit, text: unit, color: C.text, font: { size: 10 } } },
});
const lineDataset = (label, data, color) => ({
  label, data, borderColor: color, backgroundColor: color + "22",
  tension: 0.3, pointRadius: 2.5, pointHoverRadius: 4.5, borderWidth: 2, fill: false,
});
const lineOpts = (unit) => ({
  responsive: true, maintainAspectRatio: false,
  interaction: { mode: "index", intersect: false },
  plugins: { legend: { position: "bottom", labels: { color: C.text, boxWidth: 14, font: { size: 11 } } }, tooltip: { callbacks: {} } },
  scales: baseScales(unit),
});

function destroyAll() {
  Object.values(charts).forEach((ch) => { try { ch.destroy(); } catch (e) {} });
  charts = {};
  miniCharts.forEach((ch) => { try { ch.destroy(); } catch (e) {} });
  miniCharts = [];
}

function currentAspect() { return ASPECTS.find((a) => a.key === state.aspect); }

function renderMain() {
  const a = currentAspect();
  const pm = monthlyMap(state.fPrev), rm = monthlyMap(state.fReal);
  const keys = unionMonthKeys(pm, rm);
  const labels = keys.map(monthLabel);
  const prev = keys.map((k) => aggAspect(pm.get(k) || [], a));
  const real = keys.map((k) => aggAspect(rm.get(k) || [], a));

  setText("sub-main", `${a.agg === "sum" ? "Somatório mensal" : "Média mensal"} · ${a.label} (${a.unit})`);

  const ctx = document.getElementById("chart-main");
  charts.main = new Chart(ctx, {
    type: "line",
    data: { labels, datasets: [lineDataset("Previsto", prev, C.prev), lineDataset("Realizado", real, C.real)] },
    options: lineOpts(a.unit),
  });
}

function renderParity() {
  const a = currentAspect();
  const pts = [];
  for (const m of state.matched) {
    const x = m.prev.vals[a.key];
    let y = null;
    const ys = m.reals.map((r) => r.vals[a.key]).filter((v) => v != null && isFinite(v));
    if (ys.length) y = ys.reduce((s, v) => s + v, 0) / ys.length;
    if (x != null && isFinite(x) && y != null && isFinite(y)) pts.push({ x, y, plano: m.plano });
  }
  const maxVal = pts.length ? Math.max(...pts.map((p) => Math.max(p.x, p.y))) : 1;
  const top = maxVal * 1.05 || 1;
  setText("sub-parity", `${a.label} (${a.unit}) · ${pts.length} planos casados · linha = previsão perfeita (y = x)`);

  const ctx = document.getElementById("chart-parity");
  charts.parity = new Chart(ctx, {
    type: "scatter",
    data: {
      datasets: [
        { label: "Planos casados", data: pts, backgroundColor: "rgba(31,111,235,0.55)", borderColor: C.match, pointRadius: 3.5, pointHoverRadius: 5 },
        { label: "y = x (previsão perfeita)", data: [{ x: 0, y: 0 }, { x: top, y: top }], showLine: true, fill: false, borderColor: C.match, borderWidth: 1.4, borderDash: [5, 4], pointRadius: 0 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom", labels: { color: C.text, boxWidth: 14, font: { size: 11 } } },
        tooltip: { callbacks: { label: (it) => `Plano ${it.raw.plano} · ${a.label}: ${fmtNum(it.raw.y, a.dec)} (real) × ${fmtNum(it.raw.x, a.dec)} (prev)` } },
      },
      scales: {
        x: { min: 0, max: top, title: { display: true, text: `Previsto (${a.unit})`, color: C.text, font: { size: 10 } }, grid: { color: C.grid }, ticks: { color: C.text } },
        y: { min: 0, max: top, title: { display: true, text: `Realizado (${a.unit})`, color: C.text, font: { size: 10 } }, grid: { color: C.grid }, ticks: { color: C.text } },
      },
    },
  });
}

function renderVolume() {
  const a = ASPECTS.find((x) => x.key === "volume");
  const pm = monthlyMap(state.fPrev), rm = monthlyMap(state.fReal);
  const keys = unionMonthKeys(pm, rm);
  const labels = keys.map(monthLabel);
  const prev = keys.map((k) => aggAspect(pm.get(k) || [], a));
  const real = keys.map((k) => aggAspect(rm.get(k) || [], a));
  const ctx = document.getElementById("chart-volume");
  charts.volume = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: "Previsto", data: prev, backgroundColor: C.prev + "cc", borderRadius: 2 },
        { label: "Realizado", data: real, backgroundColor: C.real + "cc", borderRadius: 2 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: "bottom", labels: { color: C.text, boxWidth: 14 } }, tooltip: { callbacks: { label: (it) => `${it.dataset.label}: ${fmtInt(it.raw)} m³` } } },
      scales: baseScales("m³"),
    },
  });
}

function renderCounts() {
  const pm = monthlyMap(state.fPrev), rm = monthlyMap(state.fReal);
  const keys = unionMonthKeys(pm, rm);
  const labels = keys.map(monthLabel);
  const prev = keys.map((k) => (pm.get(k) || []).length);
  const real = keys.map((k) => (rm.get(k) || []).length);
  const ctx = document.getElementById("chart-counts");
  charts.counts = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: "Previsto", data: prev, backgroundColor: C.prev + "cc", borderRadius: 2 },
        { label: "Realizado", data: real, backgroundColor: C.real + "cc", borderRadius: 2 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: "bottom", labels: { color: C.text, boxWidth: 14 } } },
      scales: baseScales("nº planos"),
    },
  });
}

function renderDiff() {
  const a = currentAspect();
  const pm = monthlyMap(state.fPrev), rm = monthlyMap(state.fReal);
  const keys = unionMonthKeys(pm, rm);
  const labels = [], data = [], colors = [];
  for (const k of keys) {
    const p = aggAspect(pm.get(k) || [], a);
    const r = aggAspect(rm.get(k) || [], a);
    if (p == null || r == null) continue;
    const d = r - p;
    labels.push(monthLabel(k));
    data.push(d);
    colors.push(d >= 0 ? C.real : C.prev);
  }
  setText("sub-diff", `Realizado − Previsto · ${a.label} (${a.unit})`);
  const ctx = document.getElementById("chart-diff");
  charts.diff = new Chart(ctx, {
    type: "bar",
    data: { labels, datasets: [{ label: "Δ (Real − Prev)", data, backgroundColor: colors, borderRadius: 2 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (it) => `${a.label}: ${fmtNum(it.raw, a.dec)} ${a.unit}` } } },
      scales: baseScales(a.unit),
    },
  });
}

/* ---------- Grade de pequenos múltiplos (séries por aspecto) ---------- */
function buildMiniGrid() {
  const host = document.getElementById("extra-charts");
  host.innerHTML = "";
  ASPECTS.forEach((a) => {
    const card = document.createElement("div");
    card.className = "extra-card";
    card.innerHTML = `
      <p class="extra-card__title">${a.label} <span style="color:var(--muted);font-weight:400">(${a.unit})</span></p>
      <p class="extra-card__sub" id="mini-sub-${a.key}">—</p>
      <div class="extra-card__canvas"><canvas id="mini-${a.key}"></canvas></div>`;
    host.appendChild(card);
  });
}

function renderMinis() {
  const pm = monthlyMap(state.fPrev), rm = monthlyMap(state.fReal);
  const keys = unionMonthKeys(pm, rm);
  const labels = keys.map(monthLabel);
  ASPECTS.forEach((a) => {
    const prev = keys.map((k) => aggAspect(pm.get(k) || [], a));
    const real = keys.map((k) => aggAspect(rm.get(k) || [], a));
    const pAll = aggAspect(state.fPrev, a);
    const rAll = aggAspect(state.fReal, a);
    const sub = document.getElementById(`mini-sub-${a.key}`);
    if (sub) {
      const fmt = (v) => v == null ? "—" : (a.agg === "sum" ? fmtInt(v) : fmtNum(v, a.dec));
      sub.textContent = `${a.agg === "sum" ? "Total" : "Média"} · Prev ${fmt(pAll)} · Real ${fmt(rAll)}`;
    }
    const ctx = document.getElementById(`mini-${a.key}`);
    const ch = new Chart(ctx, {
      type: "line",
      data: { labels, datasets: [lineDataset("P", prev, C.prev), lineDataset("R", real, C.real)] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (it) => `${it.dataset.label === "P" ? "Previsto" : "Realizado"}: ${a.agg === "sum" ? fmtInt(it.raw) : fmtNum(it.raw, a.dec)} ${a.unit}` } } },
        scales: {
          x: { grid: { display: false }, ticks: { color: C.text, maxRotation: 0, autoSkipPadding: 18, font: { size: 9 } } },
          y: { grid: { color: C.grid }, ticks: { color: C.text, font: { size: 9 }, maxTicksLimit: 4 } },
        },
      },
    });
    miniCharts.push(ch);
  });
}

/* ---------- Tabela ---------- */
const TABLE_COLS = [
  { key: "plano", label: "Plano", align: "left", val: (m) => m.plano, fmt: (v) => v || "—" },
  { key: "date", label: "Data", val: (m) => m.prev.date, fmt: (v) => v ? `${String(v.getDate()).padStart(2, "0")}/${String(v.getMonth() + 1).padStart(2, "0")}/${v.getFullYear()}` : "—" },
  { key: "material", label: "Material", val: (m) => m.prev.material, fmt: (v) => v || "—" },
  { key: "prev", label: "Prev", val: (m, a) => m.prev.vals[a.key], fmt: (v, a) => v == null ? "—" : fmtNum(v, a.dec) },
  { key: "real", label: "Real", val: (m, a) => avgReal(m, a), fmt: (v, a) => v == null ? "—" : fmtNum(v, a.dec) },
  { key: "delta", label: "Δ", val: (m, a) => delta(m, a), fmt: (v) => v == null ? "—" : (v >= 0 ? "+" : "") + fmtNum(v, currentAspect().dec), cls: (v) => v == null ? "" : v >= 0 ? "delta-pos" : "delta-neg" },
  { key: "deltap", label: "Δ %", val: (m, a) => deltaPct(m, a), fmt: (v) => v == null ? "—" : (v >= 0 ? "+" : "") + fmtNum(v, 1) + "%", cls: (v) => v == null ? "" : v >= 0 ? "delta-pos" : "delta-neg" },
];
function avgReal(m, a) {
  const ys = m.reals.map((r) => r.vals[a.key]).filter((v) => v != null && isFinite(v));
  if (!ys.length) return null;
  return ys.reduce((s, v) => s + v, 0) / ys.length;
}
function delta(m, a) { const p = m.prev.vals[a.key], r = avgReal(m, a); if (p == null || r == null) return null; return r - p; }
function deltaPct(m, a) { const p = m.prev.vals[a.key], r = avgReal(m, a); if (p == null || r == null || p === 0) return null; return ((r - p) / Math.abs(p)) * 100; }

function renderTable() {
  const a = currentAspect();
  const head = document.getElementById("table-head");
  const aspectLabel = a.label;
  // Cabeçalho dinâmico: Prev/Real do aspecto selecionado
  const cols = [
    TABLE_COLS[0], TABLE_COLS[1], TABLE_COLS[2],
    { ...TABLE_COLS[3], label: `${aspectLabel} · Prev` },
    { ...TABLE_COLS[4], label: `${aspectLabel} · Real` },
    TABLE_COLS[5], TABLE_COLS[6],
  ];
  head.innerHTML = cols.map((c) => {
    const isSort = state.sort.key === c.key;
    const arrow = isSort ? (state.sort.dir > 0 ? " ▲" : " ▼") : "";
    return `<th data-key="${c.key}" class="${c.align === "left" ? "col-plano" : ""}" style="cursor:pointer;white-space:nowrap">${c.label}${arrow}</th>`;
  }).join("");
  head.querySelectorAll("th").forEach((th) => {
    th.onclick = () => {
      const k = th.dataset.key;
      if (state.sort.key === k) state.sort.dir *= -1; else { state.sort.key = k; state.sort.dir = 1; }
      renderTable();
    };
  });

  let rows = state.matched.slice();
  if (state.search.trim()) {
    const q = state.search.trim().toUpperCase();
    rows = rows.filter((m) => String(m.plano).includes(q));
  }
  const sortKey = state.sort.key, dir = state.sort.dir;
  rows.sort((m1, m2) => {
    const col = cols.find((c) => c.key === sortKey) || cols[0];
    let v1 = col.val(m1, a), v2 = col.val(m2, a);
    if (v1 == null && v2 == null) return 0;
    if (v1 == null) return 1;
    if (v2 == null) return -1;
    if (v1 instanceof Date) v1 = v1.getTime();
    if (v2 instanceof Date) v2 = v2.getTime();
    if (typeof v1 === "string" || typeof v2 === "string") {
      return String(v1).localeCompare(String(v2), "pt-BR", { numeric: true, sensitivity: "base" }) * dir;
    }
    return (v1 - v2) * dir;
  });

  const body = document.getElementById("table-body");
  const LIMIT = 400;
  const shown = rows.slice(0, LIMIT);
  body.innerHTML = shown.map((m) =>
    `<tr>${cols.map((c) => {
      const v = c.val(m, a);
      const cls = typeof c.cls === "function" ? c.cls(v) : "";
      return `<td class="${c.align === "left" ? "col-plano" : ""} ${cls}">${c.fmt(v, a)}</td>`;
    }).join("")}</tr>`
  ).join("") || `<tr><td colspan="${cols.length}" style="text-align:center;color:var(--muted);padding:18px">Nenhum plano casado no filtro atual.</td></tr>`;

  const foot = document.getElementById("table-foot");
  foot.textContent = rows.length > LIMIT
    ? `Mostrando ${LIMIT} de ${rows.length} planos casados · refine a busca para ver mais.`
    : `${rows.length} plano(s) casado(s) no filtro atual · ${state.matched.length} no total.`;
}

/* ---------- Util DOM ---------- */
function setText(id, t) { const el = document.getElementById(id); if (el) el.textContent = t; }
function syncSelects() {
  document.getElementById("filter-year").value = state.year;
  document.getElementById("filter-month").value = state.month;
  document.getElementById("filter-material").value = state.material;
  document.getElementById("filter-malha").value = state.malha;
  document.getElementById("aspect-main").value = state.aspect;
}

function retainAvailableFilters() {
  const options = (id) => new Set([...document.getElementById(id).options].map((option) => option.value));
  if (!options("filter-year").has(state.year)) state.year = "Todos";
  if (!options("filter-month").has(state.month)) state.month = "Todos";
  if (!options("filter-material").has(state.material)) state.material = "Todos";
  if (!options("filter-malha").has(state.malha)) state.malha = "Todos";
}

/* ---------- Render geral ---------- */
function render() {
  applyFilters();
  destroyAll();
  renderChips();
  renderKPIs();
  renderMain();
  renderParity();
  renderVolume();
  renderCounts();
  renderDiff();
  renderMinis();
  renderTable();
}

function periodSummary(records, label) {
  const dates = records.map((record) => record.date).filter(Boolean).sort((a, b) => a - b);
  if (!dates.length) return `${fmtInt(records.length)} ${label} · sem datas`;
  const monthYear = (date) => `${MON[date.getMonth()].toLowerCase()}/${date.getFullYear()}`;
  return `${fmtInt(records.length)} ${label} · ${monthYear(dates[0])}–${monthYear(dates[dates.length - 1])}`;
}

function renderSourceSummary() {
  setText("source-prev-summary", periodSummary(state.prev, "planos"));
  setText("source-real-summary", periodSummary(state.real, "desmontes"));
}

/* ---------- Inicialização dos filtros ---------- */
function populateFilters() {
  const years = new Set();
  state.prev.forEach((r) => r.year && years.add(r.year));
  state.real.forEach((r) => r.year && years.add(r.year));
  const ySel = document.getElementById("filter-year");
  ySel.innerHTML = `<option>Todos</option>` + [...years].sort().map((y) => `<option>${y}</option>`).join("");

  const mSel = document.getElementById("filter-month");
  mSel.innerHTML = `<option>Todos</option>` + MON.map((m) => `<option>${m}</option>`).join("");

  const mats = new Set();
  state.prev.forEach((r) => r.material && r.material !== "—" && mats.add(r.material));
  state.real.forEach((r) => r.material && r.material !== "—" && mats.add(r.material));
  const matSel = document.getElementById("filter-material");
  matSel.innerHTML = `<option>Todos</option>` + [...mats].sort().map((m) => `<option>${m}</option>`).join("");

  const malhas = new Set();
  state.prev.forEach((r) => r.malha && malhas.add(r.malha));
  const malSel = document.getElementById("filter-malha");
  malSel.innerHTML = `<option>Todos</option>` + [...malhas].sort().map((m) => `<option>${m}</option>`).join("");

  const aSel = document.getElementById("aspect-main");
  aSel.innerHTML = ASPECTS.map((a) => `<option value="${a.key}">${a.label} (${a.unit})</option>`).join("");
  aSel.value = state.aspect;
}

function bindEvents() {
  document.getElementById("filter-year").onchange = (e) => { state.year = e.target.value; render(); };
  document.getElementById("filter-month").onchange = (e) => { state.month = e.target.value; render(); };
  document.getElementById("filter-material").onchange = (e) => { state.material = e.target.value; render(); };
  document.getElementById("filter-malha").onchange = (e) => { state.malha = e.target.value; render(); };
  document.getElementById("aspect-main").onchange = (e) => { state.aspect = e.target.value; render(); };
  document.getElementById("refresh-data").onclick = load;
  document.getElementById("filter-reset").onclick = () => {
    state.year = state.month = state.material = state.malha = "Todos";
    syncSelects(); render();
  };
  let st;
  document.getElementById("table-search").oninput = (e) => {
    state.search = e.target.value;
    clearTimeout(st); st = setTimeout(renderTable, 120);
  };
}

/* ---------- Status ---------- */
function setStatus(kind, text, time) {
  const el = document.getElementById("status");
  el.classList.remove("is-loading", "is-ok", "is-error");
  if (kind) el.classList.add(`is-${kind}`);
  setText("status-text", text);
  if (time != null) setText("last-update", time);
}

/* ---------- Carga ---------- */
async function load() {
  if (load.inProgress) return;
  load.inProgress = true;
  load.startedAt = Date.now();
  const refreshButton = document.getElementById("refresh-data");
  refreshButton.disabled = true;
  refreshButton.textContent = "Atualizando…";
  setStatus("loading", state.ready ? "Atualizando planilhas…" : "Carregando planilhas…");
  try {
    const fetchData = async (name) => {
      const response = await fetch(DATA_URL(name), { cache: "no-store" });
      if (!response.ok) throw new Error(`dados ${name}: HTTP ${response.status}`);
      return response.json();
    };
    const [rPrev, rReal] = await Promise.all([fetchData("previsto"), fetchData("realizado")]);

    const P = parseGviz(rPrev, "prev"), R = parseGviz(rReal, "real");
    state.prev = P.records.filter((r) => r.plano != null || r.date != null);
    state.real = R.records.filter((r) => r.plano != null || r.date != null);
    renderSourceSummary();

    // diagnósticos de resolução de colunas
    const missing = [];
    for (const a of ASPECTS) {
      if (P.aspectIdx[a.key] < 0) missing.push(`Prev→${a.label}`);
      if (R.aspectIdx[a.key] < 0) missing.push(`Real→${a.label}`);
    }
    if (missing.length) console.warn("Colunas não resolvidas:", missing.join(", "));

    buildMiniGrid();
    populateFilters();
    retainAvailableFilters();
    syncSelects();
    render();

    state.ready = true;
    const generatedAt = [rPrev.metadata?.generatedAt, rReal.metadata?.generatedAt]
      .map((value) => value ? new Date(value) : null)
      .filter((value) => value && isFinite(value.getTime()));
    state.lastUpdatedAt = generatedAt.length
      ? new Date(Math.max(...generatedAt.map((value) => value.getTime())))
      : new Date();
    const upd = `Dados sincronizados em ${state.lastUpdatedAt.toLocaleString("pt-BR")}`;
    setStatus("ok", `${state.prev.length} planos previstos · ${state.real.length} realizados · ${state.matched.length} casados`, upd);
  } catch (err) {
    console.error(err);
    if (state.ready) {
      setStatus("error", `Falha na atualização; mantendo os dados anteriores. ${err.message}`);
    } else {
      setStatus("error", `Erro ao carregar: ${err.message}. Verifique a sincronização do GitHub Pages.`);
    }
  } finally {
    load.inProgress = false;
    refreshButton.disabled = false;
    refreshButton.textContent = "Atualizar";
  }
}

function refreshWhenResumed() {
  if (!document.hidden && Date.now() - (load.startedAt || 0) >= 30_000) load();
}

Chart.defaults.font.family = '"Segoe UI", -apple-system, BlinkMacSystemFont, Helvetica, Arial, sans-serif';
Chart.defaults.font.size = 11;
Chart.defaults.color = C.text;
Chart.defaults.borderColor = C.grid;

document.addEventListener("DOMContentLoaded", () => {
  bindEvents();
  load();
  window.setInterval(() => { if (!document.hidden) load(); }, 5 * 60 * 1000);
  window.addEventListener("focus", refreshWhenResumed);
  document.addEventListener("visibilitychange", refreshWhenResumed);
});
