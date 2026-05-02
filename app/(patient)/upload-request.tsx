import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, Image,
    Alert, ActivityIndicator, Animated, Easing, Dimensions, ScrollView, Platform, Vibration
} from 'react-native';
import { Feather, Ionicons } from "@expo/vector-icons";
import * as ImagePicker from 'expo-image-picker';
import { readAsStringAsync } from 'expo-file-system/legacy';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur'; // If available, otherwise falls back to View
import { useAuth } from '../../hooks/useAuth';
import { extractDetailsFromImage } from '../../services/gemini';
// --- THEME ENGINE ---
const COLORS = {
    primary: "#4338CA",    // Indigo 700 (Deep/Royal)
    primaryLight: "#6366F1", // Indigo 500
    accent: "#818CF8",     // Indigo 400
    bgStart: "#F8FAFC",    // Slate 50
    bgEnd: "#EFF6FF",      // Blue 50
    surface: "#FFFFFF",
    textMain: "#0F172A",   // Slate 900
    textSub: "#64748B",    // Slate 500
    success: "#10B981",    // Emerald
    border: "#E2E8F0",
};

const { width, height } = Dimensions.get('window');

// --- COMPONENTS ---

const ScaleButton = ({ onPress, style, children, disabled }: any) => {
    const scale = useRef(new Animated.Value(1)).current;
    const onPressIn = () => Animated.spring(scale, { toValue: 0.95, useNativeDriver: true, speed: 20 }).start();
    const onPressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20 }).start();
    return (
        <TouchableOpacity
            activeOpacity={1}
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            onPress={disabled ? null : onPress}
            disabled={disabled}
        >
            <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
        </TouchableOpacity>
    );
};

// High-Tech Scanner Animation
const ScannerOverlay = ({ isScanning }: { isScanning: boolean }) => {
    const translateY = useRef(new Animated.Value(0)).current;
    const opacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (isScanning) {
            Animated.sequence([
                Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
                Animated.loop(
                    Animated.sequence([
                        Animated.timing(translateY, {
                            toValue: 300, // Viewport Height
                            duration: 1200,
                            easing: Easing.inOut(Easing.quad),
                            useNativeDriver: true,
                        }),
                        Animated.timing(translateY, {
                            toValue: 0,
                            duration: 1200,
                            easing: Easing.inOut(Easing.quad),
                            useNativeDriver: true,
                        }),
                    ])
                )
            ]).start();
        } else {
            translateY.setValue(0);
            opacity.setValue(0);
        }
    }, [isScanning]);

    if (!isScanning) return null;

    return (
        <Animated.View style={[styles.scannerOverlay, { opacity }]}>
            <LinearGradient
                colors={['rgba(99, 102, 241, 0.1)', 'rgba(99, 102, 241, 0.4)']}
                style={StyleSheet.absoluteFill}
            />
            <Animated.View style={[styles.scannerBeam, { transform: [{ translateY }] }]}>
                <LinearGradient
                    colors={['rgba(255,255,255,0)', 'rgba(99, 102, 241, 1)', 'rgba(255,255,255,0)']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={styles.beamGradient}
                />
                <View style={styles.beamLight} />
            </Animated.View>
        </Animated.View>
    );
};

