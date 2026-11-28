from rest_framework import serializers

from .models import Classroom, Student


class ClassroomSyncSerializer(serializers.ModelSerializer):
    class Meta:
        model = Classroom
        fields = ("id", "name", "section", "academic_year", "updated_at")


class StudentSyncSerializer(serializers.ModelSerializer):
    classroom_id = serializers.IntegerField(source="classroom.id", read_only=True)

    class Meta:
        model = Student
        fields = (
            "id",
            "classroom_id",
            "roll_number",
            "full_name",
            "parent_phone",
            "updated_at",
        )


class AttendancePushItemSerializer(serializers.Serializer):
    local_id = serializers.IntegerField()
    remote_id = serializers.IntegerField(required=False, allow_null=True)
    student_id = serializers.PrimaryKeyRelatedField(
        queryset=Student.objects.all(), source="student"
    )
    date = serializers.DateField()
    status = serializers.ChoiceField(choices=["present", "absent", "late"])
    remarks = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    updated_at = serializers.DateTimeField()


class ExamMarkPushItemSerializer(serializers.Serializer):
    local_id = serializers.IntegerField()
    remote_id = serializers.IntegerField(required=False, allow_null=True)
    student_id = serializers.PrimaryKeyRelatedField(
        queryset=Student.objects.all(), source="student"
    )
    subject = serializers.CharField(max_length=100)
    exam_name = serializers.CharField(max_length=100)
    marks_obtained = serializers.FloatField(min_value=0)
    max_marks = serializers.FloatField(min_value=0)
    updated_at = serializers.DateTimeField()

    def validate(self, attrs):
        if attrs["marks_obtained"] > attrs["max_marks"]:
            raise serializers.ValidationError("marks_obtained cannot exceed max_marks.")
        return attrs


class SyncPushPayloadSerializer(serializers.Serializer):
    attendance = AttendancePushItemSerializer(many=True, required=False, default=list)
    exam_marks = ExamMarkPushItemSerializer(many=True, required=False, default=list)
