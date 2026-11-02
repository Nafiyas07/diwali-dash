
import {
    database,
    auth,
    authReady,
    ref,
    get,
    runTransaction,
    onValue
} from "./firebase.js";

// ==========================================
// DIWALI DASH — THE FESTIVE GAUNTLET
// NIPUNI × AVTAR HUMAN CAPITAL TRUST
// ==========================================

const MAX_ATTEMPTS = 3;
const GAME_TIME = 75;
const TOTAL_GAMES = 5;

const $ = (id) => document.getElementById(id);

const screens = [
    "welcome-screen",
    "game-screen",
    "result-screen",
    "leaderboard-screen",
    "certificate-screen"
];

let playerName = "";
let playerUid = "";
let totalScore = 0;
let gameIndex = 0;
let timeLeft = GAME_TIME;
let timerInterval = null;
let gameActive = false;
let attemptsUsed = 0;
let bestScore = 0;
let answerLocked = false;
let cleanupGame = null;

let gameState = {};
let leaderboardUnsubscribe = null;

// ==========================================
// GENERAL HELPERS
// ==========================================

function showScreen(screenId) {
    screens.forEach((id) => {
        const element = $(id);
        if (element) {
            element.style.display = id === screenId ? "block" : "none";
        }
    });
}

function setText(id, value) {
    const element = $(id);
    if (element) element.textContent = value;
}

function shuffle(items) {
    const copy = [...items];

    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }

    return copy;
}

function randomItem(items) {
    return items[Math.floor(Math.random() * items.length)];
}

function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[character]);
}

function renderArea(html) {
    const area = $("game-area");
    if (area) area.innerHTML = html;
}

function updateScore(points) {
    totalScore = Math.max(0, totalScore + points);
    setText("current-score", totalScore.toLocaleString("en-IN"));
}

function showFeedback(message, type = "info") {
    let feedback = $("game-feedback");

    if (!feedback) {
        feedback = document.createElement("div");
        feedback.id = "game-feedback";
        feedback.style.cssText = `
      margin: 14px auto;
      padding: 12px 16px;
      border-radius: 12px;
      max-width: 500px;
      text-align: center;
      font-weight: 700;
    `;

        $("game-area")?.appendChild(feedback);
    }

    feedback.textContent = message;

    const colors = {
        success: "#176b45",
        error: "#9d3434",
        info: "#75521c"
    };

    feedback.style.background = colors[type] || colors.info;
    feedback.style.color = "#ffffff";
}

function addPoints(points, message) {
    updateScore(points);
    showFeedback(`${message} +${points} points`, "success");
}

function stopTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
}

function stopCurrentGame() {
    stopTimer();
    gameActive = false;

    if (typeof cleanupGame === "function") {
        cleanupGame();
        cleanupGame = null;
    }
}

function updateTimerDisplay() {
    setText("timer", `${timeLeft}s`);

    const progress = $("progress-bar");

    if (progress) {
        progress.style.width = `${(timeLeft / GAME_TIME) * 100}%`;
    }
}

function startTimer() {
    stopTimer();

    timeLeft = GAME_TIME;
    updateTimerDisplay();

    timerInterval = setInterval(() => {
        timeLeft--;
        updateTimerDisplay();

        if (timeLeft <= 0) {
            finishCurrentGame();
        }
    }, 1000);
}

function finishCurrentGame() {
    if (!gameActive) return;

    stopCurrentGame();

    if (gameIndex < TOTAL_GAMES - 1) {
        gameIndex++;
        setTimeout(startCurrentGame, 1200);
    } else {
        finishAttempt();
    }
}

// ==========================================
// GAME FLOW
// ==========================================

