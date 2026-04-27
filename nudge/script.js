import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://dhmthosilfhudzygmsst.supabase.co";
const SUPABASE_KEY = "sb_publishable_kd3N68yGfmPOlK75bkTAHA_QZ9sNK1_";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const LOCAL_STORAGE_KEY = "next-move.tasks";
const THEME_STORAGE_KEY = "nudge.theme";
const VALID_THEMES = ["graphite", "ocean", "forest", "onyx", "sand"];
const THEME_META_COLORS = {
  graphite: "#15171a",
  ocean: "#0d1929",
  forest: "#121a14",
  onyx: "#000000",
  sand: "#f5f1ea",
};
const ENERGY_FLOOR = 5;

applyTheme(loadTheme());

function loadTheme() {
  const saved = localStorage.getItem(THEME_STORAGE_KEY);
  return VALID_THEMES.includes(saved) ? saved : "graphite";
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  const metaColor = document.querySelector('meta[name="theme-color"]');
  if (metaColor && THEME_META_COLORS[theme]) {
    metaColor.setAttribute("content", THEME_META_COLORS[theme]);
  }
  localStorage.setItem(THEME_STORAGE_KEY, theme);
}

const authScreen = document.getElementById("auth-screen");
const appScreen = document.getElementById("app");
const authForm = document.getElementById("auth-form");
const authEmail = document.getElementById("auth-email");
const authPassword = document.getElementById("auth-password");
const authError = document.getElementById("auth-error");
const signupBtn = document.getElementById("signup-btn");
const signoutBtn = document.getElementById("signout-btn");
const userEmailEl = document.getElementById("user-email");
const forgotLink = document.getElementById("forgot-link");
const googleBtn = document.getElementById("google-btn");
const forgotForm = document.getElementById("forgot-form");
const forgotEmail = document.getElementById("forgot-email");
const forgotStatus = document.getElementById("forgot-status");
const forgotBack = document.getElementById("forgot-back");
const pwResetForm = document.getElementById("reset-form");
const resetPassword = document.getElementById("reset-password");
const resetPasswordConfirm = document.getElementById("reset-password-confirm");
const resetStatus = document.getElementById("reset-status");
const authForms = document.querySelectorAll(".auth-mode");

const form = document.getElementById("task-form");
const nameInput = document.getElementById("name");
const importanceInput = document.getElementById("importance");
const urgencyInput = document.getElementById("urgency");
const energyInput = document.getElementById("energy");
const dueDateInput = document.getElementById("due-date");

const dueDatePicker = window.flatpickr ? window.flatpickr(dueDateInput, {
  locale: window.flatpickr.l10ns?.fr || "default",
  dateFormat: "Y-m-d",
  altInput: true,
  altFormat: "j F Y",
  allowInput: false,
  disableMobile: true,
}) : null;
const list = document.getElementById("task-list");
const empty = document.getElementById("empty");
const suggestBtn = document.getElementById("suggest-btn");
const suggestion = document.getElementById("suggestion");
const formTitle = document.getElementById("form-title");
const submitBtn = document.getElementById("submit-btn");
const cancelBtn = document.getElementById("cancel-btn");

const settingsBtn = document.getElementById("settings-btn");
const settingsBack = document.getElementById("settings-back");
const archivesBtn = document.getElementById("archives-btn");
const archivesBack = document.getElementById("archives-back");
const archivesList = document.getElementById("archives-list");
const archivesEmpty = document.getElementById("archives-empty");
const statToday = document.getElementById("stat-today");
const statWeek = document.getElementById("stat-week");
const statMonth = document.getElementById("stat-month");
const statTotal = document.getElementById("stat-total");
const tasksView = document.getElementById("tasks-view");
const settingsView = document.getElementById("settings-view");
const archivesView = document.getElementById("archives-view");
const themeGrid = document.getElementById("theme-grid");
const passwordForm = document.getElementById("password-form");
const newPassword = document.getElementById("new-password");
const newPasswordConfirm = document.getElementById("new-password-confirm");
const passwordStatus = document.getElementById("password-status");
const emailForm = document.getElementById("email-form");
const newEmail = document.getElementById("new-email");
const emailStatus = document.getElementById("email-status");

let tasks = [];
let editingId = null;
let currentUser = null;
let isInRecoveryFlow = false;

authForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  await signIn();
});

signupBtn.addEventListener("click", async () => {
  await signUp();
});

signoutBtn.addEventListener("click", async () => {
  await supabase.auth.signOut();
});

forgotLink.addEventListener("click", () => switchAuthMode("forgot"));
forgotBack.addEventListener("click", () => switchAuthMode("login"));

googleBtn.addEventListener("click", async () => {
  authError.textContent = "";
  const redirectTo = window.location.origin + window.location.pathname;
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo },
  });
  if (error) {
    authError.textContent = error.message;
  }
});

forgotForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  forgotStatus.className = "form-status";
  forgotStatus.textContent = "";
  const email = forgotEmail.value.trim();
  if (!email) return;
  const redirectTo = window.location.origin + window.location.pathname;
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) {
    forgotStatus.classList.add("error");
    forgotStatus.textContent = error.message;
    return;
  }
  forgotStatus.classList.add("success");
  forgotStatus.textContent = "Lien envoyé. Vérifie ta boîte mail.";
  forgotForm.reset();
});

pwResetForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  resetStatus.className = "form-status";
  resetStatus.textContent = "";
  const pw = resetPassword.value;
  const confirm = resetPasswordConfirm.value;
  if (pw.length < 6) {
    resetStatus.classList.add("error");
    resetStatus.textContent = "Au moins 6 caractères.";
    return;
  }
  if (pw !== confirm) {
    resetStatus.classList.add("error");
    resetStatus.textContent = "Les deux mots de passe ne correspondent pas.";
    return;
  }
  const { error } = await supabase.auth.updateUser({ password: pw });
  if (error) {
    resetStatus.classList.add("error");
    resetStatus.textContent = error.message;
    return;
  }
  resetStatus.classList.add("success");
  resetStatus.textContent = "Mot de passe mis à jour. Connexion en cours…";
  pwResetForm.reset();
});

function switchAuthMode(mode) {
  authForms.forEach((f) => {
    f.classList.toggle("hidden", f.dataset.mode !== mode);
  });
  authError.textContent = "";
  forgotStatus.textContent = "";
  forgotStatus.className = "form-status";
  resetStatus.textContent = "";
  resetStatus.className = "form-status";
}

settingsBtn.addEventListener("click", () => {
  tasksView.classList.add("hidden");
  settingsView.classList.remove("hidden");
  refreshThemeSelection();
  passwordStatus.textContent = "";
  passwordStatus.className = "form-status";
  emailStatus.textContent = "";
  emailStatus.className = "form-status";
  passwordForm.reset();
  emailForm.reset();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

settingsBack.addEventListener("click", () => {
  settingsView.classList.add("hidden");
  tasksView.classList.remove("hidden");
});

archivesBtn.addEventListener("click", async () => {
  tasksView.classList.add("hidden");
  settingsView.classList.add("hidden");
  archivesView.classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
  await loadArchives();
});

archivesBack.addEventListener("click", () => {
  archivesView.classList.add("hidden");
  tasksView.classList.remove("hidden");
});

async function loadArchives() {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .not("completed_at", "is", null)
    .order("completed_at", { ascending: false });
  if (error) {
    console.error("loadArchives", error);
    return;
  }
  renderArchives(data || []);
}

function renderArchives(archived) {
  const now = new Date();
  const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);

  let countToday = 0, countWeek = 0, countMonth = 0;
  for (const t of archived) {
    const d = new Date(t.completed_at);
    if (d >= startOfToday) countToday++;
    if (d >= sevenDaysAgo) countWeek++;
    if (d >= thirtyDaysAgo) countMonth++;
  }
  statToday.textContent = countToday;
  statWeek.textContent = countWeek;
  statMonth.textContent = countMonth;
  statTotal.textContent = archived.length;

  archivesList.innerHTML = "";
  if (archived.length === 0) {
    archivesEmpty.classList.remove("hidden");
    return;
  }
  archivesEmpty.classList.add("hidden");

  archived.forEach((task) => {
    const li = document.createElement("li");
    li.className = "task-item archived";
    li.innerHTML = `
      <div>
        <div class="name">${escapeHtml(task.name)}</div>
        <div class="meta">Faite ${formatCompletedAt(task.completed_at)} · Score ${formatScore(score(task))}</div>
      </div>
      <div class="task-actions">
        <button class="btn btn-icon" data-restore="${task.id}" aria-label="Restaurer">⟲ Restaurer</button>
        <button class="btn btn-icon btn-danger" data-purge="${task.id}" aria-label="Supprimer">Supprimer</button>
      </div>
    `;
    archivesList.appendChild(li);
  });

  archivesList.querySelectorAll("button[data-restore]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.restore;
      const { data, error } = await supabase
        .from("tasks")
        .update({ completed_at: null })
        .eq("id", id)
        .select()
        .single();
      if (error) {
        console.error("restore", error);
        return;
      }
      if (data) tasks.push(data);
      await loadArchives();
      render();
    });
  });

  archivesList.querySelectorAll("button[data-purge]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.purge;
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) {
        console.error("purge", error);
        return;
      }
      await loadArchives();
    });
  });
}

