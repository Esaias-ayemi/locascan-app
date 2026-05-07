import Database from 'better-sqlite3';
import path from 'path';

const db = new Database('attendance.db');

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT CHECK(role IN ('student', 'lecturer', 'admin')) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS courses (
    id TEXT PRIMARY KEY,
    course_code TEXT NOT NULL,
    course_title TEXT NOT NULL,
    lecturer_id TEXT NOT NULL,
    FOREIGN KEY (lecturer_id) REFERENCES users(id)
  );
`);

// Migration: Add missing columns if they don't exist
const addColumn = (table: string, column: string, type: string) => {
  try {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
  } catch (e) {
    // Column likely already exists
  }
};

addColumn('users', 'level', 'TEXT');
addColumn('users', 'department', 'TEXT');
addColumn('users', 'matric_number', 'TEXT');
addColumn('users', 'staff_id', 'TEXT');
addColumn('users', 'onboarding_completed', 'BOOLEAN DEFAULT 0');
addColumn('users', 'phone_number', 'TEXT');
addColumn('users', 'reset_token', 'TEXT');
addColumn('users', 'reset_token_expiry', 'DATETIME');

// Cleanup: Convert empty strings to NULL for unique columns
db.exec(`
  UPDATE users SET matric_number = NULL WHERE matric_number = '';
  UPDATE users SET staff_id = NULL WHERE staff_id = '';
`);

// Create unique indexes safely
db.exec(`
  CREATE UNIQUE INDEX IF NOT EXISTS idx_users_matric ON users(matric_number) WHERE matric_number IS NOT NULL;
  CREATE UNIQUE INDEX IF NOT EXISTS idx_users_staff ON users(staff_id) WHERE staff_id IS NOT NULL;
`);

addColumn('courses', 'level', 'TEXT NOT NULL DEFAULT "N/A"');
addColumn('courses', 'department', 'TEXT NOT NULL DEFAULT "N/A"');
addColumn('courses', 'required_attendance', 'INTEGER DEFAULT 70');
addColumn('courses', 'expected_classes', 'INTEGER DEFAULT 10');

db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    course_id TEXT NOT NULL,
    lecturer_id TEXT NOT NULL,
    qr_token TEXT NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    radius_meters INTEGER NOT NULL,
    expires_at DATETIME NOT NULL,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (course_id) REFERENCES courses(id),
    FOREIGN KEY (lecturer_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS attendance (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    student_id TEXT NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    ip_address TEXT,
    marked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(session_id, student_id),
    FOREIGN KEY (session_id) REFERENCES sessions(id),
    FOREIGN KEY (student_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS course_registrations (
    id TEXT PRIMARY KEY,
    course_id TEXT NOT NULL,
    student_id TEXT NOT NULL,
    semester TEXT NOT NULL,
    registered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(course_id, student_id, semester),
    FOREIGN KEY (course_id) REFERENCES courses(id),
    FOREIGN KEY (student_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS semester_registrations (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL,
    semester TEXT NOT NULL,
    registered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, semester),
    FOREIGN KEY (student_id) REFERENCES users(id)
  );
`);

export default db;
