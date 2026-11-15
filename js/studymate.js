
document.addEventListener("DOMContentLoaded", function () {

    /* Storage helpers */

    function getData(key, fallback = []) {
        try {
            const saved = localStorage.getItem(key);
            return saved ? JSON.parse(saved) : fallback;
        } catch (error) {
            console.error("Storage error:", error);
            return fallback;
        }
    }

    function saveData(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (error) {
            console.error("Unable to save data:", error);
            alert("Unable to save data. Browser storage may be full.");
            return false;
        }
    }

    function getCurrentUser() {
        return getData("studyMateCurrentUser", null);
    }

    function getUserKey(key) {
        const user = getCurrentUser();

        if (!user || !user.email) return null;

        return key + "_" + encodeURIComponent(user.email.toLowerCase());
    }

    function getUserData(key, fallback = []) {
        const userKey = getUserKey(key);

        if (!userKey) return fallback;

        return getData(userKey, fallback);
    }

    function saveUserData(key, value) {
        const userKey = getUserKey(key);

        if (!userKey) return false;

        return saveData(userKey, value);
    }

    function escapeHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, function (character) {
            const entities = {
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#039;"
            };

            return entities[character];
        });
    }

    /* Login protection */

    const isLoginPage = document.querySelector("#loginForm");
    const isRegisterPage = document.querySelector("#registerForm");
    const isPublicPage = isLoginPage || isRegisterPage;
    const currentUser = getCurrentUser();

    if (!currentUser && !isPublicPage) {
        if (window.location.pathname.includes("/pages/")) {
            window.location.href = "login.html";
            return;
        }
    }

    /* Register */

    const registerForm = document.querySelector("#registerForm");

    if (registerForm) {
        registerForm.addEventListener("submit", function (event) {
            event.preventDefault();

            const fullName =
                registerForm.elements.namedItem("fullname")?.value.trim() ||
                registerForm.elements.namedItem("name")?.value.trim();

            const email = registerForm.elements
                .namedItem("email")?.value.trim().toLowerCase();

            const password = registerForm.elements
                .namedItem("password")?.value;

            const confirmPassword = registerForm.elements
                .namedItem("confirmPassword")?.value;

            if (!fullName || !email || !password) {
                alert("Please complete all required fields.");
                return;
            }

            if (password.length < 6) {
                alert("Password must be at least 6 characters.");
                return;
            }

            if (
                confirmPassword !== undefined &&
                password !== confirmPassword
            ) {
                alert("Passwords do not match.");
                return;
            }

            const users = getData("studyMateUsers", []);

            const existingUser = users.find(function (user) {
                return user.email.toLowerCase() === email;
            });

            if (existingUser) {
                alert("This email is already registered.");
                return;
            }

            const newUser = {
                name: fullName,
                email: email,
                password: password,
                createdAt: new Date().toISOString()
            };

            users.push(newUser);

            if (!saveData("studyMateUsers", users)) return;

            if (!saveData("studyMateCurrentUser", {
                name: newUser.name,
                email: newUser.email
            })) return;

            alert("Registration successful!");
            window.location.href = "dashboard.html";
        });
    }

    /* Login */

    const loginForm = document.querySelector("#loginForm");

    if (loginForm) {
        loginForm.addEventListener("submit", function (event) {
            event.preventDefault();

            const email = loginForm.elements
                .namedItem("email")?.value.trim().toLowerCase();

            const password = loginForm.elements
                .namedItem("password")?.value;

            if (!email || !password) {
                alert("Please enter your email and password.");
                return;
            }

            const users = getData("studyMateUsers", []);

            const account = users.find(function (user) {
                return (
                    user.email.toLowerCase() === email &&
                    user.password === password
                );
            });

            if (!account) {
                alert("Incorrect email or password.");
                return;
            }

            saveData("studyMateCurrentUser", {
                name: account.name,
                email: account.email
            });

            alert("Login successful!");
            window.location.href = "dashboard.html";
        });
    }

    /* User name */

    document.querySelectorAll("[data-user-name]").forEach(function (element) {
        const user = getCurrentUser();

        if (user) {
            element.textContent = user.name;
        }
    });

    /* Logout */

    document.querySelectorAll("[data-logout]").forEach(function (button) {
        button.addEventListener("click", function () {
            localStorage.removeItem("studyMateCurrentUser");
            window.location.href = "../index.html";
        });
    });

    /* Upload materials */

    const uploadForm = document.querySelector("#uploadForm");
    const uploadedFilesContainer = document.querySelector("#uploadedFiles");

    const MAX_FILE_SIZE = 5 * 1024 * 1024;
    const MAX_EXTRACTED_TEXT = 40000;

    const SUPPORTED_EXTENSIONS = [
        "txt", "md", "pdf",
        "docx", "doc",
        "pptx", "ppt",
        "xls", "xlsx", "csv",
        "jpg", "jpeg", "png", "webp",
        "rtf",
        "mp4", "mov", "webm"
    ];

    const LIBRARY_URLS = {
        pdf: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js",
        mammoth: "https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.8.0/mammoth.browser.min.js",
        xlsx: "https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js",
        jszip: "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js",
        tesseract: "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js"
    };

    const libraryPromises = {};

    function loadLibrary(name) {
        if (libraryPromises[name]) {
            return libraryPromises[name];
        }

        libraryPromises[name] = new Promise(function (resolve, reject) {
            const existingScript = document.querySelector(
                'script[data-studymate-library="' + name + '"]'
            );

            if (existingScript) {
                if (name === "pdf" && window.pdfjsLib) return resolve();
                if (name === "mammoth" && window.mammoth) return resolve();
                if (name === "xlsx" && window.XLSX) return resolve();
                if (name === "jszip" && window.JSZip) return resolve();
                if (name === "tesseract" && window.Tesseract) return resolve();

                existingScript.addEventListener("load", resolve, { once: true });
                existingScript.addEventListener("error", reject, { once: true });
                return;
            }

            const script = document.createElement("script");

            script.src = LIBRARY_URLS[name];
            script.async = true;
            script.dataset.studymateLibrary = name;

            script.onload = resolve;

            script.onerror = function () {
                delete libraryPromises[name];
                reject(new Error("Unable to load " + name + " library."));
            };

            document.head.appendChild(script);
        });

        return libraryPromises[name];
    }

    function getFileExtension(fileName) {
        const parts = String(fileName).toLowerCase().split(".");
        return parts.length > 1 ? parts.pop() : "";
    }

    function readFileAsText(file) {
        return new Promise(function (resolve, reject) {
            const reader = new FileReader();

            reader.onload = function () {
                resolve(String(reader.result || ""));
            };

            reader.onerror = function () {
                reject(new Error("Unable to read this file."));
            };

            reader.readAsText(file);
        });
    }

    function readFileAsArrayBuffer(file) {
        return new Promise(function (resolve, reject) {
            const reader = new FileReader();

            reader.onload = function () {
                resolve(reader.result);
            };

            reader.onerror = function () {
                reject(new Error("Unable to read this file."));
            };

            reader.readAsArrayBuffer(file);
        });
    }

    function readFileAsDataURL(file) {
        return new Promise(function (resolve, reject) {
            const reader = new FileReader();

            reader.onload = function () {
                resolve(reader.result);
            };

            reader.onerror = function () {
                reject(new Error("Unable to read this image."));
            };

            reader.readAsDataURL(file);
        });
    }

    function cleanExtractedText(text) {
        return String(text || "")
            .replace(/\u0000/g, "")
            .replace(/\r\n/g, "\n")
            .replace(/\r/g, "\n")
            .replace(/[ \t]+\n/g, "\n")
            .replace(/\n{3,}/g, "\n\n")
            .trim()
            .substring(0, MAX_EXTRACTED_TEXT);
    }

    /* PDF extraction */

    async function extractPDFText(file) {
        await loadLibrary("pdf");

        if (!window.pdfjsLib) {
            throw new Error("PDF reader could not be initialized.");
        }

        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
            "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

        const buffer = await readFileAsArrayBuffer(file);

        const pdf = await window.pdfjsLib.getDocument({
            data: new Uint8Array(buffer)
        }).promise;

        let fullText = "";

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
            const page = await pdf.getPage(pageNumber);
            const textContent = await page.getTextContent();

            const pageText = textContent.items
                .map(function (item) {
                    return item.str || "";
                })
                .join(" ");

            fullText += "\n\n" + pageText;

            if (fullText.length >= MAX_EXTRACTED_TEXT) break;
        }

        return cleanExtractedText(fullText);
    }

    /* DOCX extraction */

    async function extractDOCXText(file) {
        await loadLibrary("mammoth");

        if (!window.mammoth) {
            throw new Error("DOCX reader could not be initialized.");
        }

        const buffer = await readFileAsArrayBuffer(file);

        const result = await window.mammoth.extractRawText({
            arrayBuffer: buffer
        });

        return cleanExtractedText(result.value);
    }

    /* Excel extraction */

    async function extractSpreadsheetText(file) {
        await loadLibrary("xlsx");

        if (!window.XLSX) {
            throw new Error("Spreadsheet reader could not be initialized.");
        }

        const buffer = await readFileAsArrayBuffer(file);

        const workbook = window.XLSX.read(buffer, {
            type: "array"
        });

        let output = "";

        workbook.SheetNames.forEach(function (sheetName) {
            const sheet = workbook.Sheets[sheetName];
            const rows = window.XLSX.utils.sheet_to_csv(sheet);

            output += "\n\n" + sheetName + "\n" + rows;
        });

        return cleanExtractedText(output);
    }

    /* PowerPoint extraction */

    async function extractPPTXText(file) {
        await loadLibrary("jszip");

        if (!window.JSZip) {
            throw new Error("PowerPoint reader could not be initialized.");
        }

        const buffer = await readFileAsArrayBuffer(file);
        const zip = await window.JSZip.loadAsync(buffer);

        const slideFiles = Object.keys(zip.files)
            .filter(function (name) {
                return /^ppt\/slides\/slide\d+\.xml$/i.test(name);
            })
            .sort(function (a, b) {
                const numberA = Number(a.match(/slide(\d+)/i)?.[1] || 0);
                const numberB = Number(b.match(/slide(\d+)/i)?.[1] || 0);

                return numberA - numberB;
            });

        let output = "";

        for (let index = 0; index < slideFiles.length; index++) {
            const xml = await zip.files[slideFiles[index]].async("text");

            const documentXML = new DOMParser().parseFromString(
                xml,
                "application/xml"
            );

            const paragraphs = Array.from(
                documentXML.getElementsByTagName("a:p")
            );

            const slideText = paragraphs.map(function (paragraph) {
                return Array.from(
                    paragraph.getElementsByTagName("a:t")
                ).map(function (node) {
                    return node.textContent || "";
                }).join("");
            }).filter(Boolean).join("\n");

            output += "\n\nSlide " + (index + 1) + "\n" + slideText;

            if (output.length >= MAX_EXTRACTED_TEXT) break;
        }

        return cleanExtractedText(output);
    }

    /* Image OCR extraction */

    async function extractImageText(file) {
        await loadLibrary("tesseract");

        if (!window.Tesseract) {
            throw new Error("OCR could not be initialized.");
        }

        const imageData = await readFileAsDataURL(file);

        const result = await window.Tesseract.recognize(
            imageData,
            "eng",
            {
                logger: function (message) {
                    if (message.status === "recognizing text") {
                        console.log(
                            "OCR progress:",
                            Math.round((message.progress || 0) * 100) + "%"
                        );
                    }
                }
            }
        );

        return cleanExtractedText(result.data.text);
    }

    /* RTF extraction */

    function extractRTFText(rtfText) {
        let text = String(rtfText || "");

        text = text.replace(/\\par[d]?/gi, "\n");
        text = text.replace(/\\tab/gi, "\t");
        text = text.replace(/\\'[0-9a-f]{2}/gi, "");
        text = text.replace(/\\u-?\d+\??/gi, "");
        text = text.replace(/\\[a-zA-Z]+-?\d* ?/g, "");
        text = text.replace(/[{}]/g, "");

        return cleanExtractedText(text);
    }

    /* Process uploaded files */

    async function processStudyFile(file) {
        const extension = getFileExtension(file.name);

        if (!SUPPORTED_EXTENSIONS.includes(extension)) {
            throw new Error("This file format is not supported.");
        }

        if (file.size > MAX_FILE_SIZE) {
            throw new Error("File is too large. Maximum file size is 5 MB.");
        }

        let content = "";
        let status = "Text extracted successfully";
        let extractionType = "text";

        switch (extension) {
            case "txt":
            case "md":
            case "csv":
                content = cleanExtractedText(await readFileAsText(file));
                break;

            case "pdf":
                content = await extractPDFText(file);
                break;

            case "docx":
                content = await extractDOCXText(file);
                break;

            case "xlsx":
            case "xls":
                content = await extractSpreadsheetText(file);
                break;

            case "pptx":
                content = await extractPPTXText(file);
                break;

            case "jpg":
            case "jpeg":
            case "png":
            case "webp":
                extractionType = "image-ocr";
                content = await extractImageText(file);
                break;

            case "rtf":
                content = extractRTFText(await readFileAsText(file));
                break;

            case "doc":
                extractionType = "unsupported";
                status = "Old DOC format: text extraction not available";
                break;

            case "ppt":
                extractionType = "unsupported";
                status = "Old PPT format: text extraction not available";
                break;

            case "mp4":
            case "mov":
            case "webm":
                extractionType = "video";
                status = "Video saved as a reference only. Transcription is not available.";
                break;

            default:
                throw new Error("This file format is not supported.");
        }

        if (
            !content &&
            extractionType !== "video" &&
            extractionType !== "unsupported"
        ) {
            status = "No readable text found in this file";
        }

        return {
            id: Date.now() + Math.floor(Math.random() * 100000),
            name: file.name,
            type: file.type || extension.toUpperCase() + " file",
            extension: extension,
            size: file.size,
            content: content,
            extractionType: extractionType,
            status: status,
            uploadedAt: new Date().toISOString()
        };
    }

    /* Display uploaded files */

    function renderUploadedFiles() {
        if (!uploadedFilesContainer) return;

        const files = getUserData("studyMateFiles", []);

        if (!files.length) {
            uploadedFilesContainer.innerHTML = `
                <div class="empty-state">
                    <h3>No study materials yet</h3>
                    <p>Upload your first lesson to get started.</p>
                </div>
            `;
            return;
        }

        uploadedFilesContainer.innerHTML = files.map(function (file, index) {
            return `
                <div class="uploaded-file">
                    <div class="uploaded-file-info">
                        <h3>${escapeHTML(file.name)}</h3>
                        <p>${escapeHTML(file.type || "Study Material")}</p>
                        <small>${escapeHTML(file.status || "Uploaded")}</small>
                    </div>

                    <button type="button" data-delete-file="${index}">
                        Delete
                    </button>
                </div>
            `;
        }).join("");
    }

    /* Upload form */

    if (uploadForm) {
        uploadForm.addEventListener("submit", async function (event) {
            event.preventDefault();

            const fileInput = uploadForm.querySelector('input[type="file"]');

            const submitButton = uploadForm.querySelector(
                'button[type="submit"], input[type="submit"]'
            );

            if (!fileInput || !fileInput.files.length) {
                alert("Please select at least one file.");
                return;
            }

            const selectedFiles = Array.from(fileInput.files);

            if (submitButton) {
                submitButton.disabled = true;

                if (submitButton.tagName === "INPUT") {
                    submitButton.value = "Processing...";
                } else {
                    submitButton.textContent = "Processing...";
                }
            }

            let successfulFiles = [];
            let failedFiles = [];

            try {
                for (const selectedFile of selectedFiles) {
                    try {
                        const processedFile = await processStudyFile(selectedFile);
                        successfulFiles.push(processedFile);
                    } catch (error) {
                        console.error(
                            "File processing error:",
                            selectedFile.name,
                            error
                        );

                        failedFiles.push({
                            name: selectedFile.name,
                            reason: error.message || "Unable to process file."
                        });
                    }
                }

                if (successfulFiles.length) {
                    const existingFiles = getUserData("studyMateFiles", []);
                    const updatedFiles = existingFiles.concat(successfulFiles);

                    const saved = saveUserData("studyMateFiles", updatedFiles);

                    if (saved) {
                        uploadForm.reset();

                        renderUploadedFiles();
                        renderReviewer();
                        renderFlashcards();
                        updateDashboard();
                    } else {
                        alert(
                            "Your files were processed, but browser storage " +
                            "could not save them. Try deleting old materials."
                        );
                    }
                }

                let message = "";

                if (successfulFiles.length) {
                    message += successfulFiles.length +
                        " file(s) processed.\n\n";

                    successfulFiles.forEach(function (file) {
                        message += "• " + file.name +
                            "\n  " + file.status + "\n";
                    });
                }

                if (failedFiles.length) {
                    message += "\nSome files could not be processed:\n";

                    failedFiles.forEach(function (file) {
                        message += "• " + file.name +
                            "\n  " + file.reason + "\n";
                    });
                }

                if (message) {
                    alert(message);
                }

            } finally {
                if (submitButton) {
                    submitButton.disabled = false;

                    if (submitButton.tagName === "INPUT") {
                        submitButton.value = "Upload Material";
                    } else {
                        submitButton.textContent = "Upload Material";
                    }
                }
            }
        });
    }

    /* Delete uploaded files */

    if (uploadedFilesContainer) {
        uploadedFilesContainer.addEventListener("click", function (event) {
            const button = event.target.closest("[data-delete-file]");

            if (!button) return;

            const index = Number(button.dataset.deleteFile);
            const files = getUserData("studyMateFiles", []);

            if (!files[index]) return;

            if (!confirm("Delete this study material?")) return;

            files.splice(index, 1);

            if (saveUserData("studyMateFiles", files)) {
                renderUploadedFiles();
                renderReviewer();
                renderFlashcards();
                updateDashboard();
            }
        });

        renderUploadedFiles();
    }

    /* Reviewer */

    const reviewerContent = document.querySelector("#reviewerContent");

    function renderReviewer() {
        if (!reviewerContent) return;

        const files = getUserData("studyMateFiles", []);

        if (!files.length) {
            reviewerContent.innerHTML = `
                <div class="empty-state">
                    <h3>No reviewer available</h3>
                    <p>Upload your study materials first.</p>
                </div>
            `;
            return;
        }

        reviewerContent.innerHTML = files.map(function (file, index) {
            const content = file.content || "";

            return `
                <article class="reviewer-card">
                    <h3>${escapeHTML(file.name)}</h3>

                    <p>
                        ${escapeHTML(content.substring(0, 500) ||
                            file.status || "No extracted text available.")}
                    </p>

                    ${content ? `
                        <button
                            type="button"
                            data-view-reviewer="${index}"
                        >
                            View Material
                        </button>

                        <div id="reviewer-full-${index}" hidden>
                            <p>${escapeHTML(content)}</p>
                        </div>
                    ` : `
                        <p>
                            <small>${escapeHTML(file.status || "No text available.")}</small>
                        </p>
                    `}
                </article>
            `;
        }).join("");
    }

    if (reviewerContent) {
        reviewerContent.addEventListener("click", function (event) {
            const button = event.target.closest("[data-view-reviewer]");

            if (!button) return;

            const content = document.querySelector(
                "#reviewer-full-" + button.dataset.viewReviewer
            );

            if (!content) return;

            content.hidden = !content.hidden;

            button.textContent = content.hidden
                ? "View Material"
                : "Hide Material";
        });

        renderReviewer();
    }

    /* Flashcards */

    const flashcardContent = document.querySelector("#flashcardContent");

    function createFlashcardsFromText(text) {
        if (!text) return [];

        const lines = text
            .split(/\n/)
            .map(line => line.trim())
            .filter(Boolean);

        return lines.reduce(function (cards, line) {
            const separator = line.indexOf(":");

            if (separator > 0) {
                cards.push({
                    question: line.substring(0, separator).trim(),
                    answer: line.substring(separator + 1).trim()
                });
            }

            return cards;
        }, []);
    }

    function renderFlashcards() {
        if (!flashcardContent) return;

        const files = getUserData("studyMateFiles", []);

        if (!files.length) {
            flashcardContent.innerHTML = `
                <div class="empty-state">
                    <h3>No flashcards available</h3>
                    <p>Upload your study materials first.</p>
                </div>
            `;
            return;
        }

        let allCards = [];

        files.forEach(function (file) {
            createFlashcardsFromText(file.content || "").forEach(function (card) {
                allCards.push({
                    ...card,
                    source: file.name
                });
            });
        });

        if (!allCards.length) {
            flashcardContent.innerHTML = `
                <div class="empty-state">
                    <h3>No flashcards generated</h3>
                    <p>Use this format in your text: Term: Definition</p>
                </div>
            `;
            return;
        }

        flashcardContent.innerHTML = allCards.map(function (card, index) {
            return `
                <div class="flashcard" data-flashcard="${index}">
                    <div class="flashcard-inner">
                        <div class="flashcard-front">
                            <h3>${escapeHTML(card.question)}</h3>
                            <p>Click to reveal answer</p>
                        </div>

                        <div class="flashcard-back">
                            <p>${escapeHTML(card.answer)}</p>
                        </div>
                    </div>

                    <small>${escapeHTML(card.source)}</small>
                </div>
            `;
        }).join("");

        flashcardContent.querySelectorAll(".flashcard").forEach(function (card) {
            card.addEventListener("click", function () {
                card.classList.toggle("flipped");
            });
        });
    }

    if (flashcardContent) {
        renderFlashcards();
    }

    /* Schedule */

    const scheduleForm = document.querySelector("#scheduleForm");
    const scheduleList = document.querySelector("#scheduleList");

    const dayDropdownButton = document.querySelector("#dayDropdownButton");
    const dayDropdownOptions = document.querySelector("#dayDropdownOptions");
    const selectedDaysText = document.querySelector("#selectedDaysText");
    const dayMultiSelect = document.querySelector("#dayMultiSelect");

    const WEEK_DAYS = [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday"
    ];

    let editingScheduleId = null;

    function normalizeDay(day) {
        if (!day) return null;

        const value = String(day).trim().toLowerCase();

        const dayMap = {
            mon: "Monday",
            monday: "Monday",
            tue: "Tuesday",
            tues: "Tuesday",
            tuesday: "Tuesday",
            wed: "Wednesday",
            wednesday: "Wednesday",
            thu: "Thursday",
            thur: "Thursday",
            thurs: "Thursday",
            thursday: "Thursday",
            fri: "Friday",
            friday: "Friday",
            sat: "Saturday",
            saturday: "Saturday",
            sun: "Sunday",
            sunday: "Sunday"
        };

        return dayMap[value] || null;
    }

    function timeToMinutes(time) {
        if (!time || !/^\d{2}:\d{2}$/.test(time)) return null;

        const parts = time.split(":");
        const hours = Number(parts[0]);
        const minutes = Number(parts[1]);

        if (hours > 23 || minutes > 59) return null;

        return hours * 60 + minutes;
    }

    function addMinutesToTime(time, amount) {
        const minutes = timeToMinutes(time);

        if (minutes === null) return "";

        const newMinutes = (minutes + amount) % 1440;
        const hours = Math.floor(newMinutes / 60);
        const remainingMinutes = newMinutes % 60;

        return (
            String(hours).padStart(2, "0") +
            ":" +
            String(remainingMinutes).padStart(2, "0")
        );
    }

    function formatTime(time) {
        const minutes = timeToMinutes(time);

        if (minutes === null) return time || "";

        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        const period = hours >= 12 ? "PM" : "AM";
        const displayHour = hours % 12 || 12;

        return displayHour + ":" +
            String(remainingMinutes).padStart(2, "0") +
            " " + period;
    }

    function getSchedules() {
        const schedules = getUserData("studyMateSchedule", []);

        if (!Array.isArray(schedules)) return [];

        return schedules.map(function (item, index) {
            const days = Array.isArray(item.days)
                ? item.days
                : item.day
                    ? [item.day]
                    : [];

            const startTime = item.startTime || item.time || "";
            const endTime = item.endTime ||
                (startTime ? addMinutesToTime(startTime, 60) : "");

            return {
                ...item,
                id: item.id || Date.now() + index,
                subject: item.subject || "Untitled Subject",
                days: [...new Set(days.map(normalizeDay).filter(Boolean))],
                startTime: startTime,
                endTime: endTime,
                location: item.location || item.room || ""
            };
        });
    }

    function saveSchedules(schedules) {
        return saveUserData("studyMateSchedule", schedules);
    }

    function getFormDays(form) {
        const fields = form.querySelectorAll(
            'input[name="day"], input[name="days"], input[name="scheduleDay"]'
        );

        let days = Array.from(fields)
            .filter(field => field.type === "checkbox" && field.checked)
            .map(field => normalizeDay(field.value))
            .filter(Boolean);

        if (!days.length) {
            const select = form.querySelector(
                'select[name="day"], select[name="days"]'
            );

            if (select) {
                const values = select.multiple
                    ? Array.from(select.selectedOptions).map(option => option.value)
                    : [select.value];

                days = values.map(normalizeDay).filter(Boolean);
            }
        }

        return [...new Set(days)];
    }

    function getSelectedDays() {
        return scheduleForm ? getFormDays(scheduleForm) : [];
    }

    function updateSelectedDaysText() {
        if (!selectedDaysText) return;

        const days = getSelectedDays();

        selectedDaysText.textContent = days.length
            ? days.join(", ")
            : "Select days";
    }

    if (dayDropdownButton && dayDropdownOptions) {
        dayDropdownButton.addEventListener("click", function (event) {
            event.stopPropagation();

            dayDropdownOptions.hidden = !dayDropdownOptions.hidden;

            dayDropdownButton.setAttribute(
                "aria-expanded",
                String(!dayDropdownOptions.hidden)
            );
        });

        document.addEventListener("click", function (event) {
            if (dayMultiSelect && !dayMultiSelect.contains(event.target)) {
                dayDropdownOptions.hidden = true;
                dayDropdownButton.setAttribute("aria-expanded", "false");
            }
        });
    }

    if (scheduleForm) {
        scheduleForm.querySelectorAll(
            'input[name="day"], input[name="days"], input[name="scheduleDay"]'
        ).forEach(function (checkbox) {
            checkbox.addEventListener("change", updateSelectedDaysText);
        });
    }

    function findScheduleConflict(newSchedule, schedules, excludedId = null) {
        const newStart = timeToMinutes(newSchedule.startTime);
        const newEnd = timeToMinutes(newSchedule.endTime);

        if (newStart === null || newEnd === null) return null;

        return schedules.find(function (existing) {
            if (String(existing.id) === String(excludedId)) return false;

            const existingStart = timeToMinutes(existing.startTime);
            const existingEnd = timeToMinutes(existing.endTime);

            if (existingStart === null || existingEnd === null) return false;

            const sameDay = existing.days.some(function (day) {
                return newSchedule.days.includes(day);
            });

            if (!sameDay) return false;

            return newStart < existingEnd && newEnd > existingStart;
        }) || null;
    }

    function getFieldValue(form, names) {
        for (const name of names) {
            const field = form.elements.namedItem(name);

            if (field && typeof field.value === "string") {
                return field.value.trim();
            }
        }

        return "";
    }

    function saveScheduleFromForm(form, subjectOverride = "") {
        const subject = subjectOverride ||
            form.dataset.subject ||
            getFieldValue(form, ["subject", "title", "activity"]);

        const days = getFormDays(form);

        const startTime = getFieldValue(form, [
            "startTime", "start", "time"
        ]);

        let endTime = getFieldValue(form, [
            "endTime", "end"
        ]);

        const location = getFieldValue(form, [
            "location", "room", "venue"
        ]);

        if (!endTime && startTime) {
            endTime = addMinutesToTime(startTime, 60);
        }

        if (!subject || !days.length || !startTime || !endTime) {
            alert("Please complete the subject, days, start time, and end time.");
            return false;
        }

        const start = timeToMinutes(startTime);
        const end = timeToMinutes(endTime);

        if (start === null || end === null || end <= start) {
            alert("Please enter a valid start and end time.");
            return false;
        }

        const schedules = getSchedules();

        const newSchedule = {
            id: editingScheduleId || Date.now(),
            subject: subject,
            days: days,
            startTime: startTime,
            endTime: endTime,
            time: startTime,
            location: location
        };

        const conflict = findScheduleConflict(
            newSchedule,
            schedules,
            editingScheduleId
        );

        if (conflict) {
            alert(
                "Schedule conflict detected!\n\n" +
                conflict.subject + " already has a schedule on " +
                days.filter(day => conflict.days.includes(day)).join(", ") +
                " from " + formatTime(conflict.startTime) +
                " to " + formatTime(conflict.endTime) + "."
            );

            return false;
        }

        if (editingScheduleId) {
            const index = schedules.findIndex(function (item) {
                return String(item.id) === String(editingScheduleId);
            });

            if (index !== -1) {
                schedules[index] = newSchedule;
            }

            editingScheduleId = null;
        } else {
            schedules.push(newSchedule);
        }

        if (!saveSchedules(schedules)) return false;

        renderSchedule();
        renderWeeklyTimetable();

        return true;
    }

    function renderSchedule() {
        if (!scheduleList) return;

        const schedules = getSchedules();

        if (!schedules.length) {
            scheduleList.innerHTML = `
                <div class="empty-state">
                    <h3>No schedule added yet</h3>
                    <p>Add your classes to organize your week.</p>
                </div>
            `;
            return;
        }

        scheduleList.innerHTML = schedules.map(function (item) {
            return `
                <div class="schedule-item">
                    <div class="schedule-details">
                        <h3>${escapeHTML(item.subject)}</h3>
                        <p>${escapeHTML(item.days.join(", "))}</p>
                        <p>
                            ${escapeHTML(formatTime(item.startTime))}
                            - ${escapeHTML(formatTime(item.endTime))}
                        </p>
                        ${item.location ? `
                            <p>${escapeHTML(item.location)}</p>
                        ` : ""}
                    </div>

                    <div class="schedule-actions">
                        <button
                            type="button"
                            data-edit-schedule="${escapeHTML(item.id)}"
                        >
                            Edit
                        </button>

                        <button
                            type="button"
                            data-delete-schedule="${escapeHTML(item.id)}"
                        >
                            Delete
                        </button>
                    </div>
                </div>
            `;
        }).join("");
    }

    function renderWeeklyTimetable() {
        const timetable = document.querySelector(
            "#weeklyTimetable, #weeklySchedule, #scheduleTable"
        );

        if (!timetable) return;

        const schedules = getSchedules();

        const sortedSchedules = schedules.slice().sort(function (a, b) {
            return timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
        });

        timetable.innerHTML = `
            <div class="table-scroll">
                <table class="data-table weekly-timetable">
                    <thead>
                        <tr>
                            <th>Day</th>
                            <th>Subject</th>
                            <th>Time</th>
                            <th>Room / Location</th>
                        </tr>
                    </thead>

                    <tbody>
                        ${WEEK_DAYS.map(function (day) {
                            const daySchedules = sortedSchedules.filter(function (item) {
                                return item.days.includes(day);
                            });

                            if (!daySchedules.length) {
                                return `
                                    <tr>
                                        <td>${day}</td>
                                        <td colspan="3">No classes scheduled</td>
                                    </tr>
                                `;
                            }

                            return daySchedules.map(function (item, index) {
                                return `
                                    <tr>
                                        <td>${index === 0 ? day : ""}</td>
                                        <td>${escapeHTML(item.subject)}</td>
                                        <td>
                                            ${escapeHTML(formatTime(item.startTime))}
                                            -
                                            ${escapeHTML(formatTime(item.endTime))}
                                        </td>
                                        <td>${escapeHTML(item.location || "-")}</td>
                                    </tr>
                                `;
                            }).join("");
                        }).join("")}
                    </tbody>
                </table>
            </div>
        `;
    }

    if (scheduleForm) {
        scheduleForm.addEventListener("submit", function (event) {
            event.preventDefault();

            const wasEditing = editingScheduleId !== null;
            const success = saveScheduleFromForm(scheduleForm);

            if (success) {
                scheduleForm.reset();
                updateSelectedDaysText();

                if (dayDropdownOptions) {
                    dayDropdownOptions.hidden = true;
                }

                alert(
                    wasEditing
                        ? "Schedule updated successfully!"
                        : "Schedule added successfully!"
                );

                editingScheduleId = null;
            }
        });
    }

    if (scheduleList) {
        scheduleList.addEventListener("click", function (event) {
            const deleteButton = event.target.closest("[data-delete-schedule]");
            const editButton = event.target.closest("[data-edit-schedule]");

            const schedules = getSchedules();

            if (deleteButton) {
                const id = deleteButton.dataset.deleteSchedule;

                if (!confirm("Delete this schedule?")) return;

                const updatedSchedules = schedules.filter(function (item) {
                    return String(item.id) !== String(id);
                });

                if (saveSchedules(updatedSchedules)) {
                    renderSchedule();
                    renderWeeklyTimetable();
                }
            }

            if (editButton) {
                const id = editButton.dataset.editSchedule;

                const item = schedules.find(function (schedule) {
                    return String(schedule.id) === String(id);
                });

                if (!item || !scheduleForm) return;

                editingScheduleId = item.id;

                const subjectField = scheduleForm.elements.namedItem("subject");
                const startField = scheduleForm.elements.namedItem("startTime") ||
                    scheduleForm.elements.namedItem("time");

                const endField = scheduleForm.elements.namedItem("endTime");

                if (subjectField) subjectField.value = item.subject;
                if (startField) startField.value = item.startTime;
                if (endField) endField.value = item.endTime;

                const locationField = scheduleForm.elements.namedItem("location") ||
                    scheduleForm.elements.namedItem("room");

                if (locationField) locationField.value = item.location || "";

                scheduleForm.querySelectorAll(
                    'input[name="day"], input[name="days"], input[name="scheduleDay"]'
                ).forEach(function (checkbox) {
                    checkbox.checked = item.days.includes(
                        normalizeDay(checkbox.value)
                    );
                });

                updateSelectedDaysText();

                scheduleForm.scrollIntoView({
                    behavior: "smooth",
                    block: "center"
                });
            }
        });

        renderSchedule();
    }

    /* Subject schedule forms */

    document.addEventListener("submit", function (event) {
        const form = event.target.closest(
            "form[data-subject-schedule]"
        );

        if (!form) return;

        event.preventDefault();

        const subject = form.dataset.subject ||
            form.querySelector("[name='subject']")?.value.trim();

        const success = saveScheduleFromForm(form, subject);

        if (success) {
            form.reset();
            alert("Subject schedule added successfully!");
        }
    });

    /* Schedule page initialization */

    updateSelectedDaysText();
    renderWeeklyTimetable();

    /* Quiz */

    const quizForm = document.querySelector("#quizForm");

    function getQuizQuestions() {
        return getUserData("studyMateQuiz", []);
    }

    function renderQuiz() {
        if (!quizForm) return;

        const questions = getQuizQuestions();

        if (!questions.length) {
            quizForm.innerHTML = `
                <div class="empty-state">
                    <h3>No quiz available</h3>
                    <p>Upload study materials to prepare for your quiz.</p>
                </div>
            `;
            return;
        }

        quizForm.innerHTML = questions.map(function (question, index) {
            return `
                <div class="quiz-question">
                    <h3>${index + 1}. ${escapeHTML(question.question)}</h3>

                    <div class="quiz-options">
                        ${(question.options || []).map(function (option, optionIndex) {
                            return `
                                <label>
                                    <input
                                        type="radio"
                                        name="question-${index}"
                                        value="${optionIndex}"
                                        required
                                    >
                                    ${escapeHTML(option)}
                                </label>
                            `;
                        }).join("")}
                    </div>
                </div>
            `;
        }).join("") + `
            <button type="submit">Submit Quiz</button>
        `;
    }

    if (quizForm) {
        quizForm.addEventListener("submit", function (event) {
            event.preventDefault();

            const questions = getQuizQuestions();

            if (!questions.length) return;

            let score = 0;

            questions.forEach(function (question, index) {
                const selected = quizForm.querySelector(
                    'input[name="question-' + index + '"]:checked'
                );

                if (
                    selected &&
                    Number(selected.value) === Number(question.correctAnswer)
                ) {
                    score++;
                }
            });

            const result = {
                id: Date.now(),
                score: score,
                total: questions.length,
                percentage: Math.round((score / questions.length) * 100),
                date: new Date().toISOString()
            };

            const results = getUserData("studyMateResults", []);

            results.push(result);

            if (!saveUserData("studyMateResults", results)) return;

            alert(
                "Quiz completed!\nYour score: " +
                score + " out of " + questions.length
            );

            window.location.href = "results.html";
        });
    }

    renderQuiz();

    /* Results */

    const resultContent = document.querySelector("#resultContent");

    function renderResults() {
        if (!resultContent) return;

        const results = getUserData("studyMateResults", []);

        if (!results.length) {
            resultContent.innerHTML = `
                <div class="empty-state">
                    <h3>No results yet</h3>
                    <p>Complete a quiz to see your results here.</p>
                </div>
            `;
            return;
        }

        resultContent.innerHTML = results.slice().reverse().map(function (result) {
            return `
                <div class="result-card">
                    <h3>Quiz Result</h3>

                    <p>
                        Score:
                        <strong>
                            ${escapeHTML(result.score)} /
                            ${escapeHTML(result.total)}
                        </strong>
                    </p>

                    <p>
                        Percentage:
                        <strong>${escapeHTML(result.percentage)}%</strong>
                    </p>

                    <small>
                        ${escapeHTML(new Date(result.date).toLocaleString())}
                    </small>
                </div>
            `;
        }).join("");
    }

    if (resultContent) {
        renderResults();
    }

    /* Dashboard */

    function updateDashboard() {
        const files = getUserData("studyMateFiles", []);
        const results = getUserData("studyMateResults", []);

        const materialCount = document.querySelector("#materialCount");
        const flashcardCount = document.querySelector("#flashcardCount");
        const quizCount = document.querySelector("#quizCount");
        const dashboardMaterials = document.querySelector("#dashboardMaterials");

        if (materialCount) {
            materialCount.textContent = files.length;
        }

        if (flashcardCount) {
            const totalCards = files.reduce(function (total, file) {
                return total +
                    createFlashcardsFromText(file.content || "").length;
            }, 0);

            flashcardCount.textContent = totalCards;
        }

        if (quizCount) {
            quizCount.textContent = results.length;
        }

        if (dashboardMaterials) {
            if (!files.length) {
                dashboardMaterials.innerHTML = `
                    <div class="empty-state">
                        <h3>No study materials yet</h3>
                        <p>Upload your first material to get started.</p>
                    </div>
                `;
            } else {
                dashboardMaterials.innerHTML = files.map(function (file) {
                    return `
                        <div class="dashboard-material">
                            <h3>${escapeHTML(file.name)}</h3>
                            <small>
                                ${escapeHTML(
                                    new Date(file.uploadedAt).toLocaleDateString()
                                )}
                            </small>
                        </div>
                    `;
                }).join("");
            }
        }
    }

    updateDashboard();

    console.log("StudyMate loaded successfully.");

});
