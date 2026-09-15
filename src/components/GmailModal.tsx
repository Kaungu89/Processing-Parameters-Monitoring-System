import React, { useState, useEffect } from "react";
import {
  Mail,
  Send,
  FileText,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Search,
  Trash2,
  X,
  ExternalLink,
  ShieldCheck,
  User as UserIcon,
  LogOut,
  ChevronRight,
  Sparkles,
  Inbox,
  Clock,
  Eye,
  FileEdit,
  ArrowRight
} from "lucide-react";
import { User } from "firebase/auth";
import {
  googleSignIn,
  logout,
  getAccessToken,
  getCurrentUser,
  initAuth
} from "../services/googleAuthService";
import {
  listGmailMessages,
  getGmailMessageDetails,
  sendGmailMessage,
  createGmailDraft,
  trashGmailMessage,
  generateShiftHandoverHtml,
  GmailMessageHeader,
  GmailMessageDetail
} from "../services/gmailService";
import { ShiftTelemetryData, ValidationError, ExtraProcessTelemetry, LeachPadNode, PondTelemetry } from "../types";

interface GmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  shiftData: ShiftTelemetryData;
  activeWarnings?: ValidationError[];
  extraTelemetry?: ExtraProcessTelemetry;
  plsCopperGrade?: number;
  sxRecoveryRate?: number;
  aiHandoverSummary?: string;
  onTriggerToast: (msg: string, type: "success" | "error" | "info") => void;
  initialTab?: "handover" | "inbox" | "compose";
}

export default function GmailModal({
  isOpen,
  onClose,
  shiftData,
  activeWarnings = [],
  extraTelemetry,
  plsCopperGrade = 3.8,
  sxRecoveryRate = 94.5,
  aiHandoverSummary,
  onTriggerToast,
  initialTab = "handover"
}: GmailModalProps) {
  const [activeTab, setActiveTab] = useState<"handover" | "inbox" | "compose">(initialTab);
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);

  // Handover email state
  const [recipient, setRecipient] = useState("superintendent@mimbulaminerals.com");
  const [ccRecipient, setCcRecipient] = useState("kaungu89@gmail.com");
  const [customRecipient, setCustomRecipient] = useState("");
  const [subject, setSubject] = useState(
    `[Shift Handover] Mimbula Minerals Heap Leach & SX-EW - ${shiftData.id || "Active"} (${shiftData.date} ${shiftData.time})`
  );
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [previewMode, setPreviewMode] = useState(false);

  // Compose custom email state
  const [composeTo, setComposeTo] = useState("");
  const [composeCc, setComposeCc] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");

  // Inbox state
  const [messages, setMessages] = useState<GmailMessageHeader[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [searchQuery, setSearchQuery] = useState("in:inbox");
  const [selectedMessage, setSelectedMessage] = useState<GmailMessageDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // Actions loading
  const [isSending, setIsSending] = useState(false);
  const [isDrafting, setIsDrafting] = useState(false);

  // MANDATORY User Confirmation Dialog State
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    detailsList?: string[];
    confirmAction: () => Promise<void>;
    actionBtnText: string;
    isDestructive?: boolean;
  }>({
    isOpen: false,
    title: "",
    description: "",
    confirmAction: async () => {},
    actionBtnText: "Confirm"
  });

  // Check auth on load
  useEffect(() => {
    const unsubscribe = initAuth(
      (currentUser, token) => {
        setUser(currentUser);
        setAccessToken(token);
      },
      () => {
        setUser(getCurrentUser());
      }
    );

    getAccessToken().then((token) => {
      if (token) setAccessToken(token);
    });

    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setSubject(
        `[Shift Handover] Mimbula Minerals Heap Leach & SX-EW - ${shiftData.id || "Active"} (${shiftData.date} ${shiftData.time})`
      );
    }
  }, [isOpen, initialTab, shiftData]);

  // Load messages when tab is inbox and we have a token
  useEffect(() => {
    if (isOpen && activeTab === "inbox" && accessToken) {
      loadMessages();
    }
  }, [isOpen, activeTab, accessToken]);

  const handleSignIn = async () => {
    setIsSigningIn(true);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setAccessToken(result.accessToken);
        onTriggerToast(`Connected to Gmail as ${result.user.email}`, "success");
      }
    } catch (err: any) {
      console.error("Sign in failed:", err);
      onTriggerToast(err.message || "Failed to sign in with Google", "error");
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await logout();
      setUser(null);
      setAccessToken(null);
      setMessages([]);
      setSelectedMessage(null);
      onTriggerToast("Signed out of Google account", "info");
    } catch (err: any) {
      onTriggerToast("Failed to sign out", "error");
    }
  };

  const loadMessages = async () => {
    if (!accessToken) return;
    setIsLoadingMessages(true);
    try {
      const list = await listGmailMessages(accessToken, searchQuery);
      setMessages(list);
    } catch (err: any) {
      console.error("Error loading Gmail messages:", err);
      onTriggerToast(err.message || "Could not load Gmail messages", "error");
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const handleOpenMessage = async (msgId: string) => {
    if (!accessToken) return;
    setIsLoadingDetail(true);
    try {
      const detail = await getGmailMessageDetails(accessToken, msgId);
      setSelectedMessage(detail);
    } catch (err: any) {
      console.error("Error fetching message details:", err);
      onTriggerToast(err.message || "Could not fetch message contents", "error");
    } finally {
      setIsLoadingDetail(false);
    }
  };

  // Get effective recipient
  const targetRecipient = recipient === "custom" ? customRecipient : recipient;

  // Generate current handover HTML
  const handoverHtml = generateShiftHandoverHtml({
    shiftData: {
      ...shiftData,
      notes: additionalNotes
        ? `${shiftData.notes || ""}\n\n[Operator Handover Note]: ${additionalNotes}`
        : shiftData.notes
    },
    activeWarnings,
    extraTelemetry: extraTelemetry || shiftData.extraTelemetry,
    plsCopperGrade,
    sxRecoveryRate,
    aiHandoverSummary
  });

  // Prompt confirmation for Sending Handover Email
  const promptSendHandoverEmail = () => {
    if (!accessToken) {
      onTriggerToast("Please sign in with Google first to send via Gmail", "info");
      return;
    }
    if (!targetRecipient || !targetRecipient.includes("@")) {
      onTriggerToast("Please enter a valid recipient email address", "error");
      return;
    }

    setConfirmDialog({
      isOpen: true,
      title: "Confirm Dispatching Shift Handover via Gmail",
      description:
        "You are about to send an official Shift Handover report from your authenticated Gmail account. This message will be permanently logged in your sent messages and delivered to the recipient.",
      detailsList: [
        `Recipient: ${targetRecipient}`,
        ccRecipient ? `CC: ${ccRecipient}` : "No CC",
        `Subject: ${subject}`,
        `Active Loops: ${(shiftData.pads || []).filter((p) => p.status === "Active").length} pads`,
        `Process Warnings: ${activeWarnings.length} flagged deviations`
      ],
      actionBtnText: "Confirm & Send Email",
      isDestructive: false,
      confirmAction: async () => {
        setIsSending(true);
        try {
          await sendGmailMessage(accessToken, {
            to: targetRecipient,
            cc: ccRecipient,
            subject,
            bodyHtml: handoverHtml
          });
          onTriggerToast("Shift Handover Report successfully sent via Gmail!", "success");
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        } catch (err: any) {
          console.error("Send email error:", err);
          onTriggerToast(err.message || "Failed to send email via Gmail", "error");
        } finally {
          setIsSending(false);
        }
      }
    });
  };

  // Save Handover as Gmail Draft
  const handleSaveHandoverDraft = async () => {
    if (!accessToken) {
      onTriggerToast("Please sign in with Google first", "info");
      return;
    }
    setIsDrafting(true);
    try {
      await createGmailDraft(accessToken, {
        to: targetRecipient,
        cc: ccRecipient,
        subject: `[DRAFT] ${subject}`,
        bodyHtml: handoverHtml
      });
      onTriggerToast("Saved Shift Handover as a Gmail Draft! Check your Gmail drafts.", "success");
    } catch (err: any) {
      console.error("Draft error:", err);
      onTriggerToast(err.message || "Failed to save draft", "error");
    } finally {
      setIsDrafting(false);
    }
  };

  // Prompt confirmation for Sending Custom Composed Email
  const promptSendCustomEmail = () => {
    if (!accessToken) {
      onTriggerToast("Please sign in with Google first", "info");
      return;
    }
    if (!composeTo || !composeTo.includes("@")) {
      onTriggerToast("Please enter a valid recipient email", "error");
      return;
    }
    if (!composeSubject.trim()) {
      onTriggerToast("Please enter an email subject", "error");
      return;
    }

    setConfirmDialog({
      isOpen: true,
      title: "Confirm Sending Email",
      description: "Are you sure you want to send this email from your connected Gmail address?",
      detailsList: [
        `To: ${composeTo}`,
        composeCc ? `CC: ${composeCc}` : "No CC",
        `Subject: ${composeSubject}`
      ],
      actionBtnText: "Send Message Now",
      confirmAction: async () => {
        setIsSending(true);
        try {
          const formattedBody = `<div style="font-family: sans-serif; font-size: 14px; line-height: 1.6; color: #1e293b;">${composeBody
            .replace(/\n/g, "<br/>")}</div>`;

          await sendGmailMessage(accessToken, {
            to: composeTo,
            cc: composeCc,
            subject: composeSubject,
            bodyHtml: formattedBody
          });
          onTriggerToast("Email successfully sent via Gmail!", "success");
          setComposeTo("");
          setComposeCc("");
          setComposeSubject("");
          setComposeBody("");
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        } catch (err: any) {
          console.error("Send custom email error:", err);
          onTriggerToast(err.message || "Failed to send email", "error");
        } finally {
          setIsSending(false);
        }
      }
    });
  };

  // Prompt confirmation for Trashing an Email (Destructive Operation)
  const promptTrashMessage = (msgId: string, subjectTitle: string) => {
    if (!accessToken) return;

    setConfirmDialog({
      isOpen: true,
      title: "Confirm Deleting Email",
      description: "Are you sure you want to move this message to Trash in your Gmail account?",
      detailsList: [`Subject: ${subjectTitle}`],
      actionBtnText: "Move to Trash",
      isDestructive: true,
      confirmAction: async () => {
        try {
          await trashGmailMessage(accessToken, msgId);
          onTriggerToast("Message moved to Gmail Trash", "success");
          setSelectedMessage(null);
          loadMessages();
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        } catch (err: any) {
          console.error("Trash error:", err);
          onTriggerToast(err.message || "Failed to trash message", "error");
        }
      }
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-950/90 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 shadow-xs">
              <Mail size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-wide">
                  Gmail Shift Communications & Dispatch
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/10 text-red-300 border border-red-500/20">
                  Google Workspace
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Send verified shift handover digests, plant anomaly alerts, and inspect operations mail
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Auth Bar */}
        <div className="px-5 py-2.5 bg-slate-900/90 border-b border-slate-800/60 flex flex-wrap items-center justify-between gap-3 text-xs">
          {user && accessToken ? (
            <div className="flex items-center gap-3">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || "User"}
                  className="w-7 h-7 rounded-full border border-teal-500/40"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center text-teal-400 border border-slate-700">
                  <UserIcon size={14} />
                </div>
              )}
              <div>
                <span className="font-semibold text-slate-200">
                  {user.displayName || user.email?.split("@")[0] || "Operator"}
                </span>
                <span className="text-slate-400 ml-1.5 font-mono">({user.email})</span>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-medium flex items-center gap-1">
                <CheckCircle2 size={10} /> Authenticated
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-slate-400">
              <ShieldCheck size={14} className="text-amber-400" />
              <span>Connect your Google account to send emails and review plant messages directly</span>
            </div>
          )}

          <div>
            {user && accessToken ? (
              <button
                type="button"
                onClick={handleSignOut}
                className="px-2.5 py-1 text-slate-400 hover:text-rose-300 hover:bg-slate-800 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <LogOut size={12} />
                Sign Out
              </button>
            ) : (
              /* Official styled Sign in with Google button */
              <button
                type="button"
                onClick={handleSignIn}
                disabled={isSigningIn}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white text-slate-700 hover:bg-slate-50 font-semibold text-xs transition-all shadow-xs active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <svg className="w-4 h-4" viewBox="0 0 48 48">
                  <path
                    fill="#EA4335"
                    d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                  />
                  <path
                    fill="#4285F4"
                    d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                  />
                  <path
                    fill="#34A853"
                    d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                  />
                </svg>
                {isSigningIn ? "Signing In..." : "Sign in with Google"}
              </button>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-5">
          <button
            type="button"
            onClick={() => setActiveTab("handover")}
            className={`px-4 py-3 text-xs font-semibold border-b-2 flex items-center gap-2 cursor-pointer transition-colors ${
              activeTab === "handover"
                ? "border-teal-500 text-teal-400 bg-teal-500/5"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Send size={14} />
            Dispatch Handover Report
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("inbox")}
            className={`px-4 py-3 text-xs font-semibold border-b-2 flex items-center gap-2 cursor-pointer transition-colors ${
              activeTab === "inbox"
                ? "border-teal-500 text-teal-400 bg-teal-500/5"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Inbox size={14} />
            Plant Shift Inbox
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("compose")}
            className={`px-4 py-3 text-xs font-semibold border-b-2 flex items-center gap-2 cursor-pointer transition-colors ${
              activeTab === "compose"
                ? "border-teal-500 text-teal-400 bg-teal-500/5"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <FileEdit size={14} />
            Compose Message
          </button>
        </div>

        {/* Main Content Area */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          {/* TAB 1: DISPATCH HANDOVER REPORT */}
          {activeTab === "handover" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Form Controls */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Recipient / Target Group
                    </label>
                    <select
                      value={recipient}
                      onChange={(e) => setRecipient(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-white focus:outline-hidden focus:border-teal-500"
                    >
                      <option value="superintendent@mimbulaminerals.com">
                        Plant Superintendent (superintendent@mimbulaminerals.com)
                      </option>
                      <option value="supervisor@mimbulaminerals.com">
                        Incoming Shift Supervisor (supervisor@mimbulaminerals.com)
                      </option>
                      <option value="metallurgy@mimbulaminerals.com">
                        Metallurgical Department (metallurgy@mimbulaminerals.com)
                      </option>
                      <option value="kaungu89@gmail.com">Duty Operator (kaungu89@gmail.com)</option>
                      <option value="custom">Custom Recipient...</option>
                    </select>
                  </div>

                  {recipient === "custom" && (
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Enter Custom Email Address
                      </label>
                      <input
                        type="email"
                        value={customRecipient}
                        onChange={(e) => setCustomRecipient(e.target.value)}
                        placeholder="e.g. manager@miningcorp.com"
                        className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-white focus:outline-hidden focus:border-teal-500"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Carbon Copy (CC)
                    </label>
                    <input
                      type="text"
                      value={ccRecipient}
                      onChange={(e) => setCcRecipient(e.target.value)}
                      placeholder="kaungu89@gmail.com"
                      className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-white focus:outline-hidden focus:border-teal-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Subject</label>
                    <input
                      type="text"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-white focus:outline-hidden focus:border-teal-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Additional Shift Memos & Dispatch Directives (Optional)
                    </label>
                    <textarea
                      rows={3}
                      value={additionalNotes}
                      onChange={(e) => setAdditionalNotes(e.target.value)}
                      placeholder="Add any specific instructions for incoming shift supervisor (e.g., maintain LP6 valve adjustment)..."
                      className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-white focus:outline-hidden focus:border-teal-500 resize-none"
                    />
                  </div>
                </div>

                {/* Live Shift Summary Card */}
                <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                        Telemetry Digest Preview
                      </span>
                      <button
                        type="button"
                        onClick={() => setPreviewMode(!previewMode)}
                        className="text-[11px] text-teal-400 hover:text-teal-300 flex items-center gap-1 cursor-pointer"
                      >
                        <Eye size={12} />
                        {previewMode ? "Hide HTML Code" : "Full View"}
                      </button>
                    </div>

                    <div className="space-y-2.5 text-xs">
                      <div className="flex justify-between py-1.5 border-b border-slate-800/80">
                        <span className="text-slate-400">Shift Cycle:</span>
                        <span className="font-semibold text-slate-200">
                          {shiftData.id || "CURRENT"} ({shiftData.date})
                        </span>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-slate-800/80">
                        <span className="text-slate-400">Duty Operator:</span>
                        <span className="font-semibold text-slate-200">
                          {shiftData.operatorName || "Miguel Kaungu"} ({shiftData.employmentNumber})
                        </span>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-slate-800/80">
                        <span className="text-slate-400">Active Irrigator Loops:</span>
                        <span className="font-semibold text-teal-400">
                          {(shiftData.pads || []).filter((p) => p.status === "Active").length} Active
                        </span>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-slate-800/80">
                        <span className="text-slate-400">Copper Output Estimate:</span>
                        <span className="font-semibold text-amber-400">
                          {(
                            ((extraTelemetry?.plsFlowToSx ?? 602) *
                              plsCopperGrade *
                              24 *
                              (sxRecoveryRate / 100)) /
                            1000
                          ).toFixed(2)}{" "}
                          MT / Day
                        </span>
                      </div>
                      <div className="flex justify-between py-1.5">
                        <span className="text-slate-400">Active Warnings:</span>
                        <span
                          className={`font-semibold ${
                            activeWarnings.length > 0 ? "text-rose-400" : "text-emerald-400"
                          }`}
                        >
                          {activeWarnings.length === 0
                            ? "0 (Nominal)"
                            : `${activeWarnings.length} Flagged`}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                    <span>Generated in compliant HTML email format</span>
                    <span className="text-emerald-400">Ready to Send</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={handleSaveHandoverDraft}
                  disabled={isDrafting || !accessToken}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                  title="Create a draft in your Gmail account without sending"
                >
                  <FileText size={13} />
                  {isDrafting ? "Saving Draft..." : "Save as Gmail Draft"}
                </button>

                <button
                  type="button"
                  onClick={promptSendHandoverEmail}
                  disabled={isSending || !accessToken}
                  className="px-5 py-2 bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-md hover:shadow-teal-500/20 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  <Send size={13} />
                  {isSending ? "Dispatching..." : "Send Handover Report via Gmail"}
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: INBOX & MESSAGES */}
          {activeTab === "inbox" && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <Search
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && loadMessages()}
                    placeholder="Search query (e.g. in:inbox, handover, telemetry, alert)..."
                    className="w-full pl-9 pr-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-white focus:outline-hidden focus:border-teal-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={loadMessages}
                  disabled={isLoadingMessages || !accessToken}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw size={13} className={isLoadingMessages ? "animate-spin" : ""} />
                  Refresh
                </button>
              </div>

              {selectedMessage ? (
                /* Message Detail View */
                <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3">
                    <div>
                      <button
                        type="button"
                        onClick={() => setSelectedMessage(null)}
                        className="text-xs text-teal-400 hover:text-teal-300 mb-1 flex items-center gap-1 cursor-pointer font-medium"
                      >
                        ← Back to Message List
                      </button>
                      <h3 className="text-sm font-bold text-white">{selectedMessage.subject}</h3>
                      <div className="text-xs text-slate-400 mt-1 flex flex-wrap items-center gap-3">
                        <span>
                          <strong>From:</strong> {selectedMessage.from}
                        </span>
                        <span>
                          <strong>Date:</strong> {selectedMessage.date}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        promptTrashMessage(selectedMessage.id, selectedMessage.subject)
                      }
                      className="px-2.5 py-1 text-xs text-rose-400 hover:bg-rose-500/10 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Trash2 size={13} />
                      Trash
                    </button>
                  </div>

                  {/* Message Body */}
                  <div
                    className="p-4 bg-white text-slate-900 rounded-lg overflow-x-auto text-xs max-h-96"
                    dangerouslySetInnerHTML={{ __html: selectedMessage.bodyHtml }}
                  />
                </div>
              ) : (
                /* Message List View */
                <div className="space-y-2">
                  {!accessToken ? (
                    <div className="p-8 text-center bg-slate-950/40 border border-slate-800 rounded-xl text-slate-400 text-xs">
                      Please sign in with your Google account above to load your Gmail messages.
                    </div>
                  ) : isLoadingMessages ? (
                    <div className="p-8 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
                      <RefreshCw size={14} className="animate-spin text-teal-400" />
                      Loading messages from Gmail...
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="p-8 text-center bg-slate-950/40 border border-slate-800 rounded-xl text-slate-400 text-xs">
                      No messages found matching "{searchQuery}".
                    </div>
                  ) : (
                    messages.map((msg) => (
                      <div
                        key={msg.id}
                        onClick={() => handleOpenMessage(msg.id)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                          msg.isUnread
                            ? "bg-slate-850 border-teal-500/30 hover:border-teal-500/60"
                            : "bg-slate-900/60 border-slate-800/80 hover:border-slate-700"
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            {msg.isUnread && (
                              <span className="w-2 h-2 rounded-full bg-teal-400 flex-shrink-0" />
                            )}
                            <span className="text-xs font-semibold text-white truncate max-w-xs">
                              {msg.from.split("<")[0].replace(/"/g, "")}
                            </span>
                            <span className="text-[10px] text-slate-400 ml-auto flex-shrink-0">
                              {msg.date.split(" ").slice(0, 4).join(" ")}
                            </span>
                          </div>
                          <p className="text-xs text-slate-300 font-medium truncate">
                            {msg.subject}
                          </p>
                          <p className="text-[11px] text-slate-500 truncate mt-0.5">
                            {msg.snippet}
                          </p>
                        </div>
                        <ChevronRight size={16} className="text-slate-600 flex-shrink-0" />
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: CUSTOM COMPOSE */}
          {activeTab === "compose" && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Recipient (To)
                </label>
                <input
                  type="email"
                  value={composeTo}
                  onChange={(e) => setComposeTo(e.target.value)}
                  placeholder="recipient@mimbulaminerals.com"
                  className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-white focus:outline-hidden focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">CC (Optional)</label>
                <input
                  type="text"
                  value={composeCc}
                  onChange={(e) => setComposeCc(e.target.value)}
                  placeholder="cc@example.com"
                  className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-white focus:outline-hidden focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Subject</label>
                <input
                  type="text"
                  value={composeSubject}
                  onChange={(e) => setComposeSubject(e.target.value)}
                  placeholder="e.g. Urgent Notice: Acid Tank #1 Refill Required"
                  className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-white focus:outline-hidden focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Message Content
                </label>
                <textarea
                  rows={6}
                  value={composeBody}
                  onChange={(e) => setComposeBody(e.target.value)}
                  placeholder="Write your email memo here..."
                  className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-white focus:outline-hidden focus:border-teal-500 resize-none font-sans"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={promptSendCustomEmail}
                  disabled={isSending || !accessToken}
                  className="px-5 py-2 bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-md hover:shadow-teal-500/20 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  <Send size={13} />
                  {isSending ? "Sending..." : "Send Email via Gmail"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MANDATORY USER CONFIRMATION DIALOG FOR MUTATING / SENDING WORKSPACE ACTIONS */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  confirmDialog.isDestructive
                    ? "bg-rose-500/10 border border-rose-500/20 text-rose-400"
                    : "bg-teal-500/10 border border-teal-500/20 text-teal-400"
                }`}
              >
                {confirmDialog.isDestructive ? <AlertTriangle size={20} /> : <Mail size={20} />}
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">{confirmDialog.title}</h3>
                <span className="text-[11px] text-slate-400">Explicit User Authorization</span>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">{confirmDialog.description}</p>

            {confirmDialog.detailsList && confirmDialog.detailsList.length > 0 && (
              <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl space-y-1.5 text-xs text-slate-300 font-mono">
                {confirmDialog.detailsList.map((item, idx) => (
                  <div key={idx} className="truncate">
                    • {item}
                  </div>
                ))}
              </div>
            )}

            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
                className="px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDialog.confirmAction}
                className={`px-4 py-1.5 text-xs font-bold text-white rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer ${
                  confirmDialog.isDestructive
                    ? "bg-rose-600 hover:bg-rose-500"
                    : "bg-teal-600 hover:bg-teal-500"
                }`}
              >
                {confirmDialog.actionBtnText}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
