import { withAvatar } from "./profile.js";

export const $ = (id) => document.getElementById(id);

export function formatTime(ts) {
  if (!ts) return "--:--";
  return new Date(ts).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

export function setAuthMode(mode) {
  $("loginTab").classList.toggle("active", mode === "login");
  $("registerTab").classList.toggle("active", mode === "register");
  $("registerOnlyFields").hidden = mode !== "register";
  $("authSubmit").textContent = mode === "login" ? "Войти" : "Создать аккаунт";
}

export function setAuthStatus(text, error = false) {
  const el = $("authStatus");
  el.textContent = text;
  el.style.color = error ? "#9b2525" : "";
}

export function togglePages(authVisible) {
  $("authPage").hidden = !authVisible;
  $("chatPage").hidden = authVisible;
}

export function renderSelf(user) {
  $("meName").textContent = user.displayName || `@${user.username}`;
  $("meStatus").textContent = user.status || "Без статуса";
  $("meAvatar").src = withAvatar(user.avatarUrl);
}

export function renderDialogs(state, onOpen) {
  const root = $("dialogsList");
  root.textContent = "";
  if (!state.dialogs.length) {
    const empty = document.createElement("div");
    empty.className = "status-text";
    empty.textContent = "Пока нет чатов";
    root.append(empty);
    return;
  }

  state.dialogs.forEach((dialog) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `chat-item ${state.activeChatId === (dialog.chatId || dialog.groupId) ? "active" : ""}`;
    btn.addEventListener("click", () => onOpen(dialog));

    const name = dialog.type === "group" ? dialog.name : (dialog.peerName || `@${dialog.peer}`);
    const avatar = dialog.type === "group" ? dialog.avatarUrl : dialog.peerAvatar;
    btn.innerHTML = `
      <span class="chat-row">
        <img class="avatar" src="${withAvatar(avatar)}" alt="chat" />
        <span class="chat-meta">
          <strong>${name}</strong>
          <span>${dialog.lastMessage || "Пусто"}</span>
        </span>
        <span class="chat-time">${formatTime(dialog.lastAt)}</span>
      </span>
    `;
    root.append(btn);
  });
}

export function renderSearch(users, onPick) {
  const root = $("searchResults");
  root.textContent = "";
  users.forEach((u) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "chat-item";
    item.innerHTML = `
      <span class="chat-row">
        <img class="avatar" src="${withAvatar(u.avatarUrl)}" alt="${u.username}" />
        <span class="chat-meta">
          <strong>${u.displayName || u.username}</strong>
          <span>@${u.username}</span>
        </span>
      </span>
    `;
    item.addEventListener("click", () => onPick(u));
    root.append(item);
  });
}

export function renderHeader(chat, presenceText) {
  if (!chat) {
    $("chatIdentityBtn").disabled = true;
    $("chatTitle").textContent = "Выберите чат";
    $("presenceText").textContent = "Статус: —";
    $("chatAvatar").src = withAvatar("");
    return;
  }

  $("chatIdentityBtn").disabled = false;
  const title = chat.type === "group" ? chat.name : (chat.peerName || `@${chat.peer}`);
  const avatar = chat.type === "group" ? chat.avatarUrl : chat.peerAvatar;
  $("chatTitle").textContent = title;
  $("presenceText").textContent = presenceText;
  $("chatAvatar").src = withAvatar(avatar);
}

export function renderMessages(state, onSelect) {
  const root = $("messages");
  let column = root.querySelector(".message-column");
  if (!column) {
    column = document.createElement("div");
    column.className = "message-column";
    root.append(column);
  }

  const existing = new Map(Array.from(column.children).map((el) => [el.dataset.id, el]));
  const nextIds = new Set();

  state.messages.forEach((m) => {
    nextIds.add(m.id);
    let row = existing.get(m.id);
    if (!row) {
      row = document.createElement("article");
      row.dataset.id = m.id;
      row.className = "message";
      row.addEventListener("click", (event) => {
        event.stopPropagation();
        onSelect(m.id);
      });
      column.append(row);
    }
    row.classList.toggle("own", m.from === state.user.usernameKey);
    row.classList.toggle("other", m.from !== state.user.usernameKey);
    row.classList.toggle("selected", state.selectedMessageId === m.id);
    row.innerHTML = `
      ${m.forwarded ? `<div class="message-label">Forwarded from @${m.originalSender || "unknown"}</div>` : ""}
      <div class="message-head">${m.fromName || m.from}</div>
      <div class="message-text">${escapeHtml(m.text)}</div>
      <div class="message-foot"><span>${formatTime(m.createdAt)}</span><span>${m.status || "sent"}</span></div>
    `;
  });

  existing.forEach((el, id) => { if (!nextIds.has(id)) el.remove(); });
}

export function toggleActionPanel(show) {
  $("actionPanel").hidden = !show;
}

export function setTyping(text = "") {
  $("typingIndicator").textContent = text;
  $("typingIndicator").hidden = !text;
}

export function setMobileState(listOpen) {
  $("chatPage").classList.toggle("mobile-list", listOpen);
}

export function renderForwardTargets(targets, onPick) {
  const root = $("forwardTargets");
  root.textContent = "";
  targets.forEach((t) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chat-item";
    btn.innerHTML = `<span class="chat-row"><img class="avatar" src="${withAvatar(t.avatar)}" alt="" /><span class="chat-meta"><strong>${t.name}</strong><span>${t.type === "group" ? "Группа" : "Личный чат"}</span></span></span>`;
    btn.addEventListener("click", () => onPick(t));
    root.append(btn);
  });
}

function escapeHtml(value = "") {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}
