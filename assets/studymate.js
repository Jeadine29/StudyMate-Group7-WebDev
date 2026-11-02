// StudyMate main JavaScript

function getData(key, fallback = []) {
    try {
        return JSON.parse(localStorage.getItem(key)) ?? fallback;
    } catch {
        return fallback;
    }
}

function saveData(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

function getUser() {
    return getData("studyMateCurrentUser", null);
}

function userKey(name) {
    const user = getUser();
    return user ? name + "_" + encodeURIComponent(user.email) : name;
}

function getUserData(name, fallback = []) {
    return getData(userKey(name), fallback);
}

function saveUserData(name, value) {
    saveData(userKey(name), value);
}

function requireLogin() {
    const isPagesFolder = location.pathname.includes("/pages/");
    const currentPage = location.pathname.split("/").pop();
    const publicPages = ["login.html", "register.html"];

    if (isPagesFolder && !publicPages.includes(currentPage) && !getUser()) {
        alert("Please log in first to access your study space.");
        location.href = "login.html";
        return false;
    }

    return true;
}

document.addEventListener("DOMContentLoaded", function () {

    // Protect private pages
    if (!requireLogin()) return;

    // Register
    const registerForm = document.querySelector("#registerForm");

    if (registerForm) {
        registerForm.addEventListener("submit", function (event) {
            event.preventDefault();

            const name = registerForm.elements.namedItem("fullname").value.trim();
            const email = registerForm.elements.namedItem("email").value.trim().toLowerCase();
            const password = registerForm.elements.namedItem("password").value;
            const confirmPassword = registerForm.elements.namedItem("confirmPassword").value;

            if (password.length < 6) {
                alert("Password must have at least 6 characters.");
                return;
            }

            if (password !== confirmPassword) {
                alert("Passwords do not match.");
                return;
            }

            const users = getData("studyMateUsers", []);

            if (users.some(user => user.email === email)) {
                alert("This email is already registered.");
                return;
            }

            users.push({
                name: name,
                email: email,
                password: password
            });

            saveData("studyMateUsers", users);

            alert("Registration successful! You can now log in.");
            location.href = "login.html";
        });
    }

    // Login
    const loginForm = document.querySelector("#loginForm");

    if (loginForm) {
        loginForm.addEventListener("submit", function (event) {
            event.preventDefault();

            const email = loginForm.elements.namedItem("email").value.trim().toLowerCase();
            const password = loginForm.elements.namedItem("password").value;

            const users = getData("studyMateUsers", []);

            const account = users.find(user =>
                user.email === email && user.password === password
            );

            if (!account) {
                alert("Incorrect email or password.");
                return;
            }

            saveData("studyMateCurrentUser", {
                name: account.name,
                email: account.email
            });

            location.href = "dashboard.html";
        });
    }

    // Display logged-in user's name
    const user = getUser();

    document.querySelectorAll("[data-user-name]").forEach(element => {
        element.textContent = user ? user.name : "Student";
    });

    // Logout
    document.querySelectorAll("[data-logout]").forEach(button => {
        button.addEventListener("click", function () {
            localStorage.removeItem("studyMateCurrentUser");
            location.href = "../index.html";
        });
    });

    // Upload lesson materials
    const uploadForm = document.querySelector("#uploadForm");

    if (uploadForm) {
        const fileInput = uploadForm.elements.namedItem("material");
        const fileList = document.querySelector("#uploadedFiles");

        function displayFiles() {
            const files = getUserData("studyMateFiles", []);

            if (!fileList) return;

            if (files.length === 0) {
                fileList.innerHTML = "<li class='empty-state'>No materials uploaded yet. Upload a lesson to get started.</li>";
                return;
            }

            fileList.innerHTML = files.map((file, index) => `
                <li class="file-row">
                    <span>📄 ${escapeHTML(file.name)}</span>
                    <button type="button" class="btn btn-outline btn-sm" data-remove="${index}">
                        Remove
                    </button>
                </li>
            `).join("");

            fileList.querySelectorAll("[data-remove]").forEach(button => {
                button.addEventListener("click", function () {
                    const files = getUserData("studyMateFiles", []);
                    files.splice(Number(button.dataset.remove), 1);
                    saveUserData("studyMateFiles", files);
                    displayFiles();
                });
            });
        }

        uploadForm.addEventListener("submit", function (event) {
            event.preventDefault();

            const selectedFiles = Array.from(fileInput.files);

            if (selectedFiles.length === 0) {
                alert("Please select a lesson file.");
                return;
            }

            const allowedFiles = selectedFiles.filter(file =>
                file.name.endsWith(".txt") || file.name.endsWith(".md")
            );

            if (allowedFiles.length !== selectedFiles.length) {
                alert("For this prototype, please upload TXT or MD lesson files. PDF and Word text extraction still needs to be added.");
                return;
            }

            Promise.all(allowedFiles.map(file => {
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();

                    reader.onload = function () {
                        resolve({
                            name: file.name,
                            content: reader.result
                        });
                    };

                    reader.onerror = reject;
                    reader.readAsText(file);
                });
            })).then(newFiles => {
                const files = getUserData("studyMateFiles", []);
                saveUserData("studyMateFiles", files.concat(newFiles));

                uploadForm.reset();
                displayFiles();

                alert("Your lesson has been uploaded successfully!");
            }).catch(() => {
                alert("Unable to read the selected file.");
            });
        });

        displayFiles();
    }

    // Display reviewer based on uploaded lessons
    const reviewerContent = document.querySelector("#reviewerContent");

    if (reviewerContent) {
        const files = getUserData("studyMateFiles", []);

        if (files.length === 0) {
            reviewerContent.innerHTML = `
                <div class="empty-state">
                    <h2>No reviewer available yet.</h2>
                    <p>Upload your lesson materials first to view your reviewer.</p>
                    <a href="upload.html" class="btn btn-primary">Upload Materials</a>
                </div>
            `;
        } else {
            reviewerContent.innerHTML = files.map(file => {
                const lines = file.content
                    .split(/\n+/)
                    .map(line => line.trim())
                    .filter(line => line.length > 0);

                return `
                    <article class="content-card">
                        <h2>${escapeHTML(file.name)}</h2>
                        ${lines.map(line => `<p>${escapeHTML(line)}</p>`).join("")}
                    </article>
                `;
            }).join("");
        }
    }

    // Generate simple flashcards from uploaded lesson text
    const flashcardContent = document.querySelector("#flashcardContent");

    if (flashcardContent) {
        const files = getUserData("studyMateFiles", []);

        const sentences = files.flatMap(file =>
            file.content
                .split(/[.!?\n]+/)
                .map(sentence => sentence.trim())
                .filter(sentence => sentence.length > 15)
        );

        if (sentences.length === 0) {
            flashcardContent.innerHTML = `
                <div class="empty-state">
                    <h2>No flashcards available yet.</h2>
                    <p>Upload a TXT or MD lesson first to create study cards.</p>
                    <a href="upload.html" class="btn btn-primary">Upload Materials</a>
                </div>
            `;
        } else {
            flashcardContent.innerHTML = sentences.map((sentence, index) => `
                <details class="flashcard-item">
                    <summary>
                        <span>FLASHCARD ${index + 1}</span>
                        <strong>What is an important point from your lesson?</strong>
                        <small>Click to reveal answer</small>
                    </summary>
                    <p>${escapeHTML(sentence)}.</p>
                </details>
            `).join("");
        }
    }

    // Personal study schedule
    const scheduleForm = document.querySelector("#scheduleForm");
    const scheduleList = document.querySelector("#scheduleList");

    function displaySchedule() {
        if (!scheduleList) return;

        const schedule = getUserData("studyMateSchedule", []);

        if (schedule.length === 0) {
            scheduleList.innerHTML = `
                <p class="empty-state">
                    No study schedule yet. Add your first study activity above.
                </p>
            `;
            return;
        }

        scheduleList.innerHTML = schedule.map((item, index) => `
            <div class="content-card">
                <h3>${escapeHTML(item.subject)}</h3>
                <p>${escapeHTML(item.day)} · ${escapeHTML(item.time)}</p>
                <button type="button" class="btn btn-outline btn-sm" data-delete-schedule="${index}">
                    Delete
                </button>
            </div>
        `).join("");

        scheduleList.querySelectorAll("[data-delete-schedule]").forEach(button => {
            button.addEventListener("click", function () {
                const schedule = getUserData("studyMateSchedule", []);
                schedule.splice(Number(button.dataset.deleteSchedule), 1);
                saveUserData("studyMateSchedule", schedule);
                displaySchedule();
            });
        });
    }

    if (scheduleForm) {
        scheduleForm.addEventListener("submit", function (event) {
            event.preventDefault();

            const subject = scheduleForm.elements.namedItem("subject").value.trim();
            const day = scheduleForm.elements.namedItem("day").value;
            const time = scheduleForm.elements.namedItem("time").value;

            const schedule = getUserData("studyMateSchedule", []);

            schedule.push({ subject, day, time });

            saveUserData("studyMateSchedule", schedule);
            scheduleForm.reset();
            displaySchedule();
        });
    }

    displaySchedule();

    // Quiz results
    const quizForm = document.querySelector("#quizForm");

    if (quizForm) {
        quizForm.addEventListener("submit", function (event) {
            event.preventDefault();

            const questions = quizForm.querySelectorAll("[data-answer]");
            let score = 0;

            questions.forEach(question => {
                const answer = quizForm.querySelector(
                    `input[name="${question.dataset.name}"]:checked`
                );

                if (answer && answer.value === question.dataset.answer) {
                    score++;
                }
            });

            const results = getUserData("studyMateResults", []);

            results.push({
                score: score,
                total: questions.length,
                date: new Date().toLocaleString()
            });

            saveUserData("studyMateResults", results);

            location.href = "results.html";
        });
    }

    // Display latest quiz result
    const resultContent = document.querySelector("#resultContent");

    if (resultContent) {
        const results = getUserData("studyMateResults", []);

        if (results.length === 0) {
            resultContent.innerHTML = `
                <div class="empty-state">
                    <h2>No quiz results yet.</h2>
                    <p>Complete a quiz first. Your score will appear here.</p>
                    <a href="quiz.html" class="btn btn-primary">Take Quiz</a>
                </div>
            `;
        } else {
            const latest = results[results.length - 1];
            const percentage = Math.round((latest.score / latest.total) * 100);

            resultContent.innerHTML = `
                <div class="content-card result-card">
                    <h2>Your Latest Result</h2>
                    <h1>${latest.score} / ${latest.total}</h1>
                    <p>${percentage}%</p>
                    <p>${percentage >= 60 ? "Passed" : "Needs more practice"}</p>
                    <small>Completed: ${escapeHTML(latest.date)}</small>
                </div>
            `;
        }
    }
});

// Prevent uploaded text from being treated as HTML
function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
}
