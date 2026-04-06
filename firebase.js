import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import {
  getDatabase,
  ref,
  get,
  set,
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
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyBalx-yReG31BkexcSYkX6CknHh_m_St2M",
  authDomain: "messanger-b98dd.firebaseapp.com",
  databaseURL: "https://messanger-b98dd-default-rtdb.firebaseio.com",
  projectId: "messanger-b98dd",
  storageBucket: "messanger-b98dd.firebasestorage.app",
  messagingSenderId: "389022023604",
  appId: "1:389022023604:web:5e89db01e9b9fa1aa8bce1",
  measurementId: "G-VRV1YXQRP2"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export {
  db,
  ref,
  get,
  set,
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
};
