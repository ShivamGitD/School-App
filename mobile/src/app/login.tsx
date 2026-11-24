import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { loginWithDjango } from "../sync/api";
import { syncNow } from "../sync/syncService";

export default function LoginScreen() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!username.trim() || !password) {
      setError("Enter both username and password.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await loginWithDjango(username.trim(), password);
      await syncNow(); // Pull classrooms & students immediately after login
      router.back();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Login failed. Check server URL.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 justify-center bg-slate-50 p-6">
      <Text className="mb-1 text-2xl font-bold text-slate-900">
        Teacher Login
      </Text>
      <Text className="mb-6 text-sm text-slate-500">
        Sign in to sync attendance and marks with Django.
      </Text>

      <Text className="mb-1 text-xs font-semibold uppercase text-slate-600">
        Username
      </Text>
      <TextInput
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        placeholder="teacher1"
        placeholderTextColor="#94a3b8"
        className="mb-4 rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900"
      />

      <Text className="mb-1 text-xs font-semibold uppercase text-slate-600">
        Password
      </Text>
      <TextInput
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        placeholder="••••••••"
        placeholderTextColor="#94a3b8"
        className="mb-5 rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900"
      />

      {error && (
        <Text className="mb-4 text-sm font-medium text-red-600">{error}</Text>
      )}

      <Pressable
        onPress={handleLogin}
        disabled={loading}
        className="items-center rounded-xl bg-blue-600 py-3.5 active:bg-blue-700 disabled:opacity-60"
      >
        {loading ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text className="text-base font-bold text-white">Sign In & Sync</Text>
        )}
      </Pressable>
    </View>
  );
}
