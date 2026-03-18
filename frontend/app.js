const form = document.getElementById("costForm");
const resetBtn = document.getElementById("resetBtn");
const errorBox = document.getElementById("errorBox");
const loadingOverlay = document.getElementById("loadingOverlay");

const el = {
  dailyValue: document.getElementById("dailyValue"),
  monthlyValue: document.getElementById("monthlyValue"),
  yearlyValue: document.getElementById("yearlyValue"),
  costPerRunValue: document.getElementById("costPerRunValue"),
  computeMinutesPerDay: document.getElementById("computeMinutesPerDay"),
  totalAgentMinutesPerDay: document.getElementById("totalAgentMinutesPerDay"),
  computeDaily: document.getElementById("computeDaily"),
  computeMonthly: document.getElementById("computeMonthly"),
  storageMonthlyValue: document.getElementById("storageMonthlyValue")
};

function showError(message) {
  errorBox.textContent = message;
  errorBox.style.display = "block";
}

function clearError() {
  errorBox.textContent = "";
  errorBox.style.display = "none";
}

function setLoading(isLoading) {
  loadingOverlay.style.display = isLoading ? "flex" : "none";
  loadingOverlay.setAttribute("aria-hidden", isLoading ? "false" : "true");
}

function fmtMoney(currencySymbol, value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `${currencySymbol}${n.toFixed(2)}`;
}

function fmtNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

let pieChart;
let barChart;

function ensureCharts() {
  const pieCtx = document.getElementById("pieChart");
  const barCtx = document.getElementById("barChart");

  if (!pieChart) {
    pieChart = new Chart(pieCtx, {
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

  if (!barChart) {
    barChart = new Chart(barCtx, {
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
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.parsed.y.toFixed(2)}`
            }
          }
        }
      }
    });
  }
}

function updateUI(data) {
  const currency = data?.inputs?.currency ?? "$";

  el.dailyValue.textContent = fmtMoney(currency, data.totals.daily);
  el.monthlyValue.textContent = fmtMoney(currency, data.totals.monthly);
  el.yearlyValue.textContent = fmtMoney(currency, data.totals.yearly);
  el.costPerRunValue.textContent = fmtMoney(currency, data.totals.costPerRun);

  el.computeMinutesPerDay.textContent = fmtNumber(data.breakdown.compute.computeMinutesPerDay);
  el.totalAgentMinutesPerDay.textContent = fmtNumber(data.breakdown.compute.totalAgentMinutesPerDay);
  el.computeDaily.textContent = fmtMoney(currency, data.breakdown.compute.daily);
  el.computeMonthly.textContent = fmtMoney(currency, data.breakdown.compute.monthly);
  el.storageMonthlyValue.textContent = fmtMoney(currency, data.breakdown.storage.monthly);

  ensureCharts();

  const computeMonthly = Number(data.breakdown.compute.monthly) || 0;
  const storageMonthly = Number(data.breakdown.storage.monthly) || 0;

  pieChart.data.datasets[0].data = [computeMonthly, storageMonthly];
  pieChart.update();

  barChart.data.datasets[0].data = [Number(data.totals.daily) || 0, Number(data.totals.monthly) || 0, Number(data.totals.yearly) || 0];
  barChart.update();
}

function collectInputs() {
  const fd = new FormData(form);
  return {
    runsPerDay: fd.get("runsPerDay"),
    executionTimeMinutes: fd.get("executionTimeMinutes"),
    agents: fd.get("agents"),
    costPerMinute: fd.get("costPerMinute"),
    storageMonthly: fd.get("storageMonthly")
  };
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
      const msg = body?.error || `Request failed (${resp.status})`;
      showError(msg);
      return;
    }

    updateUI(body);
  } catch (e) {
    showError("Could not reach the server. Make sure the backend is running on http://localhost:5000.");
  } finally {
    setLoading(false);
  }
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  calculate();
});

resetBtn.addEventListener("click", () => {
  clearError();
  form.reset();
  calculate();
});

// First render with defaults
calculate();

