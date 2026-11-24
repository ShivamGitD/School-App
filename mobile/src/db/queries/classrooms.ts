import { asc, eq } from "drizzle-orm";
import { db } from "../client";
import { classrooms, students } from "../schema";

export type Classroom = typeof classrooms.$inferSelect;
export type Student = typeof students.$inferSelect;

export async function getAllClassrooms(): Promise<Classroom[]> {
  return db
    .select()
    .from(classrooms)
    .orderBy(asc(classrooms.name), asc(classrooms.section));
}

export async function getStudentsByClassroom(
  classroomLocalId: number,
): Promise<Student[]> {
  return db
    .select()
    .from(students)
    .where(eq(students.classroomLocalId, classroomLocalId))
    .orderBy(asc(students.rollNumber));
}

export async function seedOfflineTestData(): Promise<boolean> {
  const existing = await db.select().from(classrooms).limit(1);
  if (existing.length > 0) return false;

  const now = new Date().toISOString();

  await db.transaction(async (tx) => {
    const [class10A, class10B] = await tx
      .insert(classrooms)
      .values([
        {
          name: "Class 10",
          section: "A",
          academicYear: "2026-27",
          synced: true,
          updatedAt: now,
        },
        {
          name: "Class 10",
          section: "B",
          academicYear: "2026-27",
          synced: true,
          updatedAt: now,
        },
      ])
      .returning();

    await tx.insert(students).values([
      {
        classroomLocalId: class10A.localId,
        rollNumber: "01",
        fullName: "Aarav Sharma",
        parentPhone: "9876543210",
        synced: true,
        updatedAt: now,
      },
      {
        classroomLocalId: class10A.localId,
        rollNumber: "02",
        fullName: "Diya Verma",
        parentPhone: "9876543211",
        synced: true,
        updatedAt: now,
      },
      {
        classroomLocalId: class10A.localId,
        rollNumber: "03",
        fullName: "Kabir Singh",
        parentPhone: "9876543212",
        synced: true,
        updatedAt: now,
      },
      {
        classroomLocalId: class10B.localId,
        rollNumber: "01",
        fullName: "Meera Patel",
        parentPhone: "9876543213",
        synced: true,
        updatedAt: now,
      },
      {
        classroomLocalId: class10B.localId,
        rollNumber: "02",
        fullName: "Rohan Gupta",
        parentPhone: "9876543214",
        synced: true,
        updatedAt: now,
      },
    ]);
  });

  return true;
}
