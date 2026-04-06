import {
  db,
  ref,
  get,
  update,
  push,
  remove,
  query,
  orderByChild,
  startAt,
  endAt,
  limitToLast,
  onValue,
  onDisconnect,
  serverTimestamp
} from "./firebase.js";
import { toKey } from "./auth.js";

export function privateChatId(a, b) {
  return [toKey(a), toKey(b)].sort().join("__");
}

function chatMessagePath(chat) {
  return chat.type === "group" ? `groups/${chat.groupId}/messages` : `chats/${chat.chatId}/messages`;
}

export async function setPresence(user) {
  const pRef = ref(db, `presence/${user.usernameKey}`);
  await update(pRef, { online: true, lastSeen: serverTimestamp(), username: user.username });
  onDisconnect(pRef).update({ online: false, lastSeen: serverTimestamp() });
}

export async function searchUsersByPrefix(prefix, meKey) {
  const term = toKey(prefix);
  if (term.length < 2) return [];
  const q = query(ref(db, "users"), orderByChild("usernameKey"), startAt(term), endAt(`${term}\uf8ff`), limitToLast(30));
  const snap = await get(q);
  return Object.values(snap.val() || {})
    .filter((u) => u.usernameKey !== meKey)
    .map((u) => ({
      username: u.username,
      usernameKey: u.usernameKey,
      displayName: u.displayName || u.username,
      avatarUrl: u.avatarUrl || "",
      status: u.status || ""
    }));
}

export function subscribeDialogs(userKey, callback) {
  return onValue(ref(db, `userChats/${userKey}`), (snap) => {
    const rows = Object.values(snap.val() || {})
      .filter((x) => !x.hidden)
      .sort((a, b) => (b.lastAt || 0) - (a.lastAt || 0));
    callback(rows);
  });
}

export function subscribePresence(userKey, callback) {
  return onValue(ref(db, `presence/${userKey}`), (snap) => callback(snap.val() || null));
}

export function subscribeTyping(chat, callback) {
  const path = chat.type === "group" ? `typing/group_${chat.groupId}` : `typing/${chat.chatId}`;
  return onValue(ref(db, path), (snap) => callback(snap.val() || {}));
}

export function subscribeMessages(chat, callback, limit = 40) {
  const q = query(ref(db, chatMessagePath(chat)), limitToLast(limit));
  return onValue(q, (snap) => {
    const rows = Object.entries(snap.val() || {})
      .map(([id, value]) => ({ id, ...value }))
      .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    callback(rows);
  });
}

export async function sendMessage({ chat, me, text, forwarded = false, originalSender = "" }) {
  const clean = text.trim();
  if (!clean) return;
  const createdAt = Date.now();
  const payload = {
    text: clean,
    from: me.usernameKey,
    fromName: me.displayName || me.username,
    createdAt,
    status: "sent",
    forwarded,
    originalSender
  };

  const messagesPath = chatMessagePath(chat);
  await push(ref(db, messagesPath), payload);

  if (chat.type === "private") {
    const myPreview = {
      type: "private",
      chatId: chat.chatId,
      peer: chat.peer,
      peerKey: toKey(chat.peer),
      peerName: chat.peerName,
      peerAvatar: chat.peerAvatar || "",
      lastMessage: clean.slice(0, 120),
      lastAt: createdAt
    };
    const peerPreview = {
      ...myPreview,
      peer: me.username,
      peerKey: me.usernameKey,
      peerName: me.displayName || me.username,
      peerAvatar: me.avatarUrl || ""
    };
    await update(ref(db), {
      [`userChats/${me.usernameKey}/${chat.chatId}`]: myPreview,
      [`userChats/${toKey(chat.peer)}/${chat.chatId}`]: peerPreview,
      [`users/${me.usernameKey}/lastSeen`]: createdAt
    });
  } else {
    const preview = {
      type: "group",
      groupId: chat.groupId,
      name: chat.name,
      description: chat.description || "",
      avatarUrl: chat.avatarUrl || "",
      lastMessage: clean.slice(0, 120),
      lastAt: createdAt
    };
    const membersSnap = await get(ref(db, `groups/${chat.groupId}/members`));
    const members = membersSnap.val() || {};
    const batch = {};
    Object.keys(members).forEach((uid) => {
      batch[`userChats/${uid}/${chat.groupId}`] = preview;
    });
    await update(ref(db), batch);
  }
}

export async function markTyping(chat, userKey, active) {
  const path = chat.type === "group" ? `typing/group_${chat.groupId}/${userKey}` : `typing/${chat.chatId}/${userKey}`;
  if (active) {
    await update(ref(db, path), { value: true, at: Date.now() });
  } else {
    await remove(ref(db, path));
  }
}

export async function hideChatForUser(userKey, chatId) {
  await update(ref(db, `userChats/${userKey}/${chatId}`), { hidden: true });
}

export async function deleteMessageForAll(chat, messageId) {
  await remove(ref(db, `${chatMessagePath(chat)}/${messageId}`));
}

export async function deleteMessageForMe(userKey, chatId, messageId) {
  await update(ref(db), {
    [`hiddenMessages/${userKey}/${chatId}/${messageId}`]: true
  });
}

export async function getHiddenMessages(userKey, chatId) {
  const snap = await get(ref(db, `hiddenMessages/${userKey}/${chatId}`));
  return snap.val() || {};
}
