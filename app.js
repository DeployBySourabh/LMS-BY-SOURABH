/* ========================================================
   app.js — Full LMS application with admin features
   - sessionStorage-based demo backend
   - Admin: enable/disable users, generate student certificate,
            add embedded YouTube videos to courses
   - Student: enroll courses, take assessments (proctored)
   - Modular UI using Bootstrap modal forms
   - Calendar (FullCalendar), Charts (Chart.js) optional
   ======================================================== */

/* ============================
   Storage keys & helpers
   ============================ */
const STORAGE = {
    USERS: "lms_users_v4",
    COURSES: "lms_courses_v4",
    PATHS: "lms_paths_v4",
    ASSESSMENTS: "lms_assessments_v4",
    EVENTS: "lms_events_v4",
    POSTS: "lms_posts_v4",
    CONTENT: "lms_content_v4",
    ATTEMPTS: "lms_attempts_v4"
};
const AUTH_KEY = "lms_current_user_v4";

/* Basic persistence helpers */
function save(key, value) {
    sessionStorage.setItem(key, JSON.stringify(value || []));
}

function load(key) {
    try { return JSON.parse(sessionStorage.getItem(key) || "[]"); } catch (e) { return []; }
}

function uid(prefix = "id_") {
    return prefix + Math.random().toString(36).slice(2, 10);
}

function nowISO() {
    return new Date().toISOString();
}

function getCurrentUser() {
    return JSON.parse(sessionStorage.getItem(AUTH_KEY) || "null");
}

function setCurrentUser(user) {
    sessionStorage.setItem(AUTH_KEY, JSON.stringify(user));
}

function removeCurrentUser() {
    sessionStorage.removeItem(AUTH_KEY);
}

