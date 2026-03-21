import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import {
    db,
    doc,
    setDoc,
    getDoc
} from './firebaseConfig';
import { canSendVerification, recordVerificationSent } from './rateLimiter';

// Internal domain for phone-based accounts to allow password linking
const INTERNAL_DOMAIN = '@medicare.internal';

// --- Types ---
export interface ProfileData {
    firstName: string;
    lastName: string;
    middleName?: string;
    dob: string;
    sex: string;
    phone?: string;
    role: string;
}

export interface AuthResponse {
    success: boolean;
    user?: FirebaseAuthTypes.User;
    error?: string;
    message?: string;
    confirmationResult?: FirebaseAuthTypes.ConfirmationResult;
}

// --- Helpers ---

export function isEmail(input: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input);
}

export function validatePhoneNumber(phoneNumber: string): boolean {
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    return phoneRegex.test(phoneNumber.replace(/\s/g, ''));
}

export function formatPhoneNumber(input: string): string {
    let clean = input.replace(/\s+/g, '');
    // Convert Ghana local format to international if applicable (Custom rule from user request)
    if (clean.startsWith('0')) {
        return '+233' + clean.substring(1);
    }
    if (!clean.startsWith('+') && clean.length > 0) {
        return '+' + clean;
    }
    return clean;
}

function getAuthErrorMessage(error: any): string {
    // Common auth errors
    if (!error) return 'An unknown error occurred.';
    const code = error.code || '';

    switch (code) {
        case 'auth/email-already-in-use':
            return 'This email is already registered. Please sign in.';
        case 'auth/invalid-email':
            return 'Invalid email address.';
        case 'auth/weak-password':
            return 'Password should be at least 6 characters.';
        case 'auth/user-not-found':
            return 'No account found with this email/phone.';
        case 'auth/wrong-password':
            return 'Invalid credentials.';
        case 'auth/too-many-requests':
            return 'Too many failed attempts. Please try again later.';
        case 'auth/invalid-phone-number':
            return 'Invalid phone number format.';
        case 'auth/quota-exceeded':
            return 'SMS quota exceeded. Try email instead.';
        case 'auth/invalid-verification-code':
            return 'Invalid verification code.';
        case 'auth/code-expired':
            return 'Code has expired. Request a new one.';
        case 'email-not-verified':
            return 'Email not verified yet. Please check your inbox.';
        default:
            return error.message || 'Authentication failed.';
    }
}

async function checkSuspension(uid: string): Promise<boolean> {
    const collections = ['users', 'doctors', 'patients'];
    for (const col of collections) {
        try {
            const ref = doc(db, col, uid);
            const snap = await getDoc(ref);
            if (snap.exists() && snap.data().suspended === true) {
                return true;
            }
        } catch (e) {
            // Ignore read errors, proceed
        }
    }
    return false;
}

// --- Email Logic ---

export async function signUpWithEmail(
    email: string,
    pass: string
): Promise<AuthResponse> {
    try {
        const userCredential = await auth().createUserWithEmailAndPassword(email, pass);
        const user = userCredential.user;

        // Send verification
        await sendVerificationEmail(user);

        return {
            success: true,
            user,
            message: 'Account created! Please check your email to verify.'
        };
    } catch (error: any) {
        return {
            success: false,
            error: error.code,
            message: getAuthErrorMessage(error)
        };
    }
}

export async function sendVerificationEmail(user: FirebaseAuthTypes.User): Promise<AuthResponse> {
    try {
        const canSend = await canSendVerification(user.email || 'unknown', 'email');
        if (!canSend.allowed) {
            return {
                success: false,
                message: `Please wait ${canSend.remainingSeconds}s before resending.`
            };
        }

        await user.sendEmailVerification();
        await recordVerificationSent(user.email || 'unknown', 'email');

        return { success: true, message: 'Verification email sent.' };
    } catch (error: any) {
        return { success: false, message: getAuthErrorMessage(error) };
    }
}

export async function checkEmailVerificationStatus(): Promise<{ verified: boolean; user?: FirebaseAuthTypes.User }> {
    try {
        const user = auth().currentUser;
        if (!user) return { verified: false };
        await user.reload();
        return { verified: user.emailVerified, user };
    } catch (e) {
        return { verified: false };
    }
}

// --- Phone Logic ---

export async function sendPhoneVerificationCode(
    phoneNumber: string
): Promise<AuthResponse> {
    try {
        const formatted = formatPhoneNumber(phoneNumber);
        if (!validatePhoneNumber(formatted)) {
            return { success: false, message: 'Invalid phone number format.' };
        }

        const canSend = await canSendVerification(formatted, 'phone');
        if (!canSend.allowed) {
            return {
                success: false,
                message: `Please wait ${canSend.remainingSeconds}s before resending.`
            };
        }

        const confirmation = await auth().signInWithPhoneNumber(formatted);
        await recordVerificationSent(formatted, 'phone');

        return {
            success: true,
            confirmationResult: confirmation as any // Type assertion for compatibility if needed
        };
    } catch (error: any) {
        return {
            success: false,
            error: error.code,
            message: getAuthErrorMessage(error)
        };
    }
}

export async function verifyPhoneCode(
    confirmationResult: any,
    code: string
): Promise<AuthResponse> {
    try {
        const result = await confirmationResult.confirm(code);
        return {
            success: true,
            user: result.user
        };
    } catch (error: any) {
        return {
            success: false,
            error: error.code,
            message: getAuthErrorMessage(error)
        };
    }
}

export async function linkPhoneWithPassword(
    phoneNumber: string,
    password: string
): Promise<AuthResponse> {
    try {
        const user = auth().currentUser;
        if (!user) return { success: false, message: 'No user signed in' };

        const formatted = formatPhoneNumber(phoneNumber);
        const internalEmail = `${formatted}${INTERNAL_DOMAIN}`;

        const credential = auth.EmailAuthProvider.credential(internalEmail, password);
        await user.linkWithCredential(credential);

        return { success: true };
    } catch (error: any) {
        // If the credential already exists, we might want to just update password or ignore
        // But for fresh users it should be fine.
        return { success: false, message: error.message };
    }
}

// --- Universal Sign In ---

export async function signInUniversal(identifier: string, password: string): Promise<AuthResponse> {
    try {
        let userCredential;
        let isPhone = false;

        if (isEmail(identifier)) {
            userCredential = await auth().signInWithEmailAndPassword(identifier, password);
        } else {
            // Assume phone
            isPhone = true;
            const formatted = formatPhoneNumber(identifier);
            const internalEmail = `${formatted}${INTERNAL_DOMAIN}`;
            userCredential = await auth().signInWithEmailAndPassword(internalEmail, password);
        }

        const user = userCredential.user;

        // Check suspension
        if (await checkSuspension(user.uid)) {
            await auth().signOut();
            return { success: false, error: 'account-suspended', message: 'Account is suspended.' };
        }

        // Check verification if email
        // Note: Phone users are verified by default via OTP to get here, 
        // unless they just signed in with password. 
        // Ideally we assume if they can sign in with password they are verified.
        // BUT for email, we strictly enforce it.
        if (!isPhone && !user.emailVerified) {
            await auth().signOut();
            return {
                success: false,
                error: 'email-not-verified',
                message: 'Email not verified. Please check your inbox.'
            };
        }

        return { success: true, user };

    } catch (error: any) {
        return { success: false, error: error.code, message: getAuthErrorMessage(error) };
    }
}