const gameDetails = [
    {
        name: "GAME 1 OF 5",
        title: "THE VIGIL",
        instruction: "Watch the diya sequence carefully. Then repeat it in the correct order."
    },
    {
        name: "GAME 2 OF 5",
        title: "THE MITHAI COUNTER",
        instruction: "Read the sorting rule and send each order to the correct tray."
    },
    {
        name: "GAME 3 OF 5",
        title: "THE TERMINAL",
        instruction: "Solve coding outputs and logic challenges. Accuracy matters."
    },
    {
        name: "GAME 4 OF 5",
        title: "LAUNCH CONTROL",
        instruction: "Stop the moving power meter inside the target zone."
    },
    {
        name: "GAME 5 OF 5",
        title: "THE PHONE",
        instruction: "Inspect suspicious messages and protect your digital wallet."
    }
];

async function reserveAttempt() {
    const playerRef = ref(database, `players/${playerUid}`);

    const result = await runTransaction(playerRef, (current) => {
        if (!current) {
            return {
                name: playerName,
                bestScore: 0,
                attempts: 1,
                updatedAt: Date.now()
            };
        }

        const used = Number(current.attempts || 0);

        if (used >= MAX_ATTEMPTS) {
            return;
        }

        return {
            ...current,
            name: playerName,
            bestScore: Number(current.bestScore || 0),
            attempts: used + 1,
            updatedAt: Date.now()
        };
    });

    if (!result.committed) {
        return false;
    }

    attemptsUsed = Number(result.snapshot.val()?.attempts || 0);
    bestScore = Number(result.snapshot.val()?.bestScore || 0);

    return true;
}

async function startGame() {
    const nameInput = $("player-name");
    const enteredName = nameInput?.value.trim() || "";

    if (enteredName.length < 2 || enteredName.length > 16) {
        alert("Please enter a name between 2 and 16 characters.");
        return;
    }

    playerName = enteredName;

    try {
        await authReady;

        if (!auth.currentUser) {
            throw new Error("Authentication is not ready. Please refresh and try again.");
        }

        playerUid = auth.currentUser.uid;

        const playerRef = ref(database, `players/${playerUid}`);
        const snapshot = await get(playerRef);

        attemptsUsed = Number(snapshot.val()?.attempts || 0);
        bestScore = Number(snapshot.val()?.bestScore || 0);

        if (attemptsUsed >= MAX_ATTEMPTS) {
            alert("You have used all 3 attempts. Thank you for playing!");
            return;
        }

        const reserved = await reserveAttempt();

        if (!reserved) {
            alert("You have used all 3 attempts. Thank you for playing!");
            return;
        }

        totalScore = 0;
        gameIndex = 0;

        setText("current-score", "0");

        showScreen("game-screen");
        startCurrentGame();
    } catch (error) {
        console.error("Could not start game:", error);
        alert("Unable to connect. Please check your internet connection and try again.");
    }
}

function startCurrentGame() {
    if (gameIndex >= TOTAL_GAMES) {
        finishAttempt();
        return;
    }

    stopCurrentGame();

    gameActive = true;
    answerLocked = false;

    const details = gameDetails[gameIndex];

    setText("round-name", details.name);
    setText("game-title", details.title);
    setText("game-instruction", details.instruction);
    setText("current-score", totalScore.toLocaleString("en-IN"));

    renderArea("");

    startTimer();

    switch (gameIndex) {
        case 0:
            startVigil();
            break;
        case 1:
            startMithaiCounter();
            break;
        case 2:
            startTerminal();
            break;
        case 3:
            startLaunchControl();
            break;
        case 4:
            startPhone();
            break;
    }
}

// ==========================================
// GAME 1 — THE VIGIL
// MEMORY SEQUENCE CHALLENGE
// ==========================================

