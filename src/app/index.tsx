import { Link } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  View,
} from "react-native";
import {
  type AttendanceStatus,
  getAttendanceByClassroomAndDate,
  saveBulkAttendance,
} from "../db/queries/attendance";
import {
  type Classroom,
  getAllClassrooms,
  getStudentsByClassroom,
  type Student,
  seedOfflineTestData,
} from "../db/queries/classrooms";

const TODAY = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

const STATUS_BADGE_CLASSES: Record<AttendanceStatus, string> = {
  present: "bg-green-100",
  absent: "bg-red-100",
  late: "bg-amber-100",
};

export default function ClassroomListScreen() {
  const [loading, setLoading] = useState(true);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [selectedClass, setSelectedClass] = useState<Classroom | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [statusMap, setStatusMap] = useState<Record<number, AttendanceStatus>>(
    {},
  );
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const loadClassrooms = useCallback(async () => {
    setLoading(true);
    await seedOfflineTestData();
    const list = await getAllClassrooms();
    setClassrooms(list);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadClassrooms();
  }, [loadClassrooms]);

  const handleSelectClassroom = async (classroom: Classroom) => {
    setSelectedClass(classroom);
    setSaveMessage(null);

    const roster = await getStudentsByClassroom(classroom.localId);
    const existing = await getAttendanceByClassroomAndDate(
      classroom.localId,
      TODAY,
    );

    const nextMap: Record<number, AttendanceStatus> = {};
    for (const student of roster) {
      const record = existing.find((a) => a.studentLocalId === student.localId);
      nextMap[student.localId] = record ? record.status : "present";
    }

    setStudents(roster);
    setStatusMap(nextMap);
  };

  const cycleStatus = (studentLocalId: number) => {
    const order: AttendanceStatus[] = ["present", "absent", "late"];
    setStatusMap((prev) => {
      const current = prev[studentLocalId] ?? "present";
      const next = order[(order.indexOf(current) + 1) % order.length];
      return { ...prev, [studentLocalId]: next };
    });
    setSaveMessage(null);
  };

  const handleSaveAttendance = async () => {
    if (!selectedClass) return;
    const entries = students.map((s) => ({
      studentLocalId: s.localId,
      status: statusMap[s.localId] ?? "present",
    }));
    await saveBulkAttendance(TODAY, entries);
    setSaveMessage(`Saved ${entries.length} records for ${TODAY} (offline)`);
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center gap-2 bg-slate-50">
        <ActivityIndicator size="large" />
        <Text className="text-sm text-slate-500">
          Loading local SQLite data...
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-slate-50 p-4">
      <View className="mb-3 flex-row items-center justify-between">
        <Text className="text-xl font-bold text-slate-900">
          Classrooms ({classrooms.length})
        </Text>
        <Link href="./marks" asChild>
          <Pressable className="rounded-lg bg-indigo-600 px-3 py-1.5 active:bg-indigo-700">
            <Text className="text-xs font-bold text-white">Exam Marks →</Text>
          </Pressable>
        </Link>
      </View>

      <FlatList
        data={classrooms}
        keyExtractor={(item) => String(item.localId)}
        horizontal
        className="mb-4 max-h-20"
        contentContainerStyle={{ gap: 10 }}
        renderItem={({ item }) => {
          const active = selectedClass?.localId === item.localId;
          return (
            <Pressable
              onPress={() => handleSelectClassroom(item)}
              className={`justify-center rounded-xl border px-4 py-3 ${
                active
                  ? "border-blue-600 bg-blue-600"
                  : "border-slate-300 bg-white"
              }`}
            >
              <Text
                className={`text-base font-bold ${
                  active ? "text-white" : "text-slate-900"
                }`}
              >
                {item.name} - {item.section}
              </Text>
              <Text
                className={`mt-0.5 text-xs ${
                  active ? "text-blue-100" : "text-slate-500"
                }`}
              >
                {item.academicYear}
              </Text>
            </Pressable>
          );
        }}
      />

      {selectedClass ? (
        <View className="flex-1">
          <Text className="mb-2.5 text-base font-semibold text-slate-800">
            {selectedClass.name} {selectedClass.section} • Attendance ({TODAY})
          </Text>

          <FlatList
            data={students}
            keyExtractor={(item) => String(item.localId)}
            contentContainerStyle={{ gap: 8 }}
            renderItem={({ item }) => {
              const status = statusMap[item.localId] ?? "present";
              return (
                <Pressable
                  onPress={() => cycleStatus(item.localId)}
                  className="flex-row items-center justify-between rounded-xl border border-slate-200 bg-white p-3 active:bg-slate-100"
                >
                  <View>
                    <Text className="text-base font-semibold text-slate-900">
                      {item.rollNumber}. {item.fullName}
                    </Text>
                    <Text className="text-xs text-slate-500">
                      Parent: {item.parentPhone ?? "N/A"}
                    </Text>
                  </View>
                  <View
                    className={`rounded-md px-2.5 py-1 ${STATUS_BADGE_CLASSES[status]}`}
                  >
                    <Text className="text-xs font-bold text-slate-900">
                      {status.toUpperCase()}
                    </Text>
                  </View>
                </Pressable>
              );
            }}
          />

          <Pressable
            onPress={handleSaveAttendance}
            className="mt-3.5 items-center rounded-xl bg-slate-900 py-3.5 active:bg-slate-800"
          >
            <Text className="text-base font-bold text-white">
              Save Attendance to SQLite
            </Text>
          </Pressable>

          {saveMessage && (
            <Text className="mt-2 text-center font-semibold text-green-700">
              {saveMessage}
            </Text>
          )}
        </View>
      ) : (
        <Text className="text-sm text-slate-500">
          Tap a classroom above to load its roster.
        </Text>
      )}
    </View>
  );
}