function formatCompletedAt(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const diff = Math.floor((now - d) / 60000);
  if (diff < 1) return "à l'instant";
  if (diff < 60) return `il y a ${diff} min`;
  if (diff < 1440) return `il y a ${Math.floor(diff / 60)} h`;
  const days = Math.floor(diff / 1440);
  if (days === 1) return "hier";
  if (days < 7) return `il y a ${days} j`;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

themeGrid.addEventListener("click", (e) => {
  const btn = e.target.closest(".theme-swatch");
  if (!btn) return;
  const theme = btn.dataset.theme;
  if (!VALID_THEMES.includes(theme)) return;
  applyTheme(theme);
  refreshThemeSelection();
});

function refreshThemeSelection() {
  const active = document.documentElement.getAttribute("data-theme") || "graphite";
  themeGrid.querySelectorAll(".theme-swatch").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.theme === active);
  });
}

passwordForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  passwordStatus.className = "form-status";
  passwordStatus.textContent = "";
  const pw = newPassword.value;
  const confirm = newPasswordConfirm.value;
  if (pw.length < 6) {
    passwordStatus.classList.add("error");
    passwordStatus.textContent = "Au moins 6 caractères.";
    return;
  }
  if (pw !== confirm) {
    passwordStatus.classList.add("error");
    passwordStatus.textContent = "Les deux mots de passe ne correspondent pas.";
    return;
  }
  const { error } = await supabase.auth.updateUser({ password: pw });
  if (error) {
    passwordStatus.classList.add("error");
    passwordStatus.textContent = error.message;
    return;
  }
  passwordStatus.classList.add("success");
  passwordStatus.textContent = "Mot de passe mis à jour.";
  passwordForm.reset();
});

emailForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  emailStatus.className = "form-status";
  emailStatus.textContent = "";
  const email = newEmail.value.trim();
  if (!email) return;
  const { error } = await supabase.auth.updateUser({ email });
  if (error) {
    emailStatus.classList.add("error");
    emailStatus.textContent = error.message;
    return;
  }
  emailStatus.classList.add("success");
  emailStatus.textContent = "Vérifie tes deux boîtes mail (ancienne et nouvelle) pour confirmer le changement.";
  emailForm.reset();
});

async function signIn() {
  authError.textContent = "";
  const email = authEmail.value.trim();
  const password = authPassword.value;
  if (!email || !password) return;
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) authError.textContent = error.message;
}

async function signUp() {
  authError.textContent = "";
  const email = authEmail.value.trim();
  const password = authPassword.value;
  if (!email || !password) {
    authError.textContent = "Email et mot de passe requis.";
    return;
  }
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) {
    authError.textContent = error.message;
    return;
  }
  if (data.session) {
    authError.textContent = "";
  } else {
    authError.textContent = "Compte créé. Vérifie ta boîte mail pour confirmer, puis reconnecte-toi.";
  }
}

supabase.auth.onAuthStateChange(async (event, session) => {
  if (event === "PASSWORD_RECOVERY") {
    isInRecoveryFlow = true;
    currentUser = session?.user ?? null;
    showAuth();
    switchAuthMode("reset");
    return;
  }

  if (event === "USER_UPDATED" && isInRecoveryFlow) {
    isInRecoveryFlow = false;
  } else if (isInRecoveryFlow) {
    return;
  }

  currentUser = session?.user ?? null;
  if (currentUser) {
    showApp();
    await loadTasks();
  } else {
    showAuth();
    switchAuthMode("login");
    tasks = [];
    render();
  }
});