function startVigil() {
    const colors = ["gold", "blue", "orange", "red"];
    const gridSize = 9;

    let sequence = [];
    let playerSequence = [];
    let showingSequence = false;
    let level = 1;

    renderArea(`
    <div class="vigil-game">
      <h3 id="vigil-level">Level 1</h3>
      <p id="vigil-message">Memorise the glowing diyas.</p>
      <div class="vigil-grid" id="vigil-grid">
        ${Array.from({ length: gridSize }, (_, i) => `
          <button class="vigil-diya" data-index="${i}" aria-label="Diya ${i + 1}">
            🪔
          </button>
        `).join("")}
      </div>
      <p id="vigil-progress">Sequence: 0 / 0</p>
      <button id="vigil-start" class="game-action-btn">Show Sequence</button>
    </div>
  `);

    const grid = $("vigil-grid");
    const startButton = $("vigil-start");

    function newLevel() {
        if (!gameActive) return;

        playerSequence = [];
        showingSequence = true;

        const length = Math.min(2 + level, 8);

        sequence = Array.from({ length }, () => ({
            index: Math.floor(Math.random() * gridSize),
            color: randomItem(colors)
        }));

        setText("vigil-level", `Level ${level}`);
        setText("vigil-message", "Watch carefully...");
        setText("vigil-progress", `Sequence: 0 / ${length}`);

        grid.querySelectorAll("button").forEach((button) => {
            button.disabled = true;
            button.className = "vigil-diya";
        });

        startButton.disabled = true;

        let position = 0;

        const showNext = () => {
            if (!gameActive) return;

            if (position >= sequence.length) {
                showingSequence = false;

                grid.querySelectorAll("button").forEach((button) => {
                    button.disabled = false;
                });

                setText("vigil-message", "Now repeat the sequence!");
                startButton.disabled = false;
                startButton.textContent = "Restart Sequence";
                return;
            }

            const item = sequence[position];
            const button = grid.querySelector(`[data-index="${item.index}"]`);

            if (button) {
                button.classList.add("glowing", item.color);
            }

            setTimeout(() => {
                button?.classList.remove("glowing", item.color);
                position++;
                setTimeout(showNext, 220);
            }, 550);
        };

        setTimeout(showNext, 400);
    }

    function handleTap(event) {
        const button = event.target.closest(".vigil-diya");

        if (!button || showingSequence || !gameActive) return;

        const index = Number(button.dataset.index);
        const expected = sequence[playerSequence.length];

        if (!expected) return;

        if (index !== expected.index) {
            showFeedback("Wrong diya! Try the next sequence.", "error");
            updateScore(-15);
            newLevel();
            return;
        }

        playerSequence.push(index);

        button.classList.add("correct");

        setText(
            "vigil-progress",
            `Sequence: ${playerSequence.length} / ${sequence.length}`
        );

        setTimeout(() => button.classList.remove("correct"), 300);

        if (playerSequence.length === sequence.length) {
            const points = 40 + level * 15;
            addPoints(points, `Level ${level} completed!`);

            level++;

            setTimeout(newLevel, 900);
        }
    }

    grid.addEventListener("click", handleTap);
    startButton.addEventListener("click", newLevel);

    cleanupGame = () => {
        grid.removeEventListener("click", handleTap);
    };

    newLevel();
}

// ==========================================
// GAME 2 — THE MITHAI COUNTER
// LOGIC-BASED SORTING
// ==========================================

