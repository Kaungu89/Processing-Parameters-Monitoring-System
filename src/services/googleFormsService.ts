/**
 * Google Forms Service for Heap Leach Operations
 * Handles form creation, reading form schema, fetching responses,
 * and mapping form responses into plant telemetry shifts.
 */

export interface GoogleFormItem {
  itemId: string;
  title: string;
  description?: string;
  questionItem?: {
    question: {
      questionId: string;
      required?: boolean;
      textQuestion?: {
        paragraph?: boolean;
      };
      choiceQuestion?: {
        type: string;
        options: { value: string }[];
      };
      scaleQuestion?: {
        low: number;
        high: number;
      };
    };
  };
}

export interface GoogleForm {
  formId: string;
  info: {
    title: string;
    documentTitle?: string;
    description?: string;
  };
  settings?: any;
  items?: GoogleFormItem[];
  revisionId?: string;
  responderUri?: string;
}

export interface GoogleFormResponseAnswer {
  questionId: string;
  textAnswers?: {
    answers: { value: string }[];
  };
}

export interface GoogleFormResponse {
  responseId: string;
  createTime: string;
  lastSubmittedTime: string;
  answers?: Record<string, GoogleFormResponseAnswer>;
}

export interface GoogleFormsDriveFile {
  id: string;
  name: string;
  modifiedTime: string;
  webViewLink?: string;
}

/**
 * List all Google Forms available to the user in their Google Drive
 */
export async function listGoogleForms(accessToken: string): Promise<GoogleFormsDriveFile[]> {
  const query = encodeURIComponent("mimeType = 'application/vnd.google-apps.form' and trashed = false");
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,modifiedTime,webViewLink)&pageSize=30&orderBy=modifiedTime desc`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const errorBody = await res.text();
    console.error("Failed to list Google Forms:", errorBody);
    throw new Error(`Failed to list Google Forms: ${res.statusText}`);
  }

  const data = await res.json();
  return data.files || [];
}

/**
 * Get form metadata and question schema
 */
export async function getGoogleForm(formId: string, accessToken: string): Promise<GoogleForm> {
  const url = `https://forms.googleapis.com/v1/forms/${formId}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const errorBody = await res.text();
    console.error(`Failed to fetch Google Form ${formId}:`, errorBody);
    throw new Error(`Failed to fetch Google Form details: ${res.statusText}`);
  }

  return await res.json();
}

/**
 * Get all responses submitted to a Google Form
 */
export async function getGoogleFormResponses(
  formId: string, 
  accessToken: string
): Promise<GoogleFormResponse[]> {
  const url = `https://forms.googleapis.com/v1/forms/${formId}/responses`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const errorBody = await res.text();
    console.error(`Failed to fetch responses for Form ${formId}:`, errorBody);
    throw new Error(`Failed to fetch Form responses: ${res.statusText}`);
  }

  const data = await res.json();
  return data.responses || [];
}

/**
 * Create a specialized Heap Leach Operational Inspection & Handover Google Form.
 * Automatically injects questions tailored to copper hydrometallurgical operations.
 */
