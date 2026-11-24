from django.db import models
from django.utils import timezone


class Classroom(models.Model):
    name = models.CharField(max_length=100)
    section = models.CharField(max_length=20)
    academic_year = models.CharField(max_length=20)
    updated_at = models.DateTimeField(default=timezone.now)

    class Meta:
        unique_together = ("name", "section", "academic_year")
        ordering = ("name", "section")

    def save(self, *args, **kwargs):
        if not kwargs.pop("preserve_timestamp", False):
            self.updated_at = timezone.now()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.name} - {self.section} ({self.academic_year})"


class Student(models.Model):
    classroom = models.ForeignKey(
        Classroom, on_delete=models.CASCADE, related_name="students"
    )
    roll_number = models.CharField(max_length=20)
    full_name = models.CharField(max_length=150)
    parent_phone = models.CharField(max_length=20, blank=True, null=True)
    updated_at = models.DateTimeField(default=timezone.now)

    class Meta:
        unique_together = ("classroom", "roll_number")
        ordering = ("roll_number",)

    def save(self, *args, **kwargs):
        if not kwargs.pop("preserve_timestamp", False):
            self.updated_at = timezone.now()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.roll_number}. {self.full_name}"


class Attendance(models.Model):
    STATUS_CHOICES = (
        ("present", "Present"),
        ("absent", "Absent"),
        ("late", "Late"),
    )

    student = models.ForeignKey(
        Student, on_delete=models.CASCADE, related_name="attendance_records"
    )
    date = models.DateField()
    status = models.CharField(max_length=10, choices=STATUS_CHOICES)
    remarks = models.TextField(blank=True, null=True)
    updated_at = models.DateTimeField(default=timezone.now)

    class Meta:
        unique_together = ("student", "date")

    def __str__(self):
        return f"{self.student.full_name} - {self.date} ({self.status})"


class ExamMark(models.Model):
    student = models.ForeignKey(
        Student, on_delete=models.CASCADE, related_name="exam_marks"
    )
    subject = models.CharField(max_length=100)
    exam_name = models.CharField(max_length=100)
    marks_obtained = models.FloatField()
    max_marks = models.FloatField()
    updated_at = models.DateTimeField(default=timezone.now)

    class Meta:
        unique_together = ("student", "subject", "exam_name")

    def __str__(self):
        return f"{self.student.full_name} - {self.subject} ({self.exam_name})"
