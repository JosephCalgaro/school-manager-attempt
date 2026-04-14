# 🎓 School Manager

![GitHub repo size](https://img.shields.io/github/repo-size/JosephCalgaro/school-manager-attempt)
![React](https://img.shields.io/badge/React-18-blue)
![Node](https://img.shields.io/badge/Node.js-Express-green)
![MySQL](https://img.shields.io/badge/Database-MySQL-orange)

A **full-stack School Management SaaS** with multi-tenant architecture. Built with **React (frontend)** and **Node.js + Express (backend)**.

Manage students, classes, teachers, assignments, attendance, grades, CRM leads, inventory, and more — all organized by role-based access control.

---

## 📚 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Roles & Permissions](#-roles--permissions)
- [Tech Stack](#-tech-stack)
- [Architecture](#-architecture)
- [Project Structure](#-project-structure)
- [Quick Start](#-quick-start)
- [API Overview](#-api-overview)
- [Database](#-database)
- [License](#-license)

---

## 🚀 Overview

| Layer | Description |
|-------|-------------|
| Frontend | React 18 + TypeScript + Vite + TailwindCSS dashboard |
| Backend | Node.js + Express REST API |
| Database | MySQL relational database |
| Authentication | JWT with 6 roles (RBAC) |

---

## ✨ Features

### 🎓 Academic Management
- Student enrollment and management
- Class and schedule management
- Teacher assignments
- Responsible (guardian) linked to students

### 👨‍🏫 Teacher Portal
- Attendance tracking with statistics
- Grade management
- Assignments with file uploads
- Lesson plans and templates
- Class statistics dashboard

### 📊 Reports (Admin)
- Enrollment reports
- Cancellation analysis
- Attendance rates
- Student performance ranking
- CRM conversion funnel

### 📋 CRM (Secretary)
- Lead management with custom fields
- Kanban-style drag-and-drop funnel
- Activity logging
- Field customization
- Stage transitions with notes

### 📦 Inventory
- Item catalog
- Stock movements tracking

### 🏢 SaaS Multi-tenant
- School management
- Impersonation for debugging
- Audit logs
- Usage metrics

### 🔐 Auth & Security
- JWT authentication
- Rate limiting (login protection)
- Role-based access control
- Timing-attack resistant login

### 📤 Export
- Client-side XLSX/CSV generation
- Customizable field selection

---

## 🎭 Roles & Permissions

| Role | API Prefix | Access |
|------|------------|--------|
| `ADMIN` | `/admin/*` | Full access: stats, CRUD, reports, inventory, CRM, lesson plans |
| `TEACHER` | `/teacher/*` | Own classes, attendance, grades, notes, assignments, lesson plans |
| `SECRETARY` | `/secretary/*` | Students, classes, responsibles, CRM |
| `STUDENT` | `/student/*` | Self-service: profile, classes, assignments, grades |
| `RESPONSIBLE` | `/responsible/*` | Linked students, classes, assignments |
| `SAAS_OWNER` | `/saas/*` | School management, impersonation, logs (requires `x-saas-key`) |

---

## 🧰 Tech Stack

### Frontend
- **React 18** + TypeScript
- **Vite** (build tool)
- **TailwindCSS** (styling)
- **React Router** (routing)
- **TanStack Query** (data fetching)
- **React Context** (state)
- **ApexCharts** (charts)
- **FullCalendar** (calendar)
- **React DnD** (drag-and-drop)
- **ExcelJS** (XLSX export)
- **React Hook Form** (forms)

### Backend
- **Node.js** + **Express**
- **MySQL** (database)
- **JWT** (authentication)
- **bcryptjs** (password hashing)
- **mysql2** (MySQL driver)
- **CORS** (cross-origin)
- **express-rate-limit** (rate limiting)
- **PM2** (production process manager)

---

## 🏗 Architecture

```
school-manager/
├── frontend/                 # React SPA
│   └── src/
│       ├── pages/            # Organized by role
│       │   ├── AdminPages/
│       │   ├── TeacherPages/
│       │   ├── SecretaryPages/
│       │   ├── StudentPages/
│       │   ├── ResponsiblePages/
│       │   └── SaasPages/
│       ├── components/       # Reusable UI
│       ├── hooks/            # Custom hooks
│       └── context/          # Auth context
│
└── backend/                  # Express API
    └── src/
        ├── controllers/      # Business logic
        ├── routes/          # API routes by role
        ├── middlewares/      # Auth, rate limiting, logging
        ├── database/         # Connection + migrations
        └── utils/            # Helpers
```

### Multi-tenant SaaS
Each school has isolated data (`school_id` filter on all queries). SaaS owner can impersonate any school for debugging.

### Auto-migrations
On backend startup, tables are auto-created/updated:
- `ensureContactColumns()` — CRM custom fields
- `initCrmTables()` — CRM tables
- `ensureIndexes()` — Performance indexes

---

## 📁 Project Structure

```
frontend/src/
├── pages/
│   ├── AdminPages/       # AdminDashboard, AdminStudents, AdminUsers, AdminClasses, AdminReports
│   ├── TeacherPages/     # TeacherDashboard, TeacherClassDetail, TeacherLessonPlans
│   ├── SecretaryPages/   # SecretaryCRM, SecretaryStudents, SecretaryClasses
│   ├── StudentPages/     # StudentDashboard
│   ├── ResponsiblePages/ # ResponsibleDashboard
│   └── SaasPages/        # SaasPanel
├── components/
│   ├── ui/               # Table, Modal, Button, etc.
│   └── export/           # ExportModal
├── hooks/                # useAuth, custom hooks
├── context/              # AuthProvider
└── utils/               # export.ts (XLSX/CSV)

backend/src/
├── controllers/          # admin, auth, crm, teacher, reports, inventory, saas, schools, responsibles, student, responsibleSelf
├── routes/               # admin, auth, teacher, secretary, studentSelf, responsibleSelf, saas, schools
├── middlewares/          # auth, rateLimiter, logger
└── database/            # connection, migrations
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- MySQL 8+

### Backend Setup

```bash
cd backend
npm install
```

Create `.env` in `backend/`:
```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=<your_db_password>
DB_NAME=school_manager
JWT_SECRET=<generate_strong_random_secret>
PORT=3333
NODE_ENV=development
SAAS_MASTER_KEY=<generate_strong_random_key>
```

```bash
npm run dev   # Starts on http://localhost:3333
```

### Frontend Setup

```bash
cd frontend
npm install
npm run dev   # Starts on http://localhost:5173
```
---

## 📡 API Overview

**Base URL:**
```
http://localhost:3333
```

**Authentication:**
```
Authorization: Bearer <jwt_token>
```

### Public Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/login` | Authenticate user |
| GET | `/auth/profile` | Get current user profile |

### Admin (`/admin/*`)

Full access to: stats, students, users, classes, responsibles, lesson-plans, inventory, CRM, reports.

### Teacher (`/teacher/*`)

Access to: own classes, attendance, grades, notes, assignments, lesson-plans, statistics.

### Secretary (`/secretary/*`)

Access to: students, classes, responsibles, CRM leads, activities, custom fields.

### Student (`/student/*`)

Self-service: profile, own classes, own assignments, own grades.

### Responsible (`/responsible/*`)

Self-service: linked students, their classes and assignments.

### SaaS (`/saas/*`)

Requires `x-saas-key` header. Access to: schools, impersonation, logs, metrics.

---

## 🗄 Database

**MySQL** — configured in `backend/src/database/connection.js`

### Tables

| Table | Description |
|-------|-------------|
| `users` | User accounts with roles |
| `students` | Student records |
| `classes` | Class definitions |
| `responsibles` | Guardian records |
| `student_class` | Student-class enrollment |
| `student_responsible` | Student-guardian links |
| `assignments` | Assignments with file support |
| `assignment_files` | Uploaded file metadata |
| `assignment_completions` | Student completion tracking |
| `attendance` | Daily attendance records |
| `grades` | Grade records |
| `notes` | Teacher notes per student |
| `lesson_plan_templates` | Lesson plan templates |
| `lesson_plans` | Lesson plans |
| `crm_leads` | CRM leads |
| `crm_activities` | Lead activities |
| `crm_custom_fields` | Custom field definitions |
| `crm_lead_field_values` | Lead field values |
| `crm_stage_logs` | Stage transition history |
| `inventory_items` | Inventory items |
| `inventory_movements` | Stock movements |
| `schools` | Multi-tenant schools |
| `saas_impersonations` | Impersonation audit |
| `audit_logs` | General audit trail |

---

## 📄 License

This is a personal project. All rights reserved.
