import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  View,
} from "react-native";
import { type Classroom, getAllClassrooms } from "../db/queries/classrooms";
import {
  type ClassroomReport,
  getClassroomReport,
  type StudentReport,
} from "../db/queries/reports";

function getAttendanceBadgeClasses(percentage: number | null): {
  bg: string;
  text: string;
} {
  if (percentage === null) {
    return { bg: "bg-slate-100", text: "text-slate-600" };
  }
  if (percentage >= 75) {
    return { bg: "bg-green-100", text: "text-green-800" };
  }
  if (percentage >= 60) {
    return { bg: "bg-amber-100", text: "text-amber-800" };
  }
  return { bg: "bg-red-100", text: "text-red-800" };
}

export default function ReportsScreen() {
  const [loading, setLoading] = useState(true);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [selectedClass, setSelectedClass] = useState<Classroom | null>(null);
  const [report, setReport] = useState<ClassroomReport | null>(null);
  const [expandedStudentId, setExpandedStudentId] = useState<number | null>(
    null,
  );

  // Ref tracks the active classroom ID without triggering useFocusEffect re-runs
  const selectedClassIdRef = useRef<number | null>(null);

  const loadReportForClass = useCallback(async (classroom: Classroom) => {
    selectedClassIdRef.current = classroom.localId;
    setSelectedClass(classroom);
    setExpandedStudentId(null);
    const data = await getClassroomReport(classroom.localId);
    setReport(data);
  }, []);

  const loadInitialData = useCallback(async () => {
    setLoading(true);
    const list = await getAllClassrooms();
    setClassrooms(list);

    if (list.length > 0) {
      const target =
        list.find((c) => c.localId === selectedClassIdRef.current) ?? list[0];
      await loadReportForClass(target);
    } else {
      selectedClassIdRef.current = null;
      setSelectedClass(null);
      setReport(null);
    }
    setLoading(false);
  }, [loadReportForClass]);

  // Runs only when the Reports screen gains focus
  useFocusEffect(
    useCallback(() => {
      void loadInitialData();
    }, [loadInitialData]),
  );

  const toggleExpand = (studentLocalId: number) => {
    setExpandedStudentId((prev) =>
      prev === studentLocalId ? null : studentLocalId,
    );
  };

  const renderStudentCard = ({ item }: { item: StudentReport }) => {
    const badge = getAttendanceBadgeClasses(item.attendancePercentage);
    const isExpanded = expandedStudentId === item.studentLocalId;

    return (
      <Pressable
        onPress={() => toggleExpand(item.studentLocalId)}
        className="rounded-xl border border-slate-200 bg-white p-3.5 active:bg-slate-50"
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-1 pr-2">
            <Text className="text-base font-bold text-slate-900">
              {item.rollNumber}. {item.fullName}
            </Text>
            <Text className="mt-0.5 text-xs text-slate-500">
              P: {item.presentCount} • L: {item.lateCount} • A:{" "}
              {item.absentCount}
            </Text>
          </View>

          <View className="items-end gap-1">
            <View className={`rounded-md px-2.5 py-1 ${badge.bg}`}>
              <Text className={`text-xs font-bold ${badge.text}`}>
                {item.attendancePercentage !== null
                  ? `${item.attendancePercentage}% Att.`
                  : "No Att."}
              </Text>
            </View>
            <Text className="text-xs font-semibold text-indigo-700">
              {item.examAveragePercentage !== null
                ? `Exams: ${item.examAveragePercentage}% (${item.examCount})`
                : "No Exam Marks"}
            </Text>
          </View>
        </View>

        {isExpanded && (
          <View className="mt-3 border-t border-slate-100 pt-2.5">
            {item.exams.length === 0 ? (
              <Text className="text-xs italic text-slate-400">
                No exam records saved locally for this student yet.
              </Text>
            ) : (
              <View className="gap-1.5">
                {item.exams.map((exam) => (
                  <View
                    key={exam.localId}
                    className="flex-row items-center justify-between rounded-lg bg-slate-50 px-2.5 py-1.5"
                  >
                    <View>
                      <Text className="text-xs font-semibold text-slate-800">
                        {exam.subject}
                      </Text>
                      <Text className="text-[11px] text-slate-500">
                        {exam.examName}
                      </Text>
                    </View>
                    <Text className="text-xs font-bold text-slate-900">
                      {exam.marksObtained}/{exam.maxMarks} ({exam.percentage}%)
                    </Text>
                  </View>
                ))}
                <Text className="mt-1 text-right text-[11px] font-semibold text-slate-600">
                  Total: {item.totalMarksObtained}/{item.totalMaxMarks}
                </Text>
              </View>
            )}
          </View>
        )}
      </Pressable>
    );
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center gap-2 bg-slate-50">
        <ActivityIndicator size="large" />
        <Text className="text-sm text-slate-500">
          Calculating offline reports...
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-slate-50 p-4">
      <View className="mb-3 flex-row items-center justify-between">
        <View>
          <Text className="text-xl font-bold text-slate-900">
            Classroom Reports
          </Text>
          <Text className="text-xs text-slate-500">
            Computed locally from SQLite (works offline)
          </Text>
        </View>
      </View>

      {classrooms.length === 0 ? (
        <View className="rounded-xl border border-dashed border-slate-300 bg-white p-6">
          <Text className="text-center text-sm font-semibold text-slate-700">
            No classrooms available
          </Text>
          <Text className="mt-1 text-center text-xs text-slate-500">
            Sync classrooms from Django on the home screen to view reports.
          </Text>
        </View>
      ) : (
        <>
          <FlatList
            data={classrooms}
            keyExtractor={(item) => String(item.localId)}
            horizontal
            className="mb-4 max-h-16"
            contentContainerStyle={{ gap: 8 }}
            renderItem={({ item }) => {
              const active = selectedClass?.localId === item.localId;
              return (
                <Pressable
                  onPress={() => void loadReportForClass(item)}
                  className={`justify-center rounded-xl border px-3.5 py-2 ${
                    active
                      ? "border-slate-900 bg-slate-900"
                      : "border-slate-300 bg-white"
                  }`}
                >
                  <Text
                    className={`text-sm font-bold ${
                      active ? "text-white" : "text-slate-900"
                    }`}
                  >
                    {item.name} - {item.section}
                  </Text>
                </Pressable>
              );
            }}
          />

          {report && (
            <>
              {/* Classroom KPI Summary Row */}
              <View className="mb-4 flex-row gap-2.5">
                <View className="flex-1 rounded-xl border border-slate-200 bg-white p-3">
                  <Text className="text-[11px] font-medium text-slate-500">
                    Class Attendance
                  </Text>
                  <Text className="mt-1 text-lg font-bold text-slate-900">
                    {report.classAttendancePercentage !== null
                      ? `${report.classAttendancePercentage}%`
                      : "—"}
                  </Text>
                </View>

                <View className="flex-1 rounded-xl border border-slate-200 bg-white p-3">
                  <Text className="text-[11px] font-medium text-slate-500">
                    Exam Average
                  </Text>
                  <Text className="mt-1 text-lg font-bold text-indigo-700">
                    {report.classExamAveragePercentage !== null
                      ? `${report.classExamAveragePercentage}%`
                      : "—"}
                  </Text>
                </View>

                <View className="flex-1 rounded-xl border border-slate-200 bg-white p-3">
                  <Text className="text-[11px] font-medium text-slate-500">
                    Below 75% Att.
                  </Text>
                  <Text
                    className={`mt-1 text-lg font-bold ${
                      report.lowAttendanceCount > 0
                        ? "text-red-600"
                        : "text-green-700"
                    }`}
                  >
                    {report.lowAttendanceCount} / {report.studentCount}
                  </Text>
                </View>
              </View>

              <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Students ({report.studentCount}) • Tap a card for exam breakdown
              </Text>

              <FlatList
                data={report.students}
                keyExtractor={(item) => String(item.studentLocalId)}
                contentContainerStyle={{ gap: 8, paddingBottom: 16 }}
                renderItem={renderStudentCard}
                ListEmptyComponent={
                  <Text className="text-sm text-slate-500">
                    No students in this classroom yet.
                  </Text>
                }
              />
            </>
          )}
        </>
      )}
    </View>
  );
}
