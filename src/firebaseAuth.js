import firebase from 'firebase/app'
import 'firebase/firestore'
import 'firebase/auth'
require('dotenv').config()

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: 'valovalorant-3a547.firebaseapp.com',
  databaseURL: 'https://valovalorant-3a547.firebaseio.com',
  projectId: 'valovalorant-3a547',
  storageBucket: 'valovalorant-3a547.appspot.com',
  messagingSenderId: '737303209890',
  appId: '1:737303209890:web:b74e7f43c3cd1e530034fb',
  measurementId: 'G-FGVH9BS241'
}

// Initialize Firebase
export const initFirebase = () => {
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig)
  }
  return firebase.firestore()
}
