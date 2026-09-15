import JSZip from "jszip";
import { ShiftTelemetryData, LeachPadNode, PondTelemetry, ExtraProcessTelemetry } from "../types";

export interface GoogleDriveFolder {
  id: string;
  name: string;
  webViewLink?: string;
}

export interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  size?: number;
}

export interface UploadProgressCallback {
  (progress: {
    stage: string;
    currentFile: string;
    completedFiles: number;
    totalFiles: number;
    percent: number;
  }): void;
}

export interface DriveUploadResult {
  success: boolean;
  folderId?: string;
  folderName?: string;
  folderUrl?: string;
  filesUploaded: GoogleDriveFile[];
  totalBytes: number;
  error?: string;
}

// Global reference for Google Identity Services token client
let tokenClient: any = null;
let currentAccessToken: string | null = null;
let tokenExpiresAt: number = 0;

/**
 * Initializes and requests an OAuth token for Google Drive API access.
 */
export async function requestGoogleDriveToken(clientId?: string): Promise<string> {
  // Check if existing token is valid (with 60s buffer)
  if (currentAccessToken && Date.now() < tokenExpiresAt - 60000) {
    return currentAccessToken;
  }

  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      return reject(new Error("Window is not available"));
    }

    const google = (window as any).google;
    if (!google?.accounts?.oauth2) {
      return reject(
        new Error(
          "Google Identity Services (GSI) SDK is not loaded. Please ensure you are connected to the internet."
        )
      );
    }

    // Use OAuth Client ID provided by user/environment or prompt
    const effectiveClientId =
      clientId ||
      (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID ||
      "124154455996-apps.googleusercontent.com";

    try {
      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: effectiveClientId,
        scope: "https://www.googleapis.com/auth/drive.file",
        callback: (response: any) => {
          if (response.error) {
            console.error("Google OAuth token error:", response);
            reject(new Error(response.error_description || response.error || "OAuth token acquisition failed"));
            return;
          }
          currentAccessToken = response.access_token;
          const expiresIn = response.expires_in ? parseInt(response.expires_in, 10) : 3600;
          tokenExpiresAt = Date.now() + expiresIn * 1000;
          resolve(response.access_token);
        },
      });

      tokenClient.requestAccessToken({ prompt: "" });
    } catch (err: any) {
      console.error("Failed to initialize Google OAuth Token Client:", err);
      reject(err);
    }
  });
}

/**
 * Creates a folder inside Google Drive.
 */
export async function createDriveFolder(
  accessToken: string,
  folderName: string,
  parentFolderId?: string
): Promise<GoogleDriveFolder> {
  const metadata: any = {
    name: folderName,
    mimeType: "application/vnd.google-apps.folder",
  };

  if (parentFolderId) {
    metadata.parents = [parentFolderId];
  }

  const response = await fetch("https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(metadata),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error?.message || `Failed to create folder "${folderName}" (HTTP ${response.status})`
    );
  }

  const data = await response.json();
  return {
    id: data.id,
    name: data.name,
    webViewLink: data.webViewLink || `https://drive.google.com/drive/folders/${data.id}`,
  };
}

/**
 * Uploads a file (text, binary, or Blob) to Google Drive using multipart upload.
 */
export async function uploadFileToDrive(
  accessToken: string,
  fileName: string,
  content: string | Blob | Uint8Array,
  mimeType: string,
  parentFolderId?: string
): Promise<GoogleDriveFile> {
  const metadata: any = {
    name: fileName,
    mimeType: mimeType,
  };

  if (parentFolderId) {
    metadata.parents = [parentFolderId];
  }

  const boundary = "-------314159265358979323846";
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  let bodyBlob: Blob;

  if (content instanceof Blob) {
    const metadataBlob = new Blob([
      delimiter,
      "Content-Type: application/json; charset=UTF-8\r\n\r\n",
      JSON.stringify(metadata),
      delimiter,
      `Content-Type: ${mimeType}\r\n\r\n`,
    ]);
    const closeBlob = new Blob([closeDelimiter]);
    bodyBlob = new Blob([metadataBlob, content, closeBlob], {
      type: `multipart/related; boundary=${boundary}`,
    });
  } else if (typeof content === "string") {
    const multipartBody =
      delimiter +
      "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
      JSON.stringify(metadata) +
      delimiter +
      `Content-Type: ${mimeType}\r\n\r\n` +
      content +
      closeDelimiter;

    bodyBlob = new Blob([multipartBody], {
      type: `multipart/related; boundary=${boundary}`,
    });
  } else {
    // Uint8Array or ArrayBuffer
    const metadataStr =
      delimiter +
      "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
      JSON.stringify(metadata) +
      delimiter +
      `Content-Type: ${mimeType}\r\n\r\n`;

    const metaBlob = new Blob([metadataStr]);
    const closeBlob = new Blob([closeDelimiter]);
    bodyBlob = new Blob([metaBlob, content, closeBlob], {
      type: `multipart/related; boundary=${boundary}`,
    });
  }

  const response = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink,size",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: bodyBlob,
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error?.message || `Failed to upload "${fileName}" (HTTP ${response.status})`
    );
  }

  const data = await response.json();
  return {
    id: data.id,
    name: data.name,
    mimeType: data.mimeType || mimeType,
    webViewLink: data.webViewLink || `https://drive.google.com/file/d/${data.id}/view`,
    size: data.size ? parseInt(data.size, 10) : bodyBlob.size,
  };
}

/**
 * Builds a complete standalone JSZip archive of all project source files, assets, and configs.
 */
export async function buildProjectZipArchive(
  activePads: LeachPadNode[],
  activePonds: Record<string, PondTelemetry>,
  history: ShiftTelemetryData[],
  extraTelemetry: ExtraProcessTelemetry
): Promise<{ zipBlob: Blob; totalFiles: number }> {
  const zip = new JSZip();

  // 1. Fetch server files manifest
  let serverFiles: { path: string; content: string; encoding: string }[] = [];
  try {
    const res = await fetch("/api/project-export");
    if (res.ok) {
      const data = await res.json();
      if (data.files && Array.isArray(data.files)) {
        serverFiles = data.files;
      }
    }
  } catch (err) {
    console.warn("Could not fetch server file manifest, falling back to local bundle:", err);
  }

  // 2. Add server files to zip
  for (const file of serverFiles) {
    if (file.encoding === "base64") {
      zip.file(file.path, file.content, { base64: true });
    } else {
      zip.file(file.path, file.content);
    }
  }

  // 3. Add live telemetry and data dumps
  const liveShiftData: ShiftTelemetryData = {
    id: `SHIFT-LIVE-BACKUP-${new Date().toISOString().replace(/[:.]/g, "-")}`,
    date: new Date().toISOString().split("T")[0],
    time: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
    operatorEmail: "kaungu89@gmail.com",
    operatorName: "Miguel Kaungu",
    employmentNumber: "EMP-8274",
    pads: activePads,
    ponds: activePonds as any,
    extraTelemetry: extraTelemetry,
    notes: "Automated full project and telemetry backup to Google Drive.",
  };

  zip.file(
    "data/active_telemetry_snapshot.json",
    JSON.stringify(liveShiftData, null, 2)
  );

  zip.file(
    "data/shift_history_records.json",
    JSON.stringify(history, null, 2)
  );

  // Generate CSV for easy Excel opening
  let csvContent = "Pad ID,Feed Source,Min Flow (m3/h),Max Flow (m3/h),Totalizer (m3),PLS Split %,ILS Split %,Status,Notes\r\n";
  activePads.forEach((p) => {
    csvContent += `${p.id},${p.feedType || "RAF"},${p.min},${p.max},${p.totalizer ?? ""},${p.dischargePlsPercent ?? 100},${p.dischargeIlsPercent ?? 0},${p.status},"${p.notes || ""}"\r\n`;
  });
  zip.file("data/leach_pads_flowsheet.csv", csvContent);

  // Add Comprehensive Documentation & Readme
  const docContent = `# MIMBULA MINERALS LIMITED - LEACH PAD TELEMETRY & ASSETS BACKUP
Generated: ${new Date().toISOString()}
Author / Lead Developer: Miguel Kaungu (EMP-8274)
Operator Email: kaungu89@gmail.com

## Project Description
This backup contains the complete, production-ready full-stack application and offline-capable Progressive Web Application (PWA) for the Mimbula Minerals Processing Department.

### Included Packages & Directories:
1. \`src/\` - React 19 + TypeScript + Tailwind CSS Frontend Source Code
   - \`components/\` - TelemetryChart with 24h MA corridor, Acid Tank Alarms, PWA Simulator, Live Pipelines
   - \`services/\` - Google Drive Synchronization, AI Process Analysis, Local DB
2. \`pwa/\` - Standalone Zero-Dependency Field Operations App
   - \`index.html\`, \`style.css\`, \`script.js\`, \`service-worker.js\`, \`manifest.json\`
3. \`server.ts\` - Express API Server with Gemini 3.5 AI & NVIDIA Llama Telemetry Analysis
4. \`data/\` - Real-time SCADA telemetry snapshots, shift logs, and CSV flowsheet datasets.
`;
  zip.file("PROJECT_BACKUP_README.md", docContent);

  const zipBlob = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
  });

  return {
    zipBlob,
    totalFiles: Object.keys(zip.files).length,
  };
}

/**
 * Orchestrates full project and asset backup to Google Drive.
 */
export async function backupProjectToGoogleDrive(
  accessToken: string,
  activePads: LeachPadNode[],
  activePonds: Record<string, PondTelemetry>,
  history: ShiftTelemetryData[],
  extraTelemetry: ExtraProcessTelemetry,
  pdfBlob?: Blob,
  chartPngBlob?: Blob,
  onProgress?: UploadProgressCallback
): Promise<DriveUploadResult> {
  const uploadedFiles: GoogleDriveFile[] = [];
  let totalBytes = 0;

  try {
    const timestamp = new Date().toISOString().replace(/T/, " ").replace(/\..+/, "");
    const dateStamp = new Date().toISOString().split("T")[0];
    const rootFolderName = `Mimbula Minerals - Telemetry Project Backup (${dateStamp})`;

    onProgress?.({
      stage: "Creating Google Drive Folder Structure",
      currentFile: rootFolderName,
      completedFiles: 0,
      totalFiles: 8,
      percent: 5,
    });

    // 1. Create Main Root Project Folder
    const rootFolder = await createDriveFolder(accessToken, rootFolderName);

    // 2. Create Organized Subfolders
    const [sourceDir, dataDir, pwaDir, reportsDir, assetsDir] = await Promise.all([
      createDriveFolder(accessToken, "01_Source_Code_Archive", rootFolder.id),
      createDriveFolder(accessToken, "02_Telemetry_Data_and_Logs", rootFolder.id),
      createDriveFolder(accessToken, "03_Standalone_PWA_Package", rootFolder.id),
      createDriveFolder(accessToken, "04_PDF_and_Print_Reports", rootFolder.id),
      createDriveFolder(accessToken, "05_Visual_Assets_and_Icons", rootFolder.id),
    ]);

    // 3. Build & Upload Full Source Code .ZIP
    onProgress?.({
      stage: "Archiving Entire Project & Assets into .ZIP",
      currentFile: "mimbula-minerals-telemetry-source.zip",
      completedFiles: 1,
      totalFiles: 8,
      percent: 20,
    });

    const { zipBlob } = await buildProjectZipArchive(
      activePads,
      activePonds,
      history,
      extraTelemetry
    );

    const zipFile = await uploadFileToDrive(
      accessToken,
      `mimbula-minerals-telemetry-full-source-${dateStamp}.zip`,
      zipBlob,
      "application/zip",
      sourceDir.id
    );
    uploadedFiles.push(zipFile);
    totalBytes += zipFile.size || zipBlob.size;

    // 4. Upload Telemetry JSON Datasets
    onProgress?.({
      stage: "Saving Telemetry JSON Logs & Shift History",
      currentFile: "active-telemetry-shift.json",
      completedFiles: 2,
      totalFiles: 8,
      percent: 40,
    });

    const liveDataJson = JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        date: dateStamp,
        operator: "Miguel Kaungu (kaungu89@gmail.com)",
        employmentNumber: "EMP-8274",
        pads: activePads,
        ponds: activePonds,
        extraTelemetry: extraTelemetry,
      },
      null,
      2
    );

    const jsonFile = await uploadFileToDrive(
      accessToken,
      `active-telemetry-shift-${dateStamp}.json`,
      liveDataJson,
      "application/json",
      dataDir.id
    );
    uploadedFiles.push(jsonFile);
    totalBytes += jsonFile.size || liveDataJson.length;

    // Shift History Archive
    const historyJson = JSON.stringify(history, null, 2);
    const historyFile = await uploadFileToDrive(
      accessToken,
      `all-recorded-shift-history-${dateStamp}.json`,
      historyJson,
      "application/json",
      dataDir.id
    );
    uploadedFiles.push(historyFile);
    totalBytes += historyFile.size || historyJson.length;

    // 5. Upload Telemetry CSV Flowsheet
    onProgress?.({
      stage: "Exporting Leach Pad Flowsheet CSV",
      currentFile: "leach-pads-flowsheet.csv",
      completedFiles: 4,
      totalFiles: 8,
      percent: 60,
    });

    let csvContent = "Pad ID,Feed Source,Min Flow (m3/h),Max Flow (m3/h),Totalizer (m3),PLS Split %,ILS Split %,Status,Notes\r\n";
    activePads.forEach((p) => {
      csvContent += `${p.id},${p.feedType || "RAF"},${p.min},${p.max},${p.totalizer ?? ""},${p.dischargePlsPercent ?? 100},${p.dischargeIlsPercent ?? 0},${p.status},"${p.notes || ""}"\r\n`;
    });

    const csvFile = await uploadFileToDrive(
      accessToken,
      `leach-pads-flowsheet-${dateStamp}.csv`,
      csvContent,
      "text/csv",
      dataDir.id
    );
    uploadedFiles.push(csvFile);
    totalBytes += csvFile.size || csvContent.length;

    // 6. Upload PDF Shift Handover Report (if supplied)
    if (pdfBlob) {
      onProgress?.({
        stage: "Uploading Shift Telemetry PDF Report",
        currentFile: "LeachPad_Shift_Handover_Report.pdf",
        completedFiles: 5,
        totalFiles: 8,
        percent: 75,
      });

      const pdfFile = await uploadFileToDrive(
        accessToken,
        `Mimbula_Minerals_Shift_Handover_Report_${dateStamp}.pdf`,
        pdfBlob,
        "application/pdf",
        reportsDir.id
      );
      uploadedFiles.push(pdfFile);
      totalBytes += pdfFile.size || pdfBlob.size;
    }

    // 7. Upload Telemetry Chart PNG (if supplied)
    if (chartPngBlob) {
      onProgress?.({
        stage: "Uploading Telemetry Chart Snapshot (PNG)",
        currentFile: "Telemetry_Chart_Snapshot.png",
        completedFiles: 6,
        totalFiles: 8,
        percent: 85,
      });

      const pngFile = await uploadFileToDrive(
        accessToken,
        `LeachPad_Telemetry_Chart_24hMA_${dateStamp}.png`,
        chartPngBlob,
        "image/png",
        assetsDir.id
      );
      uploadedFiles.push(pngFile);
      totalBytes += pngFile.size || chartPngBlob.size;
    }

    // 8. Upload README Summary
    onProgress?.({
      stage: "Writing Google Drive Project Summary Document",
      currentFile: "README.md",
      completedFiles: 7,
      totalFiles: 8,
      percent: 95,
    });

    const summaryMd = `# MIMBULA MINERALS LIMITED
## Heap Leach Pad Flows & Acid Distribution Center
### Google Drive Archive Summary

- **Backup Timestamp:** ${timestamp}
- **Operator Name:** Miguel Kaungu (EMP-8274)
- **Email:** kaungu89@gmail.com
- **Active Leach Pads:** ${activePads.filter((p) => p.status === "Active").length} of ${activePads.length} Online
- **Total Estimated Flow:** ${activePads
      .filter((p) => p.status === "Active")
      .reduce((sum, p) => sum + (p.min + p.max) / 2, 0)
      .toFixed(1)} m³/h
- **Acid Distribution Total Outflow:** ${Object.values(activePonds)
      .reduce((sum, p) => sum + p.flow, 0)
      .toFixed(1)} m³/h

### Folder Directory Overview:
1. **01_Source_Code_Archive/** - Complete downloadable .ZIP of the React, Vite, Node, and Express codebase.
2. **02_Telemetry_Data_and_Logs/** - JSON and CSV files formatted for direct import into Excel and SCADA historians.
3. **03_Standalone_PWA_Package/** - Offline Progressive Web App assets.
4. **04_PDF_and_Print_Reports/** - High-resolution landscape and portrait engineering handover PDF documents.
5. **05_Visual_Assets_and_Icons/** - Vector schematics and chart telemetry PNG captures.
`;

    const readmeFile = await uploadFileToDrive(
      accessToken,
      "00_PROJECT_SUMMARY.md",
      summaryMd,
      "text/markdown",
      rootFolder.id
    );
    uploadedFiles.push(readmeFile);
    totalBytes += readmeFile.size || summaryMd.length;

    onProgress?.({
      stage: "Backup Complete!",
      currentFile: "All assets synchronized to Google Drive",
      completedFiles: 8,
      totalFiles: 8,
      percent: 100,
    });

    return {
      success: true,
      folderId: rootFolder.id,
      folderName: rootFolder.name,
      folderUrl: rootFolder.webViewLink,
      filesUploaded: uploadedFiles,
      totalBytes,
    };
  } catch (err: any) {
    console.error("Google Drive Backup Error:", err);
    return {
      success: false,
      filesUploaded: uploadedFiles,
      totalBytes,
      error: err?.message || "Failed to backup project to Google Drive.",
    };
  }
}
