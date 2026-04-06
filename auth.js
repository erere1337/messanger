import { db, ref, get, set, update } from "./firebase.js";

export const LS_SESSION = "messenger_session_v6";

export const toKey = (value = "") => value.trim().toLowerCase();

export function isValidLogin(login) {
  return /^[a-zA-Z0-9_.-]{3,24}$/.test(login);
}

export async function hashPassword(raw) {
  const bytes = new TextEncoder().encode(raw);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function registerUser({ username, password, displayName, status, avatarUrl }) {
  const usernameKey = toKey(username);
  const userRef = ref(db, `users/${usernameKey}`);
  const exists = await get(userRef);
  if (exists.exists()) throw new Error("Логин уже занят");

  const passHash = await hashPassword(password);
  const safeDisplayName = String(displayName || username).trim().slice(0, 64);
  const safeStatus = String(status || "").trim().slice(0, 100);
  await set(userRef, {
    username,
    usernameKey,
    displayName: safeDisplayName || username,
    avatarUrl: avatarUrl || "",
    status: safeStatus,
    passHash,
    createdAt: Date.now(),
    lastSeen: Date.now()
  });

  return {
    username,
    usernameKey,
    displayName: safeDisplayName || username,
    avatarUrl: avatarUrl || "",
    status: safeStatus
  };
}

export async function loginUser(username, password) {
  const usernameKey = toKey(username);
  const snap = await get(ref(db, `users/${usernameKey}`));
  if (!snap.exists()) throw new Error("Пользователь не найден");

  const user = snap.val();
  const passHash = await hashPassword(password);
  if (passHash !== user.passHash) throw new Error("Неверный пароль");

  await update(ref(db, `users/${usernameKey}`), { lastSeen: Date.now() });
  return user;
}

export async function getUser(usernameKey) {
  const snap = await get(ref(db, `users/${usernameKey}`));
  return snap.exists() ? snap.val() : null;
}

export function saveSession(user) {
  localStorage.setItem(LS_SESSION, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(LS_SESSION);
}

export function restoreSession() {
  const raw = localStorage.getItem(LS_SESSION);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    clearSession();
    return null;
  }
}