function startMithaiCounter() {
    const orders = [
        { name: "Kaju Katli", shape: "diamond", price: 80, count: 2 },
        { name: "Laddu", shape: "round", price: 40, count: 5 },
        { name: "Jalebi", shape: "round", price: 30, count: 3 },
        { name: "Mysore Pak", shape: "square", price: 60, count: 4 },
        { name: "Soan Papdi", shape: "square", price: 50, count: 2 },
        { name: "Peda", shape: "round", price: 25, count: 6 },
        { name: "Badam Halwa", shape: "square", price: 100, count: 3 },
        { name: "Coconut Barfi", shape: "square", price: 45, count: 4 },
        { name: "Milk Cake", shape: "square", price: 70, count: 2 },
        { name: "Gulab Jamun", shape: "round", price: 35, count: 5 }
    ];

    let queue = shuffle(orders);
    let currentOrder = null;
    let completed = 0;
    let correctCount = 0;
    let ruleMode = 0;

    const rules = [
        {
            title: "SHAPE RULE",
            description: "Round sweets → HOME. Square and diamond sweets → GIFT.",
            destination: (order) => order.shape === "round" ? "home" : "gift"
        },
        {
            title: "VALUE RULE",
            description: "Orders worth ₹200 or more → GIFT. Others → HOME.",
            destination: (order) => order.price * order.count >= 200 ? "gift" : "home"
        },
        {
            title: "PRIORITY RULE",
            description: "Orders with 4 or more pieces → GIFT. Others → HOME.",
            destination: (order) => order.count >= 4 ? "gift" : "home"
        }
    ];

    function renderOrder() {
        if (!gameActive) return;

        if (queue.length === 0) {
            queue = shuffle(orders);
        }

        currentOrder = queue.pop();

        const rule = rules[ruleMode];

        renderArea(`
      <div class="mithai-game">
        <div class="rule-card">
          <strong>${rule.title}</strong>
          <p>${rule.description}</p>
        </div>

        <div class="mithai-order">
          <div class="mithai-icon">🍬</div>
          <h3>${currentOrder.name}</h3>
          <p>Shape: ${currentOrder.shape}</p>
          <p>Price: ₹${currentOrder.price} × ${currentOrder.count}</p>
          <strong>Total: ₹${currentOrder.price * currentOrder.count}</strong>
        </div>

        <div class="mithai-trays">
          <button class="game-action-btn" data-tray="gift">🎁 GIFT</button>
          <button class="game-action-btn" data-tray="home">🏠 HOME</button>
        </div>

        <p id="mithai-progress">Orders sorted: ${completed}</p>
      </div>
    `);
    }

    function handleSort(event) {
        const button = event.target.closest("[data-tray]");

        if (!button || !currentOrder || !gameActive) return;

        const selected = button.dataset.tray;
        const correct = rules[ruleMode].destination(currentOrder);

        if (selected === correct) {
            correctCount++;
            addPoints(35, "Correct sorting!");
        } else {
            updateScore(-15);
            showFeedback("Incorrect tray. Check the sorting rule!", "error");
        }

        completed++;

        if (completed % 4 === 0) {
            ruleMode = (ruleMode + 1) % rules.length;
        }

        setText("mithai-progress", `Orders sorted: ${completed}`);

        renderOrder();
    }

    $("game-area").addEventListener("click", handleSort);

    cleanupGame = () => {
        $("game-area")?.removeEventListener("click", handleSort);
    };

    renderOrder();
}

// ==========================================
// GAME 3 — THE TERMINAL
// CODING AND LOGIC QUESTIONS
// ==========================================

const codingQuestions = [
    {
        question: "What is the output?<br><code>x = 5<br>x += 3 * 2</code>",
        options: ["8", "11", "16", "13"],
        answer: "11",
        explanation: "3 × 2 = 6. Then 5 + 6 = 11."
    },
    {
        question: "What is the output?<br><code>print(2 ** 3)</code>",
        options: ["6", "8", "9", "23"],
        answer: "8",
        explanation: "The ** operator performs exponentiation: 2³ = 8."
    },
    {
        question: "Which data structure follows FIFO?",
        options: ["Stack", "Queue", "Tree", "Graph"],
        answer: "Queue",
        explanation: "FIFO means First In, First Out. A queue follows this order."
    },
    {
        question: "What is the time complexity of binary search?",
        options: ["O(n)", "O(n²)", "O(log n)", "O(1)"],
        answer: "O(log n)",
        explanation: "Binary search halves the search space at every step."
    },
    {
        question: "What is the output?<br><code>print(10 % 3)</code>",
        options: ["3", "1", "0", "10"],
        answer: "1",
        explanation: "The modulo operator returns the remainder. 10 divided by 3 leaves 1."
    },
    {
        question: "Which keyword defines a function in Python?",
        options: ["function", "func", "def", "method"],
        answer: "def",
        explanation: "Python uses the def keyword to define a function."
    },
    {
        question: "What is the output?<br><code>print(len([4, 5, 8]))</code>",
        options: ["2", "3", "4", "8"],
        answer: "3",
        explanation: "The list contains three elements."
    },
    {
        question: "Which one is NOT a programming language?",
        options: ["Python", "Java", "HTML", "C++"],
        answer: "HTML",
        explanation: "HTML is a markup language used to structure web content."
    },
    {
        question: "What is the binary representation of decimal 5?",
        options: ["100", "101", "110", "111"],
        answer: "101",
        explanation: "5 = 4 + 1, which is 101 in binary."
    },
    {
        question: "What does CPU stand for?",
        options: [
            "Central Processing Unit",
            "Computer Personal Unit",
            "Central Program Utility",
            "Control Processing User"
        ],
        answer: "Central Processing Unit",
        explanation: "CPU stands for Central Processing Unit."
    },
    {
        question: "What is the output?<br><code>print(13 & 6)</code>",
        options: ["2", "4", "6", "7"],
        answer: "4",
        explanation: "13 is 1101 and 6 is 0110. Their bitwise AND is 0100 (4)."
    },
    {
        question: "Which sorting algorithm repeatedly selects the smallest element?",
        options: [
            "Merge sort",
            "Selection sort",
            "Quick sort",
            "Bubble sort"
        ],
        answer: "Selection sort",
        explanation: "Selection sort repeatedly selects the smallest remaining element."
    },
    {
        question: "What is the next number? 2, 6, 12, 20, 30, __",
        options: ["36", "40", "42", "44"],
        answer: "42",
        explanation: "The differences are 4, 6, 8, 10, then 12. So 30 + 12 = 42."
    },
    {
        question: "Which symbol is used for equality comparison in JavaScript?",
        options: ["=", "===", "=>", "!="],
        answer: "===",
        explanation: "=== checks both value and type without type coercion."
    },
    {
        question: "Which structure is commonly used for function calls?",
        options: ["Queue", "Stack", "Graph", "Hash table"],
        answer: "Stack",
        explanation: "Function calls use a call stack to manage execution."
    }
];

