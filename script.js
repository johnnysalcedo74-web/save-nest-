
document.addEventListener("DOMContentLoaded", () => {
    const $ = id => document.getElementById(id);

    // LOCAL STORAGE KEYS
    const ACCOUNT_KEY = "savenest_demo_accounts";
    const DATA_PREFIX = "savenest_demo_data_";
    const SESSION_KEY = "savenest_demo_session";

    let currentAccount = null;
    let currentData = null;

    const money = amount =>
        new Intl.NumberFormat("en-PH", {
            style: "currency",
            currency: "PHP"
        }).format(Number(amount) || 0);

    const roundMoney = amount =>
        Math.round((Number(amount) + Number.EPSILON) * 100) / 100;

    const today = () => new Date().toISOString();

    const makeId = () =>
        Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

    // ==========================================
    // LOCAL STORAGE
    // ==========================================

    function readAccounts() {
        try {
            const accounts = JSON.parse(localStorage.getItem(ACCOUNT_KEY));
            return Array.isArray(accounts) ? accounts : [];
        } catch {
            return [];
        }
    }

    function saveAccounts(accounts) {
        localStorage.setItem(ACCOUNT_KEY, JSON.stringify(accounts));
    }

    function defaultData() {
        return {
            balance: 0,
            totalSaved: 0,
            goals: [{
                id: makeId(),
                name: "My First Savings",
                target: 20000,
                saved: 0,
                createdAt: today()
            }],
            history: [],
            adjustments: [],
            chartPeriod: "weekly"
        };
    }

    function loadData(email) {
        try {
            const data = JSON.parse(localStorage.getItem(DATA_PREFIX + email));

            if (!data) return defaultData();

            data.balance = Number(data.balance) || 0;
            data.totalSaved = Number(data.totalSaved) || 0;
            data.goals = Array.isArray(data.goals) ? data.goals : [];
            data.history = Array.isArray(data.history) ? data.history : [];
            data.adjustments = Array.isArray(data.adjustments) ? data.adjustments : [];

            data.goals.forEach(goal => {
                goal.target = Number(goal.target) || 0;
                goal.saved = Number(goal.saved) || 0;

                if (!goal.createdAt) {
                    goal.createdAt = today();
                }
            });

            if (!data.chartPeriod) {
                data.chartPeriod = "weekly";
            }

            return data;
        } catch {
            return defaultData();
        }
    }

    function saveData() {
        if (!currentAccount || !currentData) return;

        try {
            localStorage.setItem(
                DATA_PREFIX + currentAccount.email,
                JSON.stringify(currentData)
            );
        } catch (error) {
            console.error("Unable to save data:", error);
            alert("Unable to save your data. Your browser storage may be full.");
        }
    }

    // ==========================================
    // GENERAL HELPERS
    // ==========================================

    function showMessage(element, message, type = "success") {
        if (!element) return;

        element.textContent = message;
        element.className = "message " + type;
    }

    function clearMessage(element) {
        if (!element) return;

        element.textContent = "";
        element.className = "message";
    }

    function escapeHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, character => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        })[character]);
    }

    // ==========================================
    // HISTORY
    // ==========================================

    function addHistory(type, amount, details = {}) {
        const entry = {
            id: makeId(),
            type,
            amount: roundMoney(amount),
            date: today(),
            balanceBefore: details.balanceBefore ?? currentData.balance,
            balanceAfter: details.balanceAfter ?? currentData.balance,
            details
        };

        currentData.history.unshift(entry);
        saveData();

        return entry;
    }

    function addAdjustment(type, amount, details = {}) {
        const entry = addHistory(type, amount, {
            ...details,
            adjustment: true
        });

        currentData.adjustments.unshift(entry);
        saveData();

        return entry;
    }

    function findGoal(goalId) {
        return currentData?.goals.find(goal => goal.id === goalId);
    }

    function getFirstGoal() {
        return currentData?.goals[0] || null;
    }

    function getGoalProgress(goal) {
        if (!goal || Number(goal.target) <= 0) return 0;

        const saved = Math.max(0, Number(goal.saved) || 0);
        const target = Number(goal.target);

        return Math.min(100, Math.max(0, saved / target * 100));
    }

    function getAllHistoryEntries() {
        const history = currentData?.history || [];

        const extraAdjustments = (currentData?.adjustments || []).filter(
            adjustment => !history.some(item => item.id === adjustment.id)
        );

        const unique = new Map();

        [...history, ...extraAdjustments].forEach(item => {
            if (item?.id) unique.set(item.id, item);
        });

        return [...unique.values()].sort(
            (a, b) => new Date(b.date) - new Date(a.date)
        );
    }

    // ==========================================
    // AUTHENTICATION
    // ==========================================

    function showAuth() {
        closeMobileSidebar();
        $("authPage")?.classList.remove("hidden");
        $("dashboardPage")?.classList.add("hidden");
    }

    function showDashboard() {
        $("authPage")?.classList.add("hidden");
        $("dashboardPage")?.classList.remove("hidden");

        updateDashboard();
        navigate("dashboard");
    }

    function setAuthMode(mode) {
        const register = mode === "register";

        $("registerBox")?.classList.toggle("hidden", !register);
        $("loginBox")?.classList.toggle("hidden", register);

        $("registerNav")?.classList.toggle("active", register);
        $("loginNav")?.classList.toggle("active", !register);

        clearMessage($("authMessage"));
    }

    function register(name, email, password) {
        const accounts = readAccounts();

        email = email.trim().toLowerCase();
        name = name.trim();

        if (name.length < 2) {
            showMessage($("authMessage"), "Please enter your full name.", "error");
            return;
        }

        if (password.length < 8) {
            showMessage($("authMessage"), "Password must contain at least 8 characters.", "error");
            return;
        }

        if (accounts.some(account => account.email === email)) {
            showMessage($("authMessage"), "An account with this email already exists.", "error");
            return;
        }

        const account = {
            id: makeId(),
            name,
            email,
            password
        };

        accounts.push(account);
        saveAccounts(accounts);

        currentAccount = account;
        currentData = defaultData();

        saveData();
        localStorage.setItem(SESSION_KEY, email);

        showDashboard();
    }

    function login(email, password) {
        email = email.trim().toLowerCase();

        const account = readAccounts().find(
            item => item.email === email && item.password === password
        );

        if (!account) {
            showMessage($("authMessage"), "Incorrect email or password.", "error");
            return;
        }

        currentAccount = account;
        currentData = loadData(email);

        localStorage.setItem(SESSION_KEY, email);
        saveData();
        showDashboard();
    }

    function logout() {
        currentAccount = null;
        currentData = null;

        localStorage.removeItem(SESSION_KEY);

        showAuth();
        setAuthMode("login");
    }

    // ==========================================
    // MOBILE SIDEBAR
    // ==========================================

    function isMobileScreen() {
        return window.matchMedia("(max-width: 760px)").matches;
    }

    function openMobileSidebar() {
        if (!isMobileScreen()) return;

        $("dashboardPage")?.classList.add("sidebar-collapsed");
        $("menuToggle")?.setAttribute("aria-expanded", "true");
        document.body.classList.add("sidebar-open");
    }

    function closeMobileSidebar() {
        $("dashboardPage")?.classList.remove("sidebar-collapsed");
        $("menuToggle")?.setAttribute("aria-expanded", "false");
        document.body.classList.remove("sidebar-open");
    }

    function toggleSidebar() {
        if (isMobileScreen()) {
            const isOpen = $("dashboardPage")?.classList.contains("sidebar-collapsed");

            if (isOpen) {
                closeMobileSidebar();
            } else {
                openMobileSidebar();
            }
        } else {
            $("dashboardPage")?.classList.toggle("sidebar-collapsed");
        }
    }

    // ==========================================
    // NAVIGATION
    // ==========================================

    function navigate(section) {
        const sections = [
            "dashboard",
            "addSavings",
            "adjustSavings",
            "history",
            "goals",
            "settings"
        ];

        if (!sections.includes(section)) return;

        sections.forEach(name => {
            const element = $(name + "Section");

            if (element) {
                element.classList.toggle("hidden", name !== section);
            }
        });

        document.querySelectorAll(".side-link").forEach(button => {
            button.classList.toggle(
                "active",
                button.dataset.section === section
            );
        });

        if (isMobileScreen()) {
            closeMobileSidebar();
        }

        clearMessage($("savingsMessage"));
        clearMessage($("adjustMessage"));
        clearMessage($("goalMessage"));
        clearMessage($("historyMessage"));
        clearMessage($("profileMessage"));

        if (section !== "goals") {
            clearMessage($("transferMessage"));
        }

        switch (section) {
            case "dashboard":
                updateDashboard();
                break;

            case "addSavings":
                updateSavingsForm();
                break;

            case "adjustSavings":
                updateAdjustSavingsForm();
                break;

            case "history":
                renderHistory();
                break;

            case "goals":
                renderGoals();
                break;

            case "settings":
                renderProfile();
                break;
        }

        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    // ==========================================
    // DASHBOARD
    // ==========================================

    function updateDashboard() {
        if (!currentData || !currentAccount) return;

        const firstGoal = getFirstGoal();

        $("welcomeName").textContent = currentAccount.name;
        $("topbarName").textContent = currentAccount.name;

        $("balanceValue").textContent = money(currentData.balance);
        $("totalSavedValue").textContent = money(currentData.totalSaved);
        $("goalValue").textContent = money(firstGoal?.target || 0);

        const progress = getGoalProgress(firstGoal);

        if ($("goalProgress")) {
            $("goalProgress").style.width = progress + "%";
        }

        if ($("goalPercent")) {
            $("goalPercent").textContent = Math.round(progress) + "% completed";
        }

        if ($("chartPeriod")) {
            $("chartPeriod").value = currentData.chartPeriod || "weekly";
        }

        renderChart();
    }

    // ==========================================
    // GOAL SELECTORS
    // ==========================================

    function fillGoalSelector(selector) {
        if (!selector || !currentData) return;

        const previous = selector.value;
        selector.innerHTML = "";

        if (!currentData.goals.length) {
            const option = document.createElement("option");

            option.value = "";
            option.textContent = "No savings goals available";

            selector.appendChild(option);
            selector.disabled = true;
            return;
        }

        selector.disabled = false;

        currentData.goals.forEach(goal => {
            const option = document.createElement("option");

            option.value = goal.id;
            option.textContent = `${goal.name} — ${money(goal.saved)}`;

            selector.appendChild(option);
        });

        if (currentData.goals.some(goal => goal.id === previous)) {
            selector.value = previous;
        }
    }

    function updateSavingsForm() {
        if (!currentData) return;

        fillGoalSelector($("savingsGoalSelect"));
    }

    function updateAdjustSavingsForm() {
        if (!currentData) return;

        if ($("adjustAvailableBalance")) {
            $("adjustAvailableBalance").textContent = money(currentData.balance);
        }

        fillGoalSelector($("adjustGoalSelect"));
    }

    // ==========================================
    // ADD SAVINGS
    // ==========================================

    function deposit(amount, goalId) {
        amount = Number(amount);

        if (!Number.isFinite(amount) || amount <= 0) {
            showMessage($("savingsMessage"), "Enter a valid amount.", "error");
            return;
        }

        const goal = findGoal(goalId);

        if (!goal) {
            showMessage($("savingsMessage"), "Please select a savings goal.", "error");
            return;
        }

        amount = roundMoney(amount);

        if (amount <= 0) {
            showMessage($("savingsMessage"), "Enter an amount greater than zero.", "error");
            return;
        }

        const previousBalance = currentData.balance;

        goal.saved = roundMoney((Number(goal.saved) || 0) + amount);
        currentData.balance = roundMoney(currentData.balance + amount);
        currentData.totalSaved = roundMoney(currentData.totalSaved + amount);

        addHistory("Added Savings", amount, {
            goalId: goal.id,
            goalName: goal.name,
            balanceBefore: previousBalance,
            balanceAfter: currentData.balance
        });

        $("savingsAmount").value = "";

        updateDashboard();
        updateSavingsForm();
        updateAdjustSavingsForm();
        renderGoals();
        saveData();

        showMessage(
            $("savingsMessage"),
            `${money(amount)} successfully added to ${goal.name}.`
        );
    }

    // ==========================================
    // ADJUST SAVINGS
    // ==========================================

    function adjustSavings(type, amount, goalId, reason) {
        amount = Number(amount);
        reason = String(reason || "").trim();

        if (!Number.isFinite(amount) || amount <= 0) {
            showMessage($("adjustMessage"), "Enter a valid adjustment amount.", "error");
            return;
        }

        amount = roundMoney(amount);

        if (amount <= 0) {
            showMessage($("adjustMessage"), "Enter an amount greater than zero.", "error");
            return;
        }

        const goal = findGoal(goalId);

        if (!goal) {
            showMessage($("adjustMessage"), "Please select a savings goal.", "error");
            return;
        }

        const isDeduction = type === "deduct";
        const signedAmount = isDeduction ? -amount : amount;

        if (isDeduction && amount > goal.saved) {
            showMessage(
                $("adjustMessage"),
                "The deduction amount is greater than the selected goal's savings.",
                "error"
            );
            return;
        }

        if (isDeduction && amount > currentData.balance) {
            showMessage($("adjustMessage"), "Insufficient overall balance.", "error");
            return;
        }

        const action = isDeduction ? "deduct" : "add";

        if (!confirm(
            `Are you sure you want to ${action} ${money(amount)} ${isDeduction ? "from" : "to"} ${goal.name}?`
        )) {
            return;
        }

        const previousBalance = currentData.balance;
        const previousGoalAmount = goal.saved;

        goal.saved = roundMoney(goal.saved + signedAmount);
        currentData.balance = roundMoney(currentData.balance + signedAmount);

        currentData.totalSaved = Math.max(
            0,
            roundMoney(currentData.totalSaved + signedAmount)
        );

        addAdjustment("Savings Adjustment", signedAmount, {
            goalId: goal.id,
            goalName: goal.name,
            reason: reason || "No reason provided",
            adjustmentType: isDeduction ? "Deduct" : "Add",
            balanceBefore: previousBalance,
            balanceAfter: currentData.balance,
            previousAmount: previousGoalAmount,
            newAmount: goal.saved
        });

        $("adjustAmount").value = "";
        $("adjustReason").value = "";

        updateDashboard();
        updateAdjustSavingsForm();
        renderGoals();
        saveData();

        showMessage(
            $("adjustMessage"),
            `${money(amount)} successfully ${isDeduction ? "deducted from" : "added to"} ${goal.name}.`
        );
    }

    // ==========================================
    // CREATE GOAL
    // ==========================================

    function createGoal(name, target) {
        name = name.trim();
        target = Number(target);

        if (!name || name.length > 60) {
            showMessage($("goalMessage"), "Enter a valid goal name.", "error");
            return;
        }

        if (!Number.isFinite(target) || target <= 0) {
            showMessage($("goalMessage"), "Enter a valid target amount.", "error");
            return;
        }

        currentData.goals.push({
            id: makeId(),
            name,
            target: roundMoney(target),
            saved: 0,
            createdAt: today()
        });

        addHistory("Created Savings Goal", 0, {
            goalName: name
        });

        $("goalNameInput").value = "";
        $("goalAmountInput").value = "";

        updateDashboard();
        updateSavingsForm();
        updateAdjustSavingsForm();
        renderGoals();
        saveData();

        showMessage($("goalMessage"), "New savings goal created.");
    }

    // ==========================================
    // DELETE GOAL
    // ==========================================

    function deleteGoal(goalId) {
        const goal = findGoal(goalId);

        if (!goal) return;

        const savedAmount = Number(goal.saved) || 0;

        const message = savedAmount > 0
            ? `Delete "${goal.name}"?\n\nIts ${money(savedAmount)} will remain in your Current Balance and Total Saved, but it will no longer be assigned to a goal.`
            : `Are you sure you want to delete "${goal.name}"?`;

        if (!confirm(message)) return;

        currentData.goals = currentData.goals.filter(
            item => item.id !== goalId
        );

        addHistory("Deleted Savings Goal", 0, {
            goalName: goal.name,
            savedAmount,
            note: savedAmount > 0
                ? `${money(savedAmount)} retained in overall balance`
                : "Goal deleted"
        });

        updateDashboard();
        updateSavingsForm();
        updateAdjustSavingsForm();
        renderGoals();
        saveData();
    }

    // ==========================================
    // TRANSFER FORM
    // ==========================================

    function updateTransferForm() {
        if (!currentData) return;

        const fromSelect = $("transferFromGoal");
        const toSelect = $("transferToGoal");
        const amountInput = $("transferAmount");
        const submitButton = $("transferSubmitButton");
        const sourceInfo = $("transferSourceInfo");

        if (!fromSelect || !toSelect) return;

        const previousFrom = fromSelect.value;
        const previousTo = toSelect.value;
        const goals = currentData.goals || [];

        fromSelect.innerHTML = "";
        toSelect.innerHTML = "";

        if (goals.length === 0) {
            const optionFrom = document.createElement("option");
            optionFrom.value = "";
            optionFrom.textContent = "No savings goals available";

            const optionTo = document.createElement("option");
            optionTo.value = "";
            optionTo.textContent = "No destination available";

            fromSelect.appendChild(optionFrom);
            toSelect.appendChild(optionTo);

            fromSelect.disabled = true;
            toSelect.disabled = true;

            if (amountInput) {
                amountInput.disabled = true;
                amountInput.value = "";
            }

            if (submitButton) submitButton.disabled = true;

            if (sourceInfo) {
                sourceInfo.textContent = "Create a savings goal first before transferring.";
                sourceInfo.classList.add("warning");
            }

            return;
        }

        fromSelect.disabled = false;

        goals.forEach(goal => {
            const option = document.createElement("option");

            option.value = goal.id;
            option.textContent = `${goal.name} — ${money(goal.saved)}`;

            fromSelect.appendChild(option);
        });

        if (goals.some(goal => goal.id === previousFrom)) {
            fromSelect.value = previousFrom;
        }

        updateTransferDestination(previousTo);
    }

    function updateTransferDestination(previousTo = "") {
        if (!currentData) return;

        const fromSelect = $("transferFromGoal");
        const toSelect = $("transferToGoal");
        const amountInput = $("transferAmount");
        const submitButton = $("transferSubmitButton");
        const sourceInfo = $("transferSourceInfo");

        if (!fromSelect || !toSelect) return;

        const fromId = fromSelect.value;
        const fromGoal = findGoal(fromId);

        const destinationGoals = currentData.goals.filter(
            goal => goal.id !== fromId
        );

        toSelect.innerHTML = "";

        if (!fromGoal) {
            toSelect.disabled = true;

            if (amountInput) amountInput.disabled = true;
            if (submitButton) submitButton.disabled = true;

            if (sourceInfo) {
                sourceInfo.textContent = "Please select a source savings goal.";
                sourceInfo.classList.add("warning");
            }

            return;
        }

        if (destinationGoals.length === 0) {
            const option = document.createElement("option");

            option.value = "";
            option.textContent = "Create another goal first";

            toSelect.appendChild(option);
            toSelect.disabled = true;

            if (amountInput) {
                amountInput.disabled = true;
                amountInput.value = "";
            }

            if (submitButton) submitButton.disabled = true;

            if (sourceInfo) {
                sourceInfo.textContent =
                    "You need at least two savings goals before you can transfer savings.";
                sourceInfo.classList.add("warning");
            }

            return;
        }

        toSelect.disabled = false;

        destinationGoals.forEach(goal => {
            const option = document.createElement("option");

            option.value = goal.id;
            option.textContent = `${goal.name} — ${money(goal.saved)}`;

            toSelect.appendChild(option);
        });

        if (destinationGoals.some(goal => goal.id === previousTo)) {
            toSelect.value = previousTo;
        }

        const available = roundMoney(Number(fromGoal.saved) || 0);

        if (amountInput) {
            amountInput.disabled = available <= 0;
            amountInput.max = available;

            amountInput.placeholder = available > 0
                ? `Maximum ${money(available)}`
                : "No available savings";

            if (available <= 0) {
                amountInput.value = "";
            }
        }

        if (submitButton) {
            submitButton.disabled = available <= 0;
        }

        if (sourceInfo) {
            sourceInfo.classList.toggle("warning", available <= 0);

            sourceInfo.textContent = available > 0
                ? `Available savings in ${fromGoal.name}: ${money(available)}. You can transfer any amount up to this balance.`
                : `${fromGoal.name} currently has no savings available to transfer.`;
        }
    }

    // ==========================================
    // TRANSFER SAVINGS
    // ==========================================

    function transferSavings(fromId, toId, amount) {
        amount = Number(amount);

        const from = findGoal(fromId);
        const to = findGoal(toId);

        if (!from) {
            showMessage($("transferMessage"), "Please select a valid source goal.", "error");
            return false;
        }

        if (!to) {
            showMessage($("transferMessage"), "Please select a valid destination goal.", "error");
            return false;
        }

        if (from.id === to.id) {
            showMessage(
                $("transferMessage"),
                "Source and destination goals must be different.",
                "error"
            );
            return false;
        }

        if (!Number.isFinite(amount) || amount <= 0) {
            showMessage(
                $("transferMessage"),
                "Please enter a valid transfer amount.",
                "error"
            );
            return false;
        }

        amount = roundMoney(amount);

        if (amount <= 0) {
            showMessage(
                $("transferMessage"),
                "Transfer amount must be at least ₱0.01.",
                "error"
            );
            return false;
        }

        const availableSavings = roundMoney(Number(from.saved) || 0);

        if (amount > availableSavings) {
            showMessage(
                $("transferMessage"),
                `Insufficient savings. You only have ${money(availableSavings)} in ${from.name}.`,
                "error"
            );
            return false;
        }

        if (!confirm(
            `Confirm Transfer\n\n` +
            `From: ${from.name}\n` +
            `To: ${to.name}\n` +
            `Amount: ${money(amount)}\n\n` +
            `Do you want to continue?`
        )) {
            return false;
        }

        // Deduct the entered amount from the source.
        from.saved = roundMoney((Number(from.saved) || 0) - amount);

        // Add the same amount to the destination.
        to.saved = roundMoney((Number(to.saved) || 0) + amount);

        // Current Balance and Total Saved remain unchanged.
        addHistory("Transferred Savings", 0, {
            fromGoalId: from.id,
            fromGoal: from.name,
            toGoalId: to.id,
            toGoal: to.name,
            amount,
            note: `${money(amount)} transferred from ${from.name} to ${to.name}`,
            balanceBefore: currentData.balance,
            balanceAfter: currentData.balance
        });

        saveData();

        updateDashboard();
        updateSavingsForm();
        updateAdjustSavingsForm();
        renderGoals();
        updateTransferForm();

        if ($("transferAmount")) {
            $("transferAmount").value = "";
        }

        showMessage(
            $("transferMessage"),
            `${money(amount)} successfully transferred from ${from.name} to ${to.name}.`
        );

        return true;
    }

    // ==========================================
    // DISPLAY GOALS
    // ==========================================

    function renderGoals() {
        const container = $("goalsList");

        if (!container || !currentData) return;

        updateTransferForm();

        if (!currentData.goals.length) {
            container.innerHTML = `
                <div class="panel empty-state">
                    You don't have any savings goals yet. Create a new goal above.
                </div>
            `;
            return;
        }

        container.innerHTML = currentData.goals.map(goal => {
            const saved = Number(goal.saved) || 0;
            const target = Number(goal.target) || 0;
            const progress = getGoalProgress(goal);
            const remaining = Math.max(0, target - saved);

            return `
                <article class="goal-card">
                    <div class="goal-card-header">
                        <div>
                            <h3>${escapeHTML(goal.name)}</h3>
                            <p>Created ${new Date(goal.createdAt).toLocaleDateString()}</p>
                        </div>
                        <span>◎</span>
                    </div>

                    <div class="goal-card-amount">${money(saved)}</div>
                    <div class="goal-card-target">Target: ${money(target)}</div>

                    <div class="goal-card-progress">
                        <div class="goal-card-progress-fill" style="width:${progress}%"></div>
                    </div>

                    <div class="goal-card-remaining">
                        ${Math.round(progress)}% completed · ${money(remaining)} remaining
                    </div>

                    <div class="goal-card-actions">
                        <button class="goal-save-button" type="button"
                            data-save-goal="${escapeHTML(goal.id)}">
                            Add Savings
                        </button>

                        <button class="goal-delete-button" type="button"
                            data-delete-goal="${escapeHTML(goal.id)}">
                            Delete
                        </button>
                    </div>
                </article>
            `;
        }).join("");
    }

    // ==========================================
    // HISTORY DISPLAY
    // ==========================================

    function getHistoryIcon(type) {
        const icons = {
            "Added Savings": "＋",
            "Withdraw Savings": "⚙",
            "Savings Adjustment": "⚙",
            "Transferred Savings": "⇄",
            "Created Savings Goal": "◎",
            "Deleted Savings Goal": "×",
            "Clear Balance": "↻"
        };

        return icons[type] || "☷";
    }

    function renderHistory() {
        const container = $("allHistory");

        if (!container || !currentData) return;

        const entries = getAllHistoryEntries();

        if (!entries.length) {
            container.innerHTML = `
                <div class="empty-state">
                    No history yet. Your savings activity will appear here.
                </div>
            `;
            return;
        }

        container.innerHTML = entries.map(item => {
            const details = item.details || {};

            const descriptionParts = [
                details.goalName,
                details.fromGoal && `From ${details.fromGoal}`,
                details.toGoal && `To ${details.toGoal}`,
                details.note
            ].filter(Boolean);

            if (
                item.type === "Savings Adjustment" ||
                item.type === "Withdraw Savings"
            ) {
                descriptionParts.push(details.reason || "No reason provided");
            }

            if (item.type === "Clear Balance") {
                descriptionParts.push(details.reason || "Balance and savings goals cleared");
            }

            const description = descriptionParts.join(" · ");
            const date = new Date(item.date).toLocaleString();

            const displayType = item.type === "Withdraw Savings"
                ? "Adjust Savings"
                : item.type;

            const amount = item.type === "Transferred Savings"
                ? Number(details.amount) || 0
                : Number(item.amount) || 0;

            const positive = item.type === "Transferred Savings"
                ? false
                : amount > 0;

            const negative = amount < 0;

            return `
                <div class="activity-item">
                    <div class="activity-left">
                        <div class="activity-icon">${getHistoryIcon(item.type)}</div>

                        <div class="activity-info">
                            <strong>${escapeHTML(displayType)}</strong>
                            ${description
                                ? `<small>${escapeHTML(description)}</small>`
                                : ""}
                            <small>${escapeHTML(date)}</small>
                        </div>
                    </div>

                    <div class="activity-amount ${positive ? "positive" : negative ? "negative" : ""}">
                        ${item.type === "Transferred Savings"
                            ? escapeHTML(money(amount))
                            : `${positive ? "+" : ""}${escapeHTML(money(amount))}`}
                    </div>
                </div>
            `;
        }).join("");
    }

    // ==========================================
    // SAVINGS CHART
    // ==========================================

    function renderChart() {
        const container = $("savingsChart");

        if (!container || !currentData) return;

        const period = $("chartPeriod")?.value || "weekly";
        const now = new Date();

        let labels = [];
        let values = [];

        if (period === "weekly") {
            labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
            values = Array(7).fill(0);

            const monday = new Date(now);
            monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
            monday.setHours(0, 0, 0, 0);

            currentData.history.forEach(item => {
                if (item.type !== "Added Savings") return;

                const date = new Date(item.date);
                const index = Math.floor((date - monday) / 86400000);

                if (index >= 0 && index < 7) {
                    values[index] += Number(item.amount) || 0;
                }
            });

        } else if (period === "monthly") {
            labels = [
                "Jan", "Feb", "Mar", "Apr", "May", "Jun",
                "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
            ];

            values = Array(12).fill(0);

            currentData.history.forEach(item => {
                if (item.type !== "Added Savings") return;

                const date = new Date(item.date);

                if (date.getFullYear() === now.getFullYear()) {
                    values[date.getMonth()] += Number(item.amount) || 0;
                }
            });

        } else {
            const firstYear = now.getFullYear() - 5;

            labels = Array.from(
                { length: 6 },
                (_, index) => String(firstYear + index)
            );

            values = Array(6).fill(0);

            currentData.history.forEach(item => {
                if (item.type !== "Added Savings") return;

                const year = new Date(item.date).getFullYear();
                const index = year - firstYear;

                if (index >= 0 && index < 6) {
                    values[index] += Number(item.amount) || 0;
                }
            });
        }

        const maximum = Math.max(...values, 1);

        container.innerHTML = values.map((value, index) => {
            const height = Math.max(3, value / maximum * 100);

            return `
                <div class="chart-column">
                    <small class="chart-value">${money(value)}</small>

                    <div class="chart-bar-wrap">
                        <div class="chart-bar"
                            style="height:${height}%"
                            title="${money(value)}">
                        </div>
                    </div>

                    <span class="chart-label">${labels[index]}</span>
                </div>
            `;
        }).join("");
    }

    // ==========================================
    // PROFILE
    // ==========================================

    function renderProfile() {
        if (!currentAccount) return;

        $("profileName").value = currentAccount.name;
        $("profileEmail").value = currentAccount.email;
    }

    function saveProfile(name) {
        name = name.trim();

        if (name.length < 2) {
            showMessage($("profileMessage"), "Please enter a valid name.", "error");
            return;
        }

        const accounts = readAccounts();

        const account = accounts.find(
            item => item.email === currentAccount.email
        );

        if (!account) return;

        account.name = name;
        currentAccount.name = name;

        saveAccounts(accounts);
        updateDashboard();

        showMessage($("profileMessage"), "Profile updated successfully.");
    }

    // ==========================================
    // PDF EXPORT
    // ==========================================

    function getHistoryExportRows() {
        return getAllHistoryEntries().map(item => {
            const details = item.details || {};

            const descriptionParts = [
                details.goalName,
                details.fromGoal && `From ${details.fromGoal}`,
                details.toGoal && `To ${details.toGoal}`,
                details.note
            ].filter(Boolean);

            if (
                item.type === "Savings Adjustment" ||
                item.type === "Withdraw Savings"
            ) {
                descriptionParts.push(details.reason || "No reason provided");
            }

            return {
                date: new Date(item.date).toLocaleString(),
                type: item.type === "Withdraw Savings" ? "Adjust Savings" : item.type,
                amount: item.type === "Transferred Savings"
                    ? Number(details.amount) || 0
                    : Number(item.amount) || 0,
                goal: details.goalName || "",
                description: descriptionParts.join(" | "),
                previousBalance: item.balanceBefore ?? details.balanceBefore ?? "",
                newBalance: item.balanceAfter ?? ""
            };
        });
    }

    function downloadHistoryPDF() {
        if (!currentData || !currentAccount) return;

        const rows = getHistoryExportRows();

        if (!rows.length) {
            alert("There is no savings history to export yet.");
            return;
        }

        if (!window.jspdf || !window.jspdf.jsPDF) {
            alert("The PDF library could not be loaded. Please check your internet connection and reload the page.");
            return;
        }

        const { jsPDF } = window.jspdf;

        const doc = new jsPDF({
            orientation: "landscape",
            unit: "mm",
            format: "a4"
        });

        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        const safeName = currentAccount.name
            .trim()
            .replace(/[^a-z0-9_-]+/gi, "_")
            .replace(/^_+|_+$/g, "") || "user";

        let y = 17;

        function drawHeader() {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(19);
            doc.setTextColor(25, 54, 84);
            doc.text("SaveNest - Savings History", 14, y);

            y += 8;

            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            doc.setTextColor(100, 116, 139);

            doc.text(`Account: ${currentAccount.name}`, 14, y);
            doc.text(`Email: ${currentAccount.email}`, 14, y + 5);

            doc.text(
                `Generated: ${new Date().toLocaleString()}`,
                pageWidth - 14,
                y,
                { align: "right" }
            );

            y += 13;

            doc.setFillColor(240, 247, 255);
            doc.roundedRect(14, y, pageWidth - 28, 17, 2, 2, "F");

            doc.setFont("helvetica", "bold");
            doc.setFontSize(10);
            doc.setTextColor(25, 54, 84);

            doc.text(`Current Balance: ${money(currentData.balance)}`, 19, y + 7);
            doc.text(`Total Saved: ${money(currentData.totalSaved)}`, 100, y + 7);
            doc.text(`Total Records: ${rows.length}`, 190, y + 7);

            y += 25;

            const headers = [
                ["Date / Time", 14],
                ["Activity", 58],
                ["Amount", 88],
                ["Goal", 119],
                ["Reason / Details", 151],
                ["Previous", 207],
                ["New Balance", 241]
            ];

            doc.setFillColor(230, 240, 251);
            doc.rect(14, y - 5, pageWidth - 28, 10, "F");

            doc.setFont("helvetica", "bold");
            doc.setFontSize(8);
            doc.setTextColor(32, 75, 120);

            headers.forEach(([label, x]) => doc.text(label, x, y + 1));

            y += 10;
        }

        function drawRow(row, index) {
            const columns = [
                { text: row.date, x: 14, width: 42 },
                { text: row.type, x: 58, width: 28 },
                { text: money(row.amount), x: 88, width: 29 },
                { text: row.goal || "—", x: 119, width: 30 },
                { text: row.description || "—", x: 151, width: 53 },
                {
                    text: row.previousBalance === "" ? "—" : money(row.previousBalance),
                    x: 207,
                    width: 32
                },
                {
                    text: row.newBalance === "" ? "—" : money(row.newBalance),
                    x: 241,
                    width: 38
                }
            ];

            const wrapped = columns.map(column =>
                doc.splitTextToSize(String(column.text), column.width - 2)
            );

            const lineCount = Math.max(...wrapped.map(lines => lines.length));
            const rowHeight = Math.max(9, lineCount * 3.5 + 4);

            if (y + rowHeight > pageHeight - 15) {
                doc.addPage();
                y = 17;
                drawHeader();
            }

            if (index % 2 === 0) {
                doc.setFillColor(249, 251, 254);
                doc.rect(14, y - 4, pageWidth - 28, rowHeight, "F");
            }

            doc.setFont("helvetica", "normal");
            doc.setFontSize(7);
            doc.setTextColor(55, 71, 90);

            columns.forEach((column, i) => {
                doc.text(wrapped[i], column.x, y);
            });

            doc.setDrawColor(230, 235, 242);
            doc.line(14, y + rowHeight - 4, pageWidth - 14, y + rowHeight - 4);

            y += rowHeight;
        }

        drawHeader();
        rows.forEach((row, index) => drawRow(row, index));

        const pageCount = doc.internal.getNumberOfPages();

        for (let page = 1; page <= pageCount; page++) {
            doc.setPage(page);
            doc.setFontSize(8);
            doc.setTextColor(130, 145, 160);

            doc.text(
                `SaveNest | Page ${page} of ${pageCount}`,
                pageWidth - 14,
                pageHeight - 7,
                { align: "right" }
            );
        }

        const fileDate = new Date().toISOString().slice(0, 10);

        doc.save(`SaveNest_${safeName}_Savings_History_${fileDate}.pdf`);
    }

    // ==========================================
    // CLEAR HISTORY
    // ==========================================

    function clearHistory() {
        if (!confirm("Are you sure you want to clear your entire history? This cannot be undone.")) {
            return;
        }

        currentData.history = [];
        currentData.adjustments = [];

        saveData();
        renderHistory();

        showMessage($("historyMessage"), "History cleared successfully.");
    }

    // ==========================================
    // CLEAR BALANCE
    // ==========================================

    function clearBalance() {
        if (!currentData) return;

        if (!confirm(
            "Are you sure you want to clear your Current Balance, Total Saved, and all savings goal amounts?"
        )) {
            return;
        }

        const previousBalance = currentData.balance;
        const previousTotalSaved = currentData.totalSaved;

        currentData.balance = 0;
        currentData.totalSaved = 0;

        currentData.goals.forEach(goal => {
            goal.saved = 0;
        });

        addAdjustment("Clear Balance", -previousBalance, {
            reason: "Balance and savings goals cleared",
            previousTotalSaved,
            balanceBefore: previousBalance,
            balanceAfter: 0
        });

        updateDashboard();
        updateSavingsForm();
        updateAdjustSavingsForm();
        renderGoals();
        saveData();

        alert("Your Current Balance, Total Saved, and savings goal amounts have been cleared.");
    }

    // ==========================================
    // AUTHENTICATION EVENTS
    // ==========================================

    $("registerNav")?.addEventListener("click", () => setAuthMode("register"));
    $("loginNav")?.addEventListener("click", () => setAuthMode("login"));
    $("goToLogin")?.addEventListener("click", () => setAuthMode("login"));
    $("goToRegister")?.addEventListener("click", () => setAuthMode("register"));

    $("registerForm")?.addEventListener("submit", event => {
        event.preventDefault();

        const password = $("registerPassword").value;
        const confirmation = $("confirmPassword").value;

        if (password !== confirmation) {
            showMessage($("authMessage"), "Passwords do not match.", "error");
            return;
        }

        register(
            $("registerName").value,
            $("registerEmail").value,
            password
        );
    });

    $("loginForm")?.addEventListener("submit", event => {
        event.preventDefault();

        login(
            $("loginEmail").value,
            $("loginPassword").value
        );
    });

    document.querySelectorAll(".password-toggle").forEach(button => {
        button.addEventListener("click", () => {
            const input = $(button.dataset.target);

            if (!input) return;

            const show = input.type === "password";

            input.type = show ? "text" : "password";
            button.textContent = show ? "Hide" : "Show";
        });
    });

    $("forgotPassword")?.addEventListener("click", () => {
        alert("For account security, password recovery must be implemented with a secure email verification service.");
    });

    $("googleRegister")?.addEventListener("click", () => {
        alert("Google sign-in requires a configured Google authentication service.");
    });

    $("googleLogin")?.addEventListener("click", () => {
        alert("Google sign-in requires a configured Google authentication service.");
    });

    // ==========================================
    // NAVIGATION EVENTS
    // ==========================================

    document.querySelectorAll(".side-link").forEach(button => {
        button.addEventListener("click", () => {
            navigate(button.dataset.section);
        });
    });

    document.querySelectorAll("[data-go]").forEach(button => {
        button.addEventListener("click", () => {
            navigate(button.dataset.go);
        });
    });

    $("menuToggle")?.addEventListener("click", toggleSidebar);

    $("sidebarOverlay")?.addEventListener("click", closeMobileSidebar);

    document.addEventListener("keydown", event => {
        if (event.key === "Escape") {
            closeMobileSidebar();
        }
    });

    window.addEventListener("resize", () => {
        if (!isMobileScreen()) {
            closeMobileSidebar();
        }
    });

    $("logoutButton")?.addEventListener("click", logout);

    // ==========================================
    // ADD SAVINGS EVENTS
    // ==========================================

    $("savingsForm")?.addEventListener("submit", event => {
        event.preventDefault();

        deposit(
            $("savingsAmount").value,
            $("savingsGoalSelect").value
        );
    });

    document.querySelectorAll(".quick-amounts button").forEach(button => {
        button.addEventListener("click", () => {
            $("savingsAmount").value = button.dataset.amount;
            $("savingsAmount").focus();
        });
    });

    // ==========================================
    // ADJUST SAVINGS EVENTS
    // ==========================================

    $("adjustSavingsForm")?.addEventListener("submit", event => {
        event.preventDefault();

        adjustSavings(
            $("adjustType").value,
            $("adjustAmount").value,
            $("adjustGoalSelect").value,
            $("adjustReason").value
        );
    });

    // ==========================================
    // GOAL EVENTS
    // ==========================================

    $("goalForm")?.addEventListener("submit", event => {
        event.preventDefault();

        createGoal(
            $("goalNameInput").value,
            $("goalAmountInput").value
        );
    });

    $("transferFromGoal")?.addEventListener("change", () => {
        updateTransferDestination("");
        clearMessage($("transferMessage"));
    });

    $("transferSavingsForm")?.addEventListener("submit", event => {
        event.preventDefault();

        transferSavings(
            $("transferFromGoal").value,
            $("transferToGoal").value,
            $("transferAmount").value
        );
    });

    $("goalsList")?.addEventListener("click", event => {
        const saveButton = event.target.closest("[data-save-goal]");
        const deleteButton = event.target.closest("[data-delete-goal]");

        if (saveButton) {
            const goalId = saveButton.dataset.saveGoal;

            navigate("addSavings");

            if ($("savingsGoalSelect")) {
                $("savingsGoalSelect").value = goalId;
            }

            $("savingsAmount")?.focus();
            return;
        }

        if (deleteButton) {
            deleteGoal(deleteButton.dataset.deleteGoal);
        }
    });

    // ==========================================
    // CHART EVENTS
    // ==========================================

    $("chartPeriod")?.addEventListener("change", event => {
        if (!currentData) return;

        currentData.chartPeriod = event.target.value;
        saveData();
        renderChart();
    });

    // ==========================================
    // HISTORY EVENTS
    // ==========================================

    $("clearHistoryButton")?.addEventListener("click", clearHistory);
    $("downloadPdfButton")?.addEventListener("click", downloadHistoryPDF);

    // ==========================================
    // CLEAR BALANCE EVENT
    // ==========================================

    $("clearBalanceButton")?.addEventListener("click", clearBalance);

    // ==========================================
    // PROFILE EVENTS
    // ==========================================

    $("profileForm")?.addEventListener("submit", event => {
        event.preventDefault();
        saveProfile($("profileName").value);
    });

    // ==========================================
    // SESSION RESTORE
    // ==========================================

    const savedSession = localStorage.getItem(SESSION_KEY);

    if (savedSession) {
        const account = readAccounts().find(
            item => item.email === savedSession
        );

        if (account) {
            currentAccount = account;
            currentData = loadData(savedSession);

            saveData();
            showDashboard();
        } else {
            localStorage.removeItem(SESSION_KEY);
            showAuth();
            setAuthMode("register");
        }
    } else {
        showAuth();
        setAuthMode("register");
    }
});
