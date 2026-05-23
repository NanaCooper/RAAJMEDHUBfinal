import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    Pressable
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import { getRemainingCooldown, recordVerificationSent, canSendVerification } from '../../utils/rateLimiter';
import { sendPhoneVerificationCode } from '../../utils/authHelpers';


const COLORS = {
    bg: "#F8FAFC",
    surface: "#FFFFFF",
    primary: "#4F46E5",
    textMain: "#1E293B",
    textSec: "#64748B",
    border: "#E2E8F0",
    success: "#10B981",
    danger: "#EF4444",
    inputBg: "#F1F5F9",
};

export default function VerifyPhoneScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const phoneNumber = params.phoneNumber as string;
    // For Native Auth, the 'confirm' method is on the confirmationResult object, 
    // which we can't pass easily via params string. 
    // In a real native flow, we often keep this safely in a global store or context.
    // However, since we are just triggering the SMS here or coming from register,
    // we need to know IF we already have a confirmation object or if we need to request one.

    // BUT: register.tsx calls `sendPhoneVerificationCode` which returns `confirmationResult`.
    // We can't pass the function object via route params (it's not serializable).
    // WORKAROUND: We will trigger the verification code fetch HERE in this screen if it's not present,
    // OR we should have used a context. 
    // For simplicity in this migration: We will re-trigger the SMS send when this screen mounts
    // IF we don't have a way to access the previous result. 
    // actually, simpler: The `register.tsx` should probably just navigate here, and WE send the code here.
    // Let's adjust `register.tsx` next to NOT send code, but just navigate here.

    const [confirm, setConfirm] = useState<FirebaseAuthTypes.ConfirmationResult | null>(null);
    const [code, setCode] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [resendCooldown, setResendCooldown] = useState(0);

    const inputRef = useRef<TextInput>(null);

    useEffect(() => {
        // Auto-send verification code on mount
        sendVerification();

        // Auto-focus input
        setTimeout(() => inputRef.current?.focus(), 500);
    }, []);

    const sendVerification = async () => {
        if (!phoneNumber) return;
        setLoading(true);
        setError(null);
        try {
            const result = await sendPhoneVerificationCode(phoneNumber);
            if (result.success && result.confirmationResult) {
                setConfirm(result.confirmationResult);
                // Start cooldown
                const remaining = await getRemainingCooldown(phoneNumber, 'phone');
                setResendCooldown(remaining);
            } else {
                setError(result.message || "Failed to send verification code.");
            }
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (resendCooldown > 0) {
            interval = setInterval(() => {
                setResendCooldown((prev) => Math.max(0, prev - 1));
            }, 1000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [resendCooldown]);

    const handleVerify = async () => {
        if (code.length !== 6 || !confirm) return;
        setLoading(true);
        setError(null);

        try {
            await confirm.confirm(code);
            // User is now signed in
            router.replace('/complete-profile');
        } catch (err: any) {
            console.error("Verification error:", err);
            setError("Invalid code. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        if (resendCooldown > 0) return;
        await sendVerification();
    };

    // Auto-submit when code is 6 digits
    useEffect(() => {
        if (code.length === 6) {
            handleVerify();
        }
    }, [code]);

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={styles.flex}
            >
                <View style={styles.content}>
                    <TouchableOpacity
                        onPress={() => {
                            if (router.canGoBack()) {
                                router.back();
                            } else {
                                router.replace('/register');
                            }
                        }}
                        style={styles.backButton}
                    >
                        <Feather name="arrow-left" size={24} color={COLORS.textMain} />
                    </TouchableOpacity>

                    <Text style={styles.title}>Verify Phone Number</Text>
                    <Text style={styles.subtitle}>
                        Enter the 6-digit code sent to
                    </Text>
                    <Text style={styles.phoneText}>{phoneNumber}</Text>

                    {error && (
                        <View style={styles.errorContainer}>
                            <Feather name="alert-circle" size={16} color={COLORS.danger} />
                            <Text style={styles.errorText}>{error}</Text>
                        </View>
                    )}

                    <View style={styles.inputWrapper}>
                        <InputBoxes code={code} />
                        <TextInput
                            ref={inputRef}
                            value={code}
                            onChangeText={(t) => {
                                if (t.length <= 6 && /^\d*$/.test(t)) setCode(t);
                            }}
                            style={styles.hiddenInput}
                            keyboardType="number-pad"
                            caretHidden
                        />
                    </View>

                    <TouchableOpacity
                        style={[styles.verifyBtn, (code.length !== 6 || loading) && styles.disabledBtn]}
                        onPress={handleVerify}
                        disabled={code.length !== 6 || loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <Text style={styles.verifyBtnText}>Verify Code</Text>
                        )}
                    </TouchableOpacity>

                    <View style={styles.resendContainer}>
                        <Text style={styles.resendLabel}>Didn't receive the code?</Text>
                        <TouchableOpacity
                            onPress={handleResend}
                            disabled={resendCooldown > 0 || loading}
                        >
                            <Text style={[styles.resendLink, resendCooldown > 0 && styles.disabledLink]}>
                                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend Code"}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const InputBoxes = ({ code }: { code: string }) => {
    return (
        <View style={styles.boxContainer}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
                <View key={i} style={[styles.box, code.length === i && styles.activeBox]}>
                    <Text style={styles.boxText}>{code[i] || ""}</Text>
                </View>
            ))}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.bg },
    flex: { flex: 1 },
    content: { flex: 1, padding: 24, paddingTop: 60 },
    backButton: { marginBottom: 32 },
    title: { fontSize: 28, fontWeight: '800', color: COLORS.textMain, marginBottom: 8 },
    subtitle: { fontSize: 16, color: COLORS.textSec },
    phoneText: { fontSize: 18, fontWeight: '700', color: COLORS.textMain, marginBottom: 32 },

    inputWrapper: { position: 'relative', marginBottom: 32, height: 60 },
    hiddenInput: {
        position: 'absolute', width: '100%', height: '100%', opacity: 0, zIndex: 2
    },
    boxContainer: {
        flexDirection: 'row', justifyContent: 'space-between', width: '100%'
    },
    box: {
        width: 48, height: 56, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border,
        backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center'
    },
    activeBox: { borderColor: COLORS.primary, borderWidth: 2 },
    boxText: { fontSize: 24, fontWeight: '700', color: COLORS.textMain },

    verifyBtn: {
        backgroundColor: COLORS.primary, height: 56, borderRadius: 14,
        alignItems: 'center', justifyContent: 'center', marginBottom: 24
    },
    disabledBtn: { opacity: 0.7, backgroundColor: COLORS.textSec },
    verifyBtnText: { color: 'white', fontSize: 16, fontWeight: '700' },

    resendContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
    resendLabel: { color: COLORS.textSec },
    resendLink: { color: COLORS.primary, fontWeight: '700' },
    disabledLink: { color: COLORS.textSec },

    errorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF5F5',
        borderRadius: 12,
        padding: 12,
        marginBottom: 20,
        borderLeftWidth: 4,
        borderLeftColor: COLORS.danger,
    },
    errorText: { color: COLORS.danger, fontSize: 13, marginLeft: 8, flex: 1 },
});
