import { db, ref, update } from "./firebase.js";

export const avatarPlaceholder =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='96' height='96'%3E%3Crect width='100%25' height='100%25' fill='%23f7f6f3'/%3E%3Ctext x='50%25' y='52%25' dominant-baseline='middle' text-anchor='middle' fill='%23787774' font-size='26' font-family='Arial'%3E%F0%9F%91%A4%3C/text%3E%3C/svg%3E";

export function withAvatar(url) {
  return url || avatarPlaceholder;
}

export function fileToSquareBase64(file) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve("");
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const size = Math.min(image.width, image.height);
        const sx = Math.floor((image.width - size) / 2);
        const sy = Math.floor((image.height - size) / 2);
        const canvas = document.createElement("canvas");
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(image, sx, sy, size, size, 0, 0, 256, 256);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      image.onerror = () => reject(new Error("Ошибка чтения изображения"));
      image.src = reader.result;
    };
    reader.onerror = () => reject(new Error("Ошибка чтения файла"));
    reader.readAsDataURL(file);
  });
}

export async function updateProfile(usernameKey, payload) {
  await update(ref(db, `users/${usernameKey}`), payload);
}
