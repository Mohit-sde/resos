"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, googleProvider, db } from '../lib/firebase/config';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  updatePassword,
  updateEmail,
  updateProfile,
  reauthenticateWithCredential,
  EmailAuthProvider,
  deleteUser,
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

const DEFAULT_ROLE = 'user';

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [appUser, setAppUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // ─── Build the base user doc shape ───────────────────────────────────────
  const buildUserDoc = (user, role = DEFAULT_ROLE, additionalData = {}) => ({
    email: user.email,
    name: additionalData.name || user.displayName || '',
    age: additionalData.age ?? null,
    orders: {
      past: [],
      live: [],
    },
    cart: [],
    address: additionalData.address || '',
    paymentMethods: [],
    role, // Role comes from parameter, not hardcoded email mapping
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // ─── Sign up with email and password ─────────────────────────────────────
  const signup = async (email, password, additionalData = {}) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    if (additionalData.name) {
      await updateProfile(user, { displayName: additionalData.name });
    }

    // Use role from additionalData or default to 'user'
    const role = additionalData.role || DEFAULT_ROLE;
    const userDocRef = doc(db, 'realtime-users', user.email);
    await setDoc(userDocRef, buildUserDoc(user, role, additionalData));

    // Immediately set appUser so we don't wait for onAuthStateChanged
    setAppUser(buildUserDoc(user, role, additionalData));
    return userCredential;
  };

  // ─── Sign in with email and password ─────────────────────────────────────
  const login = async (email, password) => {
    return signInWithEmailAndPassword(auth, email, password);
  };

  // ─── Sign in / sign up with Google ────────────────────────────────────────
  const loginWithGoogle = async () => {
    const credential = await signInWithPopup(auth, googleProvider);
    const user = credential.user;

    const userDocRef = doc(db, 'realtime-users', user.email);
    const userDoc = await getDoc(userDocRef);

    if (!userDoc.exists()) {
      // First-time Google sign-in — create their profile doc with default 'user' role
      await setDoc(userDocRef, buildUserDoc(user, DEFAULT_ROLE));
    }
    // If doc exists, ensureUserDoc will load it

    return credential;
  };

  // ─── Sign out ──────────────────────────────────────────────────────────
  const logout = async () => {
    return signOut(auth);
  };

  // ─── Send password reset email ────────────────────────────────────────
  const resetPassword = async (email) => {
    return sendPasswordResetEmail(auth, email);
  };

  // ─── Re-authenticate (required by Firebase before sensitive changes) ───
  const reauthenticate = async (currentPassword) => {
    if (!currentUser || !currentUser.email) {
      throw new Error('No user is currently logged in');
    }
    const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
    return reauthenticateWithCredential(currentUser, credential);
  };

  // ─── Update password for current user ───────────────────────────────────
  const changePassword = async (newPassword, currentPassword) => {
    if (!currentUser) {
      throw new Error('No user is currently logged in');
    }
    if (currentPassword) {
      await reauthenticate(currentPassword);
    }
    return updatePassword(currentUser, newPassword);
  };

  // ─── Update email for current user ───────────────────────────────────────
  const changeEmail = async (newEmail, currentPassword) => {
    if (!currentUser) {
      throw new Error('No user is currently logged in');
    }
    const oldEmail = currentUser.email;
    if (currentPassword) {
      await reauthenticate(currentPassword);
    }
    await updateEmail(currentUser, newEmail);

    // Move the Firestore doc since it's keyed by email.
    const oldDocRef = doc(db, 'realtime-users', oldEmail);
    const oldDoc = await getDoc(oldDocRef);
    if (oldDoc.exists()) {
      const newDocRef = doc(db, 'realtime-users', newEmail);
      await setDoc(newDocRef, { ...oldDoc.data(), email: newEmail, updatedAt: new Date() });
    }
  };

  // ─── Update display name / profile fields ────────────────────────────────
  const updateUserProfile = async (updates = {}) => {
    if (!currentUser) {
      throw new Error('No user is currently logged in');
    }
    if (updates.name !== undefined) {
      await updateProfile(currentUser, { displayName: updates.name });
    }
    const userDocRef = doc(db, 'realtime-users', currentUser.email);
    await setDoc(userDocRef, { ...updates, updatedAt: new Date() }, { merge: true });
  };

  // ─── Delete account ────────────────────────────────────────────────────
  const deleteAccount = async (currentPassword) => {
    if (!currentUser) {
      throw new Error('No user is currently logged in');
    }
    if (currentPassword) {
      await reauthenticate(currentPassword);
    }
    return deleteUser(currentUser);
  };

  // ─── Fetch and set user doc from Firestore ────────────────────────────
  const ensureUserDoc = async (user) => {
    if (user?.email) {
      try {
        const userDocRef = doc(db, 'realtime-users', user.email);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          // User doc exists — use its role as-is (no hardcoded overrides)
          setAppUser(userDoc.data());
        } else {
          // New user, shouldn't happen in normal flow but handle it
          const defaultUserDoc = buildUserDoc(user, DEFAULT_ROLE);
          await setDoc(userDocRef, defaultUserDoc);
          setAppUser(defaultUserDoc);
        }
      } catch (error) {
        console.error('Error fetching user document:', error);
        setAppUser(null);
      }
    } else {
      setAppUser(null);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        await ensureUserDoc(user);
      } else {
        setAppUser(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    appUser,
    loading,
    signup,
    login,
    loginWithGoogle,
    logout,
    resetPassword,
    changePassword,
    changeEmail,
    updateUserProfile,
    deleteAccount,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};