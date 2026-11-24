import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  type Classroom,
  getAllClassrooms,
  getStudentsByClassroom,
  type Student,
} from "../db/queries/classrooms";
import {
  type ExamMarkInput,
  getMarksByClassroom,
  saveBulkExamMarks,
} from "../db/queries/marks";

const EXAMS = ["Unit Test 1", "Midterm", "Final"];
const SUBJECTS = ["Mathematics", "Science", "English", "Hindi"];

export default function ExamMarksScreen() {
  const [loading, setLoading] = useState(true);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [selectedClass, setSelectedClass] = useState<Classroom | null>(null);
  const [selectedExam, setSelectedExam] = useState<string>(EXAMS[0]);
  const [selectedSubject, setSelectedSubject] = useState<string>(SUBJECTS[0]);
  const [maxMarks, setMaxMarks] = useState<string>("100");

  const [students, setStudents] = useState<Student[]>([]);
  const [marksMap, setMarksMap] = useState<Record<number, string>>({});
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    (async () => {
      const list = await getAllClassrooms();
      setClassrooms(list);
      if (list.length > 0) setSelectedClass(list[0]);
      setLoading(false);
    })();
  }, []);

  const loadRosterAndMarks = useCallback(async () => {
    if (!selectedClass) return;
    setStatusMessage(null);

    const roster = await getStudentsByClassroom(selectedClass.localId);
    const existing = await getMarksByClassroom(
      selectedClass.localId,
      selectedSubject,
      selectedExam,
    );

    const nextMap: Record<number, string> = {};
    for (const student of roster) {
      const record = existing.find((m) => m.studentLocalId === student.localId);
      nextMap[student.localId] = record ? String(record.marksObtained) : "";
    }

    if (existing.length > 0) {
      setMaxMarks(String(existing[0].maxMarks));
    }

    setStudents(roster);
    setMarksMap(nextMap);
  }, [selectedClass, selectedSubject, selectedExam]);

  useEffect(() => {
    loadRosterAndMarks();
  }, [loadRosterAndMarks]);

  const handleMarkChange = (studentLocalId: number, value: string) => {
    // Allow digits and a single decimal point
    const cleaned = value.replace(/[^0-9.]/g, "");
    setMarksMap((prev) => ({ ...prev, [studentLocalId]: cleaned }));
    setStatusMessage(null);
  };

  const handleSaveMarks = async () => {
    if (!selectedClass) return;

    const parsedMax = Number.parseFloat(maxMarks);
    if (Number.isNaN(parsedMax) || parsedMax <= 0) {
      setStatusMessage({
        type: "error",
        text: "Enter a valid Max Marks value.",
      });
      return;
    }

    const entries: ExamMarkInput[] = [];

    for (const student of students) {
      const raw = marksMap[student.localId]?.trim();
      if (!raw) continue; // Skip blank rows

      const obtained = Number.parseFloat(raw);
      if (Number.isNaN(obtained) || obtained < 0 || obtained > parsedMax) {
        setStatusMessage({
          type: "error",
          text: `Invalid marks for ${student.fullName} (must be 0–${parsedMax}).`,
        });
        return;
      }

      entries.push({
        studentLocalId: student.localId,
        subject: selectedSubject,
        examName: selectedExam,
        marksObtained: obtained,
        maxMarks: parsedMax,
      });
    }

    if (entries.length === 0) {
      setStatusMessage({
        type: "error",
        text: "Enter marks for at least one student.",
      });
      return;
    }

    await saveBulkExamMarks(entries);
    setStatusMessage({
      type: "success",
      text: `Saved ${entries.length} marks for ${selectedSubject} (${selectedExam}) offline.`,
    });
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1 bg-slate-50 p-4"
    >
      {/* Classroom Selector */}
      <Text className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Classroom
      </Text>
      <FlatList
        data={classrooms}
        keyExtractor={(item) => String(item.localId)}
        horizontal
        showsHorizontalScrollIndicator={false}
        className="mb-3 max-h-11"
        contentContainerStyle={{ gap: 8 }}
        renderItem={({ item }) => {
          const active = selectedClass?.localId === item.localId;
          return (
            <Pressable
              onPress={() => setSelectedClass(item)}
              className={`justify-center rounded-lg border px-3.5 py-2 ${
                active
                  ? "border-blue-600 bg-blue-600"
                  : "border-slate-300 bg-white"
              }`}
            >
              <Text
                className={`text-sm font-semibold ${
                  active ? "text-white" : "text-slate-800"
                }`}
              >
                {item.name} - {item.section}
              </Text>
            </Pressable>
          );
        }}
      />

      {/* Exam Selector */}
      <Text className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Exam
      </Text>
      <FlatList
        data={EXAMS}
        keyExtractor={(item) => item}
        horizontal
        showsHorizontalScrollIndicator={false}
        className="mb-3 max-h-10"
        contentContainerStyle={{ gap: 8 }}
        renderItem={({ item }) => {
          const active = selectedExam === item;
          return (
            <Pressable
              onPress={() => setSelectedExam(item)}
              className={`justify-center rounded-lg border px-3 py-1.5 ${
                active
                  ? "border-slate-900 bg-slate-900"
                  : "border-slate-300 bg-white"
              }`}
            >
              <Text
                className={`text-xs font-semibold ${
                  active ? "text-white" : "text-slate-700"
                }`}
              >
                {item}
              </Text>
            </Pressable>
          );
        }}
      />

      {/* Subject & Max Marks Row */}
      <View className="mb-3 flex-row items-end gap-2">
        <View className="flex-1">
          <Text className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Subject
          </Text>
          <FlatList
            data={SUBJECTS}
            keyExtractor={(item) => item}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 6 }}
            renderItem={({ item }) => {
              const active = selectedSubject === item;
              return (
                <Pressable
                  onPress={() => setSelectedSubject(item)}
                  className={`justify-center rounded-lg border px-3 py-2 ${
                    active
                      ? "border-indigo-600 bg-indigo-600"
                      : "border-slate-300 bg-white"
                  }`}
                >
                  <Text
                    className={`text-xs font-semibold ${
                      active ? "text-white" : "text-slate-700"
                    }`}
                  >
                    {item}
                  </Text>
                </Pressable>
              );
            }}
          />
        </View>

        <View className="w-20">
          <Text className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Max
          </Text>
          <TextInput
            value={maxMarks}
            onChangeText={(val) => setMaxMarks(val.replace(/[^0-9.]/g, ""))}
            keyboardType="decimal-pad"
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-center text-sm font-bold text-slate-900"
          />
        </View>
      </View>

      {/* Student Marks List */}
      <FlatList
        data={students}
        keyExtractor={(item) => String(item.localId)}
        contentContainerStyle={{ gap: 8, paddingBottom: 12 }}
        renderItem={({ item }) => (
          <View className="flex-row items-center justify-between rounded-xl border border-slate-200 bg-white px-3.5 py-2.5">
            <View className="flex-1 pr-3">
              <Text className="text-base font-semibold text-slate-900">
                {item.rollNumber}. {item.fullName}
              </Text>
            </View>
            <View className="flex-row items-center gap-1.5">
              <TextInput
                value={marksMap[item.localId] ?? ""}
                onChangeText={(val) => handleMarkChange(item.localId, val)}
                placeholder="—"
                placeholderTextColor="#94a3b8"
                keyboardType="decimal-pad"
                className="w-16 rounded-lg border border-slate-300 bg-slate-50 px-2 py-1.5 text-center text-base font-bold text-slate-900"
              />
              <Text className="text-xs font-medium text-slate-500">
                / {maxMarks || "—"}
              </Text>
            </View>
          </View>
        )}
      />

      {/* Save Button & Feedback */}
      <Pressable
        onPress={handleSaveMarks}
        className="mt-2 items-center rounded-xl bg-slate-900 py-3.5 active:bg-slate-800"
      >
        <Text className="text-base font-bold text-white">
          Save Marks to SQLite
        </Text>
      </Pressable>

      {statusMessage && (
        <Text
          className={`mt-2 text-center text-sm font-semibold ${
            statusMessage.type === "success" ? "text-green-700" : "text-red-600"
          }`}
        >
          {statusMessage.text}
        </Text>
      )}
    </KeyboardAvoidingView>
  );
}
