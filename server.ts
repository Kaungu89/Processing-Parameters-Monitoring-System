import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "5mb" }));

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  // API Route: Serves updated simulated csv configuration for real-time syncing
  app.get("/api/pads-csv", (req, res) => {
    const now = new Date().toLocaleTimeString();
    const csvContent = `Pad ID,Feed Source,Min Flow (m3/h),Max Flow (m3/h),Totalizer (m3),PLS Split %,ILS Split %,Status,Notes
LP1,RAF,45.5,45.5,4480.20,100,0,Active,Synced from server at ${now}
LP2,RAF,0.00,0.00,0.00,100,0,Off,Standby
LP3,ILS,0.00,0.00,0.00,0,100,Off,Offline maintenance
LP4,RAF,125.00,125.00,20500.25,100,0,Active,Dosing adjusted at ${now}
LP5,RAF,158.00,158.00,32100.80,80,20,Active,Active irrigation
LP6,ILS,180.00,180.00,45900.50,55,45,Active,Optimal blending
LP7,RAF,162.00,162.00,28450.10,100,0,Active,Active irrigation
LP8,RAF,96.50,96.50,11180.40,70,30,Active,Active irrigation
LP9,ILS,165.00,165.00,30220.15,100,0,Active,Active irrigation
LP10,RAF,0.00,0.00,0.00,60,40,Off,Standby
LP11,RAF,150.00,150.00,24100.30,100,0,Active,Active irrigation
LP12,ILS,135.20,135.20,22980.60,0,100,Active,Active irrigation
`;
    res.header("Content-Type", "text/csv");
    res.attachment("LeachPads_Latest_Config.csv");
    res.send(csvContent);
  });

  // API Route: Server-side analyze endpoint for leach pad telemetry data (supports Gemini & NVIDIA Llama)
  app.post("/api/analyze", async (req, res) => {
    try {
      const { shiftData, engine } = req.body;
      if (!shiftData) {
        return res.status(400).json({ error: "No shift data provided" });
      }

      const prompt = `
You are an expert Mine Operations Engineer, Hydrometallurgical Process Specialist, and Telemetry Data Analyst.
Review the following shift telemetry data collected from the Heap Leach Pad Flows and Acid Pond Distribution Systems:

TIMESTAMP: ${shiftData.date} ${shiftData.time}
OPERATOR LOGGED EMAIL: ${shiftData.operatorEmail || "Not Specified"}
OPERATOR NAME: ${shiftData.operatorName || "Not Specified"}
EMPLOYMENT NUMBER: ${shiftData.employmentNumber || "Not Specified"}

LEACH PAD FLOW RATES (12-Pad Irrigators Flow rates inside the pad):
${shiftData.pads.map((p: any) => `- ${p.id}: Feed = ${p.feedType || "RAF"}, Min = ${p.min} m³/h, Max = ${p.max} m³/h, Status = ${p.status || "Active"}`).join("\n")}

ACID PONDS & MAIN LINE SYSTEMS TELEMETRY (Operational note: Main Line Acid DOES NOT feed directly to the Leach Pads; it supplies Raff Pond Acid, ILS Pond Acid, EW Acid, and SX2 Acid):
- RAF (Raffinate) Pond Acid:
  - Totalizer Reading: ${shiftData.ponds.raf.totalizer} m³
  - Outgoing Acid Flow rate: ${shiftData.ponds.raf.flow} m³/h
- ILS (Intermediate Leach Solution) Pond Acid:
  - Totalizer Reading: ${shiftData.ponds.ils.totalizer} m³
  - Outgoing Acid Flow rate: ${shiftData.ponds.ils.flow} m³/h
- Acid Flow to Crasher:
  - Totalizer Reading: ${shiftData.ponds.crasher.totalizer} m³
  - Flow rate: ${shiftData.ponds.crasher.flow} m³/h
- Main Distribution Line (Main Supply recharging Raff Pond Acid, ILS Pond Acid, EW Acid, and SX2 Acid):
  - Totalizer Reading: ${shiftData.ponds.mainLine.totalizer} m³
  - Flow rate: ${shiftData.ponds.mainLine.flow} m³/h

Analyze this mining telemetry dataset thoroughly and write an excellent action-oriented industrial report containing:
1. **Executive Operational Summary**: Summarize overall flow health, active irrigator count, total pad activity rate, and key performance benchmarks.
2. **Irrigation Uniformity & Status Observations**: Highlight offline or off pads (e.g. LP1, LP2, LP3, LP10 as off/offline). Point out any pads with abnormal flow patterns (e.g., Min flow > Max flow issues which indicate sensor faults, or pads with 0 flows but marked active).
3. **Acid Distribution & Hydraulic Flow Mass-Balance Checklist**: Verify if the Main Line Acid Flow rate corresponds to the sum of the downstream supply lines (Raff Pond, ILS Pond, EW Acid, and SX2 Acid circuits). Ensure there is no significant meter drift or line loss between the Main Line Acid source and the recipient/replenishing systems (taking into account EW and SX2 rates).
4. **Hydrological Control Anomalies**: Highlight any telemetry issues that violate safety thresholds or target ranges (e.g., excessive irrigation variance across active pads LP4 to LP12).
5. **Engineering Action Tasks**: List 4 clear step-by-step priority actions for the incoming crew to rectify issues, verify valves, check calibration, or balance chemistry.

Use precise, high-end metallurgy and hydraulic terms. Maintain a clear, objective, professional, and descriptive style. Present the results in styled markdown with beautiful bold terminology.
`;

      if (engine === "nvidia") {
        const nvidiaKey = process.env.NVIDIA_API_KEY || "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";
        if (!nvidiaKey) {
          return res.status(520).json({ 
            error: "Nvidia API Key is not configured in environment secrets and has no runtime fallback." 
          });
        }

        console.log("Invoking server-side NVIDIA NIM Llama-3 completions API...");
        const responseNvidia = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${nvidiaKey}`,
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          body: JSON.stringify({
            model: "meta/llama-3.1-70b-instruct",
            messages: [
              {
                role: "system",
                content: "You are an expert Mine Operations Engineer, Hydrometallurgical Process Specialist, and Telemetry Data Analyst representing Mimbula Minerals Limited."
              },
              {
                role: "user",
                content: prompt
              }
            ],
            temperature: 0.2,
            top_p: 0.7,
            max_tokens: 2048
          })
        });

        if (!responseNvidia.ok) {
          const errText = await responseNvidia.text();
          console.error("NVIDIA NIM completions error:", errText);
          throw new Error(`NVIDIA NIM API response failure (HTTP ${responseNvidia.status}): ${errText}`);
        }

        const data = await responseNvidia.json();
        const analysis = data.choices?.[0]?.message?.content || "No analysis content was returned from NVIDIA Llama 3.";
        return res.json({ analysis });
      } else {
        // Default to Google Gemini API
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
          return res.status(520).json({ 
            error: "GEMINI_API_KEY is not configured in environment secrets. Please set it using the Secrets panel in Settings." 
          });
        }

        // Initialize Gemini SDK with telemetry user-agent header
        const ai = new GoogleGenAI({
          apiKey: apiKey,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build',
            }
          }
        });

        const response = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: prompt,
        });

        res.json({ analysis: response.text });
      }
    } catch (error: any) {
      console.error("Shift Telemetry Analysis Error:", error);
      res.status(500).json({ error: error?.message || "Internal server error occurred while invoking AI API." });
    }
  });

  // API Route: Project File Manifest & Content Exporter for Google Drive Backup
  app.get("/api/project-export", async (req, res) => {
    try {
      const fs = await import("fs/promises");
      const rootDir = process.cwd();
      const filesList: { path: string; content: string; encoding: "utf8" | "base64"; size: number }[] = [];

      const ignoredDirs = new Set(["node_modules", "dist", ".git", ".cache", ".aistudio"]);
      const binaryExtensions = new Set([".png", ".jpg", ".jpeg", ".ico", ".webp", ".pdf", ".zip"]);

      async function scanDirectory(currentDir: string, relativePath: string = "") {
        const entries = await fs.readdir(currentDir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(currentDir, entry.name);
          const relPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

          if (entry.isDirectory()) {
            if (!ignoredDirs.has(entry.name)) {
              await scanDirectory(fullPath, relPath);
            }
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            const stat = await fs.stat(fullPath);
            
            // Limit file size to 15MB per asset
            if (stat.size < 15 * 1024 * 1024) {
              if (binaryExtensions.has(ext)) {
                const buffer = await fs.readFile(fullPath);
                filesList.push({
                  path: relPath,
                  content: buffer.toString("base64"),
                  encoding: "base64",
                  size: stat.size
                });
              } else {
                try {
                  const text = await fs.readFile(fullPath, "utf-8");
                  filesList.push({
                    path: relPath,
                    content: text,
                    encoding: "utf8",
                    size: stat.size
                  });
                } catch {
                  // Fallback to base64 if not UTF-8 readable
                  const buffer = await fs.readFile(fullPath);
                  filesList.push({
                    path: relPath,
                    content: buffer.toString("base64"),
                    encoding: "base64",
                    size: stat.size
                  });
                }
              }
            }
          }
        }
      }

      await scanDirectory(rootDir);
      res.json({
        success: true,
        project: "Mimbula Minerals Leach Pad Telemetry",
        timestamp: new Date().toISOString(),
        totalFiles: filesList.length,
        files: filesList
      });
    } catch (err: any) {
      console.error("Error exporting project files:", err);
      res.status(500).json({ success: false, error: err?.message || "Failed to scan project files" });
    }
  });

  // Serve standalone PWA static assets
  app.use("/pwa", express.static(path.join(process.cwd(), "pwa")));

  // Vite middleware for development or Static files for production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
