CREATE TABLE `attendance` (
	`local_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`remote_id` integer,
	`student_local_id` integer NOT NULL,
	`date` text NOT NULL,
	`status` text NOT NULL,
	`remarks` text,
	`synced` integer DEFAULT false NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`student_local_id`) REFERENCES `students`(`local_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `attendance_remote_id_unique` ON `attendance` (`remote_id`);--> statement-breakpoint
CREATE TABLE `classrooms` (
	`local_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`remote_id` integer,
	`name` text NOT NULL,
	`section` text NOT NULL,
	`academic_year` text NOT NULL,
	`synced` integer DEFAULT true NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `classrooms_remote_id_unique` ON `classrooms` (`remote_id`);--> statement-breakpoint
CREATE TABLE `exam_marks` (
	`local_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`remote_id` integer,
	`student_local_id` integer NOT NULL,
	`subject` text NOT NULL,
	`exam_name` text NOT NULL,
	`marks_obtained` real NOT NULL,
	`max_marks` real NOT NULL,
	`synced` integer DEFAULT false NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`student_local_id`) REFERENCES `students`(`local_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `exam_marks_remote_id_unique` ON `exam_marks` (`remote_id`);--> statement-breakpoint
CREATE TABLE `students` (
	`local_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`remote_id` integer,
	`classroom_local_id` integer NOT NULL,
	`roll_number` text NOT NULL,
	`full_name` text NOT NULL,
	`parent_phone` text,
	`synced` integer DEFAULT true NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`classroom_local_id`) REFERENCES `classrooms`(`local_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `students_remote_id_unique` ON `students` (`remote_id`);