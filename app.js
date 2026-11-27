const CATEGORY_LABELS = {
  cpu: "Processor (CPU)",
  motherboard: "Motherboard",
  gpu: "Graphics (GPU)",
  ram: "Memory (RAM)",
  storage: "Storage (SSD)",
  psu: "Power Supply",
  case: "PC Case"
};

const state = {
  mode: "recommender",
  budget: 1200,
  workload: "gaming-1440p",
  formFactor: "any",
  noRgb: false,
  locked: {},
  build: null,
  clientIndex: 0
};

// DOM Elements
const budgetSlider = document.getElementById("budget-slider");
const budgetDisplay = document.getElementById("budget-display");
const workloadSelect = document.getElementById("workload-select");
const formFactorSelect = document.getElementById("formfactor-select");
const noRgbCheck = document.getElementById("no-rgb-check");
const partsListEl = document.getElementById("parts-list");
const themeToggleBtn = document.getElementById("btn-theme-toggle");
const viewerContainerEl = document.getElementById("pc-3d-canvas");
const viewerCaseTagEl = document.getElementById("viewer-case-tag");
const viewerHudLabelEl = document.querySelector(".viewer-hud-label");
const viewerHudNameEl = document.getElementById("viewer-hud-name");
const toggleGlassBtn = document.getElementById("btn-toggle-glass");
const toggleExplodeBtn = document.getElementById("btn-toggle-explode");
const toggleSpinBtn = document.getElementById("btn-toggle-spin");
const toastEl = document.getElementById("toast");

let viewer3d = null;
let prevRenderedPartIds = {};
let hasCompletedFirstRender = false;
let lastCompatText = "";
let toastTimer = null;
const counterState = {};

function showToast(message) {
  if (!toastEl) return;
  toastEl.textContent = message;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.classList.remove("show");
  }, 2200);
}

function animateMetric(key, el, targetValue, formatter) {
  if (!el) return;
  const entry = counterState[key] || { value: targetValue, raf: null };
  if (entry.raf) cancelAnimationFrame(entry.raf);

  const startValue = entry.value;
  if (startValue === targetValue || !hasCompletedFirstRender) {
    entry.value = targetValue;
    el.textContent = formatter(targetValue);
    counterState[key] = entry;
    return;
  }

  const duration = 360;
  const startTime = performance.now();
  const step = (now) => {
    const t = Math.min(1, (now - startTime) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    const current = Math.round(startValue + (targetValue - startValue) * eased);
    entry.value = current;
    el.textContent = formatter(current);
    if (t < 1) {
      entry.raf = requestAnimationFrame(step);
    } else {
      entry.value = targetValue;
      entry.raf = null;
      el.textContent = formatter(targetValue);
    }
  };
  entry.raf = requestAnimationFrame(step);
  counterState[key] = entry;
}

function initTheme() {
  const savedTheme = localStorage.getItem("pc_sim_theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const isDark = savedTheme ? savedTheme === "dark" : prefersDark;
  applyTheme(isDark);
}

function applyTheme(isDark) {
  document.body.classList.toggle("dark-mode", isDark);
  themeToggleBtn.textContent = isDark ? "Light Mode" : "Dark Mode";
  localStorage.setItem("pc_sim_theme", isDark ? "dark" : "light");
  if (viewer3d) {
    viewer3d.setTheme(isDark);
  }
}

function updateViewerHud(category) {
  if (!state.build || !viewerHudLabelEl || !viewerHudNameEl) return;
  if (category && state.build[category]) {
    viewerHudLabelEl.textContent = CATEGORY_LABELS[category];
    viewerHudNameEl.textContent = state.build[category].name;
  } else {
    const coolerType = state.build.cpu.tdp >= 105 ? "240mm AIO" : "Air Cooler";
    viewerHudLabelEl.textContent = "Live 3D Preview";
    viewerHudNameEl.textContent = `${state.build.case.name} · ${coolerType}`;
  }
}

function highlightPartCard(category) {
  partsListEl.querySelectorAll(".part-card").forEach((card) => {
    card.classList.toggle("is-highlighted", Boolean(category) && card.dataset.cat === category);
  });
}

function initViewer3D() {
  if (!viewerContainerEl || typeof PCViewer3D === "undefined") return;
  viewer3d = new PCViewer3D(viewerContainerEl, {
    onPartClick: (cat) => {
      if (CATEGORY_LABELS[cat]) {
        openSwapModal(cat);
      }
    },
    onPartHover: (cat) => {
      highlightPartCard(cat);
      updateViewerHud(cat);
    }
  });
  viewer3d.setTheme(document.body.classList.contains("dark-mode"));

  // Sync Auto-Spin button if user drags the canvas
  viewerContainerEl.addEventListener("mousedown", () => {
    setTimeout(() => {
      if (viewer3d && toggleSpinBtn) {
        toggleSpinBtn.classList.toggle("active", viewer3d.autoRotate);
      }
    }, 120);
  });
}

function init() {
  initTheme();
  initViewer3D();
  state.build = BuildEngine.generateBuild({
    budget: state.budget,
    workload: state.workload,
    formFactor: state.formFactor,
    noRgb: state.noRgb
  });

  bindEvents();
  renderClientBrief();
  renderAll();
}

function bindEvents() {
  themeToggleBtn.addEventListener("click", () => {
    const isCurrentlyDark = document.body.classList.contains("dark-mode");
    applyTheme(!isCurrentlyDark);
  });

  budgetSlider.addEventListener("input", (e) => {
    state.budget = Number(e.target.value);
    budgetDisplay.textContent = `£${state.budget.toLocaleString()}`;
    regenerateBuild();
  });

  workloadSelect.addEventListener("change", (e) => {
    state.workload = e.target.value;
    regenerateBuild();
  });

  formFactorSelect.addEventListener("change", (e) => {
    state.formFactor = e.target.value;
    regenerateBuild();
  });

  noRgbCheck.addEventListener("change", (e) => {
    state.noRgb = e.target.checked;
    regenerateBuild();
  });

  document.getElementById("btn-generate").addEventListener("click", () => {
    state.locked = {};
    regenerateBuild();
  });

  // Mode switching
  document.getElementById("btn-mode-recommender").addEventListener("click", () => switchMode("recommender"));
  document.getElementById("btn-mode-commission").addEventListener("click", () => switchMode("commission"));

  // Client Commission actions
  document.getElementById("btn-new-client").addEventListener("click", () => {
    state.clientIndex = (state.clientIndex + 1) % CLIENT_BRIEFS.length;
    state.locked = {};
    renderClientBrief();
    const client = CLIENT_BRIEFS[state.clientIndex];
    state.budget = client.budget;
    state.workload = client.workload;
    state.noRgb = client.noRgb;
    regenerateBuild();
  });

  document.getElementById("btn-auto-fill-client").addEventListener("click", () => {
    const client = CLIENT_BRIEFS[state.clientIndex];
    state.locked = {};
    state.budget = client.budget;
    state.workload = client.workload;
    state.noRgb = client.noRgb;
    state.formFactor = client.name === "Samira Patel" ? "mATX" : "any";
    regenerateBuild();
  });

  document.getElementById("btn-submit-client").addEventListener("click", evaluateClientCommission);

  // Copy spec list
  document.getElementById("btn-copy-spec").addEventListener("click", copySpecToClipboard);

  // 3D Viewer controls
  const camButtons = document.querySelectorAll(".viewer-pill[data-cam]");
  camButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!viewer3d) return;
      camButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      viewer3d.setCameraPreset(btn.dataset.cam);
      if (toggleSpinBtn) toggleSpinBtn.classList.remove("active");
    });
  });

  if (toggleGlassBtn) {
    toggleGlassBtn.addEventListener("click", () => {
      if (!viewer3d) return;
      const isOpen = viewer3d.toggleGlass();
      toggleGlassBtn.classList.toggle("active", isOpen);
      toggleGlassBtn.textContent = isOpen ? "Close Glass" : "Open Glass";
    });
  }

  if (toggleExplodeBtn) {
    toggleExplodeBtn.addEventListener("click", () => {
      if (!viewer3d) return;
      const isExploded = viewer3d.toggleExplode();
      toggleExplodeBtn.classList.toggle("active", isExploded);
      toggleExplodeBtn.textContent = isExploded ? "Assemble" : "Explode";
      if (isExploded && toggleGlassBtn) {
        toggleGlassBtn.classList.add("active");
        toggleGlassBtn.textContent = "Close Glass";
      }
      showToast(isExploded ? "Exploded view enabled" : "Components assembled");
    });
  }

  if (toggleSpinBtn) {
    toggleSpinBtn.addEventListener("click", () => {
      if (!viewer3d) return;
      const spinning = viewer3d.toggleAutoRotate();
      toggleSpinBtn.classList.toggle("active", spinning);
    });
  }

  // Modal close
  document.getElementById("btn-close-modal").addEventListener("click", closeSwapModal);
  document.getElementById("swap-modal").addEventListener("click", (e) => {
    if (e.target.id === "swap-modal") closeSwapModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeSwapModal();
  });
}

function switchMode(mode) {
  state.mode = mode;
  document.getElementById("btn-mode-recommender").classList.toggle("active", mode === "recommender");
  document.getElementById("btn-mode-commission").classList.toggle("active", mode === "commission");
  document.getElementById("panel-recommender").classList.toggle("hidden", mode !== "recommender");
  document.getElementById("panel-commission").classList.toggle("hidden", mode !== "commission");
  document.getElementById("commission-result").classList.add("hidden");

  if (mode === "commission") {
    const client = CLIENT_BRIEFS[state.clientIndex];
    state.budget = client.budget;
    state.workload = client.workload;
    state.noRgb = client.noRgb;
    renderAll();
  } else {
    state.budget = Number(budgetSlider.value);
    state.workload = workloadSelect.value;
    state.noRgb = noRgbCheck.checked;
    regenerateBuild();
  }
}

function regenerateBuild() {
  const lockedParts = {};
  for (const key of Object.keys(state.locked)) {
    if (state.locked[key]) {
      lockedParts[key] = state.build[key];
    }
  }

  state.build = BuildEngine.generateBuild({
    budget: state.budget,
    workload: state.workload,
    formFactor: state.formFactor,
    noRgb: state.noRgb,
    lockedParts
  });

  renderAll();
}

function renderAll() {
  const activeBudget = state.mode === "commission" ? CLIENT_BRIEFS[state.clientIndex].budget : state.budget;
  const stats = BuildEngine.evaluateBuild(state.build, activeBudget);

  // Telemetry with smooth counter animations & progress bars
  animateMetric("totalPrice", document.getElementById("stat-total-price"), stats.totalPrice, (v) => `£${v.toLocaleString()}`);

  const remEl = document.getElementById("stat-remaining");
  animateMetric("remaining", remEl, stats.remaining, (v) => (v >= 0 ? `£${v.toLocaleString()}` : `-£${Math.abs(v).toLocaleString()}`));
  remEl.style.color = stats.remaining >= 0 ? "inherit" : "#f87171";

  animateMetric(
    "wattage",
    document.getElementById("stat-wattage"),
    stats.estimatedLoad,
    (v) => `${v}W / ${state.build.psu.wattage}W`
  );
  animateMetric("gaming", document.getElementById("stat-gaming-score"), stats.gamingScore, (v) => `${v} / 100`);
  animateMetric("creator", document.getElementById("stat-creator-score"), stats.creatorScore, (v) => `${v} / 100`);

  const wattBar = document.getElementById("bar-wattage");
  if (wattBar) {
    const wattPct = Math.min(100, Math.round((stats.estimatedLoad / state.build.psu.wattage) * 100));
    wattBar.style.width = `${wattPct}%`;
    wattBar.classList.toggle("warn", state.build.psu.wattage < stats.recommendedPsu || wattPct > 80);
  }
  const gamingBar = document.getElementById("bar-gaming");
  if (gamingBar) gamingBar.style.width = `${stats.gamingScore}%`;
  const creatorBar = document.getElementById("bar-creator");
  if (creatorBar) creatorBar.style.width = `${stats.creatorScore}%`;

  const compatBanner = document.getElementById("compat-status");
  const nextCompatText = stats.issues.length === 0 ? "All Components Compatible & Within Budget" : stats.issues[0];
  compatBanner.className = stats.issues.length === 0 ? "compat-banner compat-ok" : "compat-banner compat-warn";
  compatBanner.textContent = nextCompatText;
  if (hasCompletedFirstRender && nextCompatText !== lastCompatText) {
    void compatBanner.offsetWidth;
    compatBanner.classList.add("pulse");
  }
  lastCompatText = nextCompatText;

  // Update 3D PC Model Preview
  if (viewer3d) {
    viewer3d.updateBuild(state.build, stats);
  }
  if (viewerCaseTagEl) {
    const sizeLabel = state.build.case.formFactors.includes("ATX") ? "ATX Mid-Tower" : "Compact mATX";
    viewerCaseTagEl.textContent = stats.hasRgb ? `${sizeLabel} · RGB` : `${sizeLabel} · Stealth`;
  }
  updateViewerHud(null);

  // Render Parts with staggered initial entrance & change highlight shimmer
  const nextPartIds = {};
  partsListEl.innerHTML = "";
  Object.keys(CATEGORY_LABELS).forEach((cat, idx) => {
    const part = state.build[cat];
    const isLocked = Boolean(state.locked[cat]);
    const didChange = hasCompletedFirstRender && prevRenderedPartIds[cat] && prevRenderedPartIds[cat] !== part.id;
    nextPartIds[cat] = part.id;

    const card = document.createElement("div");
    card.className = `part-card${!hasCompletedFirstRender ? " animate-enter" : ""}${didChange ? " just-updated" : ""}`;
    if (!hasCompletedFirstRender) {
      card.style.animationDelay = `${idx * 45}ms`;
    }
    card.dataset.cat = cat;
    card.innerHTML = `
      <div class="part-category">${CATEGORY_LABELS[cat]}</div>
      <div>
        <div class="part-title">${part.name}</div>
        <div class="part-specs">${part.specs}</div>
        <div class="part-reason">${BuildEngine.explainPart(cat, part, state.build)}</div>
      </div>
      <div class="part-actions">
        <div class="part-price">£${part.price}</div>
        <div class="action-row">
          <button class="chip-btn ${isLocked ? "locked" : ""}" data-action="lock" data-cat="${cat}" type="button">
            ${isLocked ? "Locked" : "Lock"}
          </button>
          <button class="chip-btn" data-action="swap" data-cat="${cat}" type="button">Swap</button>
        </div>
      </div>
    `;
    card.addEventListener("mouseenter", () => {
      if (viewer3d) viewer3d.highlightPart(cat);
      updateViewerHud(cat);
    });
    card.addEventListener("mouseleave", () => {
      if (viewer3d) viewer3d.clearHighlight();
      updateViewerHud(null);
    });
    partsListEl.appendChild(card);
  });

  partsListEl.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => {
      const cat = btn.dataset.cat;
      if (btn.dataset.action === "lock") {
        state.locked[cat] = !state.locked[cat];
        showToast(state.locked[cat] ? `Locked ${CATEGORY_LABELS[cat]}` : `Unlocked ${CATEGORY_LABELS[cat]}`);
        renderAll();
      } else if (btn.dataset.action === "swap") {
        openSwapModal(cat);
      }
    });
  });

  prevRenderedPartIds = nextPartIds;
  hasCompletedFirstRender = true;
}

