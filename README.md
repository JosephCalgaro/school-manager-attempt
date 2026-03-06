# 🎓 School Manager

![GitHub repo
size](https://img.shields.io/github/repo-size/JosephCalgaro/school-manager-attempt)


A **full-stack School Management System** built with **React
(frontend)** and **Node.js + Express (backend)**.

The platform allows administrators and teachers to manage **students,
classes, assignments, and users** through a modern dashboard powered by
a REST API.

------------------------------------------------------------------------

# 📚 Table of Contents

-   Overview
-   Architecture
-   Tech Stack
-   Project Structure
-   API Documentation
-   Database
-   Installation
-   Environment Variables
-   Running the Project
-   Roadmap

------------------------------------------------------------------------

# 🚀 Overview

  Layer            Description
  ---------------- -------------------------------------------------
  Frontend         React dashboard for teachers and administrators
  Backend          REST API built with Express
  Database         MySQL relational database
  Authentication   JWT based authentication

Features:

-   Student management
-   Teacher management
-   Class management
-   Assignment tracking
-   Authentication system
-   File uploads for assignments
-   Dashboard analytics

------------------------------------------------------------------------

# 🏗 Architecture

    school-manager
    │
    ├── frontend      React + TypeScript + Vite
    │
    └── backend       Node.js + Express API
        ├── controllers
        ├── routes
        ├── database
        ├── middlewares
        └── utils

------------------------------------------------------------------------

# 🧰 Tech Stack

## Frontend

-   React
-   TypeScript
-   Vite
-   TailwindCSS
-   React Router
-   ApexCharts
-   FullCalendar

## Backend

-   Node.js
-   Express
-   MySQL
-   JWT Authentication
-   bcrypt
-   Nodemon

------------------------------------------------------------------------

# 📁 Project Structure

    school-manager
    │
    ├── frontend
    │   ├── src
    │   │   ├── components
    │   │   ├── pages
    │   │   ├── hooks
    │   │   ├── context
    │   │   ├── layout
    │   │   └── App.tsx
    │   │
    │   └── vite.config.ts
    │
    └── backend
        ├── src
        │   ├── controllers
        │   ├── routes
        │   ├── database
        │   ├── middlewares
        │   └── utils

------------------------------------------------------------------------

# 📡 API Documentation

**Base URL**

    http://localhost:3000

Protected routes require:

    Authorization: Bearer <token>

------------------------------------------------------------------------

# 🔐 Authentication

## Login

POST `/auth/login`

### Request

``` json
{
  "email": "admin@email.com",
  "password": "password"
}
```

### Response

``` json
{
  "token": "jwt_token",
  "user": {
    "id": 1,
    "name": "Admin",
    "role": "admin"
  }
}
```

------------------------------------------------------------------------

## Get Profile

GET `/auth/profile`

Headers

    Authorization: Bearer token

------------------------------------------------------------------------

# 👨‍🎓 Students API

| Method | Endpoint        | Description       |
| ------ | --------------- | ----------------- |
| GET    | `/students`     | Get all students  |
| GET    | `/students/:id` | Get student by id |
| POST   | `/students`     | Create student    |
| PUT    | `/students/:id` | Update student    |
| DELETE | `/students/:id` | Delete student    |


Example:

``` json
{
  "name": "John Doe",
  "birth_date": "2010-05-12",
  "phone": "123456789"
}
```

------------------------------------------------------------------------

# 👩‍🏫 Teachers API

| Method | Endpoint        | Description       |
| ------ | --------------- | ----------------- |
| GET    | `/teachers`     | Get all teachers  |
| GET    | `/teachers/:id` | Get teacher by id |
| POST   | `/teachers`     | Create teacher    |
| PUT    | `/teachers/:id` | Update teacher    |
| DELETE | `/teachers/:id` | Delete teacher    |


------------------------------------------------------------------------

# 👥 Users API

| Method | Endpoint     | Description    |
| ------ | ------------ | -------------- |
| GET    | `/users`     | Get all users  |
| GET    | `/users/:id` | Get user by id |
| POST   | `/users`     | Create user    |
| PUT    | `/users/:id` | Update user    |
| DELETE | `/users/:id` | Delete user    |


------------------------------------------------------------------------

# 🏫 Classes API

| Method | Endpoint       | Description     |
| ------ | -------------- | --------------- |
| GET    | `/classes`     | Get all classes |
| GET    | `/classes/:id` | Get class by id |
| POST   | `/classes`     | Create class    |
| PUT    | `/classes/:id` | Update class    |
| DELETE | `/classes/:id` | Delete class    |

------------------------------------------------------------------------

# 📝 Assignments API

| Method | Endpoint           | Description         |
| ------ | ------------------ | ------------------- |
| GET    | `/assignments`     | Get all assignments |
| GET    | `/assignments/:id` | Get assignment      |
| POST   | `/assignments`     | Create assignment   |
| PUT    | `/assignments/:id` | Update assignment   |
| DELETE | `/assignments/:id` | Delete assignment   |

Assignments support file uploads stored in:

    /uploads/assignments

------------------------------------------------------------------------

# 👪 Responsibles (Guardians)

| Method | Endpoint            | Description     |
| ------ | ------------------- | --------------- |
| GET    | `/responsibles`     | Get guardians   |
| GET    | `/responsibles/:id` | Get guardian    |
| POST   | `/responsibles`     | Create guardian |
| PUT    | `/responsibles/:id` | Update guardian |
| DELETE | `/responsibles/:id` | Delete guardian |


------------------------------------------------------------------------

# 🗄 Database

Database: **MySQL**

Configured in:

    backend/src/database/connection.js

------------------------------------------------------------------------

## Tables

### assignment_files

| Column        | Type      |
| ------------- | --------- |
| id            | INT       |
| assignment_id | INT       |
| original_name | VARCHAR   |
| stored_name   | VARCHAR   |
| mime_type     | VARCHAR   |
| size_bytes    | INT       |
| created_at    | TIMESTAMP |

### assignment_completions

| Column        | Type      |
| ------------- | --------- |
| id            | INT       |
| assignment_id | INT       |
| student_id    | INT       |
| completed     | BOOLEAN   |
| created_at    | TIMESTAMP |
| updated_at    | TIMESTAMP |


Unique constraint:

    assignment_id + student_id

------------------------------------------------------------------------

# ⚙️ Installation

    git clone https://github.com/JosephCalgaro/school-manager-attempt.git

------------------------------------------------------------------------

# 🔧 Backend Setup

    cd backend
    npm install
    npm run dev

Server:

    http://localhost:3000

------------------------------------------------------------------------

# 🎨 Frontend Setup

    cd frontend
    npm install
    npm run dev

Frontend:

    http://localhost:5173

------------------------------------------------------------------------

# 🔑 Environment Variables

Create `.env` inside `backend`:

    DB_HOST=localhost
    DB_USER=root
    DB_PASSWORD=password
    DB_NAME=school_manager
    JWT_SECRET=secret
    PORT=3000

------------------------------------------------------------------------

# 🛣 Roadmap

-   Role-based access control
-   Attendance tracking
-   Grades system
-   Notifications
-   Swagger UI documentation
-   Docker support
-   CI/CD pipeline

------------------------------------------------------------------------

# 📄 License

This is a personal project
