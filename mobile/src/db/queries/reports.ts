import { eq, inArray } from "drizzle-orm";
import { db } from "../client";
import { attendance, examMarks, students } from "../schema";

export interface StudentExamSummary {
  localId: number;
  subject: string;
  examName: string;
  marksObtained: number;
  maxMarks: number;
  percentage: number;
}

export interface StudentReport {
  studentLocalId: number;
  rollNumber: string;
  fullName: string;
  presentCount: number;
  lateCount: number;
  absentCount: number;
  totalAttendanceDays: number;
  // Null when no attendance has been recorded yet (distinct from 0%)
  attendancePercentage: number | null;
  examCount: number;
  totalMarksObtained: number;
  totalMaxMarks: number;
  // Null when no exam marks exist yet
  examAveragePercentage: number | null;
  exams: StudentExamSummary[];
}

export interface ClassroomReport {
  studentCount: number;
  classAttendancePercentage: number | null;
  classExamAveragePercentage: number | null;
  // Students with recorded attendance strictly below 75%
  lowAttendanceCount: number;
  students: StudentReport[];
}

function roundOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

export async function getClassroomReport(
  classroomLocalId: number,
): Promise<ClassroomReport> {
  const roster = await db
    .select()
    .from(students)
    .where(eq(students.classroomLocalId, classroomLocalId));

  // Guard against empty IN (...) clauses in SQLite
  if (roster.length === 0) {
    return {
      studentCount: 0,
      classAttendancePercentage: null,
      classExamAveragePercentage: null,
      lowAttendanceCount: 0,
      students: [],
    };
  }

  const studentIds = roster.map((s) => s.localId);

  const [attendanceRows, markRows] = await Promise.all([
    db
      .select()
      .from(attendance)
      .where(inArray(attendance.studentLocalId, studentIds)),
    db
      .select()
      .from(examMarks)
      .where(inArray(examMarks.studentLocalId, studentIds)),
  ]);

  // Group records by studentLocalId for O(n) lookup
  const attendanceByStudent = new Map<number, typeof attendanceRows>();
  for (const row of attendanceRows) {
    const list = attendanceByStudent.get(row.studentLocalId) ?? [];
    list.push(row);
    attendanceByStudent.set(row.studentLocalId, list);
  }

  const marksByStudent = new Map<number, typeof markRows>();
  for (const row of markRows) {
    const list = marksByStudent.get(row.studentLocalId) ?? [];
    list.push(row);
    marksByStudent.set(row.studentLocalId, list);
  }

  let totalClassAttended = 0;
  let totalClassAttendanceDays = 0;
  let totalClassMarksObtained = 0;
  let totalClassMaxMarks = 0;
  let lowAttendanceCount = 0;

  const studentReports: StudentReport[] = roster.map((student) => {
    const studentAttendance = attendanceByStudent.get(student.localId) ?? [];
    let presentCount = 0;
    let lateCount = 0;
    let absentCount = 0;

    for (const record of studentAttendance) {
      if (record.status === "present") presentCount += 1;
      else if (record.status === "late") lateCount += 1;
      else absentCount += 1;
    }

    const totalAttendanceDays = presentCount + lateCount + absentCount;
    // Count both "present" and "late" as attended days
    const attendedDays = presentCount + lateCount;
    const attendancePercentage =
      totalAttendanceDays > 0
        ? roundOneDecimal((attendedDays / totalAttendanceDays) * 100)
        : null;

    if (attendancePercentage !== null && attendancePercentage < 75) {
      lowAttendanceCount += 1;
    }

    totalClassAttended += attendedDays;
    totalClassAttendanceDays += totalAttendanceDays;

    const studentMarks = marksByStudent.get(student.localId) ?? [];
    let totalMarksObtained = 0;
    let totalMaxMarks = 0;

    const exams: StudentExamSummary[] = studentMarks.map((mark) => {
      totalMarksObtained += mark.marksObtained;
      totalMaxMarks += mark.maxMarks;
      const pct =
        mark.maxMarks > 0
          ? roundOneDecimal((mark.marksObtained / mark.maxMarks) * 100)
          : 0;
      return {
        localId: mark.localId,
        subject: mark.subject,
        examName: mark.examName,
        marksObtained: mark.marksObtained,
        maxMarks: mark.maxMarks,
        percentage: pct,
      };
    });

    const examAveragePercentage =
      totalMaxMarks > 0
        ? roundOneDecimal((totalMarksObtained / totalMaxMarks) * 100)
        : null;

    totalClassMarksObtained += totalMarksObtained;
    totalClassMaxMarks += totalMaxMarks;

    return {
      studentLocalId: student.localId,
      rollNumber: student.rollNumber,
      fullName: student.fullName,
      presentCount,
      lateCount,
      absentCount,
      totalAttendanceDays,
      attendancePercentage,
      examCount: exams.length,
      totalMarksObtained,
      totalMaxMarks,
      examAveragePercentage,
      exams,
    };
  });

  // Sort roster naturally by roll number
  studentReports.sort((a, b) =>
    a.rollNumber.localeCompare(b.rollNumber, undefined, { numeric: true }),
  );

  return {
    studentCount: studentReports.length,
    classAttendancePercentage:
      totalClassAttendanceDays > 0
        ? roundOneDecimal((totalClassAttended / totalClassAttendanceDays) * 100)
        : null,
    classExamAveragePercentage:
      totalClassMaxMarks > 0
        ? roundOneDecimal((totalClassMarksObtained / totalClassMaxMarks) * 100)
        : null,
    lowAttendanceCount,
    students: studentReports,
  };
}
