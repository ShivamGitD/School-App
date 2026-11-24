from django.db import transaction
from django.utils.dateparse import parse_datetime
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Attendance, Classroom, ExamMark, Student
from .serializers import (
    ClassroomSyncSerializer,
    StudentSyncSerializer,
    SyncPushPayloadSerializer,
)


class SyncPullView(APIView):
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        since_param = request.query_params.get("since")
        since_dt = parse_datetime(since_param) if since_param else None

        classrooms_qs = Classroom.objects.all()
        students_qs = Student.objects.select_related("classroom").all()

        if since_dt is not None:
            classrooms_qs = classrooms_qs.filter(updated_at__gte=since_dt)
            students_qs = students_qs.filter(updated_at__gte=since_dt)

        return Response(
            {
                "classrooms": ClassroomSyncSerializer(classrooms_qs, many=True).data,
                "students": StudentSyncSerializer(students_qs, many=True).data,
            },
            status=status.HTTP_200_OK,
        )


class SyncPushView(APIView):
    permission_classes = (IsAuthenticated,)

    @transaction.atomic
    def post(self, request):
        serializer = SyncPushPayloadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        attendance_items = serializer.validated_data["attendance"]
        marks_items = serializer.validated_data["exam_marks"]

        synced_attendance = []
        for item in attendance_items:
            existing = Attendance.objects.filter(
                student=item["student"], date=item["date"]
            ).first()

            if existing:
                # Last-write-wins conflict resolution via updated_at
                if item["updated_at"] >= existing.updated_at:
                    existing.status = item["status"]
                    existing.remarks = item.get("remarks")
                    existing.updated_at = item["updated_at"]
                    existing.save(update_fields=["status", "remarks", "updated_at"])
                record = existing
            else:
                record = Attendance.objects.create(
                    student=item["student"],
                    date=item["date"],
                    status=item["status"],
                    remarks=item.get("remarks"),
                    updated_at=item["updated_at"],
                )

            synced_attendance.append(
                {"local_id": item["local_id"], "remote_id": record.id}
            )

        synced_marks = []
        for item in marks_items:
            existing = ExamMark.objects.filter(
                student=item["student"],
                subject=item["subject"],
                exam_name=item["exam_name"],
            ).first()

            if existing:
                if item["updated_at"] >= existing.updated_at:
                    existing.marks_obtained = item["marks_obtained"]
                    existing.max_marks = item["max_marks"]
                    existing.updated_at = item["updated_at"]
                    existing.save(
                        update_fields=["marks_obtained", "max_marks", "updated_at"]
                    )
                record = existing
            else:
                record = ExamMark.objects.create(
                    student=item["student"],
                    subject=item["subject"],
                    exam_name=item["exam_name"],
                    marks_obtained=item["marks_obtained"],
                    max_marks=item["max_marks"],
                    updated_at=item["updated_at"],
                )

            synced_marks.append({"local_id": item["local_id"], "remote_id": record.id})

        return Response(
            {
                "synced_attendance": synced_attendance,
                "synced_marks": synced_marks,
            },
            status=status.HTTP_200_OK,
        )
