import React, { createContext, useState, useContext, useEffect, ReactNode, useCallback } from 'react';
import { Alert } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { db, doc, getDoc, setDoc, getAuthInstance, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, GoogleAuthProvider, signInWithCredential } from '../utils/firebaseConfig';
import * as WebBrowser from "expo-web-browser";
import { useAuthRequest } from "expo-auth-session/providers/google";
import { ANDROID_CLIENT_ID, IOS_CLIENT_ID, WEB_CLIENT_ID } from "../constants/Config";

WebBrowser.maybeCompleteAuthSession();

type AuthUser = { uid: string; email?: string | null } | null;

interface UserData {
  [key: string]: any;
}

interface AuthContextType {
  signIn: (email?: string, password?: string) => Promise<void>;
  signOut: () => Promise<void>;
  signUp: (email?: string, password?: string) => Promise<void>;
  session?: AuthUser;
  user?: UserData | null;
  isLoading: boolean;
  userType?: string | null;
  setUserType: (type: 'patient' | 'doctor') => Promise<void>;
  reloadUser: () => Promise<void>;
  promptGoogleSignIn: () => Promise<void>;
  googleAuthRequest: any;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// This hook will protect our routes
function useProtectedRoute(session: AuthUser | null | undefined, isLoading: boolean, user: UserData | null) {
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    const isModalOpen = segments[0] === '(modals)';
    const isPatientRecordScreen = segments[0] === 'patients' && segments.length > 1;
    const isOAuthRedirect = segments[0] === 'oauthredirect';

    // If a modal is open or we are viewing a specific patient's record, don't perform any navigation logic.
    if (isModalOpen || isPatientRecordScreen) {
      return;
    }
    // Exit early if authentication is still loading
    if (isLoading) {
      return;
    }

    const inAuthGroup = segments[0] === '(auth)';

    try {
      // If the user is not signed in and not in the auth group, redirect to login.
      if (!session) {
        // Allow oauthredirect to stay mounted so it can process the token
        if (!inAuthGroup && !isOAuthRedirect) {
          router.replace('/login');
        }
        return;
      }

      // --- User is signed in ---

      // If user data is still loading, wait. This can happen briefly while the user document is being fetched.
      if (!user) {
        return;
      }

      // 1. Redirect to profile completion if needed.
      // Check for false or undefined (if field is missing)
      // 1. Redirect to profile completion if needed.
      // Check for false or undefined (if field is missing)
      if (!user.profileComplete) {
        // Check last segment to avoid group name issues
        const lastSegment = segments[segments.length - 1];
        const isAtCompleteProfile = lastSegment === 'complete-profile';
        const isAtVerifyEmail = lastSegment === 'verify-email';
        const isAtVerifyPhone = lastSegment === 'verify-phone';
        const isAtRegister = lastSegment === 'register';

        if (!isAtCompleteProfile && !isAtVerifyEmail && !isAtVerifyPhone && !isAtRegister) {
          console.log('Redirecting to complete-profile');
          router.replace('/complete-profile');
        }
        return;
      }

      // 2. Redirect to user type selection if needed.
      if (!user.role || (user.role !== 'patient' && user.role !== 'doctor')) {
        const lastSegment = segments[segments.length - 1];
        const isAtUserTypeSelection = lastSegment === 'user-type-selection';
        // Also whitelist verification/register screens here so we don't jump ahead
        const isAtVerifyEmail = lastSegment === 'verify-email';
        const isAtVerifyPhone = lastSegment === 'verify-phone';
        const isAtRegister = lastSegment === 'register';

        if (!isAtUserTypeSelection && !isAtVerifyEmail && !isAtVerifyPhone && !isAtRegister) {
          console.log('Redirecting to user-type-selection. Current Role:', user.role);
          router.replace('/user-type-selection');
        }
        return;
      }

      // --- User is fully authenticated and configured ---
      const userType = user.role;
      const expectedGroup = `(${userType})`;
      const isSharedRoute = ['settings', 'appointments', 'booking', 'consultation', 'doctors', 'patients'].includes(segments[0] as string);

      // 3. If user is in an auth screen (login, signup) or oauthredirect, redirect them away to their dashboard.
      if (inAuthGroup || isOAuthRedirect) {
        if (userType === 'patient') router.replace('/(patient)');
        else if (userType === 'doctor') router.replace('/(doctor)');
        return;
      }

      // 4. If the user is on a route that doesn't match their role and is not a shared route, redirect.
      if (segments[0] !== expectedGroup && !isSharedRoute) {
        if (userType === 'patient') router.replace('/(patient)');
        else if (userType === 'doctor') router.replace('/(doctor)');
      }
    } catch (e) {
      console.warn('Navigation failed. This can happen on initial load.', e);
    }
  }, [session, isLoading, user, segments, router]);
}


