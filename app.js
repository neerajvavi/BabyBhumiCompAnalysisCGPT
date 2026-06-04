const state = {
  activeView: "audience",
  strategies: [
    ["Positioning", "How clearly the competitor frames who they serve and why they matter."],
    ["Performance marketing", "Signals from ad libraries, landing pages, offer ladders, and retargeting hooks."],
    ["Content engine", "Education, UGC, influencer, SEO, reels, newsletters, and community motion."],
    ["Pricing power", "Premium justification, bundles, subscriptions, discounting, and entry products."],
    ["Distribution", "Website, marketplaces, retail, partnerships, and social commerce presence."],
    ["Trust building", "Reviews, certifications, guarantees, founder story, clinical proof, and safety claims."]
  ],
  competitors: [],
  sources: [],
  snapshots: []
};

const els = {
  projectName: document.querySelector("#projectName"),
  marketName: document.querySelector("#marketName"),
  researchDate: document.querySelector("#researchDate"),
  analystName: document.querySelector("#analystName"),
  competitorList: document.querySelector("#competitorList"),
  sourceList: document.querySelector("#sourceList"),
  insightView: document.querySelector("#insightView"),
  strategyGrid: document.querySelector("#strategyGrid"),
  reportPreview: document.querySelector("#reportPreview"),
  competitorCount: document.querySelector("#competitorCount"),
  sourceCount: document.querySelector("#sourceCount"),
  productCategoryCount: document.querySelector("#productCategoryCount"),
  confidenceScore: document.querySelector("#confidenceScore"),
  snapshotCount: document.querySelector("#snapshotCount"),
  baselineSnapshot: document.querySelector("#baselineSnapshot"),
  comparisonSnapshot: document.querySelector("#comparisonSnapshot"),
  snapshotList: document.querySelector("#snapshotList"),
  comparisonPreview: document.querySelector("#comparisonPreview")
};

const storeKey = "competitor-research-lab";

function persist() {
  readDomIntoState();
  localStorage.setItem(storeKey, JSON.stringify({
    projectName: els.projectName.value,
    marketName: els.marketName.value,
    researchDate: els.researchDate.value,
    analystName: els.analystName.value,
    competitors: state.competitors,
    sources: state.sources,
    snapshots: state.snapshots,
    strategyScores: getStrategyScores()
  }));
  renderComputedViews();
}

function readDomIntoState() {
  state.competitors = [...document.querySelectorAll(".competitor-card")].map(card => ({
    name: card.querySelector(".competitor-name").value.trim(),
    website: card.querySelector(".website").value.trim(),
    instagram: card.querySelector(".instagram").value.trim(),
    market: card.querySelector(".market").value.trim(),
    confidence: Number(card.querySelector(".confidence").value),
    audience: card.querySelector(".audience").value.trim(),
    products: card.querySelector(".products").value.trim(),
    pricing: card.querySelector(".pricing").value.trim(),
    usp: card.querySelector(".usp").value.trim()
  }));

  state.sources = [...document.querySelectorAll(".source-card")].map(card => ({
    type: card.querySelector(".source-type").value,
    url: card.querySelector(".source-url").value.trim(),
    status: card.querySelector(".source-status").value
  }));
}

function addCompetitor(data = {}) {
  const template = document.querySelector("#competitorTemplate");
  const card = template.content.firstElementChild.cloneNode(true);
  const defaults = {
    name: "",
    website: "",
    instagram: "",
    market: "",
    confidence: 65,
    audience: "",
    products: "",
    pricing: "",
    usp: ""
  };
  const competitor = { ...defaults, ...data };

  card.querySelector(".competitor-name").value = competitor.name;
  card.querySelector(".website").value = competitor.website;
  card.querySelector(".instagram").value = competitor.instagram;
  card.querySelector(".market").value = competitor.market;
  card.querySelector(".confidence").value = competitor.confidence;
  card.querySelector(".audience").value = competitor.audience;
  card.querySelector(".products").value = competitor.products;
  card.querySelector(".pricing").value = competitor.pricing;
  card.querySelector(".usp").value = competitor.usp;
  card.querySelector(".remove-competitor").addEventListener("click", () => {
    card.remove();
    persist();
  });
  card.addEventListener("input", persist);
  card.addEventListener("change", persist);
  els.competitorList.append(card);
  persist();
}

function addSource(data = {}) {
  const template = document.querySelector("#sourceTemplate");
  const card = template.content.firstElementChild.cloneNode(true);
  const source = { type: "Website", url: "", status: "To research", ...data };

  card.querySelector(".source-type").value = source.type;
  card.querySelector(".source-url").value = source.url;
  card.querySelector(".source-status").value = source.status;
  card.querySelector(".remove-source").addEventListener("click", () => {
    card.remove();
    persist();
  });
  card.addEventListener("input", persist);
  card.addEventListener("change", persist);
  els.sourceList.append(card);
  persist();
}

function buildResearchQueue() {
  readDomIntoState();
  const planned = [];

  state.competitors.forEach(competitor => {
    if (competitor.website) {
      planned.push({ type: "Website", url: competitor.website, status: "To research" });
      planned.push({ type: "Marketplace", url: `${competitor.website.replace(/\/$/, "")}/products`, status: "To research" });
    }

    if (competitor.instagram) {
      planned.push({ type: "Social media", url: competitor.instagram, status: "To research" });
    }

    const name = competitor.name || competitor.website || "competitor";
    planned.push({ type: "Ad library", url: `Meta Ad Library search: ${name}`, status: "To research" });
    planned.push({ type: "Review site", url: `Reviews search: ${name}`, status: "To research" });
  });

  planned
    .filter(source => !state.sources.some(existing => existing.type === source.type && existing.url === source.url))
    .forEach(addSource);
  persist();
}

function renderComputedViews() {
  els.competitorCount.textContent = state.competitors.length;
  els.sourceCount.textContent = state.sources.filter(source => source.url).length;
  els.productCategoryCount.textContent = countProductCategories();
  els.confidenceScore.textContent = `${averageConfidence()}%`;
  els.snapshotCount.textContent = state.snapshots.length;
  renderInsightView();
  renderSnapshots();
  renderReport();
}

function renderInsightView() {
  const columnMap = {
    audience: ["Target audience", "audience"],
    products: ["Products / services", "products"],
    pricing: ["Price points", "pricing"],
    usp: ["Unique selling points", "usp"]
  };
  const [heading, key] = columnMap[state.activeView];
  const rows = state.competitors.map(competitor => `
    <tr>
      <td>${escapeHtml(competitor.name || "Unnamed competitor")}</td>
      <td>${formatMultiline(competitor[key] || "No notes yet")}</td>
      <td>${competitor.confidence}%</td>
    </tr>
  `).join("");

  els.insightView.innerHTML = `
    <div class="insight-table">
      <table>
        <thead>
          <tr><th>Competitor</th><th>${heading}</th><th>Confidence</th></tr>
        </thead>
        <tbody>${rows || "<tr><td colspan='3'>Add competitors to build the matrix.</td></tr>"}</tbody>
      </table>
    </div>
  `;
}

function renderStrategies(savedScores = {}) {
  els.strategyGrid.innerHTML = state.strategies.map(([name, description]) => {
    const id = slug(name);
    const score = savedScores[id] ?? 3;
    return `
      <article class="strategy-card">
        <h3>${name}</h3>
        <p>${description}</p>
        <div class="score-row">
          <input type="range" min="1" max="5" value="${score}" data-strategy="${id}" aria-label="${name} score" />
          <strong id="${id}Score">${score}/5</strong>
        </div>
      </article>
    `;
  }).join("");

  document.querySelectorAll("[data-strategy]").forEach(input => {
    input.addEventListener("input", event => {
      document.querySelector(`#${event.target.dataset.strategy}Score`).textContent = `${event.target.value}/5`;
      persist();
    });
  });
}

function saveSnapshot() {
  readDomIntoState();
  const snapshot = {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    savedAt: new Date().toISOString(),
    projectName: els.projectName.value,
    marketName: els.marketName.value,
    competitors: structuredClone(state.competitors),
    sources: structuredClone(state.sources),
    strategyScores: getStrategyScores(),
    summary: {
      competitorCount: state.competitors.length,
      sourceCount: state.sources.filter(source => source.url).length,
      productCategoryCount: countProductCategories(),
      confidenceScore: averageConfidence()
    }
  };

  state.snapshots.unshift(snapshot);
  persist();
}

function renderSnapshots() {
  const options = state.snapshots.map(snapshot => {
    const label = `${formatDate(snapshot.savedAt)} - ${snapshot.projectName || "Untitled"}`;
    return `<option value="${snapshot.id}">${escapeHtml(label)}</option>`;
  }).join("");

  [els.baselineSnapshot, els.comparisonSnapshot].forEach(select => {
    const current = select.value;
    select.innerHTML = options || "<option value=''>No snapshots yet</option>";
    if (current && state.snapshots.some(snapshot => snapshot.id === current)) {
      select.value = current;
    }
  });

  if (!els.comparisonSnapshot.value && state.snapshots[0]) {
    els.comparisonSnapshot.value = state.snapshots[0].id;
  }
  if (!els.baselineSnapshot.value && state.snapshots[1]) {
    els.baselineSnapshot.value = state.snapshots[1].id;
  }

  els.snapshotList.innerHTML = state.snapshots.map(snapshot => `
    <article class="snapshot-card">
      <div>
        <strong>${escapeHtml(snapshot.projectName || "Untitled analysis")}</strong>
        <span>${formatDate(snapshot.savedAt)} | ${snapshot.summary.competitorCount} competitors | ${snapshot.summary.sourceCount} sources | ${snapshot.summary.confidenceScore}% confidence</span>
      </div>
      <button data-load-snapshot="${snapshot.id}">Load</button>
    </article>
  `).join("") || "<p>No historical snapshots saved yet.</p>";

  document.querySelectorAll("[data-load-snapshot]").forEach(button => {
    button.addEventListener("click", () => loadSnapshot(button.dataset.loadSnapshot));
  });
}