function showApp() {
  authScreen.classList.add("hidden");
  appScreen.classList.remove("hidden");
  userEmailEl.textContent = currentUser.email;
  authEmail.value = "";
  authPassword.value = "";
  settingsView.classList.add("hidden");
  archivesView.classList.add("hidden");
  tasksView.classList.remove("hidden");
}

function showAuth() {
  authScreen.classList.remove("hidden");
  appScreen.classList.add("hidden");
  authError.textContent = "";
}

async function loadTasks() {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .is("completed_at", null)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("loadTasks", error);
    return;
  }
  tasks = data || [];
  await maybeMigrateLocalTasks();
  render();
}

async function maybeMigrateLocalTasks() {
  const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (!raw) return;
  let local;
  try {
    local = JSON.parse(raw);
  } catch {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    return;
  }
  if (!Array.isArray(local) || local.length === 0) {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    return;
  }
  const ok = confirm(
    `Tu as ${local.length} tâche(s) sauvegardée(s) localement sur cet appareil. Les importer dans ton compte Nudge ?`
  );
  if (ok) {
    const rows = local.map((t) => ({
      user_id: currentUser.id,
      name: t.name,
      importance: t.importance,
      urgency: t.urgency,
      energy: t.energy,
    }));
    const { data, error } = await supabase.from("tasks").insert(rows).select();
    if (error) {
      console.error("migration", error);
      alert("Erreur lors de l'import : " + error.message);
      return;
    }
    if (data) tasks = [...tasks, ...data];
  }
  localStorage.removeItem(LOCAL_STORAGE_KEY);
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = nameInput.value.trim();
  if (!name || !currentUser) return;

  const data = {
    name,
    importance: Number(importanceInput.value),
    urgency: Number(urgencyInput.value),
    energy: Number(energyInput.value),
    due_date: dueDateInput.value || null,
  };

  if (editingId) {
    const { data: updated, error } = await supabase
      .from("tasks")
      .update(data)
      .eq("id", editingId)
      .select()
      .single();
    if (error) {
      console.error("update", error);
      return;
    }
    const i = tasks.findIndex((t) => t.id === editingId);
    if (i !== -1) tasks[i] = updated;
    exitEditMode();
  } else {
    const { data: inserted, error } = await supabase
      .from("tasks")
      .insert({ ...data, user_id: currentUser.id })
      .select()
      .single();
    if (error) {
      console.error("insert", error);
      return;
    }
    tasks.push(inserted);
  }

  resetForm();
  render();
});

cancelBtn.addEventListener("click", () => {
  exitEditMode();
  resetForm();
});

function startEdit(id) {
  const task = tasks.find((t) => t.id === id);
  if (!task) return;
  editingId = id;
  nameInput.value = task.name;
  importanceInput.value = task.importance;
  urgencyInput.value = task.urgency;
  energyInput.value = task.energy;
  if (dueDatePicker) {
    dueDatePicker.setDate(task.due_date || null, false);
  } else {
    dueDateInput.value = task.due_date || "";
  }
  formTitle.textContent = "Modifier la tâche";
  submitBtn.textContent = "Enregistrer";
  cancelBtn.classList.remove("hidden");
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
  nameInput.focus({ preventScroll: true });
}

function exitEditMode() {
  editingId = null;
  formTitle.textContent = "Ajouter une tâche";
  submitBtn.textContent = "Ajouter";
  cancelBtn.classList.add("hidden");
  render();
}

function resetForm() {
  form.reset();
  importanceInput.value = 5;
  urgencyInput.value = 5;
  energyInput.value = 5;
  if (dueDatePicker) {
    dueDatePicker.clear();
  } else {
    dueDateInput.value = "";
  }
}

