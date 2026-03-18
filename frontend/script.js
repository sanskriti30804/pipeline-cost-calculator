// Frontend logic for Pipeline Cost Calculator
// - Calls backend API via fetch("/api/calculate-cost")
// - Renders KPIs + Chart.js charts
// - Provides instant reset (no reload, no API call)

const formEl = document.getElementById("cost-form");
const resetBtnEl = document.getElementById("reset-btn");
const errorEl = document.getElementById("form-error");
const loadingOverlay = document.getElementById("loadingOverlay");

const kpiDailyEl = document.getElementById("kpi-daily");
const kpiMonthlyEl = document.getElementById("kpi-monthly");
const kpiYearlyEl = document.getElementById("kpi-yearly");
const kpiPerRunEl = document.getElementById("kpi-per-run");

const computeMinutesPerDayEl = document.getElementById("computeMinutesPerDay");
const totalAgentMinutesPerDayEl = document.getElementById("totalAgentMinutesPerDay");
const computeDailyEl = document.getElementById("computeDaily");
const computeMonthlyEl = document.getElementById("computeMonthly");
const storageMonthlyValueEl = document.getElementById("storageMonthlyValue");

let breakdownChartInstance; // Pie chart (compute vs storage)
let projectionChartInstance; // Bar chart (daily/monthly/yearly)

function setLoading(isLoading) {
  loadingOverlay.style.display = isLoading ? "flex" : "none";
  loadingOverlay.setAttribute("aria-hidden", isLoading ? "false" : "true");
}

function showError(message) {
  errorEl.textContent = message;
  errorEl.style.display = "block";
}

function clearError() {
  errorEl.textContent = "";
  errorEl.style.display = "none";
}

// FIX 2 (mandatory): Indian Rupees formatting
function formatCurrency(amount) {
  return (
    "\u20B9" +
    Number(amount).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })
  );
}

function formatNumber(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return "--";
  return n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function ensureCharts() {
  const pieCanvas = document.getElementById("pieChart");
  const barCanvas = document.getElementById("barChart");

  if (!breakdownChartInstance) {
    breakdownChartInstance = new Chart(pieCanvas, {
      type: "pie",
      data: {
        labels: ["Compute", "Storage"],
        datasets: [
          {
            data: [0, 0],
            backgroundColor: ["rgba(59, 130, 246, 0.85)", "rgba(34, 197, 94, 0.85)"],
            borderColor: ["rgba(255,255,255,0.18)", "rgba(255,255,255,0.18)"],
            borderWidth: 1
          }
        ]
      },
      options: {
        plugins: {
          legend: {
            position: "bottom",
            labels: { color: "rgba(255,255,255,0.8)" }
          }
        }
      }
    });
  }

  if (!projectionChartInstance) {
    projectionChartInstance = new Chart(barCanvas, {
      type: "bar",
      data: {
        labels: ["Daily", "Monthly", "Yearly"],
        datasets: [
          {
            label: "Total cost",
            data: [0, 0, 0],
            backgroundColor: [
              "rgba(124, 58, 237, 0.75)",
              "rgba(59, 130, 246, 0.75)",
              "rgba(34, 197, 94, 0.75)"
            ],
            borderColor: "rgba(255,255,255,0.18)",
            borderWidth: 1,
            borderRadius: 10
          }
        ]
      },
      options: {
        responsive: true,
        scales: {
          x: { ticks: { color: "rgba(255,255,255,0.7)" }, grid: { color: "rgba(255,255,255,0.06)" } },
          y: { ticks: { color: "rgba(255,255,255,0.7)" }, grid: { color: "rgba(255,255,255,0.06)" } }
        },
        plugins: { legend: { display: false } }
      }
    });
  }
}

function collectInputs() {
  const fd = new FormData(formEl);
  return {
    runsPerDay: fd.get("runsPerDay"),
    executionTimeMinutes: fd.get("executionTimeMinutes"),
    agents: fd.get("agents"),
    costPerMinute: fd.get("costPerMinute"),
    storageMonthly: fd.get("storageMonthly")
  };
}

function renderEmptyState() {
  kpiDailyEl.textContent = "--";
  kpiMonthlyEl.textContent = "--";
  kpiYearlyEl.textContent = "--";
  kpiPerRunEl.textContent = "--";

  computeMinutesPerDayEl.textContent = "--";
  totalAgentMinutesPerDayEl.textContent = "--";
  computeDailyEl.textContent = "--";
  computeMonthlyEl.textContent = "--";
  storageMonthlyValueEl.textContent = "--";

  ensureCharts();
  breakdownChartInstance.data.datasets[0].data = [0, 0];
  breakdownChartInstance.update();

  projectionChartInstance.data.datasets[0].data = [0, 0, 0];
  projectionChartInstance.update();
}

function updateUI(apiData) {
  // Backend sends currency, but UI is standardized to ₹ per requirement
  const totals = apiData?.totals;
  const compute = apiData?.breakdown?.compute;
  const storage = apiData?.breakdown?.storage;

  kpiDailyEl.textContent = formatCurrency(totals.daily);
  kpiMonthlyEl.textContent = formatCurrency(totals.monthly);
  kpiYearlyEl.textContent = formatCurrency(totals.yearly);
  kpiPerRunEl.textContent = formatCurrency(totals.costPerRun);

  computeMinutesPerDayEl.textContent = formatNumber(compute.computeMinutesPerDay);
  totalAgentMinutesPerDayEl.textContent = formatNumber(compute.totalAgentMinutesPerDay);
  computeDailyEl.textContent = formatCurrency(compute.daily);
  computeMonthlyEl.textContent = formatCurrency(compute.monthly);
  storageMonthlyValueEl.textContent = formatCurrency(storage.monthly);

  ensureCharts();
  breakdownChartInstance.data.datasets[0].data = [Number(compute.monthly) || 0, Number(storage.monthly) || 0];
  breakdownChartInstance.update();

  projectionChartInstance.data.datasets[0].data = [
    Number(totals.daily) || 0,
    Number(totals.monthly) || 0,
    Number(totals.yearly) || 0
  ];
  projectionChartInstance.update();
}

async function calculate() {
  clearError();
  setLoading(true);
  try {
    const payload = collectInputs();
    const resp = await fetch("/api/calculate-cost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const contentType = resp.headers.get("content-type") || "";
    const isJson = contentType.includes("application/json");
    const body = isJson ? await resp.json() : null;

    if (!resp.ok) {
      showError(body?.error || `Request failed (${resp.status})`);
      return;
    }

    updateUI(body);
  } catch (e) {
    showError("Could not reach the server. Make sure the backend is running on http://localhost:5000.");
  } finally {
    setLoading(false);
  }
}

// FIX 1 (mandatory): Reset button clears inputs, results, charts, errors (no reload)
function handleReset() {
  // Reset form and clear all input values
  formEl.reset();
  for (const input of formEl.querySelectorAll("input")) {
    input.value = "";
  }

  // Clear result text
  renderEmptyState();

  // Clear any error messages
  clearError();
}

formEl.addEventListener("submit", (e) => {
  e.preventDefault();
  calculate();
});

document.getElementById("reset-btn").addEventListener("click", handleReset);

// Initial render
renderEmptyState();

