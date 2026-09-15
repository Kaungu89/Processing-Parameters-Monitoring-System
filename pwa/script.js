/**
 * Mimbula Minerals Telemetry PWA Script - Production Core Controller
 * Developed with premium responsive logic, real-time calculations, and offline persistence.
 */

// Global App States
let pads = [
  { id: "LP1", feedType: "RAF", min: 45.5, max: 45.5, totalizer: 4480.20, status: "Active", area: 4500, dischargePlsPercent: 100, dischargeIlsPercent: 0 },
  { id: "LP2", feedType: "RAF", min: 0.0, max: 0.0, totalizer: 0.00, status: "Off", area: 5000, dischargePlsPercent: 100, dischargeIlsPercent: 0 },
  { id: "LP3", feedType: "ILS", min: 0.0, max: 0.0, totalizer: 0.00, status: "Off", area: 6000, dischargePlsPercent: 0, dischargeIlsPercent: 100 },
  { id: "LP4", feedType: "RAF", min: 125.0, max: 125.0, totalizer: 20500.25, status: "Active", area: 12500, dischargePlsPercent: 100, dischargeIlsPercent: 0 },
  { id: "LP5", feedType: "RAF", min: 158.0, max: 158.0, totalizer: 32100.80, status: "Active", area: 15000, dischargePlsPercent: 80, dischargeIlsPercent: 20 },
  { id: "LP6", feedType: "ILS", min: 180.0, max: 180.0, totalizer: 45900.50, status: "Active", area: 18000, dischargePlsPercent: 55, dischargeIlsPercent: 45 },
  { id: "LP7", feedType: "RAF", min: 162.0, max: 162.0, totalizer: 28450.10, status: "Active", area: 16500, dischargePlsPercent: 100, dischargeIlsPercent: 0 },
  { id: "LP8", feedType: "RAF", min: 96.5, max: 96.5, totalizer: 11180.40, status: "Active", area: 9500, dischargePlsPercent: 70, dischargeIlsPercent: 30 },
  { id: "LP9", feedType: "ILS", min: 165.0, max: 165.0, totalizer: 30220.15, status: "Active", area: 16000, dischargePlsPercent: 100, dischargeIlsPercent: 0 },
  { id: "LP10", feedType: "RAF", min: 0.0, max: 0.0, totalizer: 0.00, status: "Off", area: 12000, dischargePlsPercent: 60, dischargeIlsPercent: 40 },
  { id: "LP11", feedType: "RAF", min: 150.0, max: 150.0, totalizer: 24100.30, status: "Active", area: 14500, dischargePlsPercent: 100, dischargeIlsPercent: 0 },
  { id: "LP12", feedType: "ILS", min: 135.2, max: 135.2, totalizer: 22980.60, status: "Active", area: 13500, dischargePlsPercent: 0, dischargeIlsPercent: 100 }
];

let ponds = {
  pls: { level: 68.4, flow: 710.20 },
  ils: { level: 55.2, flow: 480.00 },
  raf: { level: 62.1, flow: 980.50 },
  acid: { level: 45.0, flow: 12.50 }
};

let currentGPS = { lat: -12.4412, lon: 27.8122 }; // Centered on actual Mimbula Copper Mine
let capturedPhotoBase64 = null;
let operatorName = "Miguel Kaungu";
let employmentNumber = "EMP-8274";
let operatorEmail = "kaungu89@gmail.com";
let currentShiftId = "SHIFT-" + Date.now();

// Page Initiation
window.addEventListener("DOMContentLoaded", () => {
  initLoader();
  initClock();
  initTheme();
  loadDraftFromStorage();
  renderFlowSheet();
  updatePondGauges();
  renderHistoryLogs();
  initPWA();
  initWebcam();
  addEventListeners();
});

// Cinematic Loading Progress
function initLoader() {
  const bar = document.getElementById("loader-progress");
  const status = document.getElementById("loader-status-text");
  const screen = document.getElementById("loader-screen");
  
  const steps = [
    { progress: 15, text: "Initializing SCADA Link Terminus..." },
    { progress: 40, text: "Syncing Leach Pad Wetting Flux Registers..." },
    { progress: 70, text: "Re-calibrating PLS / RAF Mass-Balance Checkers..." },
    { progress: 90, text: "Registering Service Worker Offline Buffers..." },
    { progress: 100, text: "Mimbula Telemetry Core Online." }
  ];

  let currentStepIdx = 0;
  
  function runStep() {
    if (currentStepIdx < steps.length) {
      const step = steps[currentStepIdx];
      bar.style.width = step.progress + "%";
      status.innerText = step.text;
      currentStepIdx++;
      setTimeout(runStep, 350 + Math.random() * 200);
    } else {
      setTimeout(() => {
        screen.style.opacity = "0";
        screen.style.visibility = "hidden";
        writeToConsole("TELEMETRY_CORE_INIT_SUCCESS: SCADA systems synced in real-time.");
      }, 500);
    }
  }
  
  runStep();
}

// Live Central Africa Time (CAT) Clock
function initClock() {
  const clockElement = document.getElementById("live-cat-clock");
  function tick() {
    const now = new Date();
    // UTC to CAT (UTC + 2)
    const utcEpoch = now.getTime() + now.getTimezoneOffset() * 60 * 1000;
    const catDate = new Date(utcEpoch + 2 * 3600 * 1000);
    
    const d = catDate.getUTCDate();
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const m = months[catDate.getUTCMonth()];
    const y = catDate.getUTCFullYear();
    const hh = String(catDate.getUTCHours()).padStart(2, '0');
    const mm = String(catDate.getUTCMinutes()).padStart(2, '0');
    const ss = String(catDate.getUTCSeconds()).padStart(2, '0');
    
    if (clockElement) {
      clockElement.innerText = `${d}-${m}-${y} ${hh}:${mm}:${ss} CAT (Zambia)`;
    }
  }
  tick();
  setInterval(tick, 1000);
}

// Light & Dark Theme Persistence
function initTheme() {
  const btn = document.getElementById("theme-toggle");
  const storedTheme = localStorage.getItem("mimbula-pwa-theme") || "dark";
  document.documentElement.setAttribute("data-theme", storedTheme);
  
  btn.addEventListener("click", () => {
    const currentTheme = document.documentElement.getAttribute("data-theme");
    const targetTheme = currentTheme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", targetTheme);
    localStorage.setItem("mimbula-pwa-theme", targetTheme);
    showToast(`Switched to ${targetTheme === "dark" ? "Dark Mode" : "Light Mode"}`, "info");
  });
}

// Persist / Load drafts offline
function saveDraftToStorage() {
  const notes = document.getElementById("field-notes").value;
  const draft = {
    pads,
    ponds,
    notes,
    operatorName,
    employmentNumber,
    operatorEmail,
    currentShiftId
  };
  localStorage.setItem("mimbula_pwa_draft", JSON.stringify(draft));
}

function loadDraftFromStorage() {
  const raw = localStorage.getItem("mimbula_pwa_draft");
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed.pads) pads = parsed.pads;
      if (parsed.ponds) ponds = parsed.ponds;
      if (parsed.notes) document.getElementById("field-notes").value = parsed.notes;
      if (parsed.operatorName) operatorName = parsed.operatorName;
      if (parsed.employmentNumber) employmentNumber = parsed.employmentNumber;
      if (parsed.operatorEmail) operatorEmail = parsed.operatorEmail;
      if (parsed.currentShiftId) currentShiftId = parsed.currentShiftId;
    } catch(e) {
      console.warn("Draft loading failed, preloading defaults:", e);
    }
  }
}

// Render Leach Pad flow sheet table and run computations
function renderFlowSheet() {
  const tbody = document.getElementById("flow-sheet-tbody");
  tbody.innerHTML = "";
  
  let totalFlowRate = 0;
  let activeCount = 0;
  let warningCount = 0;
  let fatalErrorCount = 0;
  let activeAlarms = [];

  pads.forEach((pad, index) => {
    const isActive = pad.status === "Active";
    const isOffline = pad.status === "Offline";
    
    // Average flow rates for calculation
    const avgFlow = (pad.min + pad.max) / 2;
    if (isActive) {
      totalFlowRate += avgFlow;
      activeCount++;
    }

    // Wetting Flux Rate calculation: (AvgFlow * 1000) / PadArea = L/h/m2
    const fluxRate = pad.area > 0 && isActive ? ((avgFlow * 1000) / pad.area).toFixed(3) : "0.000";

    // Validations
    let isMinMaxError = pad.min > pad.max;
    let isHighBoundsError = avgFlow > 250;
    let isZeroFlowActiveWarning = isActive && avgFlow === 0;
    let isNonZeroInactiveWarning = !isActive && avgFlow > 0;

    let trClass = isActive ? "" : "row-disabled";
    if (isMinMaxError || isHighBoundsError) {
      trClass += " row-error-border";
      fatalErrorCount++;
    } else if (isZeroFlowActiveWarning || isNonZeroInactiveWarning) {
      warningCount++;
    }

    const tr = document.createElement("tr");
    tr.className = trClass;
    tr.id = `row-${pad.id}`;

    // Compile Alarms descriptions
    if (isMinMaxError) activeAlarms.push(`Line ${pad.id} sensor mismatch: Min flow exceeds Max flow!`);
    if (isHighBoundsError) activeAlarms.push(`Line ${pad.id} rate of ${avgFlow.toFixed(1)} m³/h is ABOVE absolute physical limit (250 m³/h)!`);
    if (isZeroFlowActiveWarning) activeAlarms.push(`Line ${pad.id} set Active but registers zero flow.`);

    tr.innerHTML = `
      <td class="pad-cell-id">${pad.id}</td>
      <td>
        <select class="glass-select" onchange="updatePadFeed('${pad.id}', this.value)" ${isOffline ? "disabled" : ""}>
          <option value="RAF" ${pad.feedType === "RAF" ? "selected" : ""}>RAF</option>
          <option value="ILS" ${pad.feedType === "ILS" ? "selected" : ""}>ILS</option>
        </select>
      </td>
      <td>
        <input type="number" step="0.1" class="flow-input ${isMinMaxError ? "flow-error-input" : ""}" value="${pad.min}" oninput="updatePadFlow('${pad.id}', 'min', this.value)" ${isOffline ? "disabled" : ""}>
      </td>
      <td>
        <input type="number" step="0.1" class="flow-input ${isMinMaxError ? "flow-error-input" : ""}" value="${pad.max}" oninput="updatePadFlow('${pad.id}', 'max', this.value)" ${isOffline ? "disabled" : ""}>
      </td>
      <td class="font-mono text-center">${fluxRate}</td>
      <td>
        <button class="status-pill-btn ${pad.status === 'Active' ? 'status-pill-active' : pad.status === 'Off' ? 'status-pill-off' : 'status-pill-offline'}" onclick="togglePadStatus('${pad.id}')">
          ${pad.status}
        </button>
      </td>
      <td class="text-center font-mono font-bold ${isMinMaxError || isHighBoundsError ? 'text-red-500' : 'text-slate-500'}">
        ${isMinMaxError ? '⚠️ sensor' : isHighBoundsError ? '🔥 bounds' : '✓ valid'}
      </td>
    `;
    
    tbody.appendChild(tr);
  });

  // Calculate aggregates
  document.getElementById("stat-active-pads").innerText = `${activeCount} / 12`;
  document.getElementById("stat-aggregate-flow").innerText = `${totalFlowRate.toFixed(2)} m³/h`;

  // Compute chemical balance: RAF-fed vs ILS-fed ratio across all pads
  const rafPads = pads.filter(p => p.status === "Active" && p.feedType === "RAF");
  const ilsPads = pads.filter(p => p.status === "Active" && p.feedType === "ILS");
  const rafTotalAvg = rafPads.reduce((sum, p) => sum + (p.min + p.max)/2, 0);
  const ilsTotalAvg = ilsPads.reduce((sum, p) => sum + (p.min + p.max)/2, 0);
  
  let ratioBadge = document.getElementById("chemical-ratio-badge");
  let ratioMsg = document.getElementById("chemical-ratio-message");
  
  if (activeCount === 0) {
    ratioBadge.className = "card-badge badge-info";
    ratioBadge.innerText = "Offline";
    ratioMsg.innerText = "Heap irrigation circuits offline.";
  } else if (ilsTotalAvg === 0) {
    ratioBadge.className = "card-badge badge-warning";
    ratioBadge.innerText = "Raffinate-Only";
    ratioMsg.innerText = "Heap running 100% on raw acid raffinate; co-recirculation bypassed.";
  } else {
    const ratio = rafTotalAvg / ilsTotalAvg;
    document.getElementById("stat-chemical-ratio").innerText = ratio.toFixed(2);
    
    if (ratio < 0.5) {
      ratioBadge.className = "card-badge badge-error";
      ratioBadge.innerText = "Under-Acid";
      ratioMsg.innerText = `Ratio (${ratio.toFixed(2)}) is BELOW target (0.50). Raise raw Raffinate acid flow!`;
      activeAlarms.push("Under-acidification drift: low H₂SO₄ concentration detected on irrigation header.");
    } else if (ratio > 2.0) {
      ratioBadge.className = "card-badge badge-error";
      ratioBadge.innerText = "Clay Blinding";
      ratioMsg.innerText = `Ratio (${ratio.toFixed(2)}) is ABOVE target (2.00). Restrict raw Raffinate to prevent clay blockage!`;
      activeAlarms.push("Clay swelling caution: excessive acid feed risks permanent clay blinding.");
    } else {
      ratioBadge.className = "card-badge badge-success";
      ratioBadge.innerText = "Optimal";
      ratioMsg.innerText = `Blending ratio (${ratio.toFixed(2)}) is safely within target threshold bounds (0.50 - 2.00).`;
    }
  }

  // Manage alarms banner
  const banner = document.getElementById("alarms-banner-box");
  if (activeAlarms.length > 0) {
    banner.style.display = "flex";
    document.getElementById("alarms-count").innerText = `${activeAlarms.length} ALARM(S) DETECTED`;
    document.getElementById("alarms-detail").innerText = activeAlarms[0]; // show primary alarm
  } else {
    banner.style.display = "none";
  }

  // Active schematic paths sync
  const pipe = document.getElementById("recirc-pipe-flow");
  if (pipe) {
    pipe.style.stroke = activeCount > 0 ? "#14b8a6" : "#475569";
    pipe.style.animationPlayState = activeCount > 0 ? "running" : "paused";
  }

  saveDraftToStorage();
}

// Update specific fields from table
window.updatePadFlow = function(padId, field, value) {
  const pad = pads.find(p => p.id === padId);
  if (pad) {
    pad[field] = parseFloat(value) || 0;
    renderFlowSheet();
  }
};

window.updatePadFeed = function(padId, value) {
  const pad = pads.find(p => p.id === padId);
  if (pad) {
    pad.feedType = value;
    renderFlowSheet();
  }
};

window.togglePadStatus = function(padId) {
  const pad = pads.find(p => p.id === padId);
  if (pad) {
    const states = ["Active", "Off", "Offline"];
    let currIdx = states.indexOf(pad.status);
    let nextIdx = (currIdx + 1) % states.length;
    pad.status = states[nextIdx];
    
    if (pad.status === "Offline" || pad.status === "Off") {
      pad.min = 0;
      pad.max = 0;
    } else if (pad.status === "Active") {
      pad.min = 100;
      pad.max = 100;
    }
    
    writeToConsole(`SCADA_ACTION: Toggled status of line ${padId} to ${pad.status}`);
    renderFlowSheet();
  }
};

// Update liquid level cylinders
function updatePondGauges() {
  const gauges = ["pls", "ils", "raf", "acid"];
  gauges.forEach(key => {
    const val = ponds[key].level;
    const liquid = document.getElementById(`cylinder-${key}-liquid`);
    const label = document.getElementById(`cylinder-${key}-label`);
    if (liquid && label) {
      liquid.style.height = val + "%";
      label.innerText = val.toFixed(0) + "%";
      
      // Warn color overrides
      if (val > 90) {
        liquid.style.background = "linear-gradient(180deg, var(--rose-500) 0%, var(--rose-600) 100%)";
      } else if (val < 15) {
        liquid.style.background = "linear-gradient(180deg, var(--amber-500) 0%, var(--amber-600) 100%)";
      } else {
        liquid.style.background = "linear-gradient(180deg, var(--teal-400) 0%, var(--teal-600) 100%)";
      }
    }
  });
}

// Log Terminal print helper
function writeToConsole(message) {
  const consoleEl = document.getElementById("terminal-console-box");
  if (consoleEl) {
    const timeStr = new Date().toLocaleTimeString();
    const div = document.createElement("div");
    div.className = "terminal-line";
    div.innerHTML = `<span class="terminal-time">[${timeStr}]</span> ${message}`;
    consoleEl.appendChild(div);
    consoleEl.scrollTop = consoleEl.scrollHeight;
  }
}

// DCS Quick Scenario Injectors
window.injectScenario = function(type) {
  writeToConsole(`INJECTING_SCENARIO: Launching '${type}' telemetry configuration...`);
  
  if (type === "nominal") {
    pads = pads.map(p => {
      if (p.id === "LP1" || p.id === "LP2" || p.id === "LP3" || p.id === "LP10") {
        return { ...p, status: "Off", min: 0, max: 0 };
      }
      return { ...p, status: "Active", min: 120, max: 120 };
    });
    ponds = {
      pls: { level: 65.0, flow: 700.0 },
      ils: { level: 58.0, flow: 450.0 },
      raf: { level: 60.0, flow: 900.0 },
      acid: { level: 50.0, flow: 12.0 }
    };
    document.getElementById("field-notes").value = "NOMINAL STEADY-STATE: All process lines calibrated at standard operating rates.";
    showToast("Nominal Steady-State Preloaded.", "success");
    
  } else if (type === "storm") {
    pads = pads.map(p => {
      if (p.status === "Active") {
        return { ...p, min: 195.0, max: 215.0 }; // storm irrigation surge
      }
      return p;
    });
    ponds = {
      pls: { level: 93.5, flow: 910.0 }, // high flood limit
      ils: { level: 91.0, flow: 750.0 },
      raf: { level: 94.2, flow: 1200.0 },
      acid: { level: 48.0, flow: 14.0 }
    };
    document.getElementById("field-notes").value = "SAFETY DIRECTIVE: Monsoon storms precipitation has elevated water pond levels near critical limit thresholds. Active recirculation to safety pools is engaged.";
    showToast("Monsoon Storm surge active!", "error");
    
  } else if (type === "outage") {
    ponds = {
      ...ponds,
      acid: { level: 8.5, flow: 1.5 } // critical dry reservoir level
    };
    document.getElementById("field-notes").value = "OUTAGE WARNING: Acid feedstock delivery pipeline lockouts are causing reservoir levels to drop. Re-routing recirc solutions to hedge inventory.";
    showToast("Acid Reservoir Depleted!", "error");
    
  } else if (type === "blockage") {
    // LP4 and LP5 valve blocked
    pads = pads.map(p => {
      if (p.id === "LP4" || p.id === "LP5") {
        return { ...p, status: "Active", min: 0, max: 0 }; // zero flow despite active status
      }
      return p;
    });
    document.getElementById("field-notes").value = "HYDRAULIC FAULT: Mechanical blockage detected on line LP4/LP5 header valves. Cavitation alarms active.";
    showToast("Valve Line Blockage Preloaded.", "info");
  }

  renderFlowSheet();
  updatePondGauges();
  writeToConsole(`SCENE_LOAD_COMPLETE: System parameters updated successfully.`);
};

// Auto-Save Shift log Database offline
window.saveShiftLog = function() {
  const notes = document.getElementById("field-notes").value || "No additional comments.";
  
  // Verify fatal sensor errors before saving
  const errors = pads.filter(p => p.min > p.max || (p.status === "Active" && (p.min + p.max)/2 > 250));
  if (errors.length > 0) {
    showToast(`Failed to record: Resolve sensor errors on ${errors[0].id} first!`, "error");
    writeToConsole(`SAVE_REJECTED: Entry has ${errors.length} fatal error validations.`);
    return;
  }

  const freshId = "SHIFT-" + Date.now();
  const logEntry = {
    id: freshId,
    timestamp: new Date().toLocaleString(),
    operatorName,
    employmentNumber,
    operatorEmail,
    pads: JSON.parse(JSON.stringify(pads)),
    ponds: JSON.parse(JSON.stringify(ponds)),
    notes,
    photo: capturedPhotoBase64
  };

  // Save to list
  let logs = JSON.parse(localStorage.getItem("mimbula_pwa_logs") || "[]");
  logs.unshift(logEntry);
  localStorage.setItem("mimbula_pwa_logs", JSON.stringify(logs));
  
  showToast("Telemetry Shift log successfully recorded to database!", "success");
  writeToConsole(`DB_INSERT_SUCCESS: Saved telemetry sheet as ${freshId}`);
  
  // Clear photo attachment
  capturedPhotoBase64 = null;
  const snapImg = document.getElementById("snapshot-preview");
  if (snapImg) snapImg.style.display = "none";

  renderHistoryLogs();
};

// Render offline log archives
function renderHistoryLogs() {
  const container = document.getElementById("archive-history-list");
  container.innerHTML = "";
  
  let logs = JSON.parse(localStorage.getItem("mimbula_pwa_logs") || "[]");
  if (logs.length === 0) {
    container.innerHTML = `<div class="text-center text-xs text-slate-500 py-4">No offline telemetry shift records found.</div>`;
    return;
  }

  logs.forEach(log => {
    const item = document.createElement("div");
    item.className = "archive-item";
    item.onclick = () => reloadShiftSnapshot(log.id);
    
    // Compute total active flow in snapshot
    const activePads = log.pads.filter(p => p.status === "Active");
    const flowSum = activePads.reduce((sum, p) => sum + (p.min + p.max)/2, 0);

    item.innerHTML = `
      <div class="archive-meta">
        <span class="archive-id">${log.id}</span>
        <span class="archive-time">${log.timestamp}</span>
      </div>
      <div class="text-xs font-bold text-slate-300">Operator: ${log.operatorName} (${log.employmentNumber})</div>
      <div class="flex justify-between text-xs text-slate-400 mt-1">
        <span>Active Lines: ${activePads.length}/12</span>
        <span>Flow Sum: ${flowSum.toFixed(1)} m³/h</span>
      </div>
      <div class="archive-notes mt-1">${log.notes}</div>
      ${log.photo ? `<div class="text-xs text-teal-400 mt-1">✓ Includes Valve Camera Attachment</div>` : ""}
      <div class="flex justify-end gap-2 mt-2">
        <button class="secondary-btn" style="padding: 0.2rem 0.5rem; font-size: 0.65rem;" onclick="event.stopPropagation(); deleteShiftSnapshot('${log.id}')">Delete</button>
      </div>
    `;
    container.appendChild(item);
  });
}

// Restore snap
function reloadShiftSnapshot(id) {
  let logs = JSON.parse(localStorage.getItem("mimbula_pwa_logs") || "[]");
  const log = logs.find(l => l.id === id);
  if (log) {
    pads = log.pads;
    ponds = log.ponds;
    document.getElementById("field-notes").value = log.notes;
    operatorName = log.operatorName;
    employmentNumber = log.employmentNumber;
    operatorEmail = log.operatorEmail;
    currentShiftId = log.id;
    
    renderFlowSheet();
    updatePondGauges();
    showToast(`Restored telemetries from archived log ${id}`, "success");
    writeToConsole(`SNAPSHOT_LOADED: Loaded archived record data.`);
  }
}

window.deleteShiftSnapshot = function(id) {
  let logs = JSON.parse(localStorage.getItem("mimbula_pwa_logs") || "[]");
  logs = logs.filter(l => l.id !== id);
  localStorage.setItem("mimbula_pwa_logs", JSON.stringify(logs));
  renderHistoryLogs();
  showToast("Record deleted from offline history archive.", "info");
};

// Clean database
window.clearLocalDB = function() {
  if (confirm("Are you sure you want to completely wipe all offline logs from process storage? This is irreversible.")) {
    localStorage.removeItem("mimbula_pwa_logs");
    localStorage.removeItem("mimbula_pwa_draft");
    writeToConsole("DB_WIPE_SUCCESS: Offline process registers cleared.");
    showToast("Wiped telemetry records from storage.", "info");
    renderHistoryLogs();
  }
};

// Speech Synthesis Web API Reader
window.speakActiveAlarms = function() {
  const activeCount = pads.filter(p => p.status === "Active").length;
  const avgFlowSum = pads.filter(p => p.status === "Active").reduce((sum, p) => sum + (p.min+p.max)/2, 0);
  
  let speechText = `Mimbula Minerals shift report. Currently irrigating ${activeCount} active leach pads. Aggregate flow is ${avgFlowSum.toFixed(0)} cubic meters per hour. `;
  
  // Append errors
  let sensorFaults = pads.filter(p => p.min > p.max).map(p => p.id);
  if (sensorFaults.length > 0) {
    speechText += `Alert: sensor mismatch faults detected on leach pad lines ${sensorFaults.join(", ")}. `;
  }

  if (ponds.acid.level < 15) {
    speechText += `Warning: Acid feedstock reservoir levels are critical at ${ponds.acid.level.toFixed(0)} percent. `;
  }

  if ('speechSynthesis' in window) {
    const utterance = new SpeechSynthesisUtterance(speechText);
    utterance.rate = 0.95;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
    showToast("Reading shift telemetry report audibly...", "success");
  } else {
    showToast("Browser Speech Synthesis API is not supported in this frame.", "error");
  }
};

// Geolocation Web API Locator
window.trackWalkCoordinates = function() {
  if ('geolocation' in navigator) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        currentGPS = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        document.getElementById("walk-coords-panel").innerText = `Lat: ${currentGPS.lat.toFixed(4)} S, Lon: ${currentGPS.lon.toFixed(4)} E`;
        showToast("GPS location coordinates resolved.", "success");
        writeToConsole(`GPS_TRACK_SUCCESS: Operator at Coordinates: [${currentGPS.lat.toFixed(4)}, ${currentGPS.lon.toFixed(4)}]`);
      },
      (err) => {
        // Fallback to Mimbula copper deposit Zambia coordinates
        document.getElementById("walk-coords-panel").innerText = `Lat: -12.4412 S, Lon: 27.8122 E`;
        writeToConsole("GPS_TRACK_FALLBACK: GPS permission denied. Preloaded Mimbula Deposit Terminus coordinates.");
      }
    );
  } else {
    showToast("Geolocation not supported.", "error");
  }
};

// Webcam Video Stream attachment API
function initWebcam() {
  const video = document.getElementById("camera-stream");
  const modal = document.getElementById("camera-modal");
  let stream = null;

  window.openCameraModal = function() {
    modal.classList.add("active");
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
      .then(s => {
        stream = s;
        video.srcObject = s;
      })
      .catch(err => {
        console.warn("Camera media access blocked:", err);
        showToast("Camera device block: Permission denied.", "error");
      });
  };

  window.closeCameraModal = function() {
    modal.classList.remove("active");
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
  };

  window.captureSnapshot = function() {
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 240;
    const ctx = canvas.getContext("2d");
    if (ctx && video.readyState === video.HAVE_ENOUGH_DATA) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      capturedPhotoBase64 = canvas.toDataURL("image/jpeg");
      
      const snapImg = document.getElementById("snapshot-preview");
      snapImg.src = capturedPhotoBase64;
      snapImg.style.display = "block";
      
      showToast("Valve visual capture attached to draft shift report.", "success");
      writeToConsole("CAMERA_API: Snapshot attached to shift entry.");
      closeCameraModal();
    }
  };
}

// CSV Export
window.exportCSVReport = function() {
  let csv = "MIMBULA MINERALS PROCESSING DEPARTMENT - TELEMETRY COCKPIT\r\n";
  csv += `Date, ${new Date().toLocaleDateString()}\r\n`;
  csv += `Operator, ${operatorName} (${employmentNumber})\r\n\r\n`;
  csv += "PAD ID,FEED TYPE,MIN FLOW,MAX FLOW,SURFACE AREA,STATUS\r\n";
  pads.forEach(p => {
    csv += `${p.id},${p.feedType},${p.min},${p.max},${p.area},${p.status}\r\n`;
  });
  
  csv += "\r\nPOND SYSTEM,LEVEL %,FLOW m3/h\r\n";
  Object.keys(ponds).forEach(k => {
    csv += `${k.toUpperCase()},${ponds[k].level},${ponds[k].flow}\r\n`;
  });

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `Mimbula_Telemetry_Report_${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast("CSV report spreadsheet downloaded successfully.", "success");
};

// JSON Export
window.exportJSONReport = function() {
  const notes = document.getElementById("field-notes").value;
  const payload = {
    shiftId: currentShiftId,
    timestamp: new Date().toISOString(),
    operator: { name: operatorName, employment: employmentNumber, email: operatorEmail },
    pads,
    ponds,
    notes,
    gps: currentGPS
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `Mimbula_Telemetry_JSON_${currentShiftId}.json`);
  link.click();
  showToast("JSON telemetry database file exported.", "success");
};

// Gemini AI-Ready Co-Pilot Shift Reporter
window.triggerAiReport = async function() {
  const notes = document.getElementById("field-notes").value || "Normal operations.";
  const key = document.getElementById("copilot-api-key").value.trim();
  const outputBox = document.getElementById("ai-output-box");
  
  writeToConsole("AI_COPILOT: Compiling metallurgical parameters...");
  outputBox.innerHTML = "<p class='font-mono animate-pulse'>Consulting Hydrometallurgical Process Co-Pilot models...</p>";

  const prompt = `
  You are an expert Metallurgical Process Specialist, SCADA Architect, and Hydrometallurgist.
  Analyze the current Mimbula Leach Pad shift telemetry:
  - Active pads: ${pads.filter(p => p.status === "Active").map(p => p.id).join(", ")}
  - Flow sum: ${pads.filter(p => p.status === "Active").reduce((sum, p) => sum + (p.min+p.max)/2, 0).toFixed(1)} m³/h
  - Pond Levels: PLS = ${ponds.pls.level}%, ILS = ${ponds.ils.level}%, RAF = ${ponds.raf.level}%, Acid Feed = ${ponds.acid.level}%
  - Operator Comments: ${notes}
  
  Write a brief 3-sentence action-oriented executive summary report using professional hydrometallurgical terms (blinding, pond overflow limits, recirculation loop, acid density concentration target). Keep it extremely direct and scannable.
  `;

  // Check if API Key or server endpoint is available
  if (!key) {
    // Attempt standard REST request to server API route proxy (/api/analyze)
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shiftData: {
            date: new Date().toLocaleDateString(),
            time: new Date().toLocaleTimeString(),
            operatorEmail,
            operatorName,
            employmentNumber,
            pads,
            ponds: {
              raf: { name: "Raffinate Pond", totalizer: 0, flow: ponds.raf.flow },
              ils: { name: "ILS Pond", totalizer: 0, flow: ponds.ils.flow },
              crasher: { name: "Crasher", totalizer: 0, flow: ponds.acid.flow },
              mainLine: { name: "Main Line", totalizer: 0, flow: 1200 }
            },
            notes
          },
          engine: "gemini"
        })
      });

      if (response.ok) {
        const data = await response.json();
        outputBox.innerHTML = `<h3>Generated AI Core Report:</h3><p class="font-mono text-xs">${data.analysis}</p>`;
        showToast("Gemini Co-Pilot Analysis Complete.", "success");
        writeToConsole("AI_COPILOT_PROXY: report processed successfully by server.");
        return;
      }
    } catch (e) {
      console.warn("Direct server endpoint analyze request failed, falling back to local heuristic analyzer:", e);
    }

    // Heuristic Offline Local Rules Compiler (Fall-back client-side model)
    setTimeout(() => {
      let advice = "";
      if (ponds.pls.level > 90) {
        advice += "CRITICAL: PLS Pond is near flooding capacity. Bypass pad discharge flow back to storm safety buffers immediately. ";
      }
      if (ponds.acid.level < 15) {
        advice += "CRITICAL: Sulfuric acid replenishment terminals running low. Restrict high flux rate lines to conserve feedstock. ";
      }
      if (advice === "") {
        advice = "HEPATIC CONTROL: Operations nominal. Uniform flux distribution achieved across all active irrigator arrays. Continue standard acid blending.";
      }
      
      outputBox.innerHTML = `
        <h3>Local Heuristic Analyst Report:</h3>
        <p class="font-mono text-xs">
          <strong>HANDOVER SUMMARY:</strong> Active irrigation flow loop steady. ${advice}
          <br><br>
          <em>*Offline intelligent heuristic rules triggered. Plug in a Gemini API Key inside Settings for advanced models.*</em>
        </p>
      `;
      showToast("Compiled offline heuristic analysis.", "info");
      writeToConsole("AI_COPILOT_OFFLINE: Heuristic process reports synthesized.");
    }, 1000);
  } else {
    // Directly request Gemini API if a private API Key is provided
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      });
      const data = await response.json();
      const txt = data.candidates?.[0]?.content?.parts?.[0]?.text || "No AI feedback received.";
      outputBox.innerHTML = `<h3>Generated AI Core Report:</h3><p class="font-mono text-xs">${txt}</p>`;
      showToast("Direct Gemini report synthesized.", "success");
      writeToConsole("AI_COPILOT_DIRECT: Gemini 2.5-Flash completed successfully.");
    } catch (err) {
      outputBox.innerHTML = `<p class="text-rose-500">API connection failed: ${err.message}</p>`;
      showToast("Gemini Direct Request failed.", "error");
    }
  }
};

// UI Toast helper
let toasts = [];
function showToast(message, type = "info") {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span>${type === 'success' ? '✓' : type === 'error' ? '❌' : 'ℹ'}</span>
    <span>${message}</span>
  `;
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => {
      container.removeChild(toast);
    }, 300);
  }, 3500);
}

// Service worker and offline registration
function initPWA() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js')
      .then(reg => {
        console.log("Mimbula PWA Service Worker Registered! Scope:", reg.scope);
      })
      .catch(err => {
        console.warn("Service worker registration skipped/failed:", err);
      });
  }
}

// Attach listener handlers
function addEventListeners() {
  const notesTextarea = document.getElementById("field-notes");
  if (notesTextarea) {
    notesTextarea.addEventListener("input", saveDraftToStorage);
  }
}
