# Supabase Schema Migration

In order for your app to work with Supabase, you must execute the following SQL script in the **Supabase SQL Editor** on your dashboard. This creates the corresponding tables to mimic the previous Firebase Collections structure.

```sql
-- Enable the UUID extension if not already present
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. users table
CREATE TABLE users (
  id uuid PRIMARY KEY, -- matches auth.users() id
  name text,
  email text,
  role text,
  onboarding_completed boolean DEFAULT false,
  created_at timestamp with time zone,
  level text,
  department text,
  matric_number text,
  staff_id text,
  phone_number text
);

-- 2. courses table
CREATE TABLE courses (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_code text,
  course_title text,
  lecturer_id uuid,
  level text,
  department text,
  required_attendance integer,
  expected_classes integer,
  created_at timestamp with time zone
);

-- 3. sessions table
CREATE TABLE sessions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id uuid,
  lecturer_id uuid,
  qr_token text,
  latitude double precision,
  longitude double precision,
  radius_meters integer,
  expires_at timestamp with time zone,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone
);

-- 4. attendance table
CREATE TABLE attendance (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id uuid,
  student_id uuid,
  course_id uuid,
  latitude double precision,
  longitude double precision,
  marked_at timestamp with time zone,
  method text -- 'qr' or 'manual'
);

-- 5. course_registrations table
CREATE TABLE course_registrations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id uuid,
  student_id uuid,
  registered_at timestamp with time zone
);

-- 6. semester_registrations table
CREATE TABLE semester_registrations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id uuid,
  semester text,
  registered_at timestamp with time zone
);

-- OPTIONAL: Add Row Level Security (RLS) policies if you want true database-level security.
-- By default (if RLS is disabled), requests from your application's API anon-key will be able to read/write all rows.
```

## Important Notes on Authentication

With Firebase, you could easily create users manually. Since we have switched to Supabase Auth:
1. Make sure **Email Provider** is enabled in `Authentication -> Providers`.
2. By default, Supabase requires "Email Confirmations". **You MUST disable Email Confirmations in Authentication -> Providers -> Email** if you want seamless sign-up, otherwise newly created users won't be able to log in without clicking an email link first.
3. Don't forget to configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the application environment variables.
