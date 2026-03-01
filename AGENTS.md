# AGENTS.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

School Manager is a full-stack web application for managing students, users, classes, assignments, and responsibles (guardians) at a school. The codebase is a monorepo with two independent Node.js projects:

- `backend/` — Express 5 REST API (plain JavaScript, ES modules) with MySQL via mysql2
- `frontend/` — React 18 + TypeScript SPA built on the TailAdmin dashboard template, using Vite, Tailwind CSS 3, and React Router 7

## Build & Run Commands

### Backend (`backend/`)
- Install: `npm install`
- Dev server (with hot-reload via nodemon): `npm run dev`
- Production start: `npm start`
- Env vars in `backend/.env`: `PORT`, `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT`, `JWT_SECRET`
- Requires a running MySQL 8.0+ instance with a `school_manager` database

### Frontend (`frontend/`)
- Install: `npm install` (use `--legacy-peer-deps` if peer dependency conflicts arise with React 18)
- Dev server: `npm run dev`
- Build: `npm run build` (runs `tsc -b` then `vite build`)
- Lint: `npm run lint` (ESLint with typescript-eslint and react-hooks/react-refresh plugins)
- Preview production build: `npm run preview`

### No test framework is currently configured in either package.

## Architecture

### Backend

Standard layered Express architecture using ES module syntax (`"type": "module"`).

- `src/server.js` — Entry point; starts the Express app on the configured port.
- `src/app.js` — App setup: registers CORS, JSON body parser, all route groups, and the `/ping` health-check endpoint.
- `src/database/connection.js` — Creates and exports a mysql2 connection pool (configured via dotenv, 20 max connections).
- `src/routes/` — Express routers mapped to controller functions. Seven route groups:
  - `/auth` (public) — login and profile (`GET /auth/profile` is protected)
  - `/students` (protected) — CRUD for students
  - `/users` (protected) — CRUD for users
  - `/classes` (protected) — CRUD for classes, plus `DELETE /:id/students/:studentId`
  - `/assignments` (protected) — CRUD for assignments
  - `/responsibles` (protected) — CRUD for responsibles, plus `GET /:id/students`
  - `/admin` (protected + admin-only) — dashboard stats, paginated student/user listings, student classes/attendance/assignments
- `src/controllers/` — Business logic per entity. Controllers run raw SQL queries against the pool. Student create/update use MySQL transactions to atomically upsert the `responsibles` table.
- `src/middlewares/auth.js` — JWT Bearer token verification middleware. Sets `req.userId` and `req.userRole`.
- `src/utils/validator.js` — Shared validation functions (CPF check-digit algorithm, email, date, minor-age detection, payload validators for students, users, classes, assignments, and responsibles).

**Known issue:** `adminRoutes.js` has a local `isAdmin` middleware that checks `req.user.role`, but the auth middleware sets `req.userRole` (not `req.user`). This will cause admin routes to fail at runtime.

Key domain rules:
- Students who are minors (< 18 years old, calculated from `birthDate`) require a `responsible` object with guardian details. The responsible is upserted by CPF.
- User deletion is a soft-delete (`is_active = 0`), not a hard delete. Student deletion is a hard delete.
- User roles validated by backend: `ADMIN`, `SECRETARY`, `TEACHER`. Students are a separate table and do not have user accounts.
- Passwords are hashed with bcryptjs (cost factor 10).
- JWT tokens encode `{ sub: userId, role }` and expire in 10 hours. Secret is read from `JWT_SECRET` env var (falls back to `'secret123'`).

Database tables: `users`, `students`, `classes`, `assignments`, `responsibles`. Admin controller queries also reference `class_students` (join table), `attendance`, and `grades` tables.

### Frontend

React SPA based on the TailAdmin free dashboard template.

- `src/main.tsx` — Root render with `ThemeProvider` (dark mode) and `AppWrapper` (Helmet for page meta).
- `src/App.tsx` — Route definitions. All dashboard routes are wrapped in `ProtectedRoute` → `AppLayout` (sidebar + header + `<Outlet />`). `/signin` is outside the layout.
- `src/components/auth/ProtectedRoute.tsx` — Redirects unauthenticated users to `/signin`.
- `src/context/` — React contexts:
  - `AuthContext.ts` + `AuthProvider.tsx` — Manages JWT auth state, persists session in `localStorage` under the `'auth'` key, provides `login()`, `logout()`, and `authFetch()` (auto-attaches Bearer token).
  - `SidebarContext` — Sidebar expand/collapse and mobile state.
  - `ThemeContext` — Light/dark theme toggle persisted in `localStorage`.
- `src/hooks/` — `useAuth()`, `useGoBack()`, `useModal()`.
- `src/layout/` — `AppLayout`, `AppSidebar`, `AppHeader`, `Backdrop`.
- `src/pages/AdminPages/` — Admin-only pages (`AdminDashboard`, `AdminStudents`, `AdminUsers`) that check `user.role === 'ADMIN'` client-side and call `/admin/*` endpoints.
- `src/components/` — Reusable UI: auth forms, charts (ApexCharts), tables, form elements, and generic UI components.
- SVGs are imported as React components via `vite-plugin-svgr` (named export `ReactComponent`).

The frontend calls the backend API at relative paths (e.g., `/auth/login`). In development, `vite.config.ts` proxies `/auth`, `/students`, `/users`, `/classes`, `/assignments`, `/attendance`, and `/ping` to `http://localhost:3333`.

## Code Conventions

- Backend is plain JavaScript with ES module imports (`.js` extension required in import paths).
- Frontend is TypeScript with strict mode enabled (`noUnusedLocals`, `noUnusedParameters`).
- Comments and user-facing error messages in the backend are written in Portuguese (pt-BR).
- Tailwind CSS uses a custom color palette (brand, success, error, warning, etc.) and custom font family `outfit`. Dark mode is class-based (`darkMode: "class"`).
- UI text throughout the frontend is in Portuguese.
