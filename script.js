/* Pipeline Cost Calculator
   - Frontend-only (open index.html directly)
   - Validates inputs, applies tool overhead, shows breakdown + simple bars
*/

const STORAGE_RATE_PER_GB = 2; // fixed rate (currency unit) per GB
const DAYS_PER_MONTH = 30; // flat estimate

const TOOL_CONFIG = {
  jenkins: { label: "Jenkins", overheadPct: 0.1 },
  github: { label: "GitHub Actions", overheadPct: 0.15 },
  gitlab: { label: "GitLab CI", overheadPct: 0.12 },
};

function $(id) {
  return document.getElementById(id);
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function formatMoney(amount, currencySymbol) {
  const safe = Number.isFinite(amount) ? amount : 0;

  const decimals = safe % 1 === 0 ? 0 : 2;
  const formatted = safe.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: 2,
  });
  return `${currencySymbol}${formatted}`;
}

function parsePositiveNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (n < 0) return null;
  return n;
}

function computeCosts({ buildsPerDay, durationMin, costPerMin, storageGb, toolKey }) {
  const tool = TOOL_CONFIG[toolKey] ?? TOOL_CONFIG.jenkins;

  const baseCompute = buildsPerDay * durationMin * costPerMin;
  const computeWithOverhead = baseCompute * (1 + tool.overheadPct);
  const storageCost = storageGb * STORAGE_RATE_PER_GB;
  const dailyTotal = computeWithOverhead + storageCost;
  const monthlyTotal = dailyTotal * DAYS_PER_MONTH;

  return {
    tool,
    baseCompute,
    computeWithOverhead,
    storageCost,
    dailyTotal,
    monthlyTotal,
  };
}

function setError(message) {
  const el = $("formError");
  if (!message) {
    el.hidden = true;
    el.textContent = "";
    return;
  }
  el.hidden = false;
  el.textContent = message;
}

function updateBars({ compute, storage, currency }) {
  const total = compute + storage;
  const computePct = total <= 0 ? 0 : (compute / total) * 100;
  const storagePct = total <= 0 ? 0 : (storage / total) * 100;

  $("barCompute").style.width = `${clamp(computePct, 0, 100).toFixed(1)}%`;
  $("barStorage").style.width = `${clamp(storagePct, 0, 100).toFixed(1)}%`;

  $("barComputeAmount").textContent = formatMoney(compute, currency);
  $("barStorageAmount").textContent = formatMoney(storage, currency);
}

function normalizeStageSplit({ buildPct, testPct, deployPct }) {
  const provided = [buildPct, testPct, deployPct].some((v) => v !== null);
  if (!provided) {
    return { build: 1 / 3, test: 1 / 3, deploy: 1 / 3 };
  }

  const b = buildPct ?? 0;
  const t = testPct ?? 0;
  const d = deployPct ?? 0;
  const sum = b + t + d;
  if (sum <= 0) {
    return { build: 1 / 3, test: 1 / 3, deploy: 1 / 3 };
  }
  return { build: b / sum, test: t / sum, deploy: d / sum };
}

function updateStageBars({ computeTotal, split, currency }) {
  const buildCost = computeTotal * split.build;
  const testCost = computeTotal * split.test;
  const deployCost = computeTotal * split.deploy;

  $("barBuild").style.width = `${clamp(split.build * 100, 0, 100).toFixed(1)}%`;
  $("barTest").style.width = `${clamp(split.test * 100, 0, 100).toFixed(1)}%`;
  $("barDeploy").style.width = `${clamp(split.deploy * 100, 0, 100).toFixed(1)}%`;

  $("barBuildAmount").textContent = formatMoney(buildCost, currency);
  $("barTestAmount").textContent = formatMoney(testCost, currency);
  $("barDeployAmount").textContent = formatMoney(deployCost, currency);

  const meta = `Build ${Math.round(split.build * 100)}% • Test ${Math.round(split.test * 100)}% • Deploy ${Math.round(
    split.deploy * 100,
  )}%`;
  $("stageMeta").textContent = `${meta} (compute only)`;
}

function setTheme(theme) {
  const root = document.documentElement;
  if (theme === "dark") {
    root.setAttribute("data-theme", "dark");
  } else {
    root.removeAttribute("data-theme");
  }
  localStorage.setItem("pcc_theme", theme);
}

