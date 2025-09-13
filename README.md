# LMS-BY-SOURABH
A lightweight, role-based Learning Management System built with HTML, CSS (Bootstrap), and vanilla JavaScript. Data persistence is handled with Session Storage — no backend required for demo purposes.
A lightweight, role-based Learning Management System built with HTML, CSS (Bootstrap), and vanilla JavaScript.
Data persistence is handled with Session Storage — no backend required for demo purposes.

✨ Features
🔑 Authentication

Login / Signup screens

Role-based access (Admin / Student)

Disabled accounts cannot log in

👨‍🏫 Admin Features

Manage Users (add, edit, remove)

Enable / Disable accounts (toggle switch)

Change user roles (student ↔ admin)

Generate student certificates (printable & styled)

Manage Courses:

Create, edit, delete

Add YouTube videos (embedded in course cards)

Manage Learning Paths

Manage Assessments (create, delete)

Upload and manage content library

Add Calendar events (with FullCalendar)

View Reports & Analytics (Chart.js graphs)

Export Users to CSV

🎓 Student Features

Sign up and log in

Browse, enroll, and view courses

Watch embedded YouTube lectures

Generate own certificate for enrolled courses

Take proctored assessments (camera permission required)

Participate in communication feed (posts/discussions)

Access content library (read-only)

View calendar events

Track progress on dashboard

🛠 Tech Stack

Frontend: HTML5, CSS3, Bootstrap 5

Logic: Vanilla JavaScript (ES6+)

UI Enhancements: Bootstrap Modals, FullCalendar, Chart.js

Persistence: Browser Session Storage (no backend)

PDF Certificates: Generated dynamically in a new tab

📂 Project Structure
lms/
 ├── index.html      # Main HTML shell
 ├── styles.css      # Custom theme + palette
 ├── app.js          # ~900 lines of full LMS logic
 └── assets/         # (optional) static resources

🎨 UI & Palette

This LMS uses a clean, minimalist color scheme:

#FFFADC (Background light)

#B6F500 (Accent 1)

#A4DD00 (Accent 2)

#98CD00 (Accent 3)