function loadSnapshot(id) {
  const snapshot = state.snapshots.find(item => item.id === id);
  if (!snapshot) return;

  els.projectName.value = snapshot.projectName || "";
  els.marketName.value = snapshot.marketName || "";
  els.competitorList.innerHTML = "";
  els.sourceList.innerHTML = "";
  snapshot.competitors.forEach(addCompetitor);
  snapshot.sources.forEach(addSource);
  renderStrategies(snapshot.strategyScores);
  persist();
}

function compareSnapshots() {
  const baseline = state.snapshots.find(snapshot => snapshot.id === els.baselineSnapshot.value);
  const comparison = state.snapshots.find(snapshot => snapshot.id === els.comparisonSnapshot.value);

  if (!baseline || !comparison) {
    els.comparisonPreview.textContent = "Save at least two snapshots to compare historical movement.";
    return;
  }

  const baselineNames = new Set(baseline.competitors.map(item => item.name).filter(Boolean));
  const comparisonNames = new Set(comparison.competitors.map(item => item.name).filter(Boolean));
  const added = [...comparisonNames].filter(name => !baselineNames.has(name));
  const removed = [...baselineNames].filter(name => !comparisonNames.has(name));
  const changedPricing = comparison.competitors
    .filter(next => {
      const prev = baseline.competitors.find(item => item.name === next.name);
      return prev && prev.pricing !== next.pricing;
    })
    .map(item => item.name);

  els.comparisonPreview.textContent = [
    `# Snapshot Comparison`,
    `Baseline: ${formatDate(baseline.savedAt)}`,
    `Comparison: ${formatDate(comparison.savedAt)}`,
    "",
    `Competitors: ${baseline.summary.competitorCount} -> ${comparison.summary.competitorCount}`,
    `Evidence sources: ${baseline.summary.sourceCount} -> ${comparison.summary.sourceCount}`,
    `Product categories: ${baseline.summary.productCategoryCount} -> ${comparison.summary.productCategoryCount}`,
    `Average confidence: ${baseline.summary.confidenceScore}% -> ${comparison.summary.confidenceScore}%`,
    "",
    `Added competitors: ${added.join(", ") || "None"}`,
    `Removed competitors: ${removed.join(", ") || "None"}`,
    `Pricing notes changed: ${changedPricing.join(", ") || "None"}`
  ].join("\n");
}

function renderReport() {
  const report = [
    `# ${els.projectName.value || "Competitor Analysis"}`,
    `Market: ${els.marketName.value || "Not specified"}`,
    `Research date: ${els.researchDate.value || "Not specified"}`,
    `Analyst: ${els.analystName.value || "Not specified"}`,
    "",
    "## Executive Snapshot",
    `Competitors reviewed: ${state.competitors.length}`,
    `Evidence sources tracked: ${state.sources.filter(source => source.url).length}`,
    `Average confidence: ${averageConfidence()}%`,
    "",
    "## Competitor Findings",
    ...state.competitors.flatMap(competitor => [
      `### ${competitor.name || "Unnamed competitor"}`,
      `Website: ${competitor.website || "Not captured"}`,
      `Social: ${competitor.instagram || "Not captured"}`,
      `Market / channel: ${competitor.market || "Not captured"}`,
      `Target audience: ${competitor.audience || "Not captured"}`,
      `Products / services: ${competitor.products || "Not captured"}`,
      `Pricing: ${competitor.pricing || "Not captured"}`,
      `USP: ${competitor.usp || "Not captured"}`,
      `Confidence: ${competitor.confidence}%`,
      ""
    ]),
    "## Evidence Sources",
    ...state.sources.map(source => `- ${source.type}: ${source.url || "No URL"} (${source.status})`),
    "",
    "## Historical Snapshots",
    ...state.snapshots.map(snapshot => `- ${formatDate(snapshot.savedAt)}: ${snapshot.summary.competitorCount} competitors, ${snapshot.summary.sourceCount} sources, ${snapshot.summary.confidenceScore}% confidence`),
    "",
    "## Strategy Scores",
    ...Object.entries(getStrategyScores()).map(([key, value]) => `- ${titleFromSlug(key)}: ${value}/5`)
  ].join("\n");

  els.reportPreview.textContent = report;
}

