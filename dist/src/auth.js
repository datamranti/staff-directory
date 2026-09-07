import { STAFF_DIRECTORY_CONFIG } from './config.js';

let auth;
let currentUser = null;

function emailDomain(email = '') {
  return String(email).trim().toLowerCase().split('@').pop();
}

function assertAllowedUser(user) {
  if (!user?.email || emailDomain(user.email) !== STAFF_DIRECTORY_CONFIG.ALLOWED_DOMAIN) {
    throw new Error(`Only @${STAFF_DIRECTORY_CONFIG.ALLOWED_DOMAIN} accounts may access the Staff Directory.`);
  }
  return user;
}

export function initializeAuth() {
  if (!window.firebase) throw new Error('Firebase could not be loaded. Check your internet connection and try again.');
  if (!firebase.apps.length) firebase.initializeApp(STAFF_DIRECTORY_CONFIG.FIREBASE);
  auth = firebase.auth();
  auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(() => {});
  return auth;
}

export function onUserChanged(callback) {
  if (!auth) initializeAuth();
  return auth.onAuthStateChanged(async user => {
    try {
      if (user) {
        assertAllowedUser(user);
        currentUser = user;
        callback(user, null);
      } else {
        currentUser = null;
        callback(null, null);
      }
    } catch (error) {
      currentUser = null;
      await auth.signOut().catch(() => {});
      callback(null, error);
    }
  });
}

export async function signIn() {
  if (!auth) initializeAuth();
  const provider = new firebase.auth.GoogleAuthProvider();
  provider.addScope('email');
  provider.addScope('profile');
  provider.setCustomParameters({ hd: STAFF_DIRECTORY_CONFIG.ALLOWED_DOMAIN, prompt: 'select_account' });
  const result = await auth.signInWithPopup(provider);
  return assertAllowedUser(result.user);
}

export async function signOut() {
  if (!auth) return;
  await auth.signOut();
}

export async function getIdToken(forceRefresh = false) {
  if (!currentUser) throw new Error('Your Staff Directory session has expired. Please sign in again.');
  return currentUser.getIdToken(forceRefresh);
}

export function getCurrentUser() {
  return currentUser;
}
