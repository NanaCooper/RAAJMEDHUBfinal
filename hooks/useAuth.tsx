import React, { createContext, useState, useContext, useEffect, ReactNode, useCallback } from 'react';
import { Alert } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { db, doc, getDoc, setDoc, getAuthInstance, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, GoogleAuthProvider, signInWithCredential } from '../utils/firebaseConfig';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { WEB_CLIENT_ID } from "../constants/Config";

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
      if (user.profileComplete === false) {
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
      // IMPORTANT: Protect admin/superadmin roles — they must NEVER be overwritten
      // by the mobile app. These roles are set directly in the database and should
      // remain intact regardless of what the mobile onboarding flow does.
      const PROTECTED_ROLES = ['superadmin', 'admin', 'Admin', 'ADMIN', 'administrator', 'reception', 'frontdesk', 'admin_capecoast', 'admin_koforidua', 'admin_takoradi'];
      const isProtectedAdmin = user.role && PROTECTED_ROLES.includes(user.role);

      if (isProtectedAdmin) {
        // Admin accounts have no valid destination in the mobile app.
        // Sign them out gracefully and show a clear message.
        if (!inAuthGroup) {
          Alert.alert(
            'Admin Account Detected',
            'This account is configured as an administrator. Please use the admin web portal instead. You will be signed out now.',
            [
              {
                text: 'OK',
                onPress: async () => {
                  try {
                    const authInst = await getAuthInstance();
                    await signOut(authInst);
                  } catch (e) {
                    console.warn('Sign out failed:', e);
                  }
                  router.replace('/login');
                },
              },
            ],
            { cancelable: false }
          );
        }
        return;
      }

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

      // 3. (Removed hospital selection enforcement to keep onboarding neutral)

      const expectedGroup = `(${userType})`;
      const isSharedRoute = ['settings', 'appointments', 'booking', 'consultation', 'doctors', 'patients'].includes(segments[0] as string);

      // 4. If user is in an auth screen (login, signup) or oauthredirect, redirect them away to their dashboard.
      if (inAuthGroup || isOAuthRedirect) {
        const lastSegment = segments[segments.length - 1];

        if (lastSegment === 'user-type-selection') {
          // Stay on user-type-selection so they can change their role if they want to
          return;
        }
        if (userType === 'patient') router.replace('/(patient)');
        else if (userType === 'doctor') router.replace('/(doctor)');
        return;
      }

      // 5. If the user is on a route that doesn't match their role and is not a shared route, redirect.
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

  // Configure native Google Sign-In on mount
  useEffect(() => {
    try {
      if (!WEB_CLIENT_ID) {
        console.warn(
          'Google Sign-In is not configured (missing EXPO_PUBLIC_WEB_CLIENT_ID). Skipping GoogleSignin.configure to avoid startup crash.'
        );
        return;
      }

      GoogleSignin.configure({
        webClientId: WEB_CLIENT_ID,
        offlineAccess: true,
      });
    } catch (e) {
      console.warn('Google Sign-In configure failed:', e);
    }
  }, []);

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
      try {
        const userRef = doc(db, "users", currentUser.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const userData = userSnap.data() as UserData;
          console.log("Checking suspension for user:", currentUser.uid, userData);
          if (userData.accountStatus === 'suspended' || userData.isSuspended === true || userData.suspended === true) {
            console.log("User is suspended. Signing out.");
            Alert.alert("Account Suspended", "Your account has been suspended. Please contact support.");
            await signOutUser();
            return;
          }
          const finalUserData = {
            uid: currentUser.uid,
            ...(userData as any),
            fullName: userData.fullName || userData.name || currentUser.displayName || "",
          };
          setUser(finalUserData);
        } else {
          // No users doc — check if they exist in the doctors collection
          // (doctors added from the admin web portal land here).
          const doctorRef = doc(db, "doctors", currentUser.uid);
          const doctorSnap = await getDoc(doctorRef);
          if (doctorSnap.exists()) {
            const doctorData = doctorSnap.data() as any;
            console.log("[reloadUser] Found doctor record. Bootstrapping users doc.");
            const bootstrapped: any = {
              uid: currentUser.uid,
              email: currentUser.email || doctorData.email || null,
              fullName: doctorData.name || doctorData.fullName || currentUser.displayName || "",
              role: 'doctor',
              profileComplete: true,
              specialty: doctorData.specialty || "",
              branch: doctorData.branch || "",
              hospitalName: doctorData.hospitalName || "",
              phone: doctorData.phone || doctorData.contact || "",
              createdAt: doctorData.createdAt || new Date().toISOString(),
              _source: 'doctors',
            };
            // Write back to users collection so future lookups are fast
            await setDoc(userRef, bootstrapped, { merge: true });
            setUser(bootstrapped);
          } else {
            // Truly new user — start the onboarding flow
            const newUser = {
              email: currentUser.email,
              createdAt: new Date().toISOString(),
              profileComplete: false,
            };
            await setDoc(userRef, newUser);
            setUser({ uid: currentUser.uid, ...newUser });
          }
        }
      } catch (error) {
        console.error("Error in reloadUser:", error);
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

        // Safety check: never overwrite a protected admin role.
        // This prevents any mobile onboarding flow from clobbering admin accounts.
        const snap = await getDoc(userRef);
        if (snap.exists()) {
          const existingRole = snap.data()?.role as string | undefined;
          const PROTECTED_ROLES = ['superadmin', 'admin', 'Admin', 'ADMIN', 'administrator', 'reception', 'frontdesk', 'admin_capecoast', 'admin_koforidua', 'admin_takoradi'];
          if (existingRole && PROTECTED_ROLES.includes(existingRole)) {
            console.warn('[useAuth] Blocked attempt to overwrite protected role:', existingRole, '→', type);
            setIsLoading(false);
            Alert.alert(
              'Permission Denied',
              'This is an administrator account. The role cannot be changed from the mobile app.'
            );
            return;
          }
        }

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
          try {
            const userRef = doc(db, "users", user.uid);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
              const userData = userSnap.data() as UserData;
              console.log("AuthStateChanged: Checking suspension for user:", user.uid, userData);
              if (userData.accountStatus === 'suspended' || userData.isSuspended === true || userData.suspended === true) {
                console.log("AuthStateChanged: User is suspended. Signing out.");
                Alert.alert("Account Suspended", "Your account has been suspended. Please contact support.");
                await signOutUser();
                return;
              }
              const finalUserData = {
                uid: user.uid,
                ...(userData as any),
                fullName: userData.fullName || userData.name || user.displayName || "",
              };
              setUser(finalUserData);
            } else {
              // No users doc — check if they exist in the doctors collection
              // (doctors added from the admin web portal land here).
              const doctorRef = doc(db, "doctors", user.uid);
              const doctorSnap = await getDoc(doctorRef);
              if (doctorSnap.exists()) {
                const doctorData = doctorSnap.data() as any;
                console.log("[onAuthStateChanged] Found doctor record. Bootstrapping users doc.");
                const bootstrapped: any = {
                  uid: user.uid,
                  email: user.email || doctorData.email || null,
                  fullName: doctorData.name || doctorData.fullName || user.displayName || "",
                  role: 'doctor',
                  profileComplete: true,
                  specialty: doctorData.specialty || "",
                  branch: doctorData.branch || "",
                  hospitalName: doctorData.hospitalName || "",
                  phone: doctorData.phone || doctorData.contact || "",
                  createdAt: doctorData.createdAt || new Date().toISOString(),
                  _source: 'doctors',
                };
                // Write back so future logins are instant
                await setDoc(userRef, bootstrapped, { merge: true });
                setUser(bootstrapped);
              } else {
                const newUser = {
                  email: user.email,
                  createdAt: new Date().toISOString(),
                  profileComplete: false,
                };
                await setDoc(userRef, newUser);
                setUser({ uid: user.uid, ...newUser });
              }
            }
          } catch (error) {
            console.error("Error fetching or initializing user profile in AuthStateChanged:", error);
            // Fallback to basic session info to prevent a black screen or loader hang
            setUser({
              uid: user.uid,
              email: user.email,
              profileComplete: false,
            });
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
      console.log("Google Sign In button pressed");
      try {
        await GoogleSignin.hasPlayServices();
        
        // Force account picker by signing out first (standard RN Google Signin pattern)
        try {
          await GoogleSignin.signOut();
        } catch {
          // Ignore if not signed in
        }

        const userInfo = await GoogleSignin.signIn();
        const idToken = userInfo.data?.idToken;
        if (!idToken) throw new Error('No ID token returned');
        const credential = GoogleAuthProvider.credential(idToken);
        setIsLoading(true);
        const auth = await getAuthInstance();
        await signInWithCredential(auth, credential);
        console.log("Google sign-in successful with Firebase.");
      } catch (error: any) {
        if (error.code === statusCodes.SIGN_IN_CANCELLED) {
          console.log('User cancelled the sign-in flow.');
        } else if (error.code === statusCodes.IN_PROGRESS) {
          console.log('Sign-in is already in progress.');
        } else {
          console.error('Google Sign-In Error:', error);
          Alert.alert('Sign-In Error', 'Could not sign in with Google. Please try again.');
        }
        setIsLoading(false);
      }
    },
    googleAuthRequest: null,
  };

  // Render children only when the core auth functions are available.
  // This prevents race conditions on initial load.
  return (
    <AuthContext.Provider value={value}>
      {!isLoading && children}
    </AuthContext.Provider>
  );
}
