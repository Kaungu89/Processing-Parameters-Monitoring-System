import React, { useState, useEffect } from "react";
import { 
  FileCheck, 
  Plus, 
  ExternalLink, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Copy, 
  ChevronRight, 
  Layers, 
  User, 
  Clock, 
  Download, 
  Share2, 
  Send,
  HelpCircle,
  Database
} from "lucide-react";
import { 
  listGoogleForms, 
  getGoogleForm, 
  getGoogleFormResponses, 
  createHeapLeachInspectionForm, 
  GoogleFormsDriveFile, 
  GoogleForm, 
  GoogleFormResponse 
} from "../services/googleFormsService";
import { getAccessToken, signInWithGoogle, getCurrentUser } from "../services/googleAuthService";

interface GoogleFormsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTriggerToast: (msg: string, type: "success" | "error" | "info") => void;
  onImportShiftFromForm?: (importedData: {
    operatorName?: string;
    employmentNumber?: string;
    notes?: string;
    rafLevel?: number;
    ilsLevel?: number;
    crasherLevel?: number;
    mainLineFlow?: number;
    cuGrade?: number;
    acidLevel?: number;
  }) => void;
}

export default function GoogleFormsModal({
  isOpen,
  onClose,
  onTriggerToast,
  onImportShiftFromForm,
}: GoogleFormsModalProps) {
  const [activeTab, setActiveTab] = useState<"forms" | "create" | "responses">("forms");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [formsList, setFormsList] = useState<GoogleFormsDriveFile[]>([]);
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null);
  const [selectedFormDetails, setSelectedFormDetails] = useState<GoogleForm | null>(null);
  const [formResponses, setFormResponses] = useState<GoogleFormResponse[]>([]);
  const [isLoadingResponses, setIsLoadingResponses] = useState<boolean>(false);
  
  // Creation form state
  const [customTitle, setCustomTitle] = useState<string>(
    `Heap Leach Shift Inspection & Handover Form - ${new Date().toLocaleDateString('en-GB')}`
  );
  const [showConfirmCreateDialog, setShowConfirmCreateDialog] = useState<boolean>(false);

  // Authentication check
  const [isAuthChecking, setIsAuthChecking] = useState<boolean>(false);
  const [hasToken, setHasToken] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      checkAuthAndLoad();
    }
  }, [isOpen]);

  const checkAuthAndLoad = async () => {
    setIsAuthChecking(true);
    try {
      const token = await getAccessToken();
      if (token) {
        setHasToken(true);
        await loadForms(token);
      } else {
        setHasToken(false);
      }
    } catch (err) {
      console.warn("Auth check notice:", err);
      setHasToken(false);
    } finally {
      setIsAuthChecking(false);
    }
  };

  const handleSignIn = async () => {
    setIsAuthChecking(true);
    try {
      const authResult = await signInWithGoogle();
      if (authResult?.accessToken) {
        setHasToken(true);
        onTriggerToast("Google Account connected for Google Forms!", "success");
        await loadForms(authResult.accessToken);
      }
    } catch (err: any) {
      console.error("Sign in failed:", err);
      onTriggerToast(`Sign in failed: ${err.message || "Please check popup settings"}`, "error");
    } finally {
      setIsAuthChecking(false);
    }
  };

  const loadForms = async (token?: string) => {
    setIsLoading(true);
    try {
      const tok = token || (await getAccessToken());
      if (!tok) {
        setHasToken(false);
        return;
      }
      const files = await listGoogleForms(tok);
      setFormsList(files);
      if (files.length > 0 && !selectedFormId) {
        setSelectedFormId(files[0].id);
        loadFormDetails(files[0].id, tok);
      }
    } catch (err: any) {
      console.error("Error loading forms:", err);
      onTriggerToast("Unable to list Google Forms from Drive", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const loadFormDetails = async (formId: string, token?: string) => {
    try {
      const tok = token || (await getAccessToken());
      if (!tok) return;
      const details = await getGoogleForm(formId, tok);
      setSelectedFormDetails(details);
    } catch (err) {
      console.warn("Could not load form schema:", err);
    }
  };

  const handleSelectForm = async (formId: string) => {
    setSelectedFormId(formId);
    const tok = await getAccessToken();
    if (tok) {
      await loadFormDetails(formId, tok);
      if (activeTab === "responses") {
        await loadResponsesForForm(formId, tok);
      }
    }
  };

  const loadResponsesForForm = async (formId: string, token?: string) => {
    setIsLoadingResponses(true);
    try {
      const tok = token || (await getAccessToken());
      if (!tok) return;
      const resps = await getGoogleFormResponses(formId, tok);
      setFormResponses(resps);
    } catch (err: any) {
      console.error("Error fetching responses:", err);
      onTriggerToast("Failed to fetch Google Form responses", "error");
    } finally {
      setIsLoadingResponses(false);
    }
  };

  const handleExecuteCreateForm = async () => {
    setShowConfirmCreateDialog(false);
    setIsCreating(true);
    try {
      const tok = await getAccessToken();
      if (!tok) {
        onTriggerToast("Please authenticate with Google first.", "error");
        return;
      }
      const newForm = await createHeapLeachInspectionForm(tok, customTitle);
      onTriggerToast(`Created Google Form: "${newForm.info.title}"`, "success");
      
      // Reload forms
      await loadForms(tok);
      setSelectedFormId(newForm.formId);
      setSelectedFormDetails(newForm);
      setActiveTab("forms");
    } catch (err: any) {
      console.error("Failed to create Google Form:", err);
      onTriggerToast(`Failed to create form: ${err.message}`, "error");
    } finally {
      setIsCreating(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    onTriggerToast(`${label} copied to clipboard!`, "info");
  };

  // Helper to import values from response to active shift
  const handleImportResponse = (resp: GoogleFormResponse) => {
    if (!onImportShiftFromForm) return;

    let opName = "";
    let empNum = "";
    let notes = `Imported from Google Form Response ID: ${resp.responseId.slice(0, 8)} (${new Date(resp.lastSubmittedTime).toLocaleString()})\n`;
    let rafLvl: number | undefined;
    let ilsLvl: number | undefined;
    let crasherLvl: number | undefined;
    let mainFlow: number | undefined;
    let cuGrd: number | undefined;
    let acidLvl: number | undefined;

    if (resp.answers && selectedFormDetails?.items) {
      const questionMap: Record<string, string> = {};
      selectedFormDetails.items.forEach(item => {
        if (item.questionItem?.question.questionId) {
          questionMap[item.questionItem.question.questionId] = item.title;
        }
      });

      Object.entries(resp.answers).forEach(([qId, ansObj]) => {
        const title = (questionMap[qId] || "").toLowerCase();
        const firstVal = ansObj.textAnswers?.answers?.[0]?.value || "";

        if (title.includes("name") || title.includes("operator")) {
          opName = firstVal;
        } else if (title.includes("badge") || title.includes("employment")) {
          empNum = firstVal;
        } else if (title.includes("raf")) {
          const num = parseFloat(firstVal);
          if (!isNaN(num)) rafLvl = num;
        } else if (title.includes("ils")) {
          const num = parseFloat(firstVal);
          if (!isNaN(num)) ilsLvl = num;
        } else if (title.includes("crasher")) {
          const num = parseFloat(firstVal);
          if (!isNaN(num)) crasherLvl = num;
        } else if (title.includes("flow") || title.includes("pls header")) {
          const num = parseFloat(firstVal);
          if (!isNaN(num)) mainFlow = num;
        } else if (title.includes("copper") || title.includes("cu grade")) {
          const num = parseFloat(firstVal);
          if (!isNaN(num)) cuGrd = num;
        } else if (title.includes("acid")) {
          const num = parseFloat(firstVal);
          if (!isNaN(num)) acidLvl = num;
        } else if (firstVal) {
          notes += `• ${questionMap[qId] || "Item"}: ${firstVal}\n`;
        }
      });
    }

    onImportShiftFromForm({
      operatorName: opName,
      employmentNumber: empNum,
      notes: notes.trim(),
      rafLevel: rafLvl,
      ilsLevel: ilsLvl,
      crasherLevel: crasherLvl,
      mainLineFlow: mainFlow,
      cuGrade: cuGrd,
      acidLevel: acidLvl,
    });

    onTriggerToast("Imported Google Form telemetry data into active shift log!", "success");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-slate-900 border border-slate-750 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-slate-850 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <FileCheck size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-100">Google Forms Integration</h2>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  Workspace Live
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Dispatch inspection forms to mobile operators &amp; import field shift telemetry
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 flex items-center justify-center transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Auth Check Warning or Connect Banner */}
        {!hasToken && (
          <div className="px-6 py-3 bg-amber-500/10 border-b border-amber-500/20 flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-300 text-xs">
              <AlertCircle size={16} />
              <span>Google Account authorization required to read or create Google Forms.</span>
            </div>
            <button
              onClick={handleSignIn}
              disabled={isAuthChecking}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-450 text-slate-950 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-md active:scale-95 disabled:opacity-50"
            >
              {isAuthChecking ? <RefreshCw size={14} className="animate-spin" /> : <User size={14} />}
              <span>Sign in with Google</span>
            </button>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="px-6 pt-3 bg-slate-850/60 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("forms")}
              className={`px-3.5 py-2 text-xs font-semibold rounded-t-lg transition-all border-b-2 flex items-center gap-2 ${
                activeTab === "forms"
                  ? "border-purple-400 text-purple-300 bg-slate-800/80 font-bold"
                  : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
              }`}
            >
              <Layers size={14} />
              <span>Plant Forms ({formsList.length})</span>
            </button>

            <button
              onClick={() => setActiveTab("create")}
              className={`px-3.5 py-2 text-xs font-semibold rounded-t-lg transition-all border-b-2 flex items-center gap-2 ${
                activeTab === "create"
                  ? "border-purple-400 text-purple-300 bg-slate-800/80 font-bold"
                  : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
              }`}
            >
              <Plus size={14} />
              <span>Generate New Shift Form</span>
            </button>

            <button
              onClick={() => {
                setActiveTab("responses");
                if (selectedFormId) {
                  loadResponsesForForm(selectedFormId);
                }
              }}
              disabled={!selectedFormId}
              className={`px-3.5 py-2 text-xs font-semibold rounded-t-lg transition-all border-b-2 flex items-center gap-2 disabled:opacity-40 ${
                activeTab === "responses"
                  ? "border-purple-400 text-purple-300 bg-slate-800/80 font-bold"
                  : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
              }`}
            >
              <Database size={14} />
              <span>Field Responses {formResponses.length > 0 ? `(${formResponses.length})` : ""}</span>
            </button>
          </div>

          <button
            onClick={() => loadForms()}
            disabled={isLoading || !hasToken}
            title="Refresh forms list"
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-40"
          >
            <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-900 min-h-[380px]">
          {/* TAB 1: BROWSE FORMS */}
          {activeTab === "forms" && (
            <div className="space-y-4">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                  <RefreshCw size={28} className="animate-spin text-purple-400 mb-3" />
                  <p className="text-sm font-medium">Loading Google Forms from Drive...</p>
                </div>
              ) : formsList.length === 0 ? (
                <div className="text-center py-12 px-4 border border-slate-800 border-dashed rounded-xl bg-slate-850/40">
                  <FileCheck size={36} className="text-purple-400/50 mx-auto mb-3" />
                  <h3 className="text-sm font-bold text-slate-200">No Google Forms Found</h3>
                  <p className="text-xs text-slate-400 max-w-md mx-auto mt-1 mb-4">
                    You don't have any Google Forms in your Drive yet. Generate a pre-configured Heap Leach Shift Inspection form to start collecting field telemetry.
                  </p>
                  <button
                    onClick={() => setActiveTab("create")}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold inline-flex items-center gap-2 transition-all shadow-md active:scale-95"
                  >
                    <Plus size={15} />
                    <span>Create Pre-configured Shift Form</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  {/* Left Column: Form list */}
                  <div className="md:col-span-1 space-y-2 max-h-[420px] overflow-y-auto pr-1">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                      Available Forms in Drive
                    </p>
                    {formsList.map((form) => {
                      const isSelected = selectedFormId === form.id;
                      return (
                        <div
                          key={form.id}
                          onClick={() => handleSelectForm(form.id)}
                          className={`p-3 rounded-xl border transition-all cursor-pointer text-left ${
                            isSelected
                              ? "bg-purple-500/10 border-purple-500/40 text-purple-100 shadow-sm"
                              : "bg-slate-850 hover:bg-slate-800 border-slate-800 text-slate-300"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="text-xs font-bold truncate leading-snug">{form.name}</h4>
                            <ChevronRight size={14} className={isSelected ? "text-purple-400 shrink-0" : "text-slate-500 shrink-0"} />
                          </div>
                          <p className="text-[10px] text-slate-400 mt-1">
                            Updated: {new Date(form.modifiedTime).toLocaleDateString()}
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  {/* Right Column: Selected Form Preview & Actions */}
                  <div className="md:col-span-2 bg-slate-850 border border-slate-800 rounded-xl p-5">
                    {selectedFormDetails ? (
                      <div className="space-y-4">
                        <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-4">
                          <div>
                            <span className="text-[9px] uppercase tracking-wider font-bold text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                              Active Form
                            </span>
                            <h3 className="text-base font-bold text-slate-100 mt-1.5">
                              {selectedFormDetails.info.title}
                            </h3>
                            {selectedFormDetails.info.description && (
                              <p className="text-xs text-slate-400 mt-1">{selectedFormDetails.info.description}</p>
                            )}
                            <p className="text-[10px] font-mono text-slate-500 mt-1">ID: {selectedFormDetails.formId}</p>
                          </div>

                          <div className="flex flex-col gap-2 shrink-0">
                            {/* Responder link */}
                            {selectedFormDetails.responderUri && (
                              <a
                                href={selectedFormDetails.responderUri}
                                target="_blank"
                                rel="noreferrer"
                                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-md active:scale-95"
                              >
                                <ExternalLink size={13} />
                                <span>Open Responder</span>
                              </a>
                            )}
                            <a
                              href={`https://docs.google.com/forms/d/${selectedFormDetails.formId}/edit`}
                              target="_blank"
                              rel="noreferrer"
                              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                            >
                              <ExternalLink size={13} />
                              <span>Edit in Forms</span>
                            </a>
                          </div>
                        </div>

                        {/* Quick links & Share bar */}
                        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs">
                          <Share2 size={14} className="text-slate-400 shrink-0" />
                          <span className="text-[11px] text-slate-400 shrink-0 font-medium">Form Link:</span>
                          <span className="font-mono text-[11px] text-purple-300 truncate flex-1">
                            {selectedFormDetails.responderUri || `https://docs.google.com/forms/d/${selectedFormDetails.formId}/viewform`}
                          </span>
                          <button
                            onClick={() => copyToClipboard(
                              selectedFormDetails.responderUri || `https://docs.google.com/forms/d/${selectedFormDetails.formId}/viewform`,
                              "Responder URL"
                            )}
                            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px] font-bold flex items-center gap-1 transition-colors"
                          >
                            <Copy size={11} />
                            <span>Copy</span>
                          </button>
                        </div>

                        {/* Form Items Preview */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                              Configured Form Fields ({selectedFormDetails.items?.length || 0})
                            </h4>
                            <button
                              onClick={() => {
                                setActiveTab("responses");
                                loadResponsesForForm(selectedFormDetails.formId);
                              }}
                              className="text-xs text-purple-400 hover:text-purple-300 font-semibold flex items-center gap-1"
                            >
                              <span>View Responses</span>
                              <ChevronRight size={13} />
                            </button>
                          </div>

                          <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                            {selectedFormDetails.items?.map((item, idx) => (
                              <div
                                key={item.itemId || idx}
                                className="p-2 rounded-lg bg-slate-900/70 border border-slate-800/80 flex items-center justify-between text-xs"
                              >
                                <span className="font-medium text-slate-200 truncate pr-2">
                                  {idx + 1}. {item.title}
                                </span>
                                <span className="text-[10px] font-mono text-slate-400 shrink-0 px-2 py-0.5 bg-slate-800 rounded">
                                  {item.questionItem?.question.textQuestion?.paragraph
                                    ? "Paragraph"
                                    : item.questionItem?.question.choiceQuestion?.type || "Text"}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-16 text-slate-400 text-xs">
                        Select a form from the left column to view questions and responses.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: GENERATE NEW SHIFT FORM */}
          {activeTab === "create" && (
            <div className="max-w-2xl mx-auto space-y-5">
              <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20">
                <h3 className="text-sm font-bold text-purple-200 flex items-center gap-2">
                  <FileCheck size={16} className="text-purple-400" />
                  Pre-configured Metallurgical Shift Inspection Form
                </h3>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  This generator creates an official Google Form in your Drive pre-loaded with standardized parameters for Leach Pad irrigation, pond levels (RAF, ILS, Crasher), main header flows, copper grade, and operator safety remarks.
                </p>
              </div>

              <div className="space-y-3">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                  Form Document Title
                </label>
                <input
                  type="text"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-850 border border-slate-750 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-purple-400 font-medium"
                  placeholder="Heap Leach Shift Handover & Inspection Form"
                />
              </div>

              {/* Pre-packaged questions preview */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Questions to be generated in Google Form
                </h4>
                <div className="p-3 bg-slate-850 rounded-xl border border-slate-800 space-y-2 text-xs text-slate-300 max-h-[220px] overflow-y-auto">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-400">1</span>
                    <span>Duty Shift Operator Full Name (Text)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-400">2</span>
                    <span>Operator Badge / Employment Number (Text)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-400">3</span>
                    <span>Shift Type (Day Shift vs. Night Shift Radio)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-400">4</span>
                    <span>Raffinate (RAF) Pond Level % (Numeric)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-400">5</span>
                    <span>Intermediate Leach Solution (ILS) Pond Level % (Numeric)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-400">6</span>
                    <span>Crasher Surge Pond Level % (Numeric)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-400">7</span>
                    <span>Main Line PLS Header Flow Rate m³/h (Numeric)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-400">8</span>
                    <span>Pregnant Leach Solution (PLS) Cu Head Grade g/L (Numeric)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-400">9</span>
                    <span>Acid Reserve Tank Storage Level % (Numeric)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-400">10</span>
                    <span>Leach Pad Field Inspection Status (Pads 1-6 checkboxes)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-400">11</span>
                    <span>Shift Handover Remarks &amp; Process Anomalies (Long Text)</span>
                  </div>
                </div>
              </div>

              {/* Action Button: triggers confirmation dialog */}
              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setActiveTab("forms")}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => setShowConfirmCreateDialog(true)}
                  disabled={isCreating || !hasToken}
                  className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-lg active:scale-95 disabled:opacity-50"
                >
                  {isCreating ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Creating Form in Drive...</span>
                    </>
                  ) : (
                    <>
                      <Plus size={15} />
                      <span>Create Form in Google Forms</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: RESPONSES */}
          {activeTab === "responses" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-100">
                    Field Submissions: {selectedFormDetails?.info.title || "Selected Form"}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Import live responses submitted by field technicians directly into the active telemetry dashboard.
                  </p>
                </div>
                <button
                  onClick={() => selectedFormId && loadResponsesForForm(selectedFormId)}
                  disabled={isLoadingResponses}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <RefreshCw size={13} className={isLoadingResponses ? "animate-spin" : ""} />
                  <span>Refresh Responses</span>
                </button>
              </div>

              {isLoadingResponses ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                  <RefreshCw size={24} className="animate-spin text-purple-400 mb-2" />
                  <p className="text-xs">Fetching submissions from Google Forms API...</p>
                </div>
              ) : formResponses.length === 0 ? (
                <div className="text-center py-12 px-4 border border-slate-800 border-dashed rounded-xl bg-slate-850/40">
                  <Clock size={32} className="text-slate-500 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-300">No responses recorded yet</p>
                  <p className="text-xs text-slate-500 mt-1 mb-4">
                    Send the form link to operators in the field or submit a test response.
                  </p>
                  {selectedFormDetails?.responderUri && (
                    <a
                      href={selectedFormDetails.responderUri}
                      target="_blank"
                      rel="noreferrer"
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition-all shadow-md active:scale-95"
                    >
                      <ExternalLink size={13} />
                      <span>Open Form to Submit Field Telemetry</span>
                    </a>
                  )}
                </div>
              ) : (
                <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                  {formResponses.map((resp, idx) => (
                    <div
                      key={resp.responseId}
                      className="p-4 rounded-xl bg-slate-850 border border-slate-800 hover:border-slate-700 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-200">
                            Submission #{formResponses.length - idx}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400 px-2 py-0.5 rounded bg-slate-800">
                            {new Date(resp.lastSubmittedTime).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 font-mono">
                          Response ID: {resp.responseId}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleImportResponse(resp)}
                          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-md active:scale-95"
                        >
                          <Download size={13} />
                          <span>Import to Dashboard</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-850 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
            <span>Google Forms API v1 &bull; Least-Privilege OAuth Scopes</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      {/* MANDATORY USER CONFIRMATION MODAL BEFORE CREATING FORM IN GOOGLE DRIVE */}
      {showConfirmCreateDialog && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
          <div 
            className="bg-slate-900 border border-purple-500/40 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/40 flex items-center justify-center shrink-0">
                <FileCheck size={22} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-100">Create New Google Form?</h3>
                <p className="text-xs text-slate-400">Google Drive &amp; Forms authorization</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              This will create a new Google Form named <strong className="text-purple-300 font-semibold">"{customTitle}"</strong> in your Google Drive with 11 standardized metallurgical questions.
            </p>

            <div className="p-3 bg-slate-850 rounded-xl border border-slate-800 text-[11px] text-slate-400 space-y-1">
              <div>&bull; Action: <strong className="text-slate-200">Create Google Form</strong></div>
              <div>&bull; Destination: <strong className="text-slate-200">User's Google Drive Root</strong></div>
              <div>&bull; Permission: <strong className="text-slate-200">Granted by user session</strong></div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmCreateDialog(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteCreateForm}
                className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95"
              >
                Yes, Create Form
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