suggestBtn.addEventListener("click", () => {
  if (tasks.length === 0) {
    suggestion.classList.remove("hidden");
    suggestion.innerHTML = `<h3>Suggestion</h3><div class="pick">Ajoute d'abord au moins une tâche.</div>`;
    return;
  }

  const ranked = [...tasks].sort((a, b) => score(b) - score(a));
  const best = ranked[0];
  const next = ranked.slice(1, 3);

  const nextHtml = next.length
    ? `<div class="next-up">
         <div class="next-label">Ensuite</div>
         ${next.map((t) => `
           <div class="next-item">
             <span class="next-name">${escapeHtml(t.name)}</span>
             <span class="next-score">Score ${formatScore(score(t))}</span>
           </div>
         `).join("")}
       </div>`
    : "";

  suggestion.classList.remove("hidden");
  suggestion.innerHTML = `
    <h3>Prochaine action</h3>
    <div class="pick">${escapeHtml(best.name)}</div>
    <div class="score">Score : ${formatScore(score(best))} ((importance ${best.importance} + urgence ${best.urgency}) ÷ ${Math.max(best.energy, ENERGY_FLOOR)}${best.energy < ENERGY_FLOOR ? ` — énergie ${best.energy} relevée au plancher ${ENERGY_FLOOR}` : ""})</div>
    ${nextHtml}
  `;
});

function score(task) {
  return (task.importance + effectiveUrgency(task)) / Math.max(task.energy, ENERGY_FLOOR);
}

function effectiveUrgency(task) {
  const dueBoost = urgencyFromDueDate(task.due_date);
  return Math.max(task.urgency, dueBoost);
}

function urgencyFromDueDate(dueDate) {
  if (!dueDate) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate + "T00:00:00");
  const days = Math.floor((due - today) / 86400000);
  if (days <= 0) return 10;
  if (days === 1) return 9;
  if (days <= 3) return 8;
  if (days <= 7) return 6;
  if (days <= 14) return 5;
  return 0;
}

function formatDueDate(dueDate) {
  if (!dueDate) return "";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate + "T00:00:00");
  const days = Math.floor((due - today) / 86400000);
  if (days < 0) return `en retard de ${-days} j`;
  if (days === 0) return "aujourd'hui";
  if (days === 1) return "demain";
  if (days <= 7) return `dans ${days} j`;
  return due.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function formatScore(n) {
  return Number.isInteger(n) ? n.toString() : n.toFixed(2);
}

function render() {
  list.innerHTML = "";
  if (tasks.length === 0) {
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");

  const sorted = [...tasks].sort((a, b) => score(b) - score(a));
  sorted.forEach((task, idx) => {
    const li = document.createElement("li");
    li.className = "task-item"
      + (task.id === editingId ? " editing" : "")
      + (idx === 0 && sorted.length > 1 ? " top-pick" : "");
    const dueLabel = task.due_date ? `<span class="due-pill ${urgencyFromDueDate(task.due_date) >= 9 ? "due-urgent" : ""}">⏱ ${formatDueDate(task.due_date)}</span>` : "";
    li.innerHTML = `
      <div>
        <div class="name">${escapeHtml(task.name)} ${dueLabel}</div>
        <div class="meta">Imp ${task.importance} · Urg ${task.urgency} · Énergie ${task.energy} · Score ${formatScore(score(task))}</div>
      </div>
      <div class="task-actions">
        <button class="btn btn-icon btn-success" data-done="${task.id}" aria-label="Marquer comme faite">✓ Fait</button>
        <button class="btn btn-icon" data-edit="${task.id}" aria-label="Modifier">Modifier</button>
        <button class="btn btn-icon btn-danger" data-delete="${task.id}" aria-label="Supprimer">Supprimer</button>
      </div>
    `;
    list.appendChild(li);
  });

  list.querySelectorAll("button[data-done]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.done;
      if (id === editingId) {
        exitEditMode();
        resetForm();
      }
      const { error } = await supabase
        .from("tasks")
        .update({ completed_at: new Date().toISOString() })
        .eq("id", id);
      if (error) {
        console.error("complete", error);
        return;
      }
      tasks = tasks.filter((t) => t.id !== id);
      render();
    });
  });

  list.querySelectorAll("button[data-edit]").forEach((btn) => {
    btn.addEventListener("click", () => startEdit(btn.dataset.edit));
  });

  list.querySelectorAll("button[data-delete]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.delete;
      if (id === editingId) {
        exitEditMode();
        resetForm();
      }
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) {
        console.error("delete", error);
        return;
      }
      tasks = tasks.filter((t) => t.id !== id);
      render();
    });
  });
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
