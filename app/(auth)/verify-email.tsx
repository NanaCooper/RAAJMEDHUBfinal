import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { checkEmailVerificationStatus, sendVerificationEmail } from '../../utils/authHelpers';
import { getRemainingCooldown } from '../../utils/rateLimiter';
import { auth } from '../../utils/firebaseConfig';
import { useAuth } from '../../hooks/useAuth';

const COLORS = {
    bg: "#F8FAFC",
    surface: "#FFFFFF",
    primary: "#4F46E5",
    textMain: "#1E293B",
    textSec: "#64748B",
    success: "#10B981",
    border: "#E2E8F0",
};

export default function VerifyEmailScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const { session } = useAuth(); // Assuming this gives us the current user state
    const email = (params.email as string) || session?.email || auth.currentUser?.email;

    const [loading, setLoading] = useState(false);
    const [resendCooldown, setResendCooldown] = useState(0);
    const [verifying, setVerifying] = useState(false);
    const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        // Start polling for verification status
        startPolling();

        // Check initial cooldown
        checkCooldown();

        return () => stopPolling();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const checkCooldown = async () => {
        if (email) {
            const remaining = await getRemainingCooldown(email, 'email');
            setResendCooldown(remaining);
        }
    };

    useEffect(() => {
        let interval: ReturnType<typeof setInterval>;
        if (resendCooldown > 0) {
            interval = setInterval(() => {
                setResendCooldown((prev) => Math.max(0, prev - 1));
            }, 1000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [resendCooldown]);

    const startPolling = () => {
        stopPolling();
        pollTimer.current = setInterval(async () => {
            const { verified } = await checkEmailVerificationStatus();
            if (verified) {
                setVerifying(true);
                stopPolling();
                setTimeout(() => {
                    router.replace('/complete-profile');
                }, 1500);
            }
        }, 3000); // Check every 3 seconds
    };

    const stopPolling = () => {
        if (pollTimer.current) {
            clearInterval(pollTimer.current);
            pollTimer.current = null;
        }
    };

    const handleResend = async () => {
        if (!auth.currentUser) return;
        setLoading(true);
        const result = await sendVerificationEmail(auth.currentUser);
        setLoading(false);

        if (result.success) {
            setResendCooldown(60);
        } else {
            // Handle error (maybe show toast or alert)
            console.warn(result.message);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                <View style={styles.iconContainer}>
                    <Feather name="mail" size={48} color={COLORS.primary} />
                </View>

                <Text style={styles.title}>Verify your email</Text>
                <Text style={styles.subtitle}>
                    We&apos;ve sent a verification email to:
                </Text>
                <Text style={styles.emailText}>{email}</Text>
                <Text style={styles.instruction}>
                    Please click the link in the email to verify your account.
                    This screen will automatically update once verified.
                </Text>

                <View style={styles.spamNote}>
                    <Feather name="info" size={14} color={COLORS.textSec} />
                    <Text style={styles.spamText}>
                        Can&apos;t find it? Check your <Text style={{fontWeight: '700'}}>Spam</Text> or Junk folder.
                    </Text>
                </View>

                {verifying && (
                    <View style={styles.successContainer}>
                        <Feather name="check-circle" size={24} color={COLORS.success} />
                        <Text style={styles.successText}>Email Verified! Redirecting...</Text>
                    </View>
                )}

                <View style={styles.actions}>
                    <TouchableOpacity
                        style={[styles.resendBtn, (loading || resendCooldown > 0) && styles.disabledBtn]}
                        onPress={handleResend}
                        disabled={loading || resendCooldown > 0}
                    >
                        {loading ? <ActivityIndicator color={COLORS.primary} /> : (
                            <Text style={styles.resendText}>
                                {resendCooldown > 0 ? `Resend email in ${resendCooldown}s` : "Resend Verification Email"}
                            </Text>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.backBtn}
                        onPress={() => router.back()}
                    >
                        <Text style={styles.backText}>Back to Sign Up</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.bg },
    content: { flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center' },
    iconContainer: {
        width: 100, height: 100, borderRadius: 50, backgroundColor: '#EEF2FF',
        alignItems: 'center', justifyContent: 'center', marginBottom: 24
    },
    title: { fontSize: 24, fontWeight: '800', color: COLORS.textMain, marginBottom: 12 },
    subtitle: { fontSize: 16, color: COLORS.textSec, marginBottom: 4 },
    emailText: { fontSize: 18, fontWeight: '600', color: COLORS.textMain, marginBottom: 24 },
    instruction: { fontSize: 14, color: COLORS.textSec, textAlign: 'center', marginBottom: 32, lineHeight: 22 },

    successContainer: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 24 },
    successText: { color: COLORS.success, fontWeight: '700', fontSize: 16 },

    actions: { width: '100%', gap: 12 },
    resendBtn: {
        backgroundColor: 'white', borderWidth: 1, borderColor: COLORS.primary,
        padding: 16, borderRadius: 12, alignItems: 'center'
    },
    disabledBtn: {
        opacity: 0.5, borderColor: COLORS.border
    },
    resendText: { color: COLORS.primary, fontWeight: '600' },

    backBtn: { padding: 16, alignItems: 'center' },
    backText: { color: COLORS.textSec, fontWeight: '500' },
    spamNote: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#F1F5F9',
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 10,
        marginBottom: 32,
    },
    spamText: {
        fontSize: 13,
        color: COLORS.textSec,
    }
});
