const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json({ limit: "64kb" }));

// Serve frontend statically (MANDATORY)
app.use(express.static(path.join(__dirname, "../frontend")));

function asNumber(value) {
  if (value === null || value === undefined) return NaN;
  const n = typeof value === "number" ? value : Number(String(value).trim());
  return Number.isFinite(n) ? n : NaN;
}

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function badRequest(res, message) {
  return res.status(400).json({ error: message });
}

// Root route (MANDATORY)
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

// API route (MANDATORY)
app.post("/api/calculate-cost", (req, res) => {
  try {
    const runsPerDay = asNumber(req.body?.runsPerDay);
    const executionTimeMinutes = asNumber(req.body?.executionTimeMinutes);
    const agents = asNumber(req.body?.agents);
    const costPerMinute = asNumber(req.body?.costPerMinute);
    const storageMonthly = asNumber(req.body?.storageMonthly);

    if (!Number.isFinite(runsPerDay) || runsPerDay <= 0) {
      return badRequest(res, "Runs/day must be a number greater than 0.");
    }
    if (!Number.isFinite(executionTimeMinutes) || executionTimeMinutes <= 0) {
      return badRequest(res, "Execution time must be a number greater than 0.");
    }
    if (!Number.isFinite(agents) || agents <= 0) {
      return badRequest(res, "Agents must be a number greater than 0.");
    }
    if (!Number.isFinite(costPerMinute) || costPerMinute <= 0) {
      return badRequest(res, "Cost/min must be a number greater than 0.");
    }
    if (!Number.isFinite(storageMonthly) || storageMonthly < 0) {
      return badRequest(res, "Storage (monthly) must be a number 0 or greater.");
    }

    // Compute
    const computeMinutesPerDay = runsPerDay * executionTimeMinutes;
    const totalAgentMinutesPerDay = computeMinutesPerDay * agents;
    const computeDaily = totalAgentMinutesPerDay * costPerMinute;
    const computeMonthly = computeDaily * 30;

    // Totals
    const totalDaily = computeDaily;
    const totalMonthly = computeMonthly + storageMonthly;
    const totalYearly = totalMonthly * 12;
    const costPerRun = computeDaily / runsPerDay;

    // Response (MANDATORY structure)
    res.json({
      totals: {
        daily: round2(totalDaily),
        monthly: round2(totalMonthly),
        yearly: round2(totalYearly),
        costPerRun: round2(costPerRun)
      },
      breakdown: {
        compute: {
          daily: round2(computeDaily),
          monthly: round2(computeMonthly),
          computeMinutesPerDay: round2(computeMinutesPerDay),
          totalAgentMinutesPerDay: round2(totalAgentMinutesPerDay)
        },
        storage: {
          monthly: round2(storageMonthly)
        }
      },
      inputs: {
        currency: "\u20B9"
      }
    });
  } catch (err) {
    return res.status(500).json({ error: "Unexpected server error." });
  }
});

const PORT = Number(process.env.PORT) || 5000;
app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server running on http://localhost:${PORT}`);
});

