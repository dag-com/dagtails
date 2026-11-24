import "./todo.css";
import * as Backend from "../../backend.js";

const $ = (id) => document.getElementById(id);

function setText(id, value) {
  const el = $(id);
  if (el) el.textContent = value == null ? "" : String(value);
}

function showGate(step) {
  $("todo-gate").hidden = false;
  $("todo-board").hidden = true;
  $("todo-email-form").hidden = step === "code";
  $("todo-code-form").hidden = step !== "code";
}

function showBoard(email) {
  $("todo-gate").hidden = true;
  $("todo-board").hidden = false;
  setText("todo-who", email ? `Signed in as ${email}` : "Signed in");
  setText("todo-status", "");
}

function friendlyError(err) {
  const raw = err && err.message ? err.message : String(err || "");
  const blob = `${err && err.code ? err.code : ""} ${raw}`.toLowerCase();
  if (raw === "not_operator") return "That email is not an operator. Only Danny and Atar can open this list.";
  if (raw === "not_invited") return "That email is not on the tester list.";
  if (raw === "invalid_email") return "Enter a real email address.";
  if (raw === "invalid_code") return "Enter the 6-digit code from the email.";
  if (raw === "invalid_title") return "Enter a task, up to 200 characters.";
  if (raw === "not_configured" || raw === "gate_missing") return "The todo list is not installed on Supabase yet.";
  if (/rate|too many|429/.test(blob)) return "Too many codes. Wait a minute and try again.";
  if (/otp|token|code|expired|invalid/.test(blob)) return "That code didn't work. Request a new one.";
  return "Something went wrong. Try again.";
}

function renderList(items) {
  const list = $("todo-list");
  list.replaceChildren();
  $("todo-empty").hidden = items.length > 0;
  for (const todo of items) {
    list.appendChild(renderItem(todo));
  }
}

function renderItem(todo) {
  const li = document.createElement("li");
  li.className = todo.done ? "item is-done" : "item";

  const check = document.createElement("input");
  check.type = "checkbox";
  check.checked = !!todo.done;
  check.setAttribute("aria-label", `Done: ${todo.title}`);
  check.addEventListener("change", () => {
    run(() => Backend.updateAdminTodo(todo.id, { done: check.checked }).then(load));
  });

  const title = document.createElement("span");
  title.className = "title";
  title.textContent = todo.title;

  const edit = document.createElement("button");
  edit.type = "button";
  edit.className = "secondary";
  edit.textContent = "Edit";
  edit.addEventListener("click", () => startEdit(li, todo, title, edit));

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "secondary";
  remove.textContent = "Delete";
  remove.addEventListener("click", () => {
    if (!window.confirm("Delete this task?")) return;
    run(() => Backend.deleteAdminTodo(todo.id).then(load));
  });

  li.append(check, title, edit, remove);
  return li;
}

function startEdit(li, todo, title, edit) {
  const input = document.createElement("input");
  input.type = "text";
  input.maxLength = 200;
  input.value = todo.title;
  input.setAttribute("aria-label", "Task");
  const save = document.createElement("button");
  save.type = "button";
  save.textContent = "Save";
  save.addEventListener("click", () => {
    run(() => Backend.updateAdminTodo(todo.id, { title: input.value }).then(load));
  });
  title.replaceWith(input);
  edit.replaceWith(save);
  input.focus();
  input.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") {
      ev.preventDefault();
      save.click();
    }
  });
  li.classList.add("is-editing");
}

async function load() {
  const items = await Backend.listAdminTodos();
  renderList(items);
}

async function run(action) {
  setText("todo-error", "");
  try {
    await action();
  } catch (e) {
    setText("todo-error", friendlyError(e));
  }
}

let pendingEmail = "";
let busy = false;

async function sendCode(email) {
  if (busy) return;
  busy = true;
  setText("todo-error", "");
  $("todo-send").disabled = true;
  try {
    pendingEmail = await Backend.requestOperatorOtp(email);
    setText("todo-code-hint", `We sent a 6-digit code to ${pendingEmail}.`);
    showGate("code");
  } catch (e) {
    setText("todo-error", friendlyError(e));
  } finally {
    busy = false;
    $("todo-send").disabled = false;
  }
}

async function openBoard(email) {
  showBoard(email);
  await load();
}

$("todo-email-form").addEventListener("submit", (ev) => {
  ev.preventDefault();
  sendCode($("todo-email").value);
});

$("todo-code-form").addEventListener("submit", (ev) => {
  ev.preventDefault();
  if (busy) return;
  busy = true;
  setText("todo-error", "");
  $("todo-verify").disabled = true;
  Backend.verifyOperatorOtp(pendingEmail, $("todo-code").value)
    .then((email) => openBoard(email))
    .catch((e) => setText("todo-error", friendlyError(e)))
    .finally(() => {
      busy = false;
      $("todo-verify").disabled = false;
    });
});

$("todo-resend").addEventListener("click", () => {
  if (pendingEmail) sendCode(pendingEmail);
});

$("todo-back").addEventListener("click", () => {
  showGate("email");
  setText("todo-error", "");
});

$("todo-add-form").addEventListener("submit", (ev) => {
  ev.preventDefault();
  const title = $("todo-title").value;
  run(async () => {
    await Backend.addAdminTodo(title);
    $("todo-title").value = "";
    await load();
  });
});

$("todo-refresh").addEventListener("click", () => run(load));

$("todo-signout").addEventListener("click", () => {
  run(async () => {
    await Backend.signOutSession();
    pendingEmail = "";
    showGate("email");
    setText("todo-who", "");
    $("todo-list").replaceChildren();
  });
});

setText("todo-status", "Checking session…");
Backend.restoreOperatorSession()
  .then((restored) => {
    setText("todo-status", "");
    if (restored && restored.ok) return openBoard(restored.email);
    if (restored && restored.reason && restored.reason !== "no_session") {
      setText("todo-error", friendlyError({ message: restored.reason }));
    }
    showGate("email");
  })
  .catch((e) => {
    setText("todo-status", "");
    setText("todo-error", friendlyError(e));
    showGate("email");
  });
