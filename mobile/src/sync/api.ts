import * as SecureStore from "expo-secure-store";

interface TokenResponse {
  access: string;
  refresh: string;
}

const ACCESS_TOKEN_KEY = "school_app_jwt_access";

// Set EXPO_PUBLIC_API_URL in your project root .env file (e.g., http://10.50.83.29:8000)
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http:127.0.0.1:8000";

export async function loginWithDjango(
  username: string,
  password: string,
): Promise<void> {
  const data = await apiRequest<TokenResponse>("/api/token/", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  await saveAuthToken(data.access);
}

export async function saveAuthToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token);
}

export async function getAuthToken(): Promise<string | null> {
  return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
}

export async function clearAuthToken(): Promise<void> {
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = await getAuthToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`HTTP ${response.status} on ${path}: ${body}`);
  }

  return (await response.json()) as T;
}
