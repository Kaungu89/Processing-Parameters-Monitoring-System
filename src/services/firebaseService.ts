import { getApps, getApp, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { 
  getFirestore, 
  doc, 
  getDocFromServer, 
  setDoc, 
  deleteDoc, 
  collection, 
  query, 
  where, 
  onSnapshot, 
  getDoc,
  getDocs,
  Unsubscribe 
} from "firebase/firestore";
import firebaseConfig from "../../firebase-applet-config.json";
import { ShiftTelemetryData } from "../types";

// Initialize Firebase App
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// CRITICAL: The app will break without specifying firestoreDatabaseId
const dbId = (firebaseConfig as { firestoreDatabaseId?: string }).firestoreDatabaseId || "ai-studio-leachpadflowsaci-80055294-a66c-4608-aae5-0a470372e7f2";
export const db = getFirestore(app, dbId);
export const auth = getAuth(app);

// Operational types for structured error handling
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// CRITICAL CONSTRAINT: Test connection probe upon initial boot
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log('[Firestore] Connection established successfully.');
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('[Firestore] Client is offline. Please check your Firebase configuration or network.');
    } else {
      console.warn('[Firestore] Probe notice:', error);
    }
    return false;
  }
}

// Automatically invoke test connection probe
testFirestoreConnection();

/**
 * Save or update a shift telemetry record in Firestore
 */
export async function saveShiftToFirestore(
  shiftData: ShiftTelemetryData, 
  userId: string
): Promise<void> {
  const path = `shifts/${shiftData.id}`;
  try {
    const docRef = doc(db, 'shifts', shiftData.id);
    const payload = {
      id: shiftData.id,
      ownerId: userId,
      date: shiftData.date,
      time: shiftData.time,
      operatorEmail: shiftData.operatorEmail || (auth.currentUser?.email ?? ""),
      operatorName: shiftData.operatorName || "",
      employmentNumber: shiftData.employmentNumber || "",
      notes: shiftData.notes || "",
      pads: shiftData.pads || [],
      ponds: shiftData.ponds || {},
      extraTelemetry: shiftData.extraTelemetry || {},
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };
    await setDoc(docRef, payload, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Delete a shift record from Firestore
 */
export async function deleteShiftFromFirestore(
  shiftId: string
): Promise<void> {
  const path = `shifts/${shiftId}`;
  try {
    const docRef = doc(db, 'shifts', shiftId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * Real-time listener for the current user's shifts
 */
export function subscribeToUserShifts(
  userId: string,
  onUpdate: (shifts: ShiftTelemetryData[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const path = 'shifts';
  const q = query(
    collection(db, 'shifts'),
    where('ownerId', '==', userId)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const records: ShiftTelemetryData[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        records.push({
          id: data.id || d.id,
          date: data.date,
          time: data.time,
          operatorEmail: data.operatorEmail,
          operatorName: data.operatorName,
          employmentNumber: data.employmentNumber,
          notes: data.notes,
          pads: data.pads || [],
          ponds: data.ponds || {},
          extraTelemetry: data.extraTelemetry
        });
      });
      // Sort descending by date and time
      records.sort((a, b) => {
        const dtA = `${a.date} ${a.time}`;
        const dtB = `${b.date} ${b.time}`;
        return dtB.localeCompare(dtA);
      });
      onUpdate(records);
    },
    (error) => {
      console.error('[Firestore] Snapshot listener error:', error);
      if (onError) {
        try {
          handleFirestoreError(error, OperationType.LIST, path);
        } catch (wrapped) {
          onError(wrapped as Error);
        }
      }
    }
  );
}

/**
 * Get or create User Profile in Firestore
 */
export async function syncUserProfile(
  userId: string, 
  email: string, 
  displayName?: string, 
  employmentNumber?: string
): Promise<void> {
  const path = `users/${userId}`;
  try {
    const userDocRef = doc(db, 'users', userId);
    await setDoc(userDocRef, {
      userId,
      email,
      displayName: displayName || "",
      employmentNumber: employmentNumber || "",
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Load operator profile from Firestore
 */
export async function getUserProfile(userId: string): Promise<any | null> {
  const path = `users/${userId}`;
  try {
    const docRef = doc(db, 'users', userId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data();
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}