function startTerminal() {
    let questions = shuffle(codingQuestions);
    let questionIndex = 0;
    let answered = 0;

    function showQuestion() {
        if (!gameActive) return;

        if (questionIndex >= questions.length) {
            questions = shuffle(codingQuestions);
            questionIndex = 0;
        }

        const question = questions[questionIndex];
        const options = shuffle(question.options);

        renderArea(`
      <div class="terminal-game">
        <div class="terminal-label">● TERMINAL ACCESS GRANTED</div>

        <p class="terminal-progress">Challenge ${answered + 1}</p>

        <h3>${question.question}</h3>

        <div class="terminal-options">
          ${options.map((option) => `
            <button class="game-action-btn terminal-option"
              data-answer="${escapeHTML(option)}">
              ${escapeHTML(option)}
            </button>
          `).join("")}
        </div>
      </div>
    `);
    }

    function handleAnswer(event) {
        const button = event.target.closest("[data-answer]");

        if (!button || !gameActive || answerLocked) return;

        answerLocked = true;

        const question = questions[questionIndex];
        const selected = button.dataset.answer;

        if (selected === question.answer) {
            addPoints(50, "Correct answer!");
        } else {
            updateScore(-10);
            showFeedback(`Not quite. ${question.explanation}`, "error");
        }

        answered++;
        questionIndex++;

        setTimeout(() => {
            answerLocked = false;
            showQuestion();
        }, 1000);
    }

    $("game-area").addEventListener("click", handleAnswer);

    cleanupGame = () => {
        $("game-area")?.removeEventListener("click", handleAnswer);
    };

    showQuestion();
}

// ==========================================
// GAME 4 — LAUNCH CONTROL
// TIMING AND PRECISION
// ==========================================