/* Small utilities */
function escapeHtml(s = "") {
    return String(s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

function fmtDate(iso) {
    try { return new Date(iso).toLocaleString(); } catch (e) { return iso; }
}

/* Toast helper (Bootstrap-like) */
function toast(message, type = "success") {
    const el = document.createElement("div");
    el.className = `toast align-items-center text-bg-${type} border-0 position-fixed top-0 end-0 m-3`;
    el.role = "alert";
    el.style.zIndex = 99999;
    el.innerHTML = `<div class="d-flex"><div class="toast-body">${message}</div><button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button></div>`;
    document.body.appendChild(el);
    const b = new bootstrap.Toast(el, { delay: 2600 });
    b.show();
    el.addEventListener("hidden.bs.toast", () => el.remove());
}

/* Confirm action wrapper (uses confirmModal existing in index.html) */
function confirmAction(message, onOk) {
    const modalEl = document.getElementById("confirmModal");
    modalEl.querySelector("#confirmModalBody").textContent = message;
    const bs = new bootstrap.Modal(modalEl);
    const okBtn = document.getElementById("confirmModalOk");

    function handler() { try { onOk(); } catch (e) { console.error(e); }
        bs.hide();
        okBtn.removeEventListener("click", handler); }
    okBtn.addEventListener("click", handler);
    bs.show();
}

/* Reusable form modal helper (formModal in index.html) */
function openFormModal(title, bodyHtml, onSave, saveText = "Save") {
    const modalEl = document.getElementById("formModal");
    document.getElementById("formModalTitle").innerHTML = title;
    document.getElementById("formModalBody").innerHTML = bodyHtml;
    const saveBtn = document.getElementById("formModalSave");
    saveBtn.textContent = saveText;
    // Remove previous onclick to avoid stacking handlers
    saveBtn.onclick = null;
    const bs = new bootstrap.Modal(modalEl);
    saveBtn.onclick = () => {
        try {
            const res = onSave && onSave();
            // if onSave returns false -> keep modal open (validation failure)
            if (res === false) return;
            bs.hide();
        } catch (err) {
            console.error(err);
            toast("Error", "danger");
        }
    };
    bs.show();
}

/* ============================
   Seed demo data
   ============================ */
function seedDemo() {
    if (!load(STORAGE.USERS).length) {
        save(STORAGE.USERS, [
            { id: uid("u_"), name: "Administrator", email: "admin@lms.com", password: "admin", role: "admin", active: true, createdAt: nowISO(), enrolledCourses: [] },
            { id: uid("u_"), name: "Student One", email: "student@lms.com", password: "student", role: "student", active: true, createdAt: nowISO(), enrolledCourses: [] }
        ]);
    }
    if (!load(STORAGE.COURSES).length) {
        save(STORAGE.COURSES, [
            { id: uid("c_"), title: "Intro to UX", description: "Basics of UX design and prototyping.", published: true, video: "", createdAt: nowISO() },
            { id: uid("c_"), title: "Frontend Basics", description: "HTML, CSS & JavaScript fundamentals.", published: true, video: "", createdAt: nowISO() }
        ]);
    }
    if (!load(STORAGE.ASSESSMENTS).length) {
        save(STORAGE.ASSESSMENTS, [
            { id: uid("a_"), title: "UX Basics Quiz", questions: [{ text: "2+2=?", options: ["3", "4", "5"], correct: 1 }], createdAt: nowISO() }
        ]);
    }
    if (!load(STORAGE.EVENTS).length) {
        const t = new Date();
        save(STORAGE.EVENTS, [
            { id: uid("ev_"), title: "Assignment Due", start: new Date(t.getFullYear(), t.getMonth(), t.getDate(), 10).toISOString() },
            { id: uid("ev_"), title: "Assessment Review", start: new Date(t.getFullYear(), t.getMonth(), t.getDate(), 14).toISOString() }
        ]);
    }
    if (!load(STORAGE.POSTS).length) {
        save(STORAGE.POSTS, [{ id: uid("p_"), author: "Administrator", text: "Welcome to the demo LMS!", createdAt: nowISO() }]);
    }
    if (!load(STORAGE.CONTENT).length) {
        save(STORAGE.CONTENT, [{ id: uid("ct_"), title: "UX Slides (PDF)", url: "#", type: "pdf", createdAt: nowISO() }]);
    }
    if (!load(STORAGE.ATTEMPTS).length) {
        save(STORAGE.ATTEMPTS, []);
    }
}
seedDemo();

/* ============================
   DOM refs & sidebar wiring
   ============================ */
const appContainer = document.getElementById("appContainer");
const sidebar = document.getElementById("sidebar");
const welcomeText = document.getElementById("welcomeText");
const logoutBtn = document.getElementById("btnLogoutTop");
const sidebarNav = document.getElementById("sidebarNav");

/* Wire sidebar links (data-module attributes) */
function wireSidebar() {
    const links = sidebarNav.querySelectorAll(".nav-link");
    links.forEach(a => {
        a.onclick = (e) => {
            e.preventDefault();
            links.forEach(x => x.classList.remove("active"));
            a.classList.add("active");
            const module = a.getAttribute("data-module");
            loadModule(module);
        };
    });
}

/* Module loader */
function loadModule(name) {
    switch (name) {
        case "dashboard":
            renderDashboard();
            break;
        case "courses":
            renderCourses();
            break;
        case "paths":
            renderPaths();
            break;
        case "assessments":
            renderAssessments();
            break;
        case "calendar":
            renderCalendar();
            break;
        case "communication":
            renderCommunication();
            break;
        case "content":
            renderContent();
            break;
        case "reports":
            renderReports();
            break;
        case "users":
            renderUsers();
            break;
        case "settings":
            renderSettings();
            break;
        default:
            renderDashboard();
    }
}

/* ============================
   Authentication: Login / Signup
   ============================ */
function renderLogin() {
    // hide sidebar/top actions
    sidebar.classList.add("d-none");
    logoutBtn.classList.add("d-none");
    const html = `
  <div class="d-flex justify-content-center" style="padding:80px 0;">
    <div class="card" style="width:480px;padding:20px;border-radius:12px;">
      <h4>Sign in</h4>
      <div class="text-muted mb-3">Demo credentials: admin@lms.com/admin • student@lms.com/student</div>
      <input id="loginEmail" class="form-control mb-2" placeholder="Email">
      <input id="loginPass" type="password" class="form-control mb-3" placeholder="Password">
      <div class="d-flex gap-2">
        <button id="btnLogin" class="btn btn-primary flex-fill">Login</button>
        <button id="btnSignup" class="btn btn-outline-secondary flex-fill">Create account</button>
      </div>
    </div>
  </div>`;
    appContainer.innerHTML = html;
    document.getElementById("btnLogin").onclick = () => {
        const email = document.getElementById("loginEmail").value.trim();
        const pass = document.getElementById("loginPass").value;
        const users = load(STORAGE.USERS);
        const found = users.find(u => u.email === email && u.password === pass);
        if (!found) { toast("Invalid credentials", "danger"); return; }
        if (!found.active) { toast("Account disabled", "danger"); return; }
        setCurrentUser(found);
        toast(`Welcome back, ${found.name}`);
        renderAppShell();
    };
    document.getElementById("btnSignup").onclick = () => renderSignup();
}

function renderSignup() {
    const html = `
  <div class="d-flex justify-content-center" style="padding:80px 0;">
    <div class="card" style="width:480px;padding:20px;border-radius:12px;">
      <h4>Create account</h4>
      <div class="text-muted mb-2">Create a student account</div>
      <input id="signupName" class="form-control mb-2" placeholder="Full name">
      <input id="signupEmail" class="form-control mb-2" placeholder="Email">
      <input id="signupPass" type="password" class="form-control mb-3" placeholder="Password">
      <div class="d-grid gap-2">
        <button id="btnCreate" class="btn btn-success">Create account</button>
        <button id="btnBack" class="btn btn-outline-secondary">Back to login</button>
      </div>
    </div>
  </div>`;
    appContainer.innerHTML = html;
    document.getElementById("btnCreate").onclick = () => {
        const name = document.getElementById("signupName").value.trim();
        const email = document.getElementById("signupEmail").value.trim();
        const pass = document.getElementById("signupPass").value;
        if (!name || !email || !pass) { toast("Fill all fields", "danger"); return; }
        const users = load(STORAGE.USERS);
        if (users.some(u => u.email === email)) { toast("Email already used", "danger"); return; }
        users.unshift({ id: uid("u_"), name, email, password: pass, role: "student", active: true, createdAt: nowISO(), enrolledCourses: [] });
        save(STORAGE.USERS, users);
        toast("Account created — please log in", "success");
        renderLogin();
    };
    document.getElementById("btnBack").onclick = () => renderLogin();
}

/* ============================
   App shell after login
   ============================ */
function renderAppShell() {
    const user = getCurrentUser();
    if (!user) return renderLogin();
    // show sidebar and logout button
    sidebar.classList.remove("d-none");
    logoutBtn.classList.remove("d-none");
    welcomeText.textContent = `Hi, ${user.name}`;
    // role-based nav visibility
    sidebarNav.querySelectorAll(".nav-link").forEach(a => {
        const mod = a.getAttribute("data-module");
        if (user.role !== "admin" && (mod === "users" || mod === "reports")) a.classList.add("d-none");
        else a.classList.remove("d-none");
    });
    wireSidebar();
    // default to dashboard
    sidebarNav.querySelectorAll(".nav-link").forEach(x => x.classList.remove("active"));
    const dash = sidebarNav.querySelector('[data-module="dashboard"]');
    if (dash) { dash.classList.add("active");
        loadModule("dashboard"); } else loadModule("dashboard");
}

/* logout */
logoutBtn.onclick = () => {
    removeCurrentUser();
    toast("Logged out", "warning");
    setTimeout(() => renderLogin(), 200);
};

/* ============================
   Dashboard module
   ============================ */
function renderDashboard() {
    const user = getCurrentUser();
    if (!user) return renderLogin();
    const users = load(STORAGE.USERS);
    const courses = load(STORAGE.COURSES);
    const assessments = load(STORAGE.ASSESSMENTS);
    const attempts = load(STORAGE.ATTEMPTS);

    appContainer.innerHTML = `
    <div class="module-header">
      <div><h3>Dashboard</h3><div class="text-muted">Overview</div></div>
      <div>
        ${user.role === "admin" ? '<button id="btnExportUsers" class="btn btn-sm btn-outline-secondary me-2">Export CSV</button>' : ''}
        ${user.role === "admin" ? '<button id="btnAddCourse" class="btn btn-sm btn-primary">+ Course</button>' : ''}
      </div>
    </div>

    <div class="row g-3">
      <div class="col-md-3"><div class="card p-3 text-center"><div class="h1">📚</div><h6>Courses</h6><strong>${courses.length}</strong></div></div>
      <div class="col-md-3"><div class="card p-3 text-center"><div class="h1">👥</div><h6>Users</h6><strong>${users.length}</strong></div></div>
      <div class="col-md-3"><div class="card p-3 text-center"><div class="h1">📝</div><h6>Assessments</h6><strong>${assessments.length}</strong></div></div>
      <div class="col-md-3"><div class="card p-3 text-center"><div class="h1">📈</div><h6>Attempts</h6><strong>${attempts.length}</strong></div></div>
    </div>
  `;

    if (user.role === "admin") {
        document.getElementById("btnExportUsers").onclick = () => exportUsersCSV();
        document.getElementById("btnAddCourse").onclick = () => openCourseModalForCreate();
    }
}

/* ============================
   Courses module (with YouTube embed support)
   ============================ */
function renderCourses() {
    const user = getCurrentUser();
    const courses = load(STORAGE.COURSES);

    appContainer.innerHTML = `
    <div class="module-header">
      <div><h3>Courses</h3><div class="text-muted">Browse courses</div></div>
      <div>${user.role === "admin" ? '<button id="addCourseBtn" class="btn btn-sm btn-success">+ New</button>' : ''}</div>
    </div>
    <div class="row g-4" id="coursesGrid"></div>
  `;

    const grid = document.getElementById("coursesGrid");
    grid.innerHTML = courses.map(c => {
                const enrolled = (user.enrolledCourses || []).includes(c.id);
                // build embed iframe if video ID present
                const videoEmbed = c.video ? `<div class="ratio ratio-16x9 mb-2"><iframe src="https://www.youtube.com/embed/${escapeHtml(c.video)}" title="${escapeHtml(c.title)}" allowfullscreen></iframe></div>` : "";
                return `
      <div class="col-md-4">
        <div class="card course-card p-3 h-100 d-flex flex-column">
          <div>
            <h5>${escapeHtml(c.title)}</h5>
            <p class="text-muted">${escapeHtml(c.description || "")}</p>
            ${videoEmbed}
          </div>
          <div class="mt-auto d-flex justify-content-between align-items-center">
            <div class="small text-muted">Created: ${new Date(c.createdAt).toLocaleDateString()}</div>
            <div>
              ${user.role === "admin"
                ? `<button class="btn btn-sm btn-outline-primary me-2" onclick="openCourseModalForEdit('${c.id}')">Edit</button><button class="btn btn-sm btn-outline-danger" onclick="deleteCourse('${c.id}')">Delete</button>`
                : enrolled
                  ? `<button class="btn btn-sm btn-primary" onclick="openCourse('${c.id}')">Open</button>`
                  : `<button class="btn btn-sm btn-success" onclick="enrollCourse('${c.id}')">Enroll</button>`}
            </div>
          </div>
        </div>
      </div>`;
  }).join("");

  if (user.role === "admin") {
    document.getElementById("addCourseBtn").onclick = () => openCourseModalForCreate();
  }
}

/* Open course detail (simple view) */
function openCourse(courseId) {
  const course = load(STORAGE.COURSES).find(c => c.id === courseId);
  if (!course) { toast("Course not found", "danger"); return; }
  appContainer.innerHTML = `
    <div class="module-header">
      <div><h3>${escapeHtml(course.title)}</h3><div class="text-muted">${escapeHtml(course.description || "")}</div></div>
      <div><button class="btn btn-sm btn-outline-secondary" onclick="loadModule('courses')">Back</button></div>
    </div>
    <div class="row g-4">
      <div class="col-md-8">
        <div class="card p-3">
          <h5>Content</h5>
          <div id="courseContentList" class="mt-2"></div>
        </div>
      </div>
      <div class="col-md-4">
        <div class="card p-3">
          <h6>Actions</h6>
          <div class="d-grid gap-2 mt-2">
            <button class="btn btn-primary" onclick="generateCertificateForCurrentUser('${escapeHtml(course.title)}')">Generate certificate</button>
            <button class="btn btn-outline-primary" onclick="loadModule('assessments')">Assessments</button>
          </div>
        </div>
      </div>
    </div>
  `;
  const contentList = load(STORAGE.CONTENT);
  document.getElementById("courseContentList").innerHTML = contentList.length ? contentList.map(it => `<div class="mb-2"><strong>${escapeHtml(it.title)}</strong><div class="small text-muted">${escapeHtml(it.type)}</div></div>`).join("") : `<div class="text-muted">No content yet.</div>`;
}

/* Create/Edit course modals (admin) */
function openCourseModalForCreate() {
  openCourseModal(null);
}
function openCourseModalForEdit(courseId) {
  openCourseModal(courseId);
}
function openCourseModal(courseId = null) {
  const editing = !!courseId;
  const course = editing ? load(STORAGE.COURSES).find(c => c.id === courseId) : null;
  openFormModal(editing ? "Edit Course" : "Add Course", `
    <div class="mb-2"><label class="form-label">Title</label><input id="courseTitle" class="form-control" value="${editing ? escapeHtml(course.title) : ""}"></div>
    <div class="mb-2"><label class="form-label">Description</label><textarea id="courseDesc" class="form-control">${editing ? escapeHtml(course.description) : ""}</textarea></div>
    <div class="mb-2"><label class="form-label">YouTube URL (optional)</label><input id="courseVideoUrl" class="form-control" placeholder="https://www.youtube.com/watch?v=..." value="${editing && course.video ? `https://www.youtube.com/watch?v=${escapeHtml(course.video)}` : ""}"></div>
    <div class="mb-2"><label class="form-label">Published</label><select id="coursePub" class="form-select"><option value="true">Yes</option><option value="false">No</option></select></div>
  `, () => {
    const title = document.getElementById("courseTitle").value.trim();
    const desc = document.getElementById("courseDesc").value.trim();
    const url = document.getElementById("courseVideoUrl").value.trim();
    const pub = document.getElementById("coursePub").value === "true";
    if (!title) { toast("Title required", "danger"); return false; }
    // extract YouTube video id if provided (basic)
    let videoId = "";
    if (url) {
      try {
        if (url.includes("youtube.com")) {
          const m = url.split("v=")[1];
          if (m) videoId = m.split("&")[0];
        } else if (url.includes("youtu.be")) {
          const parts = url.split("/");
          videoId = parts[parts.length - 1].split("?")[0];
        }
      } catch(e) { videoId = ""; }
    }
    const arr = load(STORAGE.COURSES);
    if (editing) {
      const idx = arr.findIndex(c => c.id === courseId);
      if (idx !== -1) {
        arr[idx].title = title;
        arr[idx].description = desc;
        arr[idx].video = videoId;
        arr[idx].published = pub;
        save(STORAGE.COURSES, arr);
        toast("Course updated", "success");
        renderCourses();
      }
    } else {
      arr.unshift({ id: uid("c_"), title, description: desc, video: videoId, published: pub, createdAt: nowISO() });
      save(STORAGE.COURSES, arr);
      toast("Course added", "success");
      renderCourses();
    }
  }, editing ? "Update" : "Create");
}

/* delete course */
function deleteCourse(courseId) {
  confirmAction("Delete course? This will unenroll users.", () => {
    save(STORAGE.COURSES, load(STORAGE.COURSES).filter(c => c.id !== courseId));
    // remove course from users enrolledCourses
    const users = load(STORAGE.USERS);
    users.forEach(u => { if (u.enrolledCourses) u.enrolledCourses = u.enrolledCourses.filter(cid => cid !== courseId); });
    save(STORAGE.USERS, users);
    toast("Course deleted", "warning");
    renderCourses();
  });
}

/* enroll */
function enrollCourse(courseId) {
  const user = getCurrentUser();
  if (!user) return toast("Login required", "danger");
  const users = load(STORAGE.USERS);
  const idx = users.findIndex(u => u.id === user.id);
  if (idx === -1) return toast("User not found", "danger");
  users[idx].enrolledCourses = users[idx].enrolledCourses || [];
  if (!users[idx].enrolledCourses.includes(courseId)) users[idx].enrolledCourses.push(courseId);
  save(STORAGE.USERS, users);
  setCurrentUser(users[idx]);
  toast("Enrolled", "success");
  renderCourses();
}

/* ============================
   Paths (learning paths)
   ============================ */
function renderPaths() {
  const user = getCurrentUser();
  const paths = load(STORAGE.PATHS);
  appContainer.innerHTML = `
    <div class="module-header">
      <div><h3>Learning Paths</h3><div class="text-muted">Create sequences of courses</div></div>
      <div>${user.role === "admin" ? '<button id="addPath" class="btn btn-sm btn-success">+ Add Path</button>' : ''}</div>
    </div>
    <div class="card p-3">${paths.length ? paths.map(p => `<div class="mb-3"><h5>${escapeHtml(p.title)}</h5><div class="small text-muted">${escapeHtml(p.description || '')}</div></div>`).join('') : '<div class="text-muted">No paths yet</div>'}</div>
  `;
  if (user.role === "admin") {
    document.getElementById("addPath").onclick = () => openFormModal("Add Path", `<div class="mb-2"><label>Title</label><input id="pathTitle" class="form-control"></div><div class="mb-2"><label>Description</label><textarea id="pathDesc" class="form-control"></textarea></div>`, () => {
      const t = document.getElementById("pathTitle").value.trim();
      const d = document.getElementById("pathDesc").value.trim();
      if (!t) { toast("Title required", "danger"); return false; }
      const arr = load(STORAGE.PATHS);
      arr.unshift({ id: uid("p_"), title: t, description: d, createdAt: nowISO() });
      save(STORAGE.PATHS, arr);
      toast("Path added", "success");
      renderPaths();
    });
  }
}

/* ============================
   Assessments + camera proctoring
   ============================ */
function renderAssessments() {
  const user = getCurrentUser();
  const list = load(STORAGE.ASSESSMENTS);
  appContainer.innerHTML = `
    <div class="module-header">
      <div><h3>Assessments</h3><div class="text-muted">Quizzes & tests</div></div>
      <div>${user.role === "admin" ? '<button id="addAsm" class="btn btn-sm btn-success">+ New</button>' : ''}</div>
    </div>
    <div class="card p-3"><ul class="list-unstyled mb-0" id="assessList"></ul></div>
  `;
  const ul = document.getElementById("assessList");
  const attempts = load(STORAGE.ATTEMPTS);
  ul.innerHTML = list.map(a => {
    const my = attempts.find(at => at.assessmentId === a.id && at.userId === (user ? user.id : null));
    const badge = my ? `<span class="badge bg-success">Completed</span>` : `<span class="badge bg-warning">Pending</span>`;
    return `<li class="list-group-item d-flex justify-content-between align-items-center">
      <div><strong>${escapeHtml(a.title)}</strong><div class="small text-muted">${a.questions ? a.questions.length : 0} questions</div></div>
      <div>
        ${user.role === "admin" ? `<button class="btn btn-sm btn-outline-danger me-2" onclick="deleteAssessment('${a.id}')">Delete</button>` : `<button class="btn btn-sm btn-primary me-2" onclick="startProctored('${a.id}')">${my ? 'Review' : 'Start'}</button>`}
        ${badge}
      </div>
    </li>`;
  }).join("");

  if (user.role === "admin") {
    document.getElementById("addAsm").onclick = () => openFormModal("Add Assessment", `<div class="mb-2"><label>Title</label><input id="asmTitle" class="form-control"></div>`, () => {
      const t = document.getElementById("asmTitle").value.trim();
      if (!t) { toast("Title required", "danger"); return false; }
      const arr = load(STORAGE.ASSESSMENTS);
      arr.unshift({ id: uid("a_"), title: t, questions: [] });
      save(STORAGE.ASSESSMENTS, arr);
      toast("Assessment created", "success");
      renderAssessments();
    });
  }
}

function deleteAssessment(aid) {
  confirmAction("Delete assessment?", () => {
    save(STORAGE.ASSESSMENTS, load(STORAGE.ASSESSMENTS).filter(a => a.id !== aid));
    toast("Deleted", "warning");
    renderAssessments();
  });
}

/* Proctored assessment flow (camera required) */
async function startProctored(assessmentId) {
  const assessment = load(STORAGE.ASSESSMENTS).find(a => a.id === assessmentId);
  if (!assessment) return toast("Assessment not found", "danger");
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    // show small video preview
    const video = document.createElement("video");
    video.autoplay = true;
    video.muted = true;
    video.srcObject = stream;
    Object.assign(video.style, { position: "fixed", bottom: "12px", right: "12px", width: "180px", height: "120px", zIndex: 99999, border: "3px solid #A4DD00", borderRadius: "8px" });
    document.body.appendChild(video);

    // Launch assessment UI (modal-like)
    takeAssessmentUI(assessment, () => {
      // stop stream
      stream.getTracks().forEach(t => t.stop());
      video.remove();
    });

  } catch (err) {
    toast("Camera permission required to start assessment", "danger");
  }
}

/* Assessment UI (in-page overlay) */
function takeAssessmentUI(a, onFinish) {
  const qlist = a.questions || [];
  let idx = 0, score = 0;

  const overlay = document.createElement("div");
  Object.assign(overlay.style, { position: "fixed", inset: 0, background: "rgba(2,6,23,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10800 });
  const box = document.createElement("div");
  box.className = "card";
  box.style.width = "720px";
  box.style.padding = "18px";
  box.innerHTML = `<h5>${escapeHtml(a.title)}</h5><div id="asmBody"></div><div class="mt-3 d-flex justify-content-between"><div id="asmProg"></div><div><button id="asmPrev" class="btn btn-sm btn-outline-secondary">Prev</button><button id="asmNext" class="btn btn-sm btn-primary ms-2">Next</button></div></div>`;
  overlay.appendChild(box);
  document.body.appendChild(overlay);

  function renderQ() {
    const body = box.querySelector("#asmBody");
    if (idx >= qlist.length) {
      // finish
      const user = getCurrentUser();
      const attempts = load(STORAGE.ATTEMPTS);
      const pct = qlist.length ? Math.round((score / qlist.length) * 100) : 0;
      attempts.unshift({ id: uid("at_"), assessmentId: a.id, assessmentTitle: a.title, userId: user.id, userName: user.name, score: pct, takenAt: nowISO() });
      save(STORAGE.ATTEMPTS, attempts);
      toast(`Finished — Score: ${pct}%`, pct >= 50 ? "success" : "danger");
      overlay.remove();
      onFinish && onFinish();
      renderAssessments();
      return;
    }
    const q = qlist[idx];
    body.innerHTML = `<div><strong>Q${idx+1}.</strong> ${escapeHtml(q.text || 'Question')}</div><div class="mt-2">${(q.options || []).map((opt, i) => `<div><label><input type="radio" name="opt" value="${i}"> ${escapeHtml(opt)}</label></div>`).join("")}</div>`;
    box.querySelector("#asmProg").textContent = `Question ${idx+1} of ${qlist.length}`;
    box.querySelector("#asmPrev").disabled = idx === 0;
  }

  box.querySelector("#asmNext").onclick = () => {
    const sel = box.querySelector('input[name="opt"]:checked');
    if (!sel) { alert("Select an answer"); return; }
    const val = parseInt(sel.value, 10);
    if (val === (qlist[idx].correct || 0)) score++;
    idx++;
    renderQ();
  };
  box.querySelector("#asmPrev").onclick = () => { if (idx > 0) idx--; renderQ(); };
  renderQ();
}

/* ============================
   Calendar (FullCalendar if available)
   ============================ */
function renderCalendar() {
  const user = getCurrentUser();
  appContainer.innerHTML = `
    <div class="module-header">
      <div><h3>Calendar</h3><div class="text-muted">Week view & events</div></div>
      <div>${user.role === "admin" ? '<button id="btnAddEvent" class="btn btn-sm btn-success">+ Event</button>' : ''}</div>
    </div>
    <div class="card p-3"><div id="calendar"></div></div>
  `;
  const events = load(STORAGE.EVENTS);
  const calEl = document.getElementById("calendar");
  if (typeof FullCalendar === "undefined") {
    calEl.innerHTML = `<div class="p-4 text-muted">FullCalendar not loaded. Include the library to see the calendar.</div>`;
    if (user.role === "admin") document.getElementById("btnAddEvent").onclick = () => openAddEventModal();
    return;
  }
  calEl.innerHTML = "";
  const calendar = new FullCalendar.Calendar(calEl, {
    initialView: "timeGridWeek",
    height: 600,
    events,
    dateClick: info => {
      if (user.role !== "admin") return;
      openFormModal("Add Event", `<div class="mb-2"><label>Title</label><input id="evTitle" class="form-control"></div><div class="mb-2"><label>Start</label><input id="evStart" type="datetime-local" class="form-control" value="${info.dateStr.slice(0, 16)}"></div>`, () => {
        const title = document.getElementById("evTitle").value.trim();
        const start = document.getElementById("evStart").value;
        if (!title || !start) { toast("Fill fields", "danger"); return false; }
        const ev = { id: uid("ev_"), title, start: new Date(start).toISOString() };
        events.push(ev); save(STORAGE.EVENTS, events); calendar.addEvent(ev); toast("Event added", "success");
      });
    },
    eventClick: info => {
      if (user.role === "admin") {
        confirmAction("Delete event?", () => {
          const id = info.event.id;
          info.event.remove();
          save(STORAGE.EVENTS, load(STORAGE.EVENTS).filter(e => e.id !== id));
          toast("Event removed", "warning");
        });
      }
    }
  });
  calendar.render();

  if (user.role === "admin") document.getElementById("btnAddEvent").onclick = () => openAddEventModal();

  function openAddEventModal() {
    openFormModal("Add Event", `<div class="mb-2"><label>Title</label><input id="evTitle" class="form-control"></div><div class="mb-2"><label>Start</label><input id="evStart" type="datetime-local" class="form-control"></div>`, () => {
      const title = document.getElementById("evTitle").value.trim();
      const start = document.getElementById("evStart").value;
      if (!title || !start) { toast("Fill fields", "danger"); return false; }
      const ev = { id: uid("ev_"), title, start: new Date(start).toISOString() };
      const arr = load(STORAGE.EVENTS); arr.push(ev); save(STORAGE.EVENTS, arr); calendar.addEvent(ev); toast("Event added", "success");
    });
  }
}

/* ============================
   Communication (posts)
   ============================ */
function renderCommunication() {
  const posts = load(STORAGE.POSTS);
  appContainer.innerHTML = `
    <div class="module-header"><div><h3>Communication</h3><div class="text-muted">Announcements & feed</div></div><div></div></div>
    <div class="row g-4">
      <div class="col-md-8">
        <div class="card p-3"><h5>Feed</h5><div id="postList" class="mt-3">${posts.map(p => `<div class="mb-3"><strong>${escapeHtml(p.author)}</strong><div class="small text-muted">${fmtDate(p.createdAt)}</div><div>${escapeHtml(p.text)}</div></div>`).join("")}</div></div>
      </div>
      <div class="col-md-4">
        <div class="card p-3"><h6>New Post</h6><textarea id="postTxt" class="form-control" rows="4"></textarea><div class="d-grid mt-2"><button id="postBtn" class="btn btn-primary">Post</button></div></div>
      </div>
    </div>
  `;
  document.getElementById("postBtn").onclick = () => {
    const txt = document.getElementById("postTxt").value.trim();
    if (!txt) return toast("Write something", "danger");
    const posts = load(STORAGE.POSTS);
    const user = getCurrentUser();
    posts.unshift({ id: uid("p_"), author: user.name, text: txt, createdAt: nowISO() });
    save(STORAGE.POSTS, posts);
    toast("Posted", "success");
    renderCommunication();
  };
}

/* ============================
   Content library
   ============================ */
function renderContent() {
  const user = getCurrentUser();
  const content = load(STORAGE.CONTENT);
  appContainer.innerHTML = `
    <div class="module-header"><div><h3>Content Library</h3><div class="text-muted">Resources</div></div>
    <div>${user.role === "admin" ? '<button id="addContent" class="btn btn-sm btn-success">+ Upload</button>' : ''}</div></div>
    <div class="card p-3"><div class="content-grid row g-3">${content.map(c => `<div class="col-md-4"><div class="card p-3"><strong>${escapeHtml(c.title)}</strong><div class="small text-muted">${escapeHtml(c.type)}</div><div class="mt-2"><a href="${escapeHtml(c.url)}" class="btn btn-sm btn-outline-primary" target="_blank">Open</a> ${user.role === "admin" ? `<button class="btn btn-sm btn-danger ms-2" onclick="deleteContent('${c.id}')">Delete</button>` : ''}</div></div></div>`).join("")}</div></div>
  `;
  if (user.role === "admin") {
    document.getElementById("addContent").onclick = () => openFormModal("Add Content", `<div class="mb-2"><label>Title</label><input id="ctTitle" class="form-control"></div><div class="mb-2"><label>URL</label><input id="ctUrl" class="form-control"></div><div class="mb-2"><label>Type</label><select id="ctType" class="form-select"><option value="pdf">PDF</option><option value="video">Video</option><option value="slide">Slide</option></select></div>`, () => {
      const title = document.getElementById("ctTitle").value.trim();
      const url = document.getElementById("ctUrl").value.trim();
      const type = document.getElementById("ctType").value;
      if (!title || !url) { toast("Fill fields", "danger"); return false; }
      const arr = load(STORAGE.CONTENT); arr.unshift({ id: uid("ct_"), title, url, type, createdAt: nowISO() }); save(STORAGE.CONTENT, arr); toast("Content added", "success"); renderContent();
    });
  }
}
function deleteContent(id) {
  confirmAction("Delete content?", () => {
    save(STORAGE.CONTENT, load(STORAGE.CONTENT).filter(c => c.id !== id));
    toast("Deleted", "warning");
    renderContent();
  });
}

/* ============================
   Users module (ADMIN) - enable/disable & generate certificate
   ============================ */
function renderUsers() {
  const cur = getCurrentUser();
  if (!cur || cur.role !== "admin") { appContainer.innerHTML = `<div class="card p-3">Access denied</div>`; return; }
  const users = load(STORAGE.USERS);
  appContainer.innerHTML = `
    <div class="module-header">
      <div><h3>User Management</h3><div class="text-muted">Enable/disable accounts, change roles, generate certificates</div></div>
      <div><button id="addUserBtn" class="btn btn-sm btn-success">+ Add</button></div>
    </div>
    <div class="card p-3">
      <table class="table align-middle">
        <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Active</th><th>Actions</th></tr></thead>
        <tbody>
          ${users.map(u => `
            <tr>
              <td>${escapeHtml(u.name)}</td>
              <td>${escapeHtml(u.email)}</td>
              <td>
                <select class="form-select form-select-sm" onchange="changeUserRole('${u.id}', this.value)">
                  <option value="student" ${u.role === 'student' ? 'selected' : ''}>student</option>
                  <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>admin</option>
                </select>
              </td>
              <td>
                <div class="form-check form-switch">
                  <input class="form-check-input" type="checkbox" id="activeSwitch_${u.id}" ${u.active ? 'checked' : ''} onchange="toggleUserActive('${u.id}', this.checked)">
                </div>
              </td>
              <td>
                ${u.role === "student" ? `<button class="btn btn-sm btn-outline-primary me-2" onclick="generateCertificate('${u.id}')">🎓 Certificate</button>` : ''}
                <button class="btn btn-sm btn-outline-danger" onclick="removeUser('${u.id}')">Delete</button>
              </td>
            </tr>`).join("")}
        </tbody>
      </table>
    </div>
  `;
  document.getElementById("addUserBtn").onclick = () => openFormModal("Add User", `<div class="mb-2"><label>Name</label><input id="usrName" class="form-control"></div><div class="mb-2"><label>Email</label><input id="usrEmail" class="form-control"></div><div class="mb-2"><label>Password</label><input id="usrPass" type="password" class="form-control"></div><div class="mb-2"><label>Role</label><select id="usrRole" class="form-select"><option value="student">student</option><option value="admin">admin</option></select></div>`, () => {
    const n = document.getElementById("usrName").value.trim();
    const e = document.getElementById("usrEmail").value.trim();
    const p = document.getElementById("usrPass").value;
    const r = document.getElementById("usrRole").value;
    if (!n || !e || !p) { toast("All fields required", "danger"); return false; }
    const arr = load(STORAGE.USERS);
    if (arr.some(x => x.email === e)) { toast("Email exists", "danger"); return false; }
    arr.unshift({ id: uid("u_"), name: n, email: e, password: p, role: r, active: true, createdAt: nowISO(), enrolledCourses: [] });
    save(STORAGE.USERS, arr);
    toast("User created", "success");
    renderUsers();
  });
}

/* change user role */
function changeUserRole(id, role) {
  const arr = load(STORAGE.USERS);
  const u = arr.find(x => x.id === id);
  if (!u) return;
  u.role = role;
  save(STORAGE.USERS, arr);
  toast("Role updated", "success");
  // re-render users to reflect admin-only buttons if role changed
  renderUsers();
}

/* toggle active (enable/disable) */
function toggleUserActive(id, active) {
  const arr = load(STORAGE.USERS);
  const u = arr.find(x => x.id === id);
  if (!u) return;
  u.active = !!active;
  save(STORAGE.USERS, arr);
  toast(`User ${u.active ? 'enabled' : 'disabled'}`, "success");
}

/* remove user */
function removeUser(id) {
  confirmAction("Delete this user?", () => {
    save(STORAGE.USERS, load(STORAGE.USERS).filter(u => u.id !== id));
    toast("User removed", "warning");
    renderUsers();
  });
}

/* ============================
   Certificate generation (admin -> student & student self)
*/
function generateCertificate(userId) {
  const users = load(STORAGE.USERS);
  const stu = users.find(u => u.id === userId);
  if (!stu) return toast("User not found", "danger");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Certificate</title>
    <style>
      body { font-family: 'Segoe UI', Tahoma, sans-serif; background: #FFFADC; margin:0; padding:30px; }
      .cert { width:900px; margin: 40px auto; padding:40px; border-radius:16px; border:8px solid #B6F500; background: white; text-align:center; box-shadow: 0 12px 30px rgba(0,0,0,0.08); }
      .title { font-size:28px; font-weight:700; color:#0f1720; }
      .name { font-size:32px; font-weight:800; margin-top:18px; color:#0f1720; }
      .course { margin-top:12px; font-size:18px; color:#374151; }
      .footer { margin-top:30px; color:#6b7280; font-size:13px; }
    </style>
    </head><body><div class="cert">
    <div class="title">Certificate of Completion</div>
    <div class="subtitle">This is to certify that</div>
    <div class="name">${escapeHtml(stu.name)}</div>
    <div class="course">has successfully completed the required courses</div>
    <div class="footer">Issued on ${new Date().toLocaleDateString()}</div>
    </div>
    <script>setTimeout(()=>window.print(),200)</script>
    </body></html>`;
  const w = window.open("", "_blank", "width=1000,height=700");
  w.document.write(html); w.document.close();
}

/* Student self certificate generator (by course) */
function generateCertificateForCurrentUser(courseTitle) {
  const user = getCurrentUser();
  if (!user) return toast("Log in to generate certificate", "danger");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Certificate</title>
    <style>
      body { font-family: 'Segoe UI', Tahoma, sans-serif; background: #FFFADC; margin:0; padding:30px; }
      .cert { width:900px; margin: 40px auto; padding:40px; border-radius:16px; border:8px solid #B6F500; background: white; text-align:center; box-shadow: 0 12px 30px rgba(0,0,0,0.08); }
      .title { font-size:28px; font-weight:700; color:#0f1720; }
      .name { font-size:32px; font-weight:800; margin-top:18px; color:#0f1720; }
      .course { margin-top:12px; font-size:18px; color:#374151; }
      .footer { margin-top:30px; color:#6b7280; font-size:13px; }
    </style>
    </head><body><div class="cert">
    <div class="title">Certificate of Completion</div>
    <div class="subtitle">This certifies that</div>
    <div class="name">${escapeHtml(user.name)}</div>
    <div class="course">has completed the course <strong>${escapeHtml(courseTitle)}</strong></div>
    <div class="footer">Issued on ${new Date().toLocaleDateString()}</div>
    </div>
    <script>setTimeout(()=>window.print(),200)</script>
    </body></html>`;
  const w = window.open("", "_blank", "width=1000,height=700");
  w.document.write(html); w.document.close();
}

/* ============================
   Reports (Chart.js)
*/
function renderReports() {
  const cur = getCurrentUser();
  if (!cur || cur.role !== "admin") { appContainer.innerHTML = `<div class="card p-3">Access denied</div>`; return; }
  const courses = load(STORAGE.COURSES);
  const attempts = load(STORAGE.ATTEMPTS);
  const labels = courses.map(c => c.title);
  const data = courses.map(c => attempts.filter(a => a.assessmentId && a.courseId === c.id).length || 0);

  appContainer.innerHTML = `
    <div class="module-header"><div><h3>Reports & Analytics</h3><div class="text-muted">Course metrics</div></div></div>
    <div class="card p-3"><canvas id="reportChart" style="max-height:360px"></canvas></div>
  `;
  if (typeof Chart === "undefined") {
    document.getElementById("reportChart").parentElement.innerHTML = `<div class="p-4 text-muted">Chart.js not loaded. Add Chart.js to view charts.</div>`;
    return;
  }
  const ctx = document.getElementById("reportChart");
  if (window._reportChart) window._reportChart.destroy();
  window._reportChart = new Chart(ctx, {
    type: "bar",
    data: { labels, datasets: [{ label: "Attempts", data, backgroundColor: '#98CD00' }] },
    options: { responsive: true }
  });
}

/* ============================
   Export & utilities
*/
function exportUsersCSV() {
  const users = load(STORAGE.USERS);
  const rows = [["Name", "Email", "Role", "Active", "CreatedAt"], ...users.map(u => [u.name, u.email, u.role, u.active ? "Yes" : "No", u.createdAt])];
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = "users.csv"; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  toast("Exported users.csv", "success");
}

/* ============================
   Settings (profile)
*/
function renderSettings() {
  const u = getCurrentUser();
  if (!u) return renderLogin();
  appContainer.innerHTML = `
    <div class="module-header"><div><h3>Settings</h3><div class="text-muted">Manage your profile</div></div></div>
    <div class="card p-3">
      <div class="row g-3">
        <div class="col-md-6"><label class="form-label small">Name</label><input id="setName" class="form-control" value="${escapeHtml(u.name)}"></div>
        <div class="col-md-6"><label class="form-label small">Email</label><input id="setEmail" class="form-control" value="${escapeHtml(u.email)}" disabled></div>
      </div>
      <div class="mt-3 d-grid"><button id="saveProfile" class="btn btn-primary">Save</button></div>
    </div>
  `;
  document.getElementById("saveProfile").onclick = () => {
    const name = document.getElementById("setName").value.trim();
    if (!name) return toast("Name required", "danger");
    const users = load(STORAGE.USERS);
    const me = users.find(x => x.id === u.id);
    me.name = name;
    save(STORAGE.USERS, users);
    setCurrentUser(me);
    toast("Profile updated", "success");
    renderSettings();
  };
}

/* ============================
   Boot
*/
function boot() {
  wireSidebar();
  const cur = getCurrentUser();
  if (cur) renderAppShell(); else renderLogin();
}
boot();

/* ============================
   Expose some functions globally for inline onclicks in generated HTML
*/
window.loadModule = loadModule;
window.enrollCourse = enrollCourse;
window.openCourse = openCourse;
window.deleteCourse = deleteCourse;
window.openCourseModalForEdit = openCourseModalForEdit;
window.openCourseModalForCreate = openCourseModalForCreate;
window.startProctored = startProctored;
window.deleteAssessment = deleteAssessment;
window.generateCertificateForCurrentUser = generateCertificateForCurrentUser;
window.generateCertificate = generateCertificate;
window.deleteContent = deleteContent;
window.changeUserRole = changeUserRole;
window.toggleUserActive = toggleUserActive;
window.removeUser = removeUser;
window.exportUsersCSV = exportUsersCSV;

/* ============================
   End of file
*/