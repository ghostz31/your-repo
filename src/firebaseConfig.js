import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyBppFcsFtrrhEcW0c5EURvka1i2iVDrCNg",
    authDomain: "brinko-a38b5.firebaseapp.com",
    projectId: "brinko-a38b5",
    storageBucket: "brinko-a38b5.appspot.com",
    messagingSenderId: "872391078712",
    appId: "1:872391078712:web:391035595e6ae7798e07cd",
    measurementId: "G-QXC85GYMV0"
  };

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);