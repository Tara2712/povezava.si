import { createContext, useContext, useEffect, useState } from 'react'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  updateProfile,
  updateEmail,
  updatePassword,
} from 'firebase/auth'

import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { auth, storage } from '../firebase'

const AuthContext = createContext(null)

const googleProvider = new GoogleAuthProvider()

googleProvider.setCustomParameters({
  prompt: "select_account"
})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u)
      setLoading(false)
    })
    return unsub
  }, [])

  function register(email, password, name) {
    return createUserWithEmailAndPassword(auth, email, password)
      .then((cred) =>
        updateProfile(cred.user, {
          displayName: name,
        })
      )
  }

  function login(email, password) {
    return signInWithEmailAndPassword(auth, email, password)
  }

  function loginWithGoogle() {
    return signInWithPopup(auth, googleProvider)
  }

  function logout() {
    return signOut(auth)
  }

  async function updateUserProfile({ displayName, photoFile }) {
    const updates = {}

    if (displayName !== undefined)
      updates.displayName = displayName

    if (photoFile) {
      const storageRef = ref(
        storage,
        `profile-photos/${auth.currentUser.uid}`
      )

      await uploadBytes(storageRef, photoFile)
      updates.photoURL = await getDownloadURL(storageRef)
    }
    await updateProfile(auth.currentUser, updates)

    setUser(
      Object.assign(
        Object.create(Object.getPrototypeOf(auth.currentUser)),
        auth.currentUser
      )
    )
  }

  async function updateUserEmail(newEmail) {
    await updateEmail(auth.currentUser, newEmail)

    setUser(
      Object.assign(
        Object.create(Object.getPrototypeOf(auth.currentUser)),
        auth.currentUser
      )
    )
  }

  async function updateUserPassword(newPassword) {
    await updatePassword(auth.currentUser, newPassword)
  }

  if (loading) return null

  return (
    <AuthContext.Provider
      value={{
        user,
        register,
        login,
        loginWithGoogle,
        logout,
        updateUserProfile,
        updateUserEmail,
        updateUserPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}