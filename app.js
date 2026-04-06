import {
  loginUser,
  registerUser,
  restoreSession,
  saveSession,
  clearSession,
  isValidLogin,
  toKey
} from "./auth.js";
import {
  privateChatId,
  setPresence,
  searchUsersByPrefix,
  subscribeDialogs,
  subscribeMessages,
  subscribePresence,
  subscribeTyping,
  sendMessage,
  deleteMessageForAll,
  deleteMessageForMe,
  getHiddenMessages,
  hideChatForUser
} from "./chat.js";
import { fileToSquareBase64, updateProfile } from "./profile.js";
import { createGroup } from "./groups.js";
import {
  $,
  setAuthMode,
  setAuthStatus,
  togglePages,
  renderSelf,
  renderDialogs,
  renderSearch,
  renderHeader,
  renderMessages,
  toggleActionPanel,
  setTyping,
  setMobileState,
  renderForwardTargets
} from "./ui.js";

const state = {
  user: null,
  dialogs: [],
  activeChat: null,
  activeChatId: null,
  messages: [],
  selectedMessageId: null,
  profileView: null,
  groups: [],
  hiddenMessageIds: {},
  mode: "login"
};

const unsub = { dialogs: null, messages: null, presence: null, typing: null };
let typingTimer;

function init() {
  bindEvents();
  const saved = restoreSession();
  if (saved?.usernameKey) {
    state.user = saved;
    afterLogin();
  } else {
    togglePages(true);
  }
}

function bindEvents() {
  setAuthMode("login");
  $("loginTab").addEventListener("click", () => { state.mode = "login"; setAuthMode("login"); });
  $("registerTab").addEventListener("click", () => { state.mode = "register"; setAuthMode("register"); });
  $("authForm").addEventListener("submit", onAuthSubmit);

  $("searchInput").addEventListener("input", debounce(async (event) => {
    if (!state.user) return;
    const users = await searchUsersByPrefix(event.target.value, state.user.usernameKey);
    renderSearch(users, openPrivateDialogByUser);
  }, 220));

  $("composer").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!state.activeChat) return;
    const text = $("messageInput").value;
    $("messageInput").value = "";
    await sendMessage({ chat: state.activeChat, me: state.user, text });
  });

  $("messageInput").addEventListener("keydown", async (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      $("composer").requestSubmit();
      return;
    }
    if (!state.activeChat || !state.user) return;
    clearTimeout(typingTimer);
    setTyping("Печатает...");
    typingTimer = setTimeout(() => setTyping(""), 1200);
  });

  $("logoutBtn").addEventListener("click", () => {
    clearSession();
    location.reload();
  });

  $("openProfileBtn").addEventListener("click", () => openProfile(state.user));
  $("chatIdentityBtn").addEventListener("click", () => {
    if (state.activeChat?.type === "private" && state.activeChat.peerKey) {
      const found = state.dialogs.find((x) => x.peerKey === state.activeChat.peerKey);
      openProfile(found || { displayName: state.activeChat.peerName, username: state.activeChat.peer, status: "", lastSeen: "—", avatarUrl: state.activeChat.peerAvatar });
    }
  });

  $("profileForm").addEventListener("submit", onProfileSave);
  $("createGroupBtn").addEventListener("click", () => $("groupModal").showModal());
  $("groupForm").addEventListener("submit", onGroupCreate);
  $("mobileBackBtn").addEventListener("click", () => setMobileState(true));

  document.addEventListener("click", () => {
    state.selectedMessageId = null;
    renderMessages(state, onMessageSelect);
    toggleActionPanel(false);
  });

  $("forwardBtn").addEventListener("click", openForwardModal);
  $("deleteBtn").addEventListener("click", onDeleteSelected);
}

async function onAuthSubmit(event) {
  event.preventDefault();
  const username = $("usernameInput").value.trim();
  const password = $("passwordInput").value;
  if (!isValidLogin(username)) return setAuthStatus("Логин некорректен", true);
  if (password.length < 6) return setAuthStatus("Минимум 6 символов", true);

  try {
    if (state.mode === "login") {
      state.user = await loginUser(username, password);
    } else {
      const avatarUrl = await fileToSquareBase64($("avatarInput").files[0]);
      state.user = await registerUser({
        username,
        password,
        displayName: $("displayNameInput").value,
        status: $("statusInput").value,
        avatarUrl
      });
    }
    setAuthStatus("Успешно");
    saveSession(state.user);
    afterLogin();
  } catch (error) {
    setAuthStatus(error.message || "Ошибка", true);
  }
}

async function afterLogin() {
  togglePages(false);
  renderSelf(state.user);
  await setPresence(state.user);
  watchDialogs();
}

function watchDialogs() {
  unsub.dialogs?.();
  unsub.dialogs = subscribeDialogs(state.user.usernameKey, (rows) => {
    state.dialogs = rows;
    renderDialogs(state, openDialog);
  });
}

async function openPrivateDialogByUser(user) {
  const chatId = privateChatId(state.user.username, user.username);
  openDialog({
    type: "private",
    chatId,
    peer: user.username,
    peerKey: user.usernameKey,
    peerName: user.displayName || user.username,
    peerAvatar: user.avatarUrl || "",
    lastMessage: "",
    lastAt: Date.now()
  });
}