function openSwapModal(category) {
  const modal = document.getElementById("swap-modal");
  const optionsEl = document.getElementById("modal-options");
  document.getElementById("modal-title").textContent = `Swap ${CATEGORY_LABELS[category]}`;
  document.getElementById("modal-subtitle").textContent = "Showing compatible components for your current build:";

  const compatibleOptions = PARTS_DB[category].filter((item) => {
    if (category === "motherboard") return item.socket === state.build.cpu.socket;
    if (category === "cpu") return item.socket === state.build.motherboard.socket;
    if (category === "ram") return item.ramType === state.build.motherboard.ramType;
    if (category === "case") {
      return (
        item.formFactors.includes(state.build.motherboard.formFactor) &&
        item.maxGpuLength >= state.build.gpu.length
      );
    }
    return true;
  });

  optionsEl.innerHTML = "";
  compatibleOptions.forEach((item) => {
    const row = document.createElement("div");
    row.className = "option-item";
    row.innerHTML = `
      <div>
        <strong>${item.name}</strong>
        <div class="part-specs">${item.specs} ${item.rgb ? "(RGB)" : ""}</div>
      </div>
      <strong>£${item.price}</strong>
    `;
    row.addEventListener("click", () => {
      state.build[category] = item;
      state.locked[category] = true;
      closeSwapModal();
      showToast(`Installed ${item.name}`);
      renderAll();
    });
    optionsEl.appendChild(row);
  });

  modal.classList.remove("hidden");
  requestAnimationFrame(() => modal.classList.add("is-open"));
}

function closeSwapModal() {
  const modal = document.getElementById("swap-modal");
  if (!modal || modal.classList.contains("hidden")) return;
  modal.classList.remove("is-open");
  setTimeout(() => {
    if (!modal.classList.contains("is-open")) {
      modal.classList.add("hidden");
    }
  }, 220);
}

function renderClientBrief() {
  const client = CLIENT_BRIEFS[state.clientIndex];
  document.getElementById("client-name").textContent = client.name;
  document.getElementById("client-tag").textContent = `${client.tag} • £${client.budget}`;
  document.getElementById("client-request").textContent = `"${client.quote}"`;

  const reqList = document.getElementById("client-requirements");
  reqList.innerHTML = "";
  client.rules.forEach((rule) => {
    const li = document.createElement("li");
    li.textContent = rule;
    reqList.appendChild(li);
  });

  document.getElementById("commission-result").classList.add("hidden");
}

function evaluateClientCommission() {
  const client = CLIENT_BRIEFS[state.clientIndex];
  const stats = BuildEngine.evaluateBuild(state.build, client.budget);
  const passed = client.check(state.build, stats);
  const resultBox = document.getElementById("commission-result");

  resultBox.classList.remove("hidden");
  if (passed) {
    resultBox.style.background = "var(--ok-bg)";
    resultBox.style.color = "var(--ok-text)";
    resultBox.innerHTML = `<strong>Commission Passed!</strong> ${client.name} loved the build (£${stats.totalPrice} / £${client.budget}).`;
  } else {
    resultBox.style.background = "var(--warn-bg)";
    resultBox.style.color = "var(--warn-text)";
    const reason = stats.issues.length > 0 ? stats.issues[0] : "One or more client performance/style requirements were missed.";
    resultBox.innerHTML = `<strong>Needs Adjustment:</strong> ${reason}`;
  }
}

function copySpecToClipboard() {
  const activeBudget = state.mode === "commission" ? CLIENT_BRIEFS[state.clientIndex].budget : state.budget;
  const stats = BuildEngine.evaluateBuild(state.build, activeBudget);
  const lines = [
    `PC Build Spec (£${stats.totalPrice} / £${activeBudget} Budget)`,
    ...Object.keys(CATEGORY_LABELS).map((cat) => `- ${CATEGORY_LABELS[cat]}: ${state.build[cat].name} (£${state.build[cat].price})`),
    `Estimated Power: ${stats.estimatedLoad}W (PSU: ${state.build.psu.wattage}W)`
  ];
  navigator.clipboard.writeText(lines.join("\n")).then(() => {
    const btn = document.getElementById("btn-copy-spec");
    btn.textContent = "Copied!";
    showToast("Spec list copied to clipboard");
    setTimeout(() => (btn.textContent = "Copy Spec List"), 1500);
  });
}

init();