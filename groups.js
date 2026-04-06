import { db, ref, push, set, update } from "./firebase.js";
import { toKey } from "./auth.js";

export async function createGroup({ creator, name, description, avatarUrl, memberLogins }) {
  const groupRef = push(ref(db, "groups"));
  const groupId = groupRef.key;
  const members = { [creator.usernameKey]: true };
  memberLogins
    .map((x) => toKey(x))
    .filter(Boolean)
    .filter((x) => x !== creator.usernameKey)
    .forEach((x) => { members[x] = true; });

  await set(groupRef, {
    name: name.trim(),
    description: String(description || "").trim(),
    avatarUrl: avatarUrl || "",
    creatorId: creator.usernameKey,
    members,
    createdAt: Date.now()
  });

  const preview = {
    type: "group",
    groupId,
    name: name.trim(),
    description: String(description || "").trim(),
    avatarUrl: avatarUrl || "",
    lastMessage: "Группа создана",
    lastAt: Date.now()
  };

  const updates = {};
  Object.keys(members).forEach((userId) => {
    updates[`userChats/${userId}/${groupId}`] = preview;
  });
  await update(ref(db), updates);
  return groupId;
}