async function openDialog(dialog) {
  state.activeChat = dialog.type === "group"
    ? { type: "group", groupId: dialog.groupId, name: dialog.name, avatarUrl: dialog.avatarUrl || "", description: dialog.description || "" }
    : { type: "private", chatId: dialog.chatId, peer: dialog.peer, peerKey: dialog.peerKey || toKey(dialog.peer), peerName: dialog.peerName || dialog.peer, peerAvatar: dialog.peerAvatar || "" };
  state.activeChatId = dialog.chatId || dialog.groupId;
  state.selectedMessageId = null;
  setMobileState(false);
  $("messageInput").focus();
  renderHeader(state.activeChat, "Загрузка...");

  const hid = await getHiddenMessages(state.user.usernameKey, state.activeChatId);
  state.hiddenMessageIds = hid;

  unsub.messages?.();
  unsub.presence?.();
  unsub.typing?.();

  unsub.messages = subscribeMessages(state.activeChat, (messages) => {
    state.messages = messages.filter((m) => !state.hiddenMessageIds[m.id]);
    renderMessages(state, onMessageSelect);
    stickToBottomIfNear();
  }, 50);

  if (state.activeChat.type === "private") {
    unsub.presence = subscribePresence(state.activeChat.peerKey, (presence) => {
      const value = presence?.online ? "online" : `last seen ${presence?.lastSeen ? new Date(presence.lastSeen).toLocaleString("ru-RU") : "—"}`;
      renderHeader(state.activeChat, value);
    });
  } else {
    renderHeader(state.activeChat, "Групповой чат");
  }

  unsub.typing = subscribeTyping(state.activeChat, (typingState) => {
    const peersTyping = Object.keys(typingState).filter((id) => id !== state.user.usernameKey);
    setTyping(peersTyping.length ? "Печатает..." : "");
  });
}

function onMessageSelect(messageId) {
  state.selectedMessageId = state.selectedMessageId === messageId ? null : messageId;
  renderMessages(state, onMessageSelect);
  toggleActionPanel(Boolean(state.selectedMessageId));
}

async function onDeleteSelected() {
  const target = state.messages.find((x) => x.id === state.selectedMessageId);
  if (!target) return;

  if (target.from === state.user.usernameKey) {
    const mode = window.prompt("1 — удалить у меня, 2 — удалить у всех", "1");
    if (mode === "2") await deleteMessageForAll(state.activeChat, target.id);
    else await deleteMessageForMe(state.user.usernameKey, state.activeChatId, target.id);
  } else {
    await deleteMessageForMe(state.user.usernameKey, state.activeChatId, target.id);
  }

  state.selectedMessageId = null;
  toggleActionPanel(false);
}

function openForwardModal() {
  const selected = state.messages.find((x) => x.id === state.selectedMessageId);
  if (!selected) return;
  const targets = state.dialogs
    .filter((d) => (d.chatId || d.groupId) !== state.activeChatId)
    .map((d) => ({
      type: d.type || "private",
      chatId: d.chatId,
      groupId: d.groupId,
      name: d.type === "group" ? d.name : (d.peerName || `@${d.peer}`),
      avatar: d.type === "group" ? d.avatarUrl : d.peerAvatar,
      dialog: d
    }));

  renderForwardTargets(targets, async (target) => {
    const chat = target.type === "group"
      ? { type: "group", groupId: target.groupId, name: target.dialog.name, avatarUrl: target.dialog.avatarUrl }
      : {
          type: "private",
          chatId: target.chatId,
          peer: target.dialog.peer,
          peerName: target.dialog.peerName,
          peerAvatar: target.dialog.peerAvatar
        };
    await sendMessage({
      chat,
      me: state.user,
      text: selected.text,
      forwarded: true,
      originalSender: selected.fromName || selected.from
    });
    $("forwardModal").close();
  });
  $("forwardModal").showModal();
}

function openProfile(user) {
  state.profileView = user;
  $("profileAvatar").src = user.avatarUrl || $("meAvatar").src;
  $("profileDisplayName").value = user.displayName || user.username || "";
  $("profileStatus").value = user.status || "";
  const own = user.usernameKey === state.user.usernameKey;
  $("profileSaveBtn").hidden = !own;
  $("profileAvatarField").hidden = !own;
  $("profileMeta").textContent = own
    ? `@${state.user.username}`
    : `@${user.username || "unknown"} · ${user.lastSeen ? new Date(user.lastSeen).toLocaleString("ru-RU") : "—"}`;
  $("profileModal").showModal();
}

async function onProfileSave(event) {
  event.preventDefault();
  const patch = {
    displayName: $("profileDisplayName").value.trim() || state.user.username,
    status: $("profileStatus").value.trim().slice(0, 100)
  };
  const avatarFile = $("profileAvatarInput").files[0];
  if (avatarFile) patch.avatarUrl = await fileToSquareBase64(avatarFile);
  await updateProfile(state.user.usernameKey, patch);
  Object.assign(state.user, patch);
  saveSession(state.user);
  renderSelf(state.user);
  $("profileModal").close();
}

async function onGroupCreate(event) {
  event.preventDefault();
  const avatarUrl = await fileToSquareBase64($("groupAvatarInput").files[0]);
  const groupId = await createGroup({
    creator: state.user,
    name: $("groupNameInput").value,
    description: $("groupDescriptionInput").value,
    avatarUrl,
    memberLogins: $("groupMembersInput").value.split(",").map((v) => v.trim()).filter(Boolean)
  });
  $("groupModal").close();
  const created = state.dialogs.find((d) => d.groupId === groupId);
  if (created) openDialog(created);
}

function stickToBottomIfNear() {
  const root = $("messages");
  const nearBottom = root.scrollHeight - root.scrollTop - root.clientHeight < 90;
  if (nearBottom) root.scrollTop = root.scrollHeight;
}

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

init();
