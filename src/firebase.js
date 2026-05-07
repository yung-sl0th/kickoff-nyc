import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyA4odkb0jGHn5S9DFJClwqBYBQ6v9lopkA",
  authDomain: "kickoff-nyc.firebaseapp.com",
  projectId: "kickoff-nyc",
  storageBucket: "kickoff-nyc.firebasestorage.app",
  messagingSenderId: "761636239204",
  appId: "1:761636239204:web:f80672fd25b4214fc2ec71"
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const googleProvider = new GoogleAuthProvider()
export const db = getFirestore(app)