function startLaunchControl() {
    let power = 0;
    let direction = 1;
    let speed = 1.8;
    let launches = 0;
    let hits = 0;
    let animationFrame = null;
    let lastFrame = 0;

    renderArea(`
    <div class="rocket-game">
      <h3>🚀 POWER CONTROL</h3>
      <p>Stop the meter inside the target zone.</p>

      <div class="rocket-track">
        <div class="rocket-target"></div>
        <div id="rocket-power" class="rocket-power"></div>
      </div>

      <h2 id="rocket-value">0%</h2>

      <button id="rocket-launch" class="game-action-btn">
        LAUNCH!
      </button>

      <p id="rocket-stats">Successful launches: 0</p>
    </div>
  `);

    const powerElement = $("rocket-power");
    const launchButton = $("rocket-launch");

    function animate(timestamp) {
        if (!gameActive) return;

        if (!lastFrame) lastFrame = timestamp;

        const delta = Math.min((timestamp - lastFrame) / 16.67, 2);
        lastFrame = timestamp;

        power += direction * speed * delta;

        if (power >= 100) {
            power = 100;
            direction = -1;
        }

        if (power <= 0) {
            power = 0;
            direction = 1;
        }

        if (powerElement) {
            powerElement.style.width = `${power}%`;
        }

        setText("rocket-value", `${Math.round(power)}%`);

        animationFrame = requestAnimationFrame(animate);
    }

    function launch() {
        if (!gameActive || answerLocked) return;

        answerLocked = true;
        launches++;

        const accuracy = Math.abs(power - 75);

        if (accuracy <= 5) {
            hits++;
            addPoints(100, "Perfect launch!");
        } else if (accuracy <= 12) {
            hits++;
            addPoints(60, "Good launch!");
        } else if (accuracy <= 20) {
            addPoints(25, "Launch completed!");
        } else {
            updateScore(-15);
            showFeedback("Missed the target. Keep trying!", "error");
        }

        setText("rocket-stats", `Successful launches: ${hits} / ${launches}`);

        setTimeout(() => {
            answerLocked = false;
        }, 350);
    }

    launchButton.addEventListener("click", launch);

    animationFrame = requestAnimationFrame(animate);

    cleanupGame = () => {
        cancelAnimationFrame(animationFrame);
        launchButton.removeEventListener("click", launch);
    };
}

// ==========================================
// GAME 5 — THE PHONE
// SCAM DETECTION CHALLENGE
// ==========================================

const phoneScenarios = [
    {
        sender: "Unknown UPI Support",
        message: "Your UPI account will be blocked in 10 minutes. Share your OTP to reactivate it immediately.",
        clues: [
            "Urgent threat of account blocking",
            "Request for OTP",
            "Unknown sender"
        ],
        answer: "scam",
        explanation: "Never share your OTP. Banks and payment providers do not ask for it."
    },
    {
        sender: "College Placement Cell",
        message: "Your interview is scheduled for Friday at 10 AM. Please check the official college placement portal for details.",
        clues: [
            "Uses the official college portal",
            "Does not ask for money",
            "Provides a normal interview schedule"
        ],
        answer: "safe",
        explanation: "This message directs you to the official placement portal and does not request sensitive information."
    },
    {
        sender: "Work From Home Hiring",
        message: "Earn ₹8,000 daily! Pay a refundable registration fee of ₹499 now. Limited seats. Send payment screenshot.",
        clues: [
            "Promises unusually high earnings",
            "Asks for an upfront fee",
            "Creates pressure with limited seats"
        ],
        answer: "scam",
        explanation: "Upfront payment requests and unrealistic income promises are common job scam warning signs."
    },
    {
        sender: "Courier Delivery",
        message: "Your parcel delivery failed. Confirm your address through the official courier app.",
        clues: [
            "Asks you to use the official app",
            "Does not request an OTP",
            "Does not demand an immediate payment"
        ],
        answer: "safe",
        explanation: "Using the official courier app is safer than following unknown links."
    },
    {
        sender: "Bank KYC Department",
        message: "Complete your KYC immediately using this shortened link or your account will be suspended. Enter your card PIN.",
        clues: [
            "Uses a shortened link",
            "Threatens account suspension",
            "Requests a card PIN"
        ],
        answer: "scam",
        explanation: "Never enter your PIN through a message link. Contact your bank through official channels."
    },
    {
        sender: "Friend",
        message: "Hey! I changed my phone number. Can you send me ₹2,000 urgently? I'll return it tonight.",
        clues: [
            "Unexpected request for money",
            "Claims to have a new number",
            "Uses urgency"
        ],
        answer: "scam",
        explanation: "Verify the person's identity by calling their old or known number before sending money."
    },
    {
        sender: "Official Event Team",
        message: "Thank you for registering. Your event confirmation is available in your official registration account.",
        clues: [
            "Refers to an existing registration",
            "Directs you to your account",
            "Does not ask for private credentials"
        ],
        answer: "safe",
        explanation: "A confirmation through the official account is a normal event communication."
    },
    {
        sender: "Prize Winner",
        message: "Congratulations! You won an iPhone. Pay ₹999 delivery charges now to claim your prize.",
        clues: [
            "Unexpected prize",
            "Asks for money to claim it",
            "No verifiable competition details"
        ],
        answer: "scam",
        explanation: "Unexpected prize messages that demand payment are a common scam pattern."
    },
    {
        sender: "Unknown Recruiter",
        message: "We found your resume on a job portal. Apply through the company's official careers page. No fee is required.",
        clues: [
            "Directs you to the official careers page",
            "Does not ask for money",
            "Does not request an OTP or PIN"
        ],
        answer: "safe",
        explanation: "Applying through a company's official careers page is a safer approach. Verify the recruiter independently."
    },
    {
        sender: "Electricity Department",
        message: "Your electricity connection will be disconnected tonight. Call this personal number and share the OTP to stop disconnection.",
        clues: [
            "Threatens immediate disconnection",
            "Asks for an OTP",
            "Uses a personal contact number"
        ],
        answer: "scam",
        explanation: "Do not share OTPs. Verify electricity bills through the official electricity provider."
    }
];