export async function createHeapLeachInspectionForm(
  accessToken: string,
  customTitle?: string
): Promise<GoogleForm> {
  const title = customTitle || `Heap Leach Shift Inspection Form - ${new Date().toLocaleDateString('en-GB')}`;
  
  // 1. Create base form
  const createRes = await fetch("https://forms.googleapis.com/v1/forms", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      info: {
        title: title,
        documentTitle: title,
      },
    }),
  });

  if (!createRes.ok) {
    const errorBody = await createRes.text();
    console.error("Failed to create Google Form:", errorBody);
    throw new Error(`Failed to create Google Form: ${createRes.statusText}`);
  }

  const form: GoogleForm = await createRes.json();
  const formId = form.formId;

  // 2. Add question items via batchUpdate
  const batchRequests = [
    {
      createItem: {
        item: {
          title: "Duty Shift Operator Full Name",
          description: "Enter your full name as logged in the plant registry",
          questionItem: {
            question: {
              required: true,
              textQuestion: { paragraph: false },
            },
          },
        },
        location: { index: 0 },
      },
    },
    {
      createItem: {
        item: {
          title: "Operator Badge / Employment Number",
          description: "e.g. OP-5820",
          questionItem: {
            question: {
              required: true,
              textQuestion: { paragraph: false },
            },
          },
        },
        location: { index: 1 },
      },
    },
    {
      createItem: {
        item: {
          title: "Shift Type",
          questionItem: {
            question: {
              required: true,
              choiceQuestion: {
                type: "RADIO",
                options: [
                  { value: "Day Shift (06:00 - 18:00)" },
                  { value: "Night Shift (18:00 - 06:00)" },
                ],
              },
            },
          },
        },
        location: { index: 2 },
      },
    },
    {
      createItem: {
        item: {
          title: "Raffinate (RAF) Pond Level (%)",
          description: "Visual / telemetry pond gauge percentage (0 - 100%)",
          questionItem: {
            question: {
              required: true,
              textQuestion: { paragraph: false },
            },
          },
        },
        location: { index: 3 },
      },
    },
    {
      createItem: {
        item: {
          title: "Intermediate Leach Solution (ILS) Pond Level (%)",
          description: "Pond capacity sensor reading (0 - 100%)",
          questionItem: {
            question: {
              required: true,
              textQuestion: { paragraph: false },
            },
          },
        },
        location: { index: 4 },
      },
    },
    {
      createItem: {
        item: {
          title: "Crasher Pond Level (%)",
          description: "Crasher surge pond level percentage",
          questionItem: {
            question: {
              required: true,
              textQuestion: { paragraph: false },
            },
          },
        },
        location: { index: 5 },
      },
    },
    {
      createItem: {
        item: {
          title: "Main Line PLS Header Flow Rate (m³/h)",
          description: "Flow rate to SX plant (design: 1000 - 1300 m³/h)",
          questionItem: {
            question: {
              required: true,
              textQuestion: { paragraph: false },
            },
          },
        },
        location: { index: 6 },
      },
    },
    {
      createItem: {
        item: {
          title: "Pregnant Leach Solution (PLS) Cu Grade (g/L)",
          description: "Current pregnant copper head grade (e.g. 4.8 g/L)",
          questionItem: {
            question: {
              required: true,
              textQuestion: { paragraph: false },
            },
          },
        },
        location: { index: 7 },
      },
    },
    {
      createItem: {
        item: {
          title: "Acid Reserve Tank Level (%)",
          description: "Commercial H2SO4 storage tank percentage",
          questionItem: {
            question: {
              required: false,
              textQuestion: { paragraph: false },
            },
          },
        },
        location: { index: 8 },
      },
    },
    {
      createItem: {
        item: {
          title: "Leach Pad Field Inspection Status",
          description: "Condition of emitter lines, dripper manifolds, and pond berms",
          questionItem: {
            question: {
              required: true,
              choiceQuestion: {
                type: "CHECKBOX",
                options: [
                  { value: "Pad 1: Normal Irrigation" },
                  { value: "Pad 2: Normal Irrigation" },
                  { value: "Pad 3: Normal Irrigation" },
                  { value: "Pad 4: Normal Irrigation" },
                  { value: "Pad 5: Normal Irrigation" },
                  { value: "Pad 6: Normal Irrigation" },
                  { value: "Puddle / Ponding Observed on Crest" },
                  { value: "Emitter Line Pressure Drop Detected" },
                ],
              },
            },
          },
        },
        location: { index: 9 },
      },
    },
    {
      createItem: {
        item: {
          title: "Shift Handover Remarks & Process Anomalies",
          description: "Log valve adjustments, mechanical faults, pump cavitation, or safety hazards",
          questionItem: {
            question: {
              required: false,
              textQuestion: { paragraph: true },
            },
          },
        },
        location: { index: 10 },
      },
    },
  ];

  const updateRes = await fetch(`https://forms.googleapis.com/v1/forms/${formId}:batchUpdate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      requests: batchRequests,
      includeFormInResponse: true,
    }),
  });

  if (!updateRes.ok) {
    const errorBody = await updateRes.text();
    console.warn("BatchUpdate had warnings on form creation:", errorBody);
    // Return base form even if batch questions failed
    return form;
  }

  const updatedForm = await updateRes.json();
  return updatedForm.form || form;
}