function getInitialTheme() {
  const saved = localStorage.getItem("pcc_theme");
  if (saved === "light" || saved === "dark") return saved;
  const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)")?.matches;
  return prefersDark ? "dark" : "light";
}

function boot() {
  // Theme
  setTheme(getInitialTheme());
  $("themeToggle").addEventListener("click", () => {
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    setTheme(isDark ? "light" : "dark");
  });

  // Storage rate pill + note (updates with currency)
  const syncStorageRateText = () => {
    const currency = $("currency").value || "₹";
    const text = `${currency}${STORAGE_RATE_PER_GB}/GB`;
    $("storageRatePill").textContent = text;
    $("storageRateNote").textContent = text;
  };
  $("currency").addEventListener("change", syncStorageRateText);
  syncStorageRateText();

  // Form submit
  $("calcForm").addEventListener("submit", (e) => {
    e.preventDefault();
    setError("");

    const buildsPerDay = parsePositiveNumber($("buildsPerDay").value);
    const durationMin = parsePositiveNumber($("durationMin").value);
    const costPerMin = parsePositiveNumber($("costPerMin").value);
    const storageGb = parsePositiveNumber($("storageGb").value);
    const stageBuildPct = $("stageBuildPct").value.trim() === "" ? null : parsePositiveNumber($("stageBuildPct").value);
    const stageTestPct = $("stageTestPct").value.trim() === "" ? null : parsePositiveNumber($("stageTestPct").value);
    const stageDeployPct =
      $("stageDeployPct").value.trim() === "" ? null : parsePositiveNumber($("stageDeployPct").value);
    const toolKey = $("tool").value;
    const currency = $("currency").value || "₹";

    const missing = [];
    if (buildsPerDay === null) missing.push("Builds per day");
    if (durationMin === null) missing.push("Avg build duration");
    if (costPerMin === null) missing.push("Cost per minute");
    if (storageGb === null) missing.push("Storage usage");
    if (stageBuildPct === null && $("stageBuildPct").value.trim() !== "") missing.push("Build (%)");
    if (stageTestPct === null && $("stageTestPct").value.trim() !== "") missing.push("Test (%)");
    if (stageDeployPct === null && $("stageDeployPct").value.trim() !== "") missing.push("Deploy (%)");

    if (missing.length) {
      setError(`Please enter valid values for: ${missing.join(", ")}.`);
      return;
    }

    const stageSplit = normalizeStageSplit({
      buildPct: stageBuildPct,
      testPct: stageTestPct,
      deployPct: stageDeployPct,
    });

    const costs = computeCosts({
      buildsPerDay,
      durationMin,
      costPerMin,
      storageGb,
      toolKey,
    });

    $("dailyCost").textContent = formatMoney(costs.dailyTotal, currency);
    $("monthlyCost").textContent = formatMoney(costs.monthlyTotal, currency);
    $("computeCost").textContent = formatMoney(costs.computeWithOverhead, currency);
    $("storageCost").textContent = formatMoney(costs.storageCost, currency);
    $("overheadPct").textContent = `${Math.round(costs.tool.overheadPct * 100)}% (${costs.tool.label})`;

    $("vizMeta").textContent = `${costs.tool.label} • ${Math.round(costs.tool.overheadPct * 100)}% overhead`;
    updateBars({ compute: costs.computeWithOverhead, storage: costs.storageCost, currency });
    updateStageBars({ computeTotal: costs.computeWithOverhead, split: stageSplit, currency });
  });

  // Reset
  $("resetBtn").addEventListener("click", () => {
    $("calcForm").reset();
    setError("");

    $("dailyCost").textContent = "—";
    $("monthlyCost").textContent = "—";
    $("computeCost").textContent = "—";
    $("storageCost").textContent = "—";
    $("overheadPct").textContent = "—";
    $("vizMeta").textContent = "Compute vs storage";
    $("stageMeta").textContent = "Build vs test vs deploy (compute only)";
    updateBars({ compute: 0, storage: 0, currency: $("currency").value || "₹" });
    updateStageBars({
      computeTotal: 0,
      split: { build: 1 / 3, test: 1 / 3, deploy: 1 / 3 },
      currency: $("currency").value || "₹",
    });
    syncStorageRateText();
  });

  // initialize charts in empty state
  updateStageBars({
    computeTotal: 0,
    split: { build: 1 / 3, test: 1 / 3, deploy: 1 / 3 },
    currency: $("currency").value || "₹",
  });
}

document.addEventListener("DOMContentLoaded", boot);

