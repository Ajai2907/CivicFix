//// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyBACd0QOEiH_ISuL1XuHrjgIYi7FN7batg",
    authDomain: "civicfix-31e49.firebaseapp.com",
    projectId: "civicfix-31e49",
    storageBucket: "civicfix-31e49.firebasestorage.app",
    messagingSenderId: "494985883466",
    appId: "1:494985883466:web:f9a6f497b238e2ed709bb3"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize Firestore
const db = firebase.firestore();

console.log("✅ Firebase Connected Successfully");