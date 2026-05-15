# Geo-Fenced QR Code Attendance & Course Registration System

A modern, full-stack web application designed for educational institutions to manage student attendance using geo-fenced QR codes and streamline course registrations. The system provides dedicated portals for both Students and Lecturers, built with React, Vite, and Tailwind CSS.

## 🌟 Features

### For Students
*   **Secure QR Attendance:** Mark attendance by scanning dynamically generated QR codes within a designated physical radius (Geo-fencing).
*   **Course Management:** Register and unregister for courses securely.
*   **Analytics Dashboard:** Track personal attendance records, view statistics, and monitor required attendance thresholds.
*   **Profile Settings:** Manage personal information, departments, and levels.

### For Lecturers
*   **Session Management:** Start live attendance sessions with custom geo-fences (latitude, longitude, and acceptable radius).
*   **Dynamic QR Codes:** Generate expiring and refreshing QR codes to prevent proxy attendance.
*   **Course Administration:** Create, update, and manage courses expected to be taught in the semester.
*   **Real-time Analytics:** Monitor session participation, attendance trends, and overall class performance.

### System Architecture & Security
*   **Anti-Proxy Mechanisms:** Combines short-lived QR codes with geo-location validation to ensure students are physically present.
*   **Double Registration Prevention:** Database schema enforces unique constraints (e.g., `UNIQUE(course_id, student_id, semester)`) to completely avoid duplicate registrations.
*   **Offline Tolerance / Local Dev:** Includes an SQLite/Supabase compatibility layer for fluid development and production deployments.

## 🚀 Tech Stack

*   **Frontend:** React 18, Vite, TypeScript
*   **Styling:** Tailwind CSS
*   **Icons & Animations:** Lucide React, Framer Motion
*   **QR Scanner/Generator:** `html5-qrcode`, `qrcode.react`
*   **Backend/Database Compatibility:** Supabase (PostgreSQL) / Local SQLite (via `better-sqlite3`) with a Firebase-like wrapper API (`db-compat.ts`).

## 🛠️ Installation & Setup

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd <repository-folder>
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Environment Variables:**
    Create a `.env` file in the root directory and add your Supabase credentials (if using Supabase) as shown in `.env.example`:
    ```env
    VITE_SUPABASE_URL=your_supabase_url
    VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
    ```

4.  **Run the application (Development):**
    ```bash
    npm run dev
    ```
    The application will be available at `http://localhost:3000`.

5.  **Build for Production:**
    ```bash
    npm run build
    npm start
    ```

## 🏗️ Methodology (Agile Development)

This project was built using an **Iterative Agile Methodology**.

1.  **Iterative Planning & Requirements:** Continuous refinement of functional requirements (e.g., QR scanning, Geo-location checking) and non-functional requirements (e.g., system response time, data integrity).
2.  **Prototyping & Feedback:** Early development of the core QR scanning and session generation capabilities, allowing rapid validation of the anti-proxy concept.
3.  **Sprint-Based Execution:** Features were grouped logically—starting with Authentication, followed by Course Administration, Geo-fenced Sessions, and finally Analytics.
4.  **Continuous Integration:** Utilizing a consistent testing structure to ensure security constraints like double course registration blocks were robust.

This methodology guarantees that the most critical feature—secure, proxy-proof attendance—was validated early and refined continuously throughout the development lifecycle.

## 🔒 Security Measures

*   **Unique Database Constraints:** Prevents duplicate attendance marks or course registrations strictly at the database layer (preventing race conditions).
*   **Geo-fencing Validation:** The frontend forces location disclosure and compares coordinates to the session's approved radius.
*   **Token Expiration:** Attendees cannot copy a QR code and use it later; tokens refresh out of sync with old codes.
*   **Route Protection:** Standard authenticated routing protects Lecturer and Student portals from unauthorized access.

## 📄 License

This project is licensed under the MIT License.