function countProductCategories() {
  const products = state.competitors.flatMap(competitor => competitor.products.split(/[,\n;]/));
  return new Set(products.map(item => item.trim().toLowerCase()).filter(Boolean)).size;
}

function averageConfidence() {
  if (!state.competitors.length) return 0;
  const total = state.competitors.reduce((sum, competitor) => sum + competitor.confidence, 0);
  return Math.round(total / state.competitors.length);
}

function getStrategyScores() {
  return Object.fromEntries([...document.querySelectorAll("[data-strategy]")].map(input => [
    input.dataset.strategy,
    Number(input.value)
  ]));
}

function loadSaved() {
  const saved = JSON.parse(localStorage.getItem(storeKey) || "null");
  els.researchDate.valueAsDate = new Date();
  renderStrategies();

  if (!saved) {
    addCompetitor();
    addSource();
    return;
  }

  els.projectName.value = saved.projectName || "";
  els.marketName.value = saved.marketName || "";
  els.researchDate.value = saved.researchDate || "";
  els.analystName.value = saved.analystName || "";
  state.snapshots = saved.snapshots || [];
  renderStrategies(saved.strategyScores);
  (saved.competitors || []).forEach(addCompetitor);
  (saved.sources || []).forEach(addSource);
  renderComputedViews();
}

function loadSample() {
  els.projectName.value = "Baby Bhumi";
  els.marketName.value = "Baby and toddler products";
  els.researchDate.valueAsDate = new Date();
  els.analystName.value = "Research team";
  els.competitorList.innerHTML = "";
  els.sourceList.innerHTML = "";

  addCompetitor({
    name: "Organic Baby Co.",
    website: "https://example.com",
    instagram: "@organicbabyco",
    market: "D2C premium",
    confidence: 65,
    audience: "Urban parents seeking organic materials, safety-led claims, and giftable designs.",
    products: "Organic cotton clothing, swaddles, bedding, gift boxes",
    pricing: "Essentials Rs. 499-1,299; bedding Rs. 1,999-4,999; gift boxes Rs. 2,499+",
    usp: "Certified organic cotton, muted design language, curated newborn gifting."
  });
  addCompetitor({
    name: "Tiny Rituals",
    website: "https://example.org",
    instagram: "@tinyrituals",
    market: "Marketplace plus retail",
    confidence: 65,
    audience: "New parents comparing practical bundles, repeat-purchase basics, and gentle baby care.",
    products: "Skin care, bath care, diapering accessories, starter bundles",
    pricing: "Skin care Rs. 249-799; bundles Rs. 999-2,499",
    usp: "Dermatologist-tested routines, accessible pricing, strong marketplace reviews."
  });
  addSource({ type: "Website", url: "https://example.com", status: "Captured" });
  addSource({ type: "Social media", url: "https://instagram.com/organicbabyco", status: "To research" });
  addSource({ type: "Ad library", url: "https://www.facebook.com/ads/library", status: "To research" });
  persist();
}

function exportReport() {
  persist();
  const blob = new Blob([els.reportPreview.textContent], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${slug(els.projectName.value || "competitor-analysis")}.md`;
  link.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function formatMultiline(value) {
  return escapeHtml(value).replace(/\n/g, "<br>");
}

function formatDate(value) {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function titleFromSlug(value) {
  return value.replace(/-/g, " ").replace(/\b\w/g, char => char.toUpperCase());
}

document.querySelector("#addCompetitorButton").addEventListener("click", () => addCompetitor());
document.querySelector("#addSourceButton").addEventListener("click", () => addSource());
document.querySelector("#buildQueueButton").addEventListener("click", buildResearchQueue);
document.querySelector("#saveSnapshotButton").addEventListener("click", saveSnapshot);
document.querySelector("#compareSnapshotsButton").addEventListener("click", compareSnapshots);
document.querySelector("#loadSampleButton").addEventListener("click", loadSample);
document.querySelector("#exportButton").addEventListener("click", exportReport);
document.querySelector("#newProjectButton").addEventListener("click", () => {
  localStorage.removeItem(storeKey);
  location.reload();
});

[els.projectName, els.marketName, els.researchDate, els.analystName].forEach(input => {
  input.addEventListener("input", persist);
  input.addEventListener("change", persist);
});

document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(item => item.classList.remove("active"));
    tab.classList.add("active");
    state.activeView = tab.dataset.view;
    renderInsightView();
  });
});

loadSaved();