function startPhone() {
    const walletStart = 10000;
    let wallet = walletStart;
    let scenarios = shuffle(phoneScenarios);
    let scenarioIndex = 0;
    let correctDecisions = 0;

    function showScenario() {
        if (!gameActive) return;

        if (scenarioIndex >= scenarios.length) {
            scenarios = shuffle(phoneScenarios);
            scenarioIndex = 0;
        }

        const scenario = scenarios[scenarioIndex];

        renderArea(`
      <div class="phone-game">
        <div class="phone-header">
          <span>📱 INCOMING MESSAGE</span>
          <strong>Wallet: ₹${wallet.toLocaleString("en-IN")}</strong>
        </div>

        <div class="phone-message">
          <strong>${escapeHTML(scenario.sender)}</strong>
          <p>${escapeHTML(scenario.message)}</p>
        </div>

        <h3>What looks suspicious or trustworthy?</h3>

        <div class="phone-clues">
          ${scenario.clues.map((clue, index) => `
            <div class="phone-clue">
              <span>${index + 1}. ${escapeHTML(clue)}</span>
            </div>
          `).join("")}
        </div>

        <h3>Your decision?</h3>

        <div class="phone-actions">
          <button class="game-action-btn" data-verdict="safe">
            ✓ SAFE
          </button>
          <button class="game-action-btn" data-verdict="scam">
            ⚠ SCAM
          </button>
        </div>
      </div>
    `);
    }

    function handleVerdict(event) {
        const button = event.target.closest("[data-verdict]");

        if (!button || !gameActive || answerLocked) return;

        answerLocked = true;

        const scenario = scenarios[scenarioIndex];
        const selected = button.dataset.verdict;

        if (selected === scenario.answer) {
            correctDecisions++;
            wallet += 500;
            addPoints(60, "Good judgement! ₹500 bonus added.");
            showFeedback(scenario.explanation, "success");
        } else {
            if (scenario.answer === "scam") {
                wallet = Math.max(0, wallet - 1000);
                updateScore(-30);
                showFeedback(`You missed a scam! ₹1,000 lost. ${scenario.explanation}`, "error");
            } else {
                wallet = Math.max(0, wallet - 250);
                updateScore(-10);
                showFeedback(`That message was safe. Verify before deciding. ${scenario.explanation}`, "error");
            }
        }

        scenarioIndex++;

        setTimeout(() => {
            answerLocked = false;
            showScenario();
        }, 1500);
    }

    $("game-area").addEventListener("click", handleVerdict);

    cleanupGame = () => {
        $("game-area")?.removeEventListener("click", handleVerdict);
    };

    showScenario();
}

