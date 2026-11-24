from django.contrib import admin

from .models import Attendance, Classroom, ExamMark, Student

admin.site.register(Classroom)
admin.site.register(Student)
admin.site.register(Attendance)
admin.site.register(ExamMark)
