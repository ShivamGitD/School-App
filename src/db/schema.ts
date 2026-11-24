import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

export const classrooms = sqliteTable("classrooms", {
  localId: integer("local_id").primaryKey({ autoIncrement: true }),
  remoteId: integer("remote_id").unique(),
  name: text("name").notNull(),
  section: text("section").notNull(),
  academicYear: text("academic_year").notNull(),
  synced: integer("synced", { mode: "boolean" }).default(true).notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const students = sqliteTable("students", {
  localId: integer("local_id").primaryKey({ autoIncrement: true }),
  remoteId: integer("remote_id").unique(),
  classroomLocalId: integer("classroom_local_id")
    .notNull()
    .references(() => classrooms.localId, { onDelete: "cascade" }),
  rollNumber: text("roll_number").notNull(),
  fullName: text("full_name").notNull(),
  parentPhone: text("parent_phone"),
  synced: integer("synced", { mode: "boolean" }).default(true).notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const attendance = sqliteTable("attendance", {
  localId: integer("local_id").primaryKey({ autoIncrement: true }),
  remoteId: integer("remote_id").unique(),
  studentLocalId: integer("student_local_id")
    .notNull()
    .references(() => students.localId, { onDelete: "cascade" }),
  date: text("date").notNull(), // Format: YYYY-MM-DD
  status: text("status", { enum: ["present", "absent", "late"] }).notNull(),
  remarks: text("remarks"),
  synced: integer("synced", { mode: "boolean" }).default(false).notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const examMarks = sqliteTable("exam_marks", {
  localId: integer("local_id").primaryKey({ autoIncrement: true }),
  remoteId: integer("remote_id").unique(),
  studentLocalId: integer("student_local_id")
    .notNull()
    .references(() => students.localId, { onDelete: "cascade" }),
  subject: text("subject").notNull(),
  examName: text("exam_name").notNull(),
  marksObtained: real("marks_obtained").notNull(),
  maxMarks: real("max_marks").notNull(),
  synced: integer("synced", { mode: "boolean" }).default(false).notNull(),
  updatedAt: text("updated_at").notNull(),
});
