import NetInfo from "@react-native-community/netinfo";
import { Link, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { clearAuthToken, getAuthToken } from "../sync/api";
import { getPendingSyncCount, syncNow } from "../sync/syncService";

interface SyncBarProps {
  onSynced?: () => void;
}

export function SyncBar({ onSynced }: SyncBarProps) {
  const [isOnline, setIsOnline] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const refreshState = useCallback(async () => {
    const [token, count] = await Promise.all([
      getAuthToken(),
      getPendingSyncCount(),
    ]);
    setLoggedIn(Boolean(token));
    setPending(count);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshState();
    }, [refreshState]),
  );

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      setIsOnline(
        Boolean(state.isConnected) && state.isInternetReachable !== false,
      );
    });
    return () => unsub();
  }, []);

  const handleManualSync = async () => {
    setSyncing(true);
    setFeedback(null);
    try {
      const res = await syncNow();
      await refreshState();
      if (res) {
        setFeedback(
          `Synced: ↓${res.pulledStudents} students, ↑${res.pushedAttendance + res.pushedMarks} records`,
        );
        onSynced?.();
      }
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const handleLogout = async () => {
    await clearAuthToken();
    setLoggedIn(false);
    setFeedback("Logged out");
  };

  return (
    <View className="mb-3 rounded-xl border border-slate-200 bg-white p-3">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <View
            className={`h-2.5 w-2.5 rounded-full ${
              isOnline ? "bg-green-500" : "bg-slate-400"
            }`}
          />
          <Text className="text-xs font-semibold text-slate-700">
            {isOnline ? "Online" : "Offline"} • {pending} pending
          </Text>
        </View>

        <View className="flex-row items-center gap-2">
          {loggedIn ? (
            <>
              <Pressable
                onPress={handleManualSync}
                disabled={syncing || !isOnline}
                className="rounded-lg bg-slate-900 px-3 py-1.5 disabled:opacity-40"
              >
                {syncing ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text className="text-xs font-bold text-white">Sync Now</Text>
                )}
              </Pressable>
              <Pressable
                onPress={handleLogout}
                className="rounded-lg border border-slate-300 px-2.5 py-1.5"
              >
                <Text className="text-xs font-semibold text-slate-600">
                  Logout
                </Text>
              </Pressable>
            </>
          ) : (
            <Link href="./login" asChild>
              <Pressable className="rounded-lg bg-blue-600 px-3 py-1.5">
                <Text className="text-xs font-bold text-white">Login</Text>
              </Pressable>
            </Link>
          )}
        </View>
      </View>

      {feedback && (
        <Text className="mt-1.5 text-xs text-slate-500">{feedback}</Text>
      )}
    </View>
  );
}