export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthUser | null>(null);
  const [user, setUser] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Google Auth Request Hook - Lifted to AuthProvider to persist across navigation
  const [request, response, promptAsync] = useAuthRequest({
    iosClientId: IOS_CLIENT_ID,
    androidClientId: ANDROID_CLIENT_ID,
    webClientId: WEB_CLIENT_ID,
    scopes: ["profile", "email"],
    // Try single slash format which is sometimes required for custom schemes
    redirectUri: 'com.cooperlistic.medicare:/oauthredirect',
  });

  useEffect(() => {
    if (request) {
      console.log("Generated Redirect URI:", request.redirectUri);
    }
  }, [request]);

  // Handle Google Auth Response
  useEffect(() => {
    if (response) {
      console.log("Google Auth Response received:", JSON.stringify(response, null, 2));
    }

    if (response?.type === "success") {
      const { id_token } = response.params;

      const credential = GoogleAuthProvider.credential(id_token);

      // Set loading true while we process the sign in
      setIsLoading(true);

      getAuthInstance().then(auth => {
        signInWithCredential(auth, credential)
          .then(async (userCredential: any) => {
            console.log("Google sign-in successful with Firebase.");
            // The onAuthStateChanged listener will pick this up and handle the rest
            // But we can force a reload or check here if needed
          })
          .catch((error: any) => {
            console.error("Firebase sign-in error:", error);
            setIsLoading(false);
          });
      });
    } else if (response?.type === 'error') {
      console.error("Google Sign-In Error:", response.error);
    }
  }, [response]);

  // We use a lazily-initialized auth instance provided by utils/firebaseConfig.
  // Call getAuthInstance() where needed to ensure the React Native persistence
  // initialization (if available) has completed.

  const signOutUser = useCallback(async () => {
    setIsLoading(true);
    try {
      const authInst = await getAuthInstance();
      await signOut(authInst);
    } catch (error: any) {
      setIsLoading(false);
      console.error("Firebase Sign Out Error:", error.message);
      throw error;
    }
  }, []);

  const reloadUser = async () => {
    const authInst = await getAuthInstance();
    const currentUser = authInst.currentUser;
    if (currentUser) {
      const userRef = doc(db, "users", currentUser.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const userData = userSnap.data();
        console.log("Checking suspension for user:", currentUser.uid, userData);
        // Check for suspension
        if (userData.accountStatus === 'suspended' || userData.isSuspended === true || userData.suspended === true) {
          console.log("User is suspended. Signing out.");
          Alert.alert("Account Suspended", "Your account has been suspended. Please contact support.");
          await signOutUser();
          return;
        }
        setUser({ uid: currentUser.uid, ...userData });
      } else {
        // If the user exists in Auth but not Firestore, create a basic profile.
        // This is common for social sign-ins on first login.
        const newUser = {
          email: currentUser.email,
          createdAt: new Date().toISOString(),
          profileComplete: false, // Explicitly set profile as incomplete
        };
        await setDoc(userRef, newUser);
        setUser({ uid: currentUser.uid, ...newUser });
      }
    } else {
      setUser(null);
    }
  };

  const signIn = async (email?: string, password?: string) => {
    if (!email || !password) {
      throw new Error("Email and password are required for sign in.");
    }
    setIsLoading(true);
    try {
      const authInst = await getAuthInstance();
      await signInWithEmailAndPassword(authInst, email, password);
    } catch (error: any) {
      setIsLoading(false);
      console.error("Firebase Sign In Error:", error.message);
      throw error;
    }
  };

  const signUp = async (email?: string, password?: string) => {
    if (!email || !password) {
      throw new Error("Email and password are required for sign up.");
    }
    setIsLoading(true);
    try {
      const authInst = await getAuthInstance();
      const userCredential = await createUserWithEmailAndPassword(authInst, email, password);

      // Create user document in Firestore immediately after successful registration
      await setDoc(doc(db, "users", userCredential.user.uid), {
        email: userCredential.user.email,
        createdAt: new Date().toISOString(),
        profileComplete: false,
      });
      // onAuthStateChanged will handle setting the session and userType
    } catch (error: any) {
      setIsLoading(false);
      console.error("Firebase Sign Up Error:", error.message);
      throw error;
    }
  };

  // Function to set user type and store it in Firestore
  const setUserType = async (type: 'patient' | 'doctor') => {
    if (session) {
      try {
        setIsLoading(true);
        const userRef = doc(db, "users", session.uid);
        await setDoc(userRef, { role: type }, { merge: true });
        // After setting the type, reload the user data to get the updated profile
        await reloadUser();
        setIsLoading(false);
      } catch (error) {
        console.error("Error setting user type in Firestore:", error);
        setIsLoading(false);
        throw error;
      }
    }
  };

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let mounted = true;

    (async () => {
      const authInst = await getAuthInstance();
      if (!mounted) return;

      // Use the wrapper from firebaseConfig which handles both Native/Web modularity
      unsubscribe = onAuthStateChanged(authInst, async (user: any) => {
        setIsLoading(true);
        setSession(user);
        if (user) {
          const userRef = doc(db, "users", user.uid);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            const userData = userSnap.data();
            console.log("AuthStateChanged: Checking suspension for user:", user.uid, userData);
            if (userData.accountStatus === 'suspended' || userData.isSuspended === true || userData.suspended === true) {
              console.log("AuthStateChanged: User is suspended. Signing out.");
              Alert.alert("Account Suspended", "Your account has been suspended. Please contact support.");
              await signOutUser();
              return;
            }
            setUser({ uid: user.uid, ...userData });
          } else {
            const newUser = {
              email: user.email,
              createdAt: new Date().toISOString(),
              profileComplete: false,
            };
            await setDoc(userRef, newUser);
            setUser({ uid: user.uid, ...newUser });
          }
        } else {
          setUser(null);
        }
        setIsLoading(false);
      });

    })();

    return () => {
      mounted = false;
      if (unsubscribe) unsubscribe();
    };
  }, [signOutUser]);

  useProtectedRoute(session, isLoading, user);

  const value = {
    signIn,
    signOut: signOutUser,
    signUp,
    session,
    user,
    isLoading,
    userType: user?.role || null, // Derive userType directly from the user object
    setUserType,
    reloadUser,
    promptGoogleSignIn: async () => {
      console.log("Prompting Google Sign In...");
      if (!request) {
        console.warn("Google Auth Request is not ready yet.");
        return;
      }
      try {
        await promptAsync();
      } catch (e) {
        console.error("Failed to prompt Google Sign In:", e);
      }
    },
    googleAuthRequest: request,
  };

  // Render children only when the core auth functions are available.
  // This prevents race conditions on initial load.
  return (
    <AuthContext.Provider value={value}>
      {!isLoading && children}
    </AuthContext.Provider>
  );
}
