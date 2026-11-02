
import { initializeApp } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js";

import {
    getAuth,
    signInAnonymously
} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js";

import {
    getDatabase,
    ref,
    get,
    set,
    onValue,
    runTransaction
} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyDTWCcFA9lOTmJe-IVgLVJAes9TfgJGWH4",
    authDomain: "diwali-dash-nipuni.firebaseapp.com",
    databaseURL: "https://diwali-dash-nipuni-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "diwali-dash-nipuni",
    storageBucket: "diwali-dash-nipuni.firebasestorage.app",
    messagingSenderId: "22913996645",
    appId: "1:22913996645:web:e0b4551dccdd633305f38c",
    measurementId: "G-SVVZ3M93RK"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const database = getDatabase(app);

export const authReady = signInAnonymously(auth);

export {
    ref,
    get,
    set,
    onValue,
    runTransaction
};
