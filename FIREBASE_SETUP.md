# 🔥 Firebase Setup Guide

Complete guide to configure Firebase for your Elhegazi 2.0 app.

## 📋 What is Firebase?

Firebase provides:
- ✅ Authentication (Google, Email, etc.)
- ✅ Real-time Database
- ✅ Cloud Storage
- ✅ Analytics
- ✅ Push Notifications
- ✅ Hosting

## 🚀 Step 1: Create Firebase Project

1. Go to **firebase.google.com**
2. Click **"Get Started"**
3. Click **"Create a project"**
4. Enter project name: **Elhegazi-2.0**
5. Click **"Continue"**
6. Disable Google Analytics (optional)
7. Click **"Create project"**
8. Wait for project creation (1-2 minutes)

## 🔑 Step 2: Get Firebase Credentials

### For Web App:

1. In Firebase Console, click **"<>"** (Add app)
2. Select **"Web"**
3. Enter app name: **Elhegazi Web**
4. Check **"Also set up Firebase Hosting"** (optional)
5. Click **"Register app"**
6. Copy the Firebase config:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "elhegazi-2-0.firebaseapp.com",
  projectId: "elhegazi-2-0",
  storageBucket: "elhegazi-2-0.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123def456",
  measurementId: "G-ABC123DEF"
};
```

## 📝 Step 3: Add to Environment Variables

### Backend (.env or server/.env):

```env
FIREBASE_API_KEY=AIzaSy...
FIREBASE_AUTH_DOMAIN=elhegazi-2-0.firebaseapp.com
FIREBASE_PROJECT_ID=elhegazi-2-0
FIREBASE_STORAGE_BUCKET=elhegazi-2-0.appspot.com
FIREBASE_MESSAGING_SENDER_ID=123456789
FIREBASE_APP_ID=1:123456789:web:abc123def456
FIREBASE_MEASUREMENT_ID=G-ABC123DEF
```

### Frontend (.env.local):

```env
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=elhegazi-2-0.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=elhegazi-2-0
VITE_FIREBASE_STORAGE_BUCKET=elhegazi-2-0.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123def456
VITE_FIREBASE_MEASUREMENT_ID=G-ABC123DEF
```

## 🔐 Step 4: Enable Authentication

1. In Firebase Console, go to **"Authentication"**
2. Click **"Get started"**
3. Enable sign-in methods:
   - ✅ Email/Password
   - ✅ Google
   - ✅ Facebook (optional)
   - ✅ GitHub (optional)

### For Google Sign-In:

1. Click **"Google"**
2. Enable it
3. Add project support email
4. Click **"Save"**

## 💾 Step 5: Setup Firestore Database

1. Go to **"Firestore Database"**
2. Click **"Create database"**
3. Select region: **europe-west1** (or closest to you)
4. Select **"Start in production mode"**
5. Click **"Create"**

### Set Security Rules:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow authenticated users to read/write their own data
    match /users/{userId} {
      allow read, write: if request.auth.uid == userId;
    }
    
    // Allow anyone to read products
    match /products/{document=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    
    // Allow anyone to read orders
    match /orders/{document=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
  }
}
```

## 📦 Step 6: Setup Cloud Storage

1. Go to **"Storage"**
2. Click **"Get started"**
3. Select region: **europe-west1**
4. Click **"Done"**

### Set Security Rules:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Allow authenticated users to upload files
    match /uploads/{userId}/{allPaths=**} {
      allow read, write: if request.auth.uid == userId;
    }
    
    // Allow anyone to read public files
    match /public/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

## 🔔 Step 7: Setup Cloud Messaging (Optional)

For push notifications:

1. Go to **"Cloud Messaging"**
2. Click **"Create service account"**
3. Follow the steps to create a service account
4. Download the JSON key file
5. Save securely (never commit to git!)

## 📊 Step 8: Enable Analytics (Optional)

1. Go to **"Analytics"**
2. Click **"Get started"**
3. Analytics will automatically track user behavior

## 🧪 Step 9: Test Firebase Connection

### Test in Frontend:

```javascript
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
  measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

console.log('✓ Firebase initialized');
```

### Test in Backend:

```javascript
import admin from 'firebase-admin';

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  }),
});

console.log('✓ Firebase Admin initialized');
```

## 🔗 Integration with Your App

### Use Firebase Auth:

```javascript
import { signInWithGoogle } from 'firebase/auth';

// Sign in with Google
const signIn = async () => {
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  const user = result.user;
  console.log('Signed in as:', user.email);
};
```

### Use Firestore Database:

```javascript
import { collection, addDoc } from 'firebase/firestore';

// Add a product
const addProduct = async (productData) => {
  const docRef = await addDoc(collection(db, 'products'), productData);
  console.log('Product added:', docRef.id);
};
```

### Use Cloud Storage:

```javascript
import { ref, uploadBytes } from 'firebase/storage';

// Upload file
const uploadFile = async (file) => {
  const storageRef = ref(storage, `uploads/${file.name}`);
  await uploadBytes(storageRef, file);
  console.log('File uploaded');
};
```

## 📋 Deployment Checklist

- [ ] Created Firebase project
- [ ] Got Firebase credentials
- [ ] Added to .env files
- [ ] Enabled Authentication
- [ ] Setup Firestore Database
- [ ] Setup Cloud Storage
- [ ] Set security rules
- [ ] Tested Firebase connection
- [ ] Integrated with app
- [ ] Deployed to Vercel

## 🐛 Troubleshooting

### Firebase Not Initializing

**Error: "Firebase app not initialized"**
- Check environment variables are set correctly
- Verify API key is valid
- Check project ID matches

### Authentication Not Working

**Error: "Auth not available"**
- Enable authentication in Firebase Console
- Check security rules allow the operation
- Verify user is authenticated

### Firestore Queries Failing

**Error: "Permission denied"**
- Check Firestore security rules
- Verify user is authenticated
- Check collection path is correct

### Storage Upload Failing

**Error: "Storage bucket not found"**
- Enable Cloud Storage in Firebase
- Check storage bucket name
- Verify security rules allow upload

## 📚 Resources

- Firebase Docs: https://firebase.google.com/docs
- Firebase Console: https://console.firebase.google.com
- Firebase SDK: https://github.com/firebase/firebase-js-sdk
- Firestore Rules: https://firebase.google.com/docs/firestore/security/start

## 🎉 You're Ready!

Your Firebase is now configured and ready to use! 🚀

---

**Happy building with Firebase! 🔥**
