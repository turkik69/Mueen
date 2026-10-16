// Bundle the same SDK used by the website so the native shell starts offline.
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/database';
window.firebase = firebase;
