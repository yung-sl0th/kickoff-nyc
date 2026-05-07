npm install firebase
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyA4odkb0jGHn5S9DFJClwqBYBQ6v9lopkA",
  authDomain: "kickoff-nyc.firebaseapp.com",
  databaseURL: "https://kickoff-nyc-default-rtdb.firebaseio.com",
  projectId: "kickoff-nyc",
  storageBucket: "kickoff-nyc.firebasestorage.app",
  messagingSenderId: "761636239204",
  appId: "1:761636239204:web:f80672fd25b4214fc2ec71",
  measurementId: "G-LZ5DXQLP9N"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);


