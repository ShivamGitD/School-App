import { eq, inArray, isNull } from "drizzle-orm";
import { db } from "../client";
import { attendance, classrooms, examMarks, students } from "../schema";

export type Classroom = typeof classrooms.$inferSelect;
export type Student = typeof students.$inferSelect;

export async function getAllClassrooms(): Promise<Classroom[]> {
  return db.select().from(classrooms);
}

export async function getStudentsByClassroom(
  classroomLocalId: number,
): Promise<Student[]> {
  return db
    .select()
    .from(students)
    .where(eq(students.classroomLocalId, classroomLocalId));
}

// Removes local dummy classrooms/students (remoteId = null) while preserving Django-synced data
export async function purgeDummySeedData(): Promise<void> {
  const dummyStudents = await db
    .select({ localId: students.localId })
    .from(students)
    .where(isNull(students.remoteId));

  const dummyStudentIds = dummyStudents.map((s) => s.localId);

  await db.transaction(async (tx) => {
    if (dummyStudentIds.length > 0) {
      await tx
        .delete(attendance)
        .where(inArray(attendance.studentLocalId, dummyStudentIds));
      await tx
        .delete(examMarks)
        .where(inArray(examMarks.studentLocalId, dummyStudentIds));
    }
    await tx.delete(students).where(isNull(students.remoteId));
    await tx.delete(classrooms).where(isNull(classrooms.remoteId));
  });
}
