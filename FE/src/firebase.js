import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: "AIzaSyD7cOoc0EBMP9dxt65p99TZcUi9kBYI8rg",
  authDomain: "povezava-si.firebaseapp.com",
  projectId: "povezava-si",
  storageBucket: "povezava-si.firebasestorage.app",
  messagingSenderId: "182132401045",
  appId: "1:182132401045:web:8cca0930e4fd542f728c9c"
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const storage = getStorage(app)
