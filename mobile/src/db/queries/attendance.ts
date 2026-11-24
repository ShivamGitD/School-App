import { and, eq, inArray } from "drizzle-orm";
import { db } from "../client";
import { attendance, students } from "../schema";

export type AttendanceStatus = "present" | "absent" | "late";

export interface BulkAttendanceEntry {
  studentLocalId: number;
  status: AttendanceStatus;
  remarks?: string | null;
}

export async function getAttendanceByClassroomAndDate(
  classroomLocalId: number,
  date: string,
) {
  const roster = await db
    .select({ localId: students.localId })
    .from(students)
    .where(eq(students.classroomLocalId, classroomLocalId));

  if (roster.length === 0) return [];

  const studentIds = roster.map((s) => s.localId);

  return db
    .select()
    .from(attendance)
    .where(
      and(
        eq(attendance.date, date),
        inArray(attendance.studentLocalId, studentIds),
      ),
    );
}

export async function saveBulkAttendance(
  date: string,
  entries: BulkAttendanceEntry[],
): Promise<void> {
  if (entries.length === 0) return;

  const now = new Date().toISOString();

  await db.transaction(async (tx) => {
    for (const entry of entries) {
      const existing = await tx
        .select({ localId: attendance.localId })
        .from(attendance)
        .where(
          and(
            eq(attendance.studentLocalId, entry.studentLocalId),
            eq(attendance.date, date),
          ),
        )
        .limit(1);

      if (existing.length > 0) {
        await tx
          .update(attendance)
          .set({
            status: entry.status,
            remarks: entry.remarks ?? null,
            synced: false,
            updatedAt: now,
          })
          .where(eq(attendance.localId, existing[0].localId));
      } else {
        await tx.insert(attendance).values({
          studentLocalId: entry.studentLocalId,
          date,
          status: entry.status,
          remarks: entry.remarks ?? null,
          synced: false,
          updatedAt: now,
        });
      }
    }
  });
}
