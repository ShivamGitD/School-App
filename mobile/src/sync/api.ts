import * as SecureStore from "expo-secure-store";

const ACCESS_TOKEN_KEY = "school_app_jwt_access";
const REFRESH_TOKEN_KEY = "school_app_jwt_refresh";

// Strip any trailing slash from EXPO_PUBLIC_API_URL to avoid double-slash URLs
const API_BASE_URL = (
  process.env.EXPO_PUBLIC_API_URL ?? "http://127.0.0.1:8000"
).replace(/\/+$/, "");

interface TokenResponse {
  access: string;
  refresh: string;
}

interface RefreshResponse {
  access: string;
  refresh?: string; // Populated if SimpleJWT ROTATE_REFRESH_TOKENS is enabled
}

// Single-flight promise prevents duplicate refresh calls on parallel 401s
let refreshInFlight: Promise<string | null> | null = null;

export async function getAuthToken(): Promise<string | null> {
  return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
}

export async function saveAuthToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token);
}

export async function saveAuthTokens(
  access: string,
  refresh: string,
): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(ACCESS_TOKEN_KEY, access),
    SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refresh),
  ]);
}

export async function clearAuthToken(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
  ]);
}

async function performTokenRefresh(): Promise<string | null> {
  const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  if (!refreshToken) {
    return null;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/token/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh: refreshToken }),
    });

    if (!response.ok) {
      // Refresh token is expired or invalid; clear session so user logs in again
      await clearAuthToken();
      return null;
    }

    const data = (await response.json()) as RefreshResponse;
    if (data.refresh) {
      await saveAuthTokens(data.access, data.refresh);
    } else {
      await saveAuthToken(data.access);
    }
    return data.access;
  } catch {
    // Network drop during refresh: keep stored tokens so offline mode still works
    return null;
  }
}

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = performTokenRefresh().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

function buildHeaders(
  customHeaders: HeadersInit | undefined,
  token: string | null,
): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (customHeaders instanceof Headers) {
    customHeaders.forEach((value, key) => {
      headers[key] = value;
    });
  } else if (Array.isArray(customHeaders)) {
    for (const [key, value] of customHeaders) {
      headers[key] = value;
    }
  } else if (customHeaders) {
    Object.assign(headers, customHeaders);
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

async function parseErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: string };
    if (typeof body.detail === "string" && body.detail.length > 0) {
      return body.detail;
    }
  } catch {
    // Response body is not JSON; fall back to HTTP status
  }
  return `Request failed (${response.status})`;
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  skipAuth = false,
): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const token = skipAuth ? null : await getAuthToken();

  let response = await fetch(url, {
    ...options,
    headers: buildHeaders(options.headers, token),
  });

  // Automatically refresh and retry once when an authenticated request returns 401
  if (response.status === 401 && !skipAuth) {
    const newAccessToken = await refreshAccessToken();
    if (!newAccessToken) {
      throw new Error("Session expired. Please log in again.");
    }

    response = await fetch(url, {
      ...options,
      headers: buildHeaders(options.headers, newAccessToken),
    });
  }

  if (!response.ok) {
    const message = await parseErrorMessage(response);
    throw new Error(message);
  }

  return (await response.json()) as T;
}

export async function loginWithDjango(
  username: string,
  password: string,
): Promise<void> {
  // skipAuth = true prevents invalid login credentials (401) from triggering token refresh
  const data = await apiRequest<TokenResponse>(
    "/api/token/",
    {
      method: "POST",
      body: JSON.stringify({ username, password }),
    },
    true,
  );
  await saveAuthTokens(data.access, data.refresh);
}
