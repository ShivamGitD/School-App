import { and, eq, inArray } from "drizzle-orm";
import { db } from "../client";
import { examMarks, students } from "../schema";

export interface ExamMarkInput {
  studentLocalId: number;
  subject: string;
  examName: string;
  marksObtained: number;
  maxMarks: number;
}

export async function getMarksByClassroom(
  classroomLocalId: number,
  subject?: string,
  examName?: string,
) {
  const roster = await db
    .select({ localId: students.localId })
    .from(students)
    .where(eq(students.classroomLocalId, classroomLocalId));

  if (roster.length === 0) return [];

  const conditions = [
    inArray(
      examMarks.studentLocalId,
      roster.map((s) => s.localId),
    ),
  ];

  if (subject) conditions.push(eq(examMarks.subject, subject));
  if (examName) conditions.push(eq(examMarks.examName, examName));

  return db
    .select()
    .from(examMarks)
    .where(and(...conditions));
}

export async function saveExamMark(input: ExamMarkInput): Promise<void> {
  const now = new Date().toISOString();

  const existing = await db
    .select({ localId: examMarks.localId })
    .from(examMarks)
    .where(
      and(
        eq(examMarks.studentLocalId, input.studentLocalId),
        eq(examMarks.subject, input.subject),
        eq(examMarks.examName, input.examName),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(examMarks)
      .set({
        marksObtained: input.marksObtained,
        maxMarks: input.maxMarks,
        synced: false,
        updatedAt: now,
      })
      .where(eq(examMarks.localId, existing[0].localId));
  } else {
    await db.insert(examMarks).values({
      ...input,
      synced: false,
      updatedAt: now,
    });
  }
}

export async function saveBulkExamMarks(
  inputs: ExamMarkInput[],
): Promise<void> {
  if (inputs.length === 0) return;

  const now = new Date().toISOString();

  await db.transaction(async (tx) => {
    for (const input of inputs) {
      const existing = await tx
        .select({ localId: examMarks.localId })
        .from(examMarks)
        .where(
          and(
            eq(examMarks.studentLocalId, input.studentLocalId),
            eq(examMarks.subject, input.subject),
            eq(examMarks.examName, input.examName),
          ),
        )
        .limit(1);

      if (existing.length > 0) {
        await tx
          .update(examMarks)
          .set({
            marksObtained: input.marksObtained,
            maxMarks: input.maxMarks,
            synced: false,
            updatedAt: now,
          })
          .where(eq(examMarks.localId, existing[0].localId));
      } else {
        await tx.insert(examMarks).values({
          ...input,
          synced: false,
          updatedAt: now,
        });
      }
    }
  });
}
