import React, { useState, useEffect } from "react";
import { 
  Cloud, 
  FolderCheck, 
  CheckCircle2, 
  ExternalLink, 
  Download, 
  RefreshCw, 
  AlertCircle, 
  FileText, 
  FileCode, 
  FileSpreadsheet, 
  FileArchive, 
  Sparkles, 
  HardDrive,
  ShieldCheck,
  X,
  Layers,
  ArrowRight,
  FolderOpen
} from "lucide-react";
import { 
  requestGoogleDriveToken, 
  backupProjectToGoogleDrive, 
  buildProjectZipArchive,
  DriveUploadResult, 
  GoogleDriveFile 
} from "../services/googleDriveService";
import { ShiftTelemetryData, LeachPadNode, PondTelemetry, ExtraProcessTelemetry } from "../types";

interface GoogleDriveSaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  pads: LeachPadNode[];
  ponds: Record<string, PondTelemetry>;
  history: ShiftTelemetryData[];
  extraTelemetry: ExtraProcessTelemetry;
  pdfBlobGenerator?: () => Promise<Blob | null>;
  chartCaptureGenerator?: () => Promise<Blob | null>;
  onTriggerToast: (msg: string, type: "success" | "error" | "info") => void;
}

export default function GoogleDriveSaveModal({
  isOpen,
  onClose,
  pads,
  ponds,
  history,
  extraTelemetry,
  pdfBlobGenerator,
  chartCaptureGenerator,
  onTriggerToast,
}: GoogleDriveSaveModalProps) {
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);
  const [accessToken, setAccessToken] = useState<string>("");
  const [customTokenInput, setCustomTokenInput] = useState<string>("");
  const [showManualToken, setShowManualToken] = useState(false);

  const [uploadProgress, setUploadProgress] = useState<{
    stage: string;
    currentFile: string;
    completedFiles: number;
    totalFiles: number;
    percent: number;
  }>({
    stage: "Ready to backup",
    currentFile: "",
    completedFiles: 0,
    totalFiles: 8,
    percent: 0,
  });

  const [uploadResult, setUploadResult] = useState<DriveUploadResult | null>(null);

  useEffect(() => {
    if (isOpen) {
      setUploadResult(null);
      setUploadProgress({
        stage: "Ready to backup",
        currentFile: "",
        completedFiles: 0,
        totalFiles: 8,
        percent: 0,
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleStartDriveBackup = async () => {
    setIsUploading(true);
    setUploadResult(null);

    try {
      let token = accessToken || customTokenInput.trim();

      if (!token) {
        setIsAuthorizing(true);
        setUploadProgress({
          stage: "Authenticating with Google Account...",
          currentFile: "Requesting Drive access permission",
          completedFiles: 0,
          totalFiles: 8,
          percent: 2,
        });

        try {
          token = await requestGoogleDriveToken();
          setAccessToken(token);
        } catch (authErr: any) {
          console.warn("Standard GSI OAuth popup failed or cancelled:", authErr);
          setIsAuthorizing(false);
          setIsUploading(false);
          setShowManualToken(true);
          onTriggerToast(
            "Please grant Google Drive access or paste an OAuth token to proceed.",
            "info"
          );
          return;
        }
      }

      setIsAuthorizing(false);

      // Generate PDF on the fly if generator provided
      let pdfBlob: Blob | undefined;
      if (pdfBlobGenerator) {
        try {
          const generatedPdf = await pdfBlobGenerator();
          if (generatedPdf) pdfBlob = generatedPdf;
        } catch (e) {
          console.warn("Could not capture PDF blob for upload:", e);
        }
      }

      // Generate Chart PNG on the fly if generator provided
      let chartBlob: Blob | undefined;
      if (chartCaptureGenerator) {
        try {
          const generatedPng = await chartCaptureGenerator();
          if (generatedPng) chartBlob = generatedPng;
        } catch (e) {
          console.warn("Could not capture chart PNG blob for upload:", e);
        }
      }

      // Orchestrate upload to Google Drive
      const result = await backupProjectToGoogleDrive(
        token,
        pads,
        ponds,
        history,
        extraTelemetry,
        pdfBlob,
        chartBlob,
        (progress) => {
          setUploadProgress(progress);
        }
      );

      setUploadResult(result);
      if (result.success) {
        onTriggerToast("All project files and assets saved to Google Drive!", "success");
      } else {
        onTriggerToast(result.error || "Google Drive upload encountered an issue.", "error");
      }
    } catch (err: any) {
      console.error("Backup execution failure:", err);
      setUploadResult({
        success: false,
        filesUploaded: [],
        totalBytes: 0,
        error: err?.message || "Unexpected error during Google Drive backup.",
      });
      onTriggerToast(err?.message || "Failed to save project to Google Drive.", "error");
    } finally {
      setIsUploading(false);
      setIsAuthorizing(false);
    }
  };

  const handleDownloadOfflineZip = async () => {
    setIsDownloadingZip(true);
    try {
      onTriggerToast("Packaging full project and asset archive...", "info");
      const { zipBlob } = await buildProjectZipArchive(
        pads,
        ponds,
        history,
        extraTelemetry
      );

      const dateStamp = new Date().toISOString().split("T")[0];
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Mimbula_Minerals_Project_and_Assets_${dateStamp}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      onTriggerToast("Complete project ZIP archive downloaded successfully!", "success");
    } catch (err: any) {
      console.error("Failed to build local ZIP:", err);
      onTriggerToast("Failed to generate project ZIP archive.", "error");
    } finally {
      setIsDownloadingZip(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fade-in no-print">
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] transition-all"
        role="dialog"
        aria-modal="true"
        aria-labelledby="drive-modal-title"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-indigo-950 px-6 py-4.5 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-500 to-indigo-500 p-2 flex items-center justify-center shadow-md">
              <HardDrive size={22} className="text-white animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono tracking-widest text-teal-400 font-bold uppercase">
                  GOOGLE WORKSPACE & DRIVE INTEGRATION
                </span>
                <span className="px-1.5 py-0.2 bg-teal-950 text-teal-300 border border-teal-800/80 rounded text-[9px] font-mono font-semibold">
                  OAuth 2.0 Ready
                </span>
              </div>
              <h2 id="drive-modal-title" className="text-base font-bold text-white tracking-tight">
                Save Project & All Assets to Google Drive
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 text-slate-700 font-sans text-xs">
          
          {/* Target Account Indicator */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-700 font-bold font-mono text-xs">
                MK
              </div>
              <div>
                <p className="font-bold text-slate-800 text-xs">Miguel Kaungu (Target Google Drive)</p>
                <p className="text-[11px] text-slate-500 font-mono">kaungu89@gmail.com</p>
              </div>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200 font-medium">
              <ShieldCheck size={13} className="text-emerald-600" />
              <span>Project ID: lulamba-creatives</span>
            </div>
          </div>

          {/* Asset Bundle Breakdown Card */}
          <div className="space-y-2">
            <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
              <Layers size={13} className="text-indigo-600" />
              <span>Assets & Components to be Saved in Google Drive</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-start gap-2.5">
                <FileCode size={16} className="text-teal-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-slate-800 text-xs">Source Code Bundle (.ZIP)</p>
                  <p className="text-[10.5px] text-slate-500 leading-tight mt-0.5">
                    Complete React 19, Vite, TypeScript, Express backend, and build configs.
                  </p>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-start gap-2.5">
                <FileSpreadsheet size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-slate-800 text-xs">Telemetry Datasets & CSV</p>
                  <p className="text-[10.5px] text-slate-500 leading-tight mt-0.5">
                    Live leach pad logs, 24h moving averages, shift history, and pond totalizers.
                  </p>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-start gap-2.5">
                <FileArchive size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-slate-800 text-xs">Standalone PWA Package</p>
                  <p className="text-[10.5px] text-slate-500 leading-tight mt-0.5">
                    Zero-dependency offline PWA files (HTML, CSS, JS, manifest, service worker).
                  </p>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-start gap-2.5">
                <FileText size={16} className="text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-slate-800 text-xs">PDF Reports & Diagrams</p>
                  <p className="text-[10.5px] text-slate-500 leading-tight mt-0.5">
                    Formal engineering handover PDFs, SVGs, and telemetry anomaly chart captures.
                  </p>
                </div>
              </div>

            </div>
          </div>

          {/* Progress / Status Container */}
          {(isUploading || isAuthorizing || uploadProgress.percent > 0) && (
            <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl p-4 space-y-2.5 animate-fade-in">
              <div className="flex items-center justify-between text-xs font-bold text-indigo-950">
                <span className="flex items-center gap-2">
                  <RefreshCw size={13} className={`text-indigo-600 ${isUploading ? "animate-spin" : ""}`} />
                  {uploadProgress.stage}
                </span>
                <span className="font-mono text-indigo-700">{uploadProgress.percent}%</span>
              </div>
              
              {/* Progress Bar */}
              <div className="w-full bg-indigo-100 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-teal-500 to-indigo-600 h-full transition-all duration-300 ease-out rounded-full"
                  style={{ width: `${uploadProgress.percent}%` }}
                />
              </div>

              {uploadProgress.currentFile && (
                <p className="text-[10.5px] text-indigo-800 font-mono truncate">
                  Processing: <span className="font-semibold">{uploadProgress.currentFile}</span>
                </p>
              )}
            </div>
          )}

          {/* Success / Result View */}
          {uploadResult && uploadResult.success && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-3 animate-fade-in">
              <div className="flex items-center gap-2 text-emerald-900 font-bold text-xs">
                <CheckCircle2 size={16} className="text-emerald-600 flex-none" />
                <span>Successfully created Google Drive Project Folder & Uploaded Assets!</span>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                {uploadResult.folderUrl && (
                  <a
                    href={uploadResult.folderUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all"
                  >
                    <FolderOpen size={13} />
                    <span>Open Project Folder in Google Drive</span>
                    <ExternalLink size={11} className="opacity-80" />
                  </a>
                )}
              </div>

              {/* Uploaded Files Manifest */}
              <div className="pt-2 border-t border-emerald-200/60 space-y-1.5">
                <p className="text-[11px] font-bold text-emerald-950 uppercase tracking-wider">
                  Uploaded Google Drive Files ({uploadResult.filesUploaded.length}):
                </p>
                <div className="max-h-36 overflow-y-auto space-y-1 pr-1 font-mono text-[10.5px]">
                  {uploadResult.filesUploaded.map((file, idx) => (
                    <div 
                      key={idx}
                      className="bg-white/80 border border-emerald-100 rounded-md p-1.5 flex items-center justify-between"
                    >
                      <span className="text-slate-800 truncate pr-2 font-medium">📄 {file.name}</span>
                      {file.webViewLink && (
                        <a
                          href={file.webViewLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-600 hover:text-indigo-800 flex items-center gap-1 shrink-0 font-sans text-[10px] font-semibold"
                        >
                          View <ExternalLink size={9} />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Failure Alert */}
          {uploadResult && !uploadResult.success && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 space-y-1.5 animate-fade-in text-rose-900">
              <div className="flex items-center gap-2 font-bold text-xs">
                <AlertCircle size={15} className="text-rose-600 shrink-0" />
                <span>Failed to complete Google Drive upload</span>
              </div>
              <p className="text-[11px] text-rose-800">{uploadResult.error}</p>
            </div>
          )}

          {/* Optional manual token toggle */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowManualToken(!showManualToken)}
              className="text-[11px] text-slate-500 hover:text-slate-700 underline flex items-center gap-1 cursor-pointer"
            >
              <span>{showManualToken ? "Hide manual OAuth token configuration" : "Need to specify a custom OAuth Token or Client ID?"}</span>
            </button>
            
            {showManualToken && (
              <div className="mt-2 p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <label className="block text-[10.5px] font-mono text-slate-600">
                  Google OAuth Access Token (Optional Manual Override):
                </label>
                <input
                  type="password"
                  placeholder="ya29.a0AfH6SM..."
                  value={customTokenInput}
                  onChange={(e) => setCustomTokenInput(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            )}
          </div>

        </div>

        {/* Footer Actions */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          
          <button
            type="button"
            onClick={handleDownloadOfflineZip}
            disabled={isDownloadingZip || isUploading}
            className="w-full sm:w-auto px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer disabled:opacity-60"
            title="Download full project source code and assets as a .ZIP archive onto your local device"
          >
            <Download size={13} className={isDownloadingZip ? "animate-bounce" : "text-slate-500"} />
            <span>{isDownloadingZip ? "Generating ZIP..." : "Download Local .ZIP Archive"}</span>
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl font-semibold text-xs transition-all cursor-pointer"
            >
              Close
            </button>

            <button
              type="button"
              onClick={handleStartDriveBackup}
              disabled={isUploading || isAuthorizing}
              className="w-full sm:w-auto px-5 py-2 bg-gradient-to-r from-teal-600 to-indigo-600 hover:from-teal-500 hover:to-indigo-500 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all cursor-pointer active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isUploading || isAuthorizing ? (
                <>
                  <RefreshCw size={13} className="animate-spin" />
                  <span>Saving to Google Drive...</span>
                </>
              ) : (
                <>
                  <Cloud size={14} className="text-teal-200" />
                  <span>Save Project to Google Drive</span>
                  <ArrowRight size={13} />
                </>
              )}
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}