// ==========================================
// ATTEMPT COMPLETION AND FIREBASE SAVE
// ==========================================

async function saveResult() {
    const playerRef = ref(database, `players/${playerUid}`);

    const result = await runTransaction(playerRef, (current) => {
        if (!current) {
            return {
                name: playerName,
                bestScore: totalScore,
                attempts: attemptsUsed,
                updatedAt: Date.now()
            };
        }

        return {
            ...current,
            name: playerName,
            bestScore: Math.max(
                Number(current.bestScore || 0),
                totalScore
            ),
            attempts: Number(current.attempts || attemptsUsed),
            updatedAt: Date.now()
        };
    });

    if (result.committed) {
        bestScore = Number(result.snapshot.val()?.bestScore || totalScore);
    }
}

async function finishAttempt() {
    stopCurrentGame();

    try {
        await saveResult();
    } catch (error) {
        console.error("Score save failed:", error);
    }

    setText("final-score", totalScore.toLocaleString("en-IN"));
    setText(
        "attempt-result",
        `Attempt ${attemptsUsed} of ${MAX_ATTEMPTS} completed. Your best score is ${bestScore.toLocaleString("en-IN")}.`
    );

    const retryButton = $("retry-btn");

    if (retryButton) {
        retryButton.style.display =
            attemptsUsed >= MAX_ATTEMPTS ? "none" : "inline-block";
    }

    const certificateButton = $("certificate-btn");

    if (certificateButton) {
        certificateButton.style.display = "inline-block";
    }

    showScreen("result-screen");
}

// ==========================================
// CERTIFICATE
// ==========================================

function openCertificate() {
    setText("certificate-name", playerName);
    setText(
        "certificate-score",
        `Final Score: ${totalScore.toLocaleString("en-IN")} points`
    );

    showScreen("certificate-screen");
}

function downloadCertificate() {
    const certificate = $("certificate");

    if (!certificate) {
        alert("Certificate section not found.");
        return;
    }

    window.print();
}

// ==========================================
// LEADERBOARD
// ==========================================

function renderLeaderboard(players) {
    const list = $("leaderboard-list");

    if (!list) return;

    if (players.length === 0) {
        list.textContent = "No players yet. Be the first to play!";
        return;
    }

    list.innerHTML = players.slice(0, 20).map((player, index) => `
    <div class="leaderboard-row">
      <span class="leaderboard-rank">#${index + 1}</span>
      <span class="leaderboard-player">${escapeHTML(player.name || "Player")}</span>
      <strong class="leaderboard-score">
        ${Number(player.bestScore || 0).toLocaleString("en-IN")}
      </strong>
    </div>
  `).join("");
}

function openLeaderboard() {
    showScreen("leaderboard-screen");

    const list = $("leaderboard-list");

    if (list) list.textContent = "Loading leaderboard...";

    if (leaderboardUnsubscribe) {
        leaderboardUnsubscribe();
    }

    const playersRef = ref(database, "players");

    leaderboardUnsubscribe = onValue(
        playersRef,
        (snapshot) => {
            const data = snapshot.val() || {};

            const players = Object.values(data)
                .map((player) => ({
                    name: player.name || "Player",
                    bestScore: Number(player.bestScore || 0)
                }))
                .sort((a, b) => b.bestScore - a.bestScore);

            renderLeaderboard(players);
        },
        (error) => {
            console.error("Leaderboard error:", error);

            if (list) {
                list.textContent = "Unable to load leaderboard. Please try again.";
            }
        }
    );
}

// ==========================================
// BUTTON CONNECTIONS
// ==========================================

$("start-btn")?.addEventListener("click", startGame);

$("retry-btn")?.addEventListener("click", () => {
    startGame();
});

$("certificate-btn")?.addEventListener("click", openCertificate);

$("download-certificate")?.addEventListener("click", downloadCertificate);

$("leaderboard-btn")?.addEventListener("click", openLeaderboard);

$("leaderboard-btn-result")?.addEventListener("click", openLeaderboard);

$("refresh-btn")?.addEventListener("click", openLeaderboard);


// Initial screen
showScreen("welcome-screen");
