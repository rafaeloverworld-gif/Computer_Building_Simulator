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

function init() {
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

  // Modal close
  document.getElementById("btn-close-modal").addEventListener("click", closeSwapModal);
  document.getElementById("swap-modal").addEventListener("click", (e) => {
    if (e.target.id === "swap-modal") closeSwapModal();
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

  // Telemetry
  document.getElementById("stat-total-price").textContent = `£${stats.totalPrice.toLocaleString()}`;
  const remEl = document.getElementById("stat-remaining");
  remEl.textContent = stats.remaining >= 0 ? `£${stats.remaining.toLocaleString()}` : `-£${Math.abs(stats.remaining).toLocaleString()}`;
  remEl.style.color = stats.remaining >= 0 ? "inherit" : "#991b1b";

  document.getElementById("stat-wattage").textContent = `${stats.estimatedLoad}W / ${state.build.psu.wattage}W`;
  document.getElementById("stat-gaming-score").textContent = `${stats.gamingScore} / 100`;
  document.getElementById("stat-creator-score").textContent = `${stats.creatorScore} / 100`;

  const compatBanner = document.getElementById("compat-status");
  if (stats.issues.length === 0) {
    compatBanner.className = "compat-banner compat-ok";
    compatBanner.textContent = "All Components Compatible & Within Budget";
  } else {
    compatBanner.className = "compat-banner compat-warn";
    compatBanner.textContent = stats.issues[0];
  }

  // Render Parts
  partsListEl.innerHTML = "";
  Object.keys(CATEGORY_LABELS).forEach((cat) => {
    const part = state.build[cat];
    const isLocked = Boolean(state.locked[cat]);

    const card = document.createElement("div");
    card.className = "part-card";
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
    partsListEl.appendChild(card);
  });

  partsListEl.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => {
      const cat = btn.dataset.cat;
      if (btn.dataset.action === "lock") {
        state.locked[cat] = !state.locked[cat];
        renderAll();
      } else if (btn.dataset.action === "swap") {
        openSwapModal(cat);
      }
    });
  });
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
      renderAll();
    });
    optionsEl.appendChild(row);
  });

  modal.classList.remove("hidden");
}

function closeSwapModal() {
  document.getElementById("swap-modal").classList.add("hidden");
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
    resultBox.style.background = "#e7f6ed";
    resultBox.style.color = "#166534";
    resultBox.innerHTML = `<strong>Commission Passed!</strong> ${client.name} loved the build (£${stats.totalPrice} / £${client.budget}).`;
  } else {
    resultBox.style.background = "#fef2f2";
    resultBox.style.color = "#991b1b";
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
    setTimeout(() => (btn.textContent = "Copy Spec List"), 1500);
  });
}

init();
