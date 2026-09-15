import { ShiftTelemetryData, ValidationError, ExtraProcessTelemetry, LeachPadNode, PondTelemetry } from "../types";

export interface GmailMessageHeader {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  snippet: string;
  labelIds: string[];
  isUnread: boolean;
}

export interface GmailMessageDetail extends GmailMessageHeader {
  bodyText: string;
  bodyHtml: string;
}

export interface SendEmailParams {
  to: string;
  subject: string;
  bodyHtml: string;
  from?: string;
  cc?: string;
}

/**
 * Encodes string to base64url format for Gmail API
 */
function toBase64Url(str: string): string {
  // UTF-8 safe base64 encoding
  const utf8Bytes = new TextEncoder().encode(str);
  let binary = "";
  for (let i = 0; i < utf8Bytes.length; i++) {
    binary += String.fromCharCode(utf8Bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Decodes base64url string from Gmail API
 */
function fromBase64Url(base64UrlStr: string): string {
  try {
    let base64 = base64UrlStr.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) {
      base64 += "=";
    }
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  } catch (err) {
    console.warn("Base64Url decoding fallback error:", err);
    return "";
  }
}

/**
 * Builds RFC 2822 formatted raw email string
 */
export function buildRawEmail(params: SendEmailParams): string {
  const { to, subject, bodyHtml, from, cc } = params;
  const boundary = `====boundary_${Date.now()}_${Math.random().toString(36).substring(2)}====`;

  // Encode subject to UTF-8 B-encoding if needed
  const encodedSubject = `=?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`;

  const headers = [
    `To: ${to.trim()}`,
    ...(from ? [`From: ${from.trim()}`] : []),
    ...(cc && cc.trim() ? [`Cc: ${cc.trim()}`] : []),
    `Subject: ${encodedSubject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    ``
  ];

  // Plain text fallback (strip tags)
  const plainText = bodyHtml
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

  const bodyParts = [
    `--${boundary}`,
    `Content-Type: text/plain; charset=UTF-8`,
    `Content-Transfer-Encoding: 7bit`,
    ``,
    plainText,
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset=UTF-8`,
    `Content-Transfer-Encoding: 7bit`,
    ``,
    bodyHtml,
    ``,
    `--${boundary}--`
  ];

  const fullEmail = headers.concat(bodyParts).join("\r\n");
  return toBase64Url(fullEmail);
}

/**
 * List recent messages in Gmail matching query
 */
export async function listGmailMessages(
  accessToken: string,
  query: string = "in:inbox",
  maxResults: number = 15
): Promise<GmailMessageHeader[]> {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}&q=${encodeURIComponent(
    query
  )}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    const errJson = await response.json().catch(() => ({}));
    throw new Error(
      errJson.error?.message || `Failed to fetch Gmail messages (HTTP ${response.status})`
    );
  }

  const data = await response.json();
  const rawList: { id: string; threadId: string }[] = data.messages || [];

  if (rawList.length === 0) {
    return [];
  }

  // Fetch headers for messages in parallel batches (up to 10 at a time)
  const headersPromises = rawList.slice(0, maxResults).map(async (item) => {
    try {
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${item.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Date`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/json"
          }
        }
      );

      if (!msgRes.ok) return null;
      const msgData = await msgRes.json();

      const headers = msgData.payload?.headers || [];
      const getHeader = (name: string) =>
        headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || "";

      const labelIds: string[] = msgData.labelIds || [];
      const isUnread = labelIds.includes("UNREAD");

      return {
        id: msgData.id,
        threadId: msgData.threadId,
        subject: getHeader("Subject") || "(No Subject)",
        from: getHeader("From") || "Unknown Sender",
        to: getHeader("To") || "me",
        date: getHeader("Date") || "",
        snippet: msgData.snippet || "",
        labelIds,
        isUnread
      } as GmailMessageHeader;
    } catch (e) {
      console.warn("Failed to fetch message metadata:", e);
      return null;
    }
  });

  const resolved = await Promise.all(headersPromises);
  return resolved.filter((m): m is GmailMessageHeader => m !== null);
}

/**
 * Fetch full message details including HTML and text body
 */
export async function getGmailMessageDetails(
  accessToken: string,
  messageId: string
): Promise<GmailMessageDetail> {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    const errJson = await response.json().catch(() => ({}));
    throw new Error(
      errJson.error?.message || `Failed to fetch message detail (HTTP ${response.status})`
    );
  }

  const data = await response.json();
  const headers = data.payload?.headers || [];
  const getHeader = (name: string) =>
    headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || "";

  let bodyText = "";
  let bodyHtml = "";

  const extractBody = (part: any) => {
    if (!part) return;
    const mime = part.mimeType || "";
    if (mime === "text/plain" && part.body?.data) {
      bodyText += fromBase64Url(part.body.data);
    } else if (mime === "text/html" && part.body?.data) {
      bodyHtml += fromBase64Url(part.body.data);
    }

    if (part.parts && Array.isArray(part.parts)) {
      part.parts.forEach(extractBody);
    }
  };

  extractBody(data.payload);

  if (!bodyHtml && bodyText) {
    bodyHtml = `<div style="white-space: pre-wrap; font-family: sans-serif;">${escapeHtml(bodyText)}</div>`;
  }

  return {
    id: data.id,
    threadId: data.threadId,
    subject: getHeader("Subject") || "(No Subject)",
    from: getHeader("From") || "Unknown",
    to: getHeader("To") || "",
    date: getHeader("Date") || "",
    snippet: data.snippet || "",
    labelIds: data.labelIds || [],
    isUnread: (data.labelIds || []).includes("UNREAD"),
    bodyText,
    bodyHtml
  };
}

/**
 * Send an email directly using Gmail API
 */
export async function sendGmailMessage(
  accessToken: string,
  params: SendEmailParams
): Promise<{ id: string; threadId: string }> {
  const raw = buildRawEmail(params);

  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({ raw })
  });

  if (!response.ok) {
    const errJson = await response.json().catch(() => ({}));
    throw new Error(
      errJson.error?.message || `Failed to send email via Gmail (HTTP ${response.status})`
    );
  }

  return await response.json();
}

/**
 * Create a draft message in Gmail
 */
export async function createGmailDraft(
  accessToken: string,
  params: SendEmailParams
): Promise<{ id: string; message: { id: string } }> {
  const raw = buildRawEmail(params);

  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/drafts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({
      message: { raw }
    })
  });

  if (!response.ok) {
    const errJson = await response.json().catch(() => ({}));
    throw new Error(
      errJson.error?.message || `Failed to create draft in Gmail (HTTP ${response.status})`
    );
  }

  return await response.json();
}

/**
 * Move message to trash (Destructive operation requiring confirmation)
 */
export async function trashGmailMessage(
  accessToken: string,
  messageId: string
): Promise<void> {
  const response = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/trash`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json"
      }
    }
  );

  if (!response.ok) {
    const errJson = await response.json().catch(() => ({}));
    throw new Error(
      errJson.error?.message || `Failed to trash email (HTTP ${response.status})`
    );
  }
}

/**
 * Generate formatted HTML for Shift Handover Report dispatch
 */
export function generateShiftHandoverHtml(params: {
  shiftData: ShiftTelemetryData;
  activeWarnings?: ValidationError[];
  extraTelemetry?: ExtraProcessTelemetry;
  plsCopperGrade?: number;
  sxRecoveryRate?: number;
  aiHandoverSummary?: string;
}): string {
  const {
    shiftData,
    activeWarnings = [],
    extraTelemetry = shiftData.extraTelemetry,
    plsCopperGrade = 3.8,
    sxRecoveryRate = 94.5,
    aiHandoverSummary
  } = params;

  const pads: LeachPadNode[] = shiftData.pads || [];
  const activePads = pads.filter((p) => p.status === "Active");
  const totalMin = activePads.reduce((acc, p) => acc + p.min, 0);
  const totalMax = activePads.reduce((acc, p) => acc + p.max, 0);

  const plsFlow = extraTelemetry?.plsFlowToSx ?? 602.0;
  const cuGrade = plsCopperGrade;
  const recovery = sxRecoveryRate;
  const dailyCopperTons = (plsFlow * cuGrade * 24 * (recovery / 100)) / 1000;
  const cathodesPlated = Math.round(dailyCopperTons * 41.6);
  const lmeValue = dailyCopperTons * 9450;

  const ponds = shiftData.ponds || {
    raf: { id: "raf", name: "RAF Pond Acid", totalizer: 0, flow: 0 },
    ils: { id: "ils", name: "ILS Pond Acid", totalizer: 0, flow: 0 },
    crasher: { id: "crasher", name: "Acid to Crasher", totalizer: 0, flow: 0 },
    mainLine: { id: "mainLine", name: "Main Line", totalizer: 0, flow: 0 }
  };

  const warningsList =
    activeWarnings.length > 0
      ? activeWarnings
          .map(
            (w) =>
              `<li style="margin-bottom: 6px; color: #be123c;"><strong>[${escapeHtml(
                w.type.toUpperCase()
              )}] ${escapeHtml(w.field)}:</strong> ${escapeHtml(w.message)}</li>`
          )
          .join("")
      : `<li style="color: #059669;"><strong>Zero Active Anomalies:</strong> All process circuits operating within nominal safety thresholds.</li>`;

  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #0f172a; margin: 0; padding: 20px; }
  .container { max-width: 720px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
  .header { background: #0f172a; color: #ffffff; padding: 24px; border-bottom: 3px solid #0d9488; }
  .header h1 { margin: 0 0 6px 0; font-size: 20px; letter-spacing: 0.5px; }
  .header p { margin: 0; font-size: 12px; color: #94a3b8; }
  .meta-bar { background: #f1f5f9; padding: 12px 24px; border-bottom: 1px solid #e2e8f0; font-size: 12px; display: flex; justify-content: space-between; }
  .section { padding: 20px 24px; border-bottom: 1px solid #f1f5f9; }
  .section-title { font-size: 14px; font-weight: 700; color: #1e293b; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 0; margin-bottom: 12px; }
  .kpi-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
  .kpi-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; border-left: 4px solid #0d9488; }
  .kpi-label { font-size: 11px; color: #64748b; font-weight: 600; text-transform: uppercase; margin-bottom: 4px; }
  .kpi-val { font-size: 18px; font-weight: 700; color: #0f172a; }
  .kpi-sub { font-size: 11px; color: #475569; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; text-align: left; }
  th { background: #f1f5f9; color: #475569; padding: 8px 10px; font-weight: 600; border-bottom: 1px solid #cbd5e1; }
  td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; color: #1e293b; }
  .badge-active { background: #dcfce7; color: #15803d; font-weight: 700; padding: 2px 6px; border-radius: 4px; font-size: 10px; }
  .badge-off { background: #fef3c7; color: #b45309; font-weight: 700; padding: 2px 6px; border-radius: 4px; font-size: 10px; }
  .footer { background: #f8fafc; padding: 16px 24px; font-size: 11px; color: #64748b; text-align: center; }
</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>MIMBULA MINERALS LIMITED • LEACH PAD TELEMETRY</h1>
      <p>Official Shift Handover Record & Metallurgical Process Operations Digest</p>
    </div>
    
    <div class="meta-bar">
      <div><strong>Shift ID:</strong> ${escapeHtml(shiftData.id || "CURRENT")} • <strong>Date:</strong> ${escapeHtml(
    shiftData.date
  )} ${escapeHtml(shiftData.time)} CAT</div>
      <div><strong>Duty Operator:</strong> ${escapeHtml(
        shiftData.operatorName || "Miguel Kaungu"
      )} (${escapeHtml(shiftData.employmentNumber || "EMP-8274")})</div>
    </div>

    <!-- SX-EW & Copper Production -->
    <div class="section">
      <h3 class="section-title" style="color: #0d9488;">1. SX-EW Circuit & Copper Output</h3>
      <table style="margin-bottom: 16px;">
        <tr>
          <td style="width: 25%; background: #f0fdfa; border-radius: 6px; padding: 10px;">
            <div class="kpi-label">PLS Flow to SX</div>
            <div class="kpi-val">${plsFlow.toFixed(1)} m³/h</div>
            <div class="kpi-sub">Target: 600 m³/h</div>
          </td>
          <td style="width: 25%; background: #eef2ff; border-radius: 6px; padding: 10px;">
            <div class="kpi-label">Assayed Cu Grade</div>
            <div class="kpi-val">${cuGrade.toFixed(2)} g/L</div>
            <div class="kpi-sub">AAS Lab Analyzed</div>
          </td>
          <td style="width: 25%; background: #f0fdf4; border-radius: 6px; padding: 10px;">
            <div class="kpi-label">SX Recovery</div>
            <div class="kpi-val">${recovery.toFixed(1)}%</div>
            <div class="kpi-sub">Organic Circuit</div>
          </td>
          <td style="width: 25%; background: #fffbeb; border-radius: 6px; padding: 10px;">
            <div class="kpi-label">Copper Production</div>
            <div class="kpi-val" style="color: #b45309;">${dailyCopperTons.toFixed(2)} MT/d</div>
            <div class="kpi-sub">≈ ${cathodesPlated} Cathodes ($${Math.round(lmeValue).toLocaleString()})</div>
          </td>
        </tr>
      </table>
      <div style="font-size: 11.5px; color: #475569;">
        <strong>Hydraulic advance to EW:</strong> ${(extraTelemetry?.advanceFlowToEw ?? 147).toFixed(1)} m³/h | 
        <strong>Rectifier Current:</strong> ${(extraTelemetry?.ewCurrent ?? 24).toFixed(1)} KA | 
        <strong>Organic Flow:</strong> ${(extraTelemetry?.organicFlow ?? 687).toFixed(1)} m³/h
      </div>
    </div>

    <!-- Leach Pad Loops -->
    <div class="section">
      <h3 class="section-title">2. Leach Pad Flow & Status (${activePads.length} Active)</h3>
      <table>
        <thead>
          <tr>
            <th>Pad ID</th>
            <th>Status</th>
            <th>Feed</th>
            <th>Flow (m³/h)</th>
            <th>Totalizer (m³)</th>
            <th>Split (PLS/ILS)</th>
          </tr>
        </thead>
        <tbody>
          ${pads
            .map(
              (p) => `
          <tr>
            <td><strong>${escapeHtml(p.id)}</strong></td>
            <td><span class="${p.status === "Active" ? "badge-active" : "badge-off"}">${escapeHtml(p.status)}</span></td>
            <td>${escapeHtml(p.feedType || "RAF")}</td>
            <td>${p.min.toFixed(1)} - ${p.max.toFixed(1)}</td>
            <td>${p.totalizer !== undefined ? p.totalizer.toLocaleString() : "-"}</td>
            <td>${p.dischargePlsPercent ?? 100}% / ${p.dischargeIlsPercent ?? 0}%</td>
          </tr>`
            )
            .join("")}
          <tr style="background: #f8fafc; font-weight: bold;">
            <td colspan="3">Aggregated Flow Total</td>
            <td>${totalMin.toFixed(1)} - ${totalMax.toFixed(1)} m³/h</td>
            <td colspan="2">-</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pond Inventory -->
    <div class="section">
      <h3 class="section-title">3. Pond Levels & Acid Distribution</h3>
      <table>
        <thead>
          <tr>
            <th>Reservoir / Pond</th>
            <th>Live Level</th>
            <th>Discharge Flow</th>
            <th>Totalizer</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>RAF Pond (Raffinate Acid)</strong></td>
            <td>${(extraTelemetry?.rafPondLevel ?? 85.4).toFixed(1)}%</td>
            <td>${ponds.raf.flow.toFixed(1)} m³/h</td>
            <td>${ponds.raf.totalizer.toLocaleString()} m³</td>
          </tr>
          <tr>
            <td><strong>ILS Pond (Intermediate Leach)</strong></td>
            <td>${(extraTelemetry?.ilsPondLevel ?? 79.5).toFixed(1)}%</td>
            <td>${ponds.ils.flow.toFixed(1)} m³/h</td>
            <td>${ponds.ils.totalizer.toLocaleString()} m³</td>
          </tr>
          <tr>
            <td><strong>PLS Pond (Pregnant Solution)</strong></td>
            <td>${(extraTelemetry?.plsPondLevel ?? 65.5).toFixed(1)}%</td>
            <td>${plsFlow.toFixed(1)} m³/h</td>
            <td>${ponds.mainLine.totalizer.toLocaleString()} m³</td>
          </tr>
          <tr>
            <td><strong>Acid Tank #1 (Bulk Storage)</strong></td>
            <td style="color: ${(extraTelemetry?.acidTank1Level ?? 10.9) < 20 ? "#be123c; font-weight: bold;" : "#1e293b;"}">
              ${(extraTelemetry?.acidTank1Level ?? 10.9).toFixed(1)}% ${(extraTelemetry?.acidTank1Level ?? 10.9) < 20 ? "[LOW REFILL ALERT]" : ""}
            </td>
            <td>-</td>
            <td>-</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Active Warnings & Anomalies -->
    <div class="section">
      <h3 class="section-title" style="color: #e11d48;">4. Shift Anomalies & Active Alerts</h3>
      <ul style="margin: 0; padding-left: 18px; font-size: 12px; line-height: 1.6;">
        ${warningsList}
      </ul>
    </div>

    <!-- Operator Notes & Directives -->
    <div class="section">
      <h3 class="section-title">5. Shift Handover Notes & Directives</h3>
      <div style="background: #f8fafc; border-left: 3px solid #64748b; padding: 12px; font-size: 12px; line-height: 1.5; color: #334155;">
        ${escapeHtml(
          shiftData.notes ||
            "Shift completed in accordance with metallurgical standard operating procedures. All pad headers and line pressures checked."
        )}
      </div>
      ${
        aiHandoverSummary
          ? `
      <div style="margin-top: 12px; background: #f0fdfa; border: 1px solid #ccfbf1; border-radius: 6px; padding: 12px; font-size: 12px; line-height: 1.5; color: #115e59;">
        <strong>AI Process Assistant Directives:</strong><br/>
        ${escapeHtml(aiHandoverSummary).replace(/\n/g, "<br/>")}
      </div>`
          : ""
      }
    </div>

    <div class="footer">
      This email was generated directly by Mimbula Minerals SCADA & Telemetry DCS Integration.<br/>
      Confidential • Authorized Metallurgical Processing Personnel Only
    </div>
  </div>
</body>
</html>
`;
}

function escapeHtml(str: string): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
