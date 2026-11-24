import NetInfo from "@react-native-community/netinfo";
import { eq, inArray } from "drizzle-orm";
import { db } from "../db/client";
import { attendance, classrooms, examMarks, students } from "../db/schema";
import { apiRequest, getAuthToken } from "./api";

// --- Expected Django API Payload Shapes ---

interface RemoteClassroom {
  id: number;
  name: string;
  section: string;
  academic_year: string;
  updated_at: string;
}

interface RemoteStudent {
  id: number;
  classroom_id: number;
  roll_number: string;
  full_name: string;
  parent_phone: string | null;
  updated_at: string;
}

interface PullResponse {
  classrooms: RemoteClassroom[];
  students: RemoteStudent[];
}

interface PushResponse {
  synced_attendance: Array<{ local_id: number; remote_id: number }>;
  synced_marks: Array<{ local_id: number; remote_id: number }>;
}

export interface SyncResult {
  pulledClassrooms: number;
  pulledStudents: number;
  pushedAttendance: number;
  pushedMarks: number;
}

let isSyncing = false;

export async function pullFromDjango(): Promise<{
  pulledClassrooms: number;
  pulledStudents: number;
}> {
  const data = await apiRequest<PullResponse>("/api/sync/pull/", {
    method: "GET",
  });

  await db.transaction(async (tx) => {
    const classroomIdMap = new Map<number, number>();

    for (const remoteClass of data.classrooms) {
      const existing = await tx
        .select({ localId: classrooms.localId })
        .from(classrooms)
        .where(eq(classrooms.remoteId, remoteClass.id))
        .limit(1);

      if (existing.length > 0) {
        await tx
          .update(classrooms)
          .set({
            name: remoteClass.name,
            section: remoteClass.section,
            academicYear: remoteClass.academic_year,
            synced: true,
            updatedAt: remoteClass.updated_at,
          })
          .where(eq(classrooms.localId, existing[0].localId));

        classroomIdMap.set(remoteClass.id, existing[0].localId);
      } else {
        const [inserted] = await tx
          .insert(classrooms)
          .values({
            remoteId: remoteClass.id,
            name: remoteClass.name,
            section: remoteClass.section,
            academicYear: remoteClass.academic_year,
            synced: true,
            updatedAt: remoteClass.updated_at,
          })
          .returning({ localId: classrooms.localId });

        classroomIdMap.set(remoteClass.id, inserted.localId);
      }
    }

    for (const remoteStudent of data.students) {
      const classroomLocalId = classroomIdMap.get(remoteStudent.classroom_id);
      if (!classroomLocalId) continue;

      const existing = await tx
        .select({ localId: students.localId })
        .from(students)
        .where(eq(students.remoteId, remoteStudent.id))
        .limit(1);

      if (existing.length > 0) {
        await tx
          .update(students)
          .set({
            classroomLocalId,
            rollNumber: remoteStudent.roll_number,
            fullName: remoteStudent.full_name,
            parentPhone: remoteStudent.parent_phone,
            synced: true,
            updatedAt: remoteStudent.updated_at,
          })
          .where(eq(students.localId, existing[0].localId));
      } else {
        await tx.insert(students).values({
          remoteId: remoteStudent.id,
          classroomLocalId,
          rollNumber: remoteStudent.roll_number,
          fullName: remoteStudent.full_name,
          parentPhone: remoteStudent.parent_phone,
          synced: true,
          updatedAt: remoteStudent.updated_at,
        });
      }
    }
  });

  return {
    pulledClassrooms: data.classrooms.length,
    pulledStudents: data.students.length,
  };
}

export async function pushToDjango(): Promise<{
  pushedAttendance: number;
  pushedMarks: number;
}> {
  const pendingAttendance = await db
    .select()
    .from(attendance)
    .where(eq(attendance.synced, false));

  const pendingMarks = await db
    .select()
    .from(examMarks)
    .where(eq(examMarks.synced, false));

  if (pendingAttendance.length === 0 && pendingMarks.length === 0) {
    return { pushedAttendance: 0, pushedMarks: 0 };
  }

  // Map local student IDs to Django remote IDs
  const studentLocalIds = Array.from(
    new Set([
      ...pendingAttendance.map((a) => a.studentLocalId),
      ...pendingMarks.map((m) => m.studentLocalId),
    ]),
  );

  const studentRows = await db
    .select({ localId: students.localId, remoteId: students.remoteId })
    .from(students)
    .where(inArray(students.localId, studentLocalIds));

  const studentRemoteMap = new Map<number, number>();
  for (const row of studentRows) {
    if (row.remoteId !== null) {
      studentRemoteMap.set(row.localId, row.remoteId);
    }
  }

  const attendancePayload = pendingAttendance
    .filter((a) => studentRemoteMap.has(a.studentLocalId))
    .map((a) => ({
      local_id: a.localId,
      remote_id: a.remoteId,
      student_id: studentRemoteMap.get(a.studentLocalId)!,
      date: a.date,
      status: a.status,
      remarks: a.remarks,
      updated_at: a.updatedAt,
    }));

  const marksPayload = pendingMarks
    .filter((m) => studentRemoteMap.has(m.studentLocalId))
    .map((m) => ({
      local_id: m.localId,
      remote_id: m.remoteId,
      student_id: studentRemoteMap.get(m.studentLocalId)!,
      subject: m.subject,
      exam_name: m.examName,
      marks_obtained: m.marksObtained,
      max_marks: m.maxMarks,
      updated_at: m.updatedAt,
    }));

  if (attendancePayload.length === 0 && marksPayload.length === 0) {
    return { pushedAttendance: 0, pushedMarks: 0 };
  }

  const result = await apiRequest<PushResponse>("/api/sync/push/", {
    method: "POST",
    body: JSON.stringify({
      attendance: attendancePayload,
      exam_marks: marksPayload,
    }),
  });

  await db.transaction(async (tx) => {
    for (const item of result.synced_attendance) {
      await tx
        .update(attendance)
        .set({ remoteId: item.remote_id, synced: true })
        .where(eq(attendance.localId, item.local_id));
    }

    for (const item of result.synced_marks) {
      await tx
        .update(examMarks)
        .set({ remoteId: item.remote_id, synced: true })
        .where(eq(examMarks.localId, item.local_id));
    }
  });

  return {
    pushedAttendance: result.synced_attendance.length,
    pushedMarks: result.synced_marks.length,
  };
}

export async function syncNow(): Promise<SyncResult | null> {
  if (isSyncing) return null;

  const token = await getAuthToken();
  if (!token) {
    // Skip background sync until the user logs in and stores a JWT
    return null;
  }

  isSyncing = true;
  try {
    const pulled = await pullFromDjango();
    const pushed = await pushToDjango();
    return { ...pulled, ...pushed };
  } finally {
    isSyncing = false;
  }
}

export function startNetworkSyncListener(): () => void {
  const unsubscribe = NetInfo.addEventListener((state) => {
    const isOnline =
      Boolean(state.isConnected) && state.isInternetReachable !== false;

    if (isOnline) {
      syncNow()
        .then((res) => {
          if (res) {
            console.log("Background sync complete:", res);
          }
        })
        .catch((err) => {
          console.warn("Background sync skipped/failed:", err.message);
        });
    }
  });

  return unsubscribe;
}

const unsubscribe = NetInfo.addEventListener((state) => {
  const isOnline =
    Boolean(state.isConnected) && state.isInternetReachable !== false;

  console.log("NetInfo changed:", { isOnline, type: state.type });
  // ...rest of function
});
