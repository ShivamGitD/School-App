# School-App

An offline-first mobile classroom management system built as a full-stack monorepo. Teachers can record daily attendance, enter exam marks, and inspect student analytics with zero internet connectivity, then synchronize bidirectionally with a Django REST Framework backend once a network connection is available.

---

## Key Features

- **Offline-First Storage:** All classrooms, rosters, attendance records, and exam marks live in an on-device SQLite database managed by Drizzle ORM. Every read and write works in airplane mode.
- **Bidirectional Pull/Push Sync:** Pulls authoritative classrooms and student rosters from Django (`remoteId` mapping) and pushes locally created or updated attendance and exam marks back with **last-write-wins (LWW)** timestamp conflict resolution.
- **Automatic JWT Refresh & Rotation:** Authenticates against Django SimpleJWT (15-minute access tokens, 7-day rotating refresh tokens) stored in encrypted device storage via `expo-secure-store`. A single-flight `401` interceptor silently refreshes expired access tokens and retries pending sync requests without interrupting the user.
- **Local SQLite Analytics & Reports:** Computes classroom attendance percentages, exam averages, low-attendance flags (below 75%), and expandable per-student subject breakdowns directly on-device with no network calls.

---

## Tech Stack

| Layer                        | Technologies                                                           |
| :--------------------------- | :--------------------------------------------------------------------- |
| **Mobile App (`mobile/`)**   | React Native, Expo, Expo Router, TypeScript, NativeWind (Tailwind CSS) |
| **Local Database & Storage** | `expo-sqlite`, Drizzle ORM, `drizzle-kit`, `expo-secure-store`         |
| **Backend API (`backend/`)** | Python, Django, Django REST Framework, SimpleJWT, SQLite               |
| **Sync & Networking**        | REST JSON Pull/Push endpoints, LAN development over mobile hotspot     |

---

## Monorepo Structure

```text
School-App/
├── backend/
│   ├── config/
│   │   ├── settings.py          # DRF, CORS, and SimpleJWT lifetime/rotation config
│   │   └── urls.py              # Admin, JWT token, and sync routes
│   ├── sync_api/
│   │   ├── models.py            # Classroom, Student, Attendance, ExamMark models
│   │   ├── serializers.py       # Validation & sync payload serializers
│   │   ├── views.py             # SyncPullView & SyncPushView (LWW conflict logic)
│   │   └── admin.py             # Django Admin registrations
│   └── manage.py
└── mobile/
    ├── drizzle/                 # Generated SQLite migrations
    ├── src/
    │   ├── app/
    │   │   ├── _layout.tsx      # Root Expo Router stack & DB migration bootstrap
    │   │   ├── index.tsx        # Classrooms & daily attendance marking
    │   │   ├── marks.tsx        # Exam marks entry
    │   │   ├── reports.tsx      # Offline KPI cards & expandable student breakdowns
    │   │   └── login.tsx        # Teacher JWT sign-in
    │   ├── components/
    │   │   └── SyncBar.tsx      # Auth state indicator & manual Sync Now trigger
    │   ├── db/
    │   │   ├── client.ts        # Expo SQLite + Drizzle client
    │   │   ├── schema.ts        # Local tables with remoteId & updatedAt tracking
    │   │   └── queries/         # classrooms.ts, attendance.ts, marks.ts, reports.ts
    │   └── sync/
    │       ├── api.ts           # Fetch wrapper with single-flight 401 JWT refresh
    │       └── syncService.ts   # Push/pull orchestration against Django
    └── package.json
```

---

## Sync & Authentication Architecture

```text
[Offline Action] ──▶ Write to local SQLite (Drizzle) with updatedAt timestamp
                            │
                            ▼ (When online / tap "Sync Now")
                   apiRequest() sends Bearer access token
                            │
              ┌─────────────┴─────────────┐
              ▼ (200 OK)                  ▼ (401 Unauthorized)
     1. POST /api/sync/push/     Single-flight lock calls
        (LWW on updated_at)      POST /api/token/refresh/
     2. GET /api/sync/pull/               │
        (Upsert by remoteId)     Saves rotated tokens to SecureStore
              │                  and retries original request once
              ▼                           │
     UI refreshes from SQLite ◀───────────┘
```

---

## API Endpoints

| Method | Endpoint              | Auth                   | Purpose                                               |
| :----- | :-------------------- | :--------------------- | :---------------------------------------------------- |
| `POST` | `/api/token/`         | Public                 | Obtain initial JWT access and refresh token pair      |
| `POST` | `/api/token/refresh/` | Public (Refresh Token) | Issue a new access token and rotate the refresh token |
| `GET`  | `/api/sync/pull/`     | Bearer JWT             | Pull classrooms, students, attendance, and marks      |
| `POST` | `/api/sync/push/`     | Bearer JWT             | Push unsynced local attendance and exam marks (LWW)   |
| `GET`  | `/admin/`             | Session                | Manage classrooms, students, and synced records       |

---

## Local Development Setup

### 1. Clone the Repository

```bash
git clone [https://github.com/ShivamGitD/School-App.git](https://github.com/ShivamGitD/School-App.git)
cd School-App
```

### 2. Backend Setup (`backend/`)

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install django djangorestframework djangorestframework-simplejwt django-cors-headers
python manage.py migrate
python manage.py createsuperuser
```

Start the backend bound to all LAN interfaces so your phone can reach it over Wi-Fi/hotspot:

```bash
python manage.py runserver 0.0.0.0:8000
```

Add at least one `Classroom` and `Student` via `http://<YOUR_LAN_IP>:8000/admin/`.

### 3. Mobile Setup (`mobile/`)

```bash
cd mobile
npm install
```

Create `mobile/.env` pointing to your machine's current LAN IPv4 address (never `127.0.0.1` for a physical device):

```env
EXPO_PUBLIC_API_URL=http://<YOUR_LAN_IP>:8000
```

Start Metro over LAN (include `-c` whenever you edit `mobile/.env`):

```bash
npx expo start --lan -c
```

Scan the QR code in **Expo Go** on Android/iOS.

---

## Maintenance Commands

| Folder                     | Command                                                       | When to Run                                            |
| :------------------------- | :------------------------------------------------------------ | :----------------------------------------------------- |
| `backend/` _(venv active)_ | `python manage.py makemigrations && python manage.py migrate` | After modifying `sync_api/models.py`                   |
| `mobile/`                  | `npx drizzle-kit generate`                                    | After modifying `mobile/src/db/schema.ts`              |
| `mobile/`                  | `npx tsc --noEmit`                                            | To run a strict TypeScript check across the mobile app |

---

## Verifying Offline-First Behavior

1. Sign in via **SyncBar** and tap **Sync Now** to pull classrooms and students from Django.
2. Stop the Django server (`Ctrl+C`) or enable Airplane Mode on your device.
3. Mark attendance, save exam marks, and open **Reports**—KPI cards and expandable per-student breakdowns compute and update immediately from local SQLite.
4. Restart Django and tap **Sync Now** to push all queued offline changes back to the server.