export default function UploadRequestForm() {
    const router = useRouter();
    const { user } = useAuth(); // Assuming useAuth exposes user profile details
    const [uploadedImage, setUploadedImage] = useState<string | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analyzingStep, setAnalyzingStep] = useState(0); // 0: Idle, 1: Uploading, 2: OCR, 3: Success
    const [patientType, setPatientType] = useState<'me' | 'someone'>('me');

    // Mock Analysis (Replace with real call in production if needed, but we use the service)
    // We will use the proper service import in the actual implementation below

    const handlePickImage = async (mode: 'camera' | 'gallery') => {
        try {
            // Check if user is authenticated
            if (!user) {
                Alert.alert(
                    "Authentication Required",
                    "Please log in to use the Smart Scan feature.",
                    [{ text: "OK" }]
                );
                return;
            }

            const perms = mode === 'camera'
                ? await ImagePicker.requestCameraPermissionsAsync()
                : await ImagePicker.requestMediaLibraryPermissionsAsync();

            if (perms.status !== 'granted') return Alert.alert("Permission Required", "Please allow access to proceed.");

            const result = mode === 'camera'
                ? await ImagePicker.launchCameraAsync({ quality: 0.8, allowsEditing: true })
                : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });

            if (!result.canceled) {
                setUploadedImage(result.assets[0].uri);
                processImage(result.assets[0].uri);
            }
        } catch (e) {
            Alert.alert("Error", "Capture failed.");
        }
    };

    const processImage = async (uri: string) => {
        setIsAnalyzing(true);
        setAnalyzingStep(1); // Uploading

        try {
            // Simulate steps for UX
            setTimeout(() => setAnalyzingStep(2), 2000); // Extracting

            const base64 = await readAsStringAsync(uri, { encoding: 'base64' });

            // Call the client-side Gemini function
            const extracted = await extractDetailsFromImage(base64);

            if (extracted) {
                // Success block
                setAnalyzingStep(3); // Success
                if (Platform.OS !== 'web') Vibration.vibrate(50);

                // Calculate age from profile if needed
                let profileAge = user?.age;
                if (!profileAge && user?.dateOfBirth) {
                    const birthDate = new Date(user.dateOfBirth);
                    const today = new Date();
                    let age = today.getFullYear() - birthDate.getFullYear();
                    const m = today.getMonth() - birthDate.getMonth();
                    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                        age--;
                    }
                    profileAge = age.toString();
                }

                const finalData = {
                    ...extracted,
                    // Override personalized fields if 'For Me'
                    patientName: patientType === 'me'
                        ? (user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : (user?.displayName || 'Me'))
                        : extracted.patientName,
                    age: patientType === 'me' ? (profileAge || extracted.age) : extracted.age,
                    sex: patientType === 'me' ? (user?.gender || extracted.sex) : extracted.sex,

                    // Map new prompts to keys expected by UI
                    reason: extracted.reasonForVisit || extracted.reason,
                    procedure: extracted.specificScan || extracted.specifications,
                    referral: extracted.referralSource || extracted.referral,

                    // Critical: Map serviceType to scanTypes array for BookingForm auto-selection
                    scanTypes: Array.isArray(extracted.serviceType)
                        ? extracted.serviceType
                        : (extracted.serviceType ? [extracted.serviceType] : (extracted.scanTypes || [])),
                };

                setTimeout(() => {
                    Alert.alert("Scan Successful", "Request details extracted.", [
                        {
                            text: "Proceed",
                            onPress: () => router.push({
                                pathname: '/(patient)/review-request',
                                params: {
                                    extractedData: JSON.stringify(finalData),
                                    imageUri: uploadedImage
                                }
                            })
                        }
                    ]);
                }, 500);
            }
        } catch (error: any) {
            console.error(error);
            if (error.message === "GEMINI_API_KEY_MISSING") {
                Alert.alert("Configuration Error", "AI service is not configured. Please contact support.");
            } else {
                Alert.alert("Scan Failed", "Please try again with a clearer image or check your connection.");
            }
            setUploadedImage(null);
        } finally {
            setTimeout(() => {
                setIsAnalyzing(false);
                setAnalyzingStep(0);
            }, 1000);
        }
    };

    return (
        <View style={styles.root}>
            {/* Cinematic Background */}
            <LinearGradient colors={[COLORS.bgStart, COLORS.bgEnd]} style={StyleSheet.absoluteFill} />
            <View style={styles.ambientGlow} />

            <SafeAreaView style={styles.container}>

                {/* HEADER */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.push({ pathname: '/(patient)/appointments', params: { tab: 'book' } })} style={styles.backBtn}>
                        <Feather name="arrow-left" size={24} color={COLORS.textMain} />
                    </TouchableOpacity>
                    <View>
                        <Text style={styles.headerTitle}>Scan Request</Text>
                        <Text style={styles.headerSub}>AI-Powered Extraction</Text>
                    </View>
                    <View style={styles.headerBadge}>
                        <Ionicons name="sparkles" size={14} color={COLORS.primaryLight} />
                        <Text style={styles.badgeText}>Gemini AI</Text>
                    </View>
                </View>

                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >

                    {/* INSTRUCTIONS CARD */}
                    {!uploadedImage && (
                        <>
                            {/* Patient Type Toggle */}
                            <View style={styles.toggleContainer}>
                                <Text style={styles.toggleLabel}>Who is this for?</Text>
                                <View style={styles.toggleWrapper}>
                                    <TouchableOpacity
                                        style={[styles.toggleOption, patientType === 'me' && styles.toggleActive]}
                                        onPress={() => setPatientType('me')}
                                    >
                                        <Feather name="user" size={16} color={patientType === 'me' ? '#FFF' : COLORS.textSub} />
                                        <Text style={[styles.toggleText, patientType === 'me' && styles.toggleTextActive]}>For Me</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.toggleOption, patientType === 'someone' && styles.toggleActive]}
                                        onPress={() => setPatientType('someone')}
                                    >
                                        <Feather name="users" size={16} color={patientType === 'someone' ? '#FFF' : COLORS.textSub} />
                                        <Text style={[styles.toggleText, patientType === 'someone' && styles.toggleTextActive]}>Someone Else</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <View style={styles.instructionCard}>
                                <View style={styles.stepContainer}>
                                    {[
                                        { icon: 'camera', label: 'Capture', active: true },
                                        { icon: 'cpu', label: 'Analyze', active: false },
                                        { icon: 'check-circle', label: 'Verify', active: false },
                                    ].map((step, i) => (
                                        <React.Fragment key={i}>
                                            <View style={styles.stepItem}>
                                                <View style={[styles.stepIcon, step.active && styles.stepIconActive]}>
                                                    <Feather name={step.icon as any} size={18} color={step.active ? '#FFF' : COLORS.textSub} />
                                                </View>
                                                <Text style={[styles.stepLabel, step.active && styles.stepLabelActive]}>{step.label}</Text>
                                            </View>
                                            {i < 2 && <View style={styles.stepLine} />}
                                        </React.Fragment>
                                    ))}
                                </View>
                                <Text style={styles.instructionText}>
                                    {patientType === 'me'
                                        ? "We'll use your profile details for the appointment."
                                        : "We'll extract the patient's name and details from the form."}
                                </Text>
                            </View>
                        </>
                    )}

                    {/* MAIN VIEWPORT - Remainder remains similar ... */}
                    <View style={styles.viewportWrapper}>
                        <View style={styles.viewport}>
                            {uploadedImage ? (
                                <>
                                    <Image source={{ uri: uploadedImage }} style={styles.previewImage} />
                                    <ScannerOverlay isScanning={isAnalyzing} />

                                    {/* HUD LAYER */}
                                    {isAnalyzing && (
                                        <View style={styles.hudContainer}>
                                            <BlurView intensity={80} tint="light" style={styles.hudCard}>
                                                {analyzingStep === 3 ? (
                                                    <Feather name="check" size={32} color={COLORS.success} />
                                                ) : (
                                                    <ActivityIndicator size="large" color={COLORS.primary} />
                                                )}
                                                <View style={styles.hudContent}>
                                                    <Text style={styles.hudTitle}>
                                                        {analyzingStep === 1 ? 'Uploading...' :
                                                            analyzingStep === 2 ? 'Extracting Data...' :
                                                                'Complete!'}
                                                    </Text>
                                                    <Text style={styles.hudSub}>
                                                        {analyzingStep === 1 ? 'Securing connection' :
                                                            analyzingStep === 2 ? 'Gemini AI processing' :
                                                                'Redirecting you now'}
                                                    </Text>
                                                </View>
                                            </BlurView>
                                        </View>
                                    )}
                                </>
                            ) : (
                                <View style={styles.placeholderState}>
                                    <View style={styles.placeholderIcon}>
                                        <Ionicons name="scan-outline" size={48} color={COLORS.primaryLight} />
                                    </View>
                                    <Text style={styles.placeholderTitle}>Ready to Scan</Text>
                                    <Text style={styles.placeholderSub}>Tap a button below to start</Text>
                                </View>
                            )}
                        </View>

                        {/* Corner Reticles */}
                        <View style={[styles.reticle, styles.rTopLeft]} />
                        <View style={[styles.reticle, styles.rTopRight]} />
                        <View style={[styles.reticle, styles.rBottomLeft]} />
                        <View style={[styles.reticle, styles.rBottomRight]} />
                    </View>

                    {/* CONTROLS */}
                    {!isAnalyzing && (
                        <View style={styles.controlsContainer}>
                            {uploadedImage ? (
                                <ScaleButton style={styles.retakeBtn} onPress={() => setUploadedImage(null)}>
                                    <Feather name="refresh-ccw" size={20} color={COLORS.textMain} />
                                    <Text style={styles.retakeText}>Scan New Document</Text>
                                </ScaleButton>
                            ) : (
                                <View style={styles.btnRow}>
                                    <ScaleButton style={styles.galleryBtn} onPress={() => handlePickImage('gallery')}>
                                        <View style={styles.btnIconBg}>
                                            <Feather name="image" size={24} color={COLORS.primary} />
                                        </View>
                                        <Text style={styles.galleryText}>Gallery</Text>
                                    </ScaleButton>

                                    <ScaleButton style={styles.cameraBtn} onPress={() => handlePickImage('camera')}>
                                        <LinearGradient
                                            colors={[COLORS.primaryLight, COLORS.primary]}
                                            style={StyleSheet.absoluteFill}
                                            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                                        />
                                        <Feather name="camera" size={32} color="#FFF" />
                                    </ScaleButton>
                                </View>
                            )}
                        </View>
                    )}

                    <View style={{ height: 40 }} />
                </ScrollView>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1 },
    container: { flex: 1 },
    ambientGlow: {
        position: 'absolute', top: -100, right: -100, width: 400, height: 400,
        backgroundColor: 'rgba(99, 102, 241, 0.08)', borderRadius: 200,
    },

    // Header
    header: {
        flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 12,
        marginBottom: 10,
    },
    backBtn: {
        width: 44, height: 44, borderRadius: 14, backgroundColor: '#FFF',
        alignItems: 'center', justifyContent: 'center', marginRight: 16,
        shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08, shadowRadius: 12, elevation: 3, borderWidth: 1, borderColor: '#F1F5F9'
    },
    headerTitle: { fontSize: 20, fontWeight: '800', color: COLORS.textMain, letterSpacing: -0.5 },
    headerSub: { fontSize: 12, fontWeight: '600', color: COLORS.textSub },
    headerBadge: {
        marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#EEF2FF', borderRadius: 20,
        borderWidth: 1, borderColor: '#E0E7FF'
    },
    badgeText: { fontSize: 11, fontWeight: '700', color: COLORS.primary },

    scrollContent: { paddingHorizontal: 24, paddingBottom: 40 },

    // Instructions
    instructionCard: {
        backgroundColor: '#FFF', borderRadius: 24, padding: 20, marginBottom: 32,
        shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 8,
        borderWidth: 1, borderColor: '#F1F5F9'
    },
    stepContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    stepItem: { alignItems: 'center', gap: 6 },
    stepIcon: {
        width: 36, height: 36, borderRadius: 12, backgroundColor: '#F1F5F9',
        alignItems: 'center', justifyContent: 'center',
    },
    stepIconActive: { backgroundColor: COLORS.primary },
    stepLabel: { fontSize: 11, fontWeight: '600', color: COLORS.textSub },
    stepLabelActive: { color: COLORS.primary, fontWeight: '700' },
    stepLine: { width: 30, height: 2, backgroundColor: '#E2E8F0', marginBottom: 20, marginHorizontal: 8 },
    instructionText: { textAlign: 'center', color: COLORS.textSub, fontSize: 13, lineHeight: 20 },

    // Viewport
    viewportWrapper: {
        width: '100%', aspectRatio: 3 / 4, position: 'relative', marginBottom: 40,
        shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 20 },
        shadowOpacity: 0.15, shadowRadius: 30, elevation: 10,
    },
    viewport: {
        flex: 1, backgroundColor: '#F8FAFC', borderRadius: 32, overflow: 'hidden',
        borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center',
    },
    previewImage: { width: '100%', height: '100%', resizeMode: 'cover' },

    placeholderState: { alignItems: 'center', gap: 16 },
    placeholderIcon: {
        width: 80, height: 80, borderRadius: 40, backgroundColor: '#EEF2FF',
        alignItems: 'center', justifyContent: 'center',
    },
    placeholderTitle: { fontSize: 18, fontWeight: '800', color: COLORS.textMain },
    placeholderSub: { fontSize: 14, color: COLORS.textSub },

    // Reticles
    reticle: { position: 'absolute', width: 30, height: 30, borderColor: COLORS.primary, borderWidth: 4, borderRadius: 4 },
    rTopLeft: { top: -2, left: -2, borderRightWidth: 0, borderBottomWidth: 0 },
    rTopRight: { top: -2, right: -2, borderLeftWidth: 0, borderBottomWidth: 0 },
    rBottomLeft: { bottom: -2, left: -2, borderRightWidth: 0, borderTopWidth: 0 },
    rBottomRight: { bottom: -2, right: -2, borderLeftWidth: 0, borderTopWidth: 0 },

    // Scanner
    scannerOverlay: { ...StyleSheet.absoluteFillObject, overflow: 'hidden', zIndex: 10 },
    scannerBeam: { width: '100%', height: 60, alignItems: 'center', justifyContent: 'center' },
    beamGradient: { width: '100%', height: 2, opacity: 0.8 },
    beamLight: { width: '80%', height: 4, backgroundColor: '#818CF8', borderRadius: 2, opacity: 0.6, shadowColor: '#FFF', shadowOpacity: 1, shadowRadius: 10 },

    // HUD
    hudContainer: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(15, 23, 42, 0.4)' },
    hudCard: {
        flexDirection: 'row', alignItems: 'center', gap: 16, padding: 20, borderRadius: 24,
        backgroundColor: 'rgba(255,255,255,0.9)', overflow: 'hidden',
        shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 20,
    },
    hudContent: { gap: 2 },
    hudTitle: { fontSize: 16, fontWeight: '800', color: COLORS.textMain },
    hudSub: { fontSize: 12, fontWeight: '600', color: COLORS.textSub },

    // Buttons
    controlsContainer: { width: '100%', paddingHorizontal: 10 },
    btnRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },

    galleryBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 24,
        backgroundColor: '#FFF', borderRadius: 20, borderWidth: 1, borderColor: '#E2E8F0',
        shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4,
    },
    btnIconBg: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' },
    galleryText: { fontSize: 16, fontWeight: '700', color: COLORS.textMain },

    cameraBtn: {
        width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center',
        shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 10,
        marginTop: -30, borderWidth: 4, borderColor: '#FFF',
        overflow: 'hidden', // Ensures the gradient stays inside the circle
    },

    retakeBtn: {
        width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
        paddingVertical: 18, borderRadius: 20, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0',
        shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10,
    },
    retakeText: { fontSize: 16, fontWeight: '700', color: COLORS.textMain },

    // Toggle
    toggleContainer: { marginBottom: 20 },
    toggleLabel: { fontSize: 13, fontWeight: '700', color: COLORS.textMain, marginBottom: 8, paddingHorizontal: 4 },
    toggleWrapper: { flexDirection: 'row', backgroundColor: '#FFF', borderRadius: 16, padding: 4, borderWidth: 1, borderColor: '#E2E8F0' },
    toggleOption: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10, borderRadius: 12 },
    toggleActive: { backgroundColor: COLORS.primary },
    toggleText: { fontSize: 14, fontWeight: '600', color: COLORS.textSub },
    toggleTextActive: { color: '#FFF', fontWeight: '700' },
});