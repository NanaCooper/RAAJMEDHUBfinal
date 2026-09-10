import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Alert, ActivityIndicator } from 'react-native';
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import ScaleButton from '../ui/ScaleButton';
import { extractDetailsFromImageLocal } from '../../services/localOcr';

interface Props {
    onCancel: () => void;
    onSuccess: (extractedData: {
        patientName?: string;
        age?: string;
        phone?: string;
        scanTypes?: string[];
        specificScan?: string;
        notes?: string;
        reason?: string;
        referral?: string;
        sex?: string;
        doctorName?: string;
    }) => void;
}

const COLORS = {
    primary: "#4F46E5",
    primaryDark: "#4338CA",
    primarySoft: "#EEF2FF",
    textMain: "#0F172A",
    textSub: "#64748B",
    border: "#E2E8F0",
};

const SHADOW = {
    shadowColor: "#4F46E5",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 5,
};

export default function UploadRequestForm({ onCancel, onSuccess }: Props) {
    const [uploadedImage, setUploadedImage] = useState<string | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    const handlePickImage = async (mode: 'camera' | 'gallery') => {
        try {
            let result;
            if (mode === 'camera') {
                const { status } = await ImagePicker.requestCameraPermissionsAsync();
                if (status !== 'granted') return Alert.alert("Permission Denied", "Camera access is required.");
                result = await ImagePicker.launchCameraAsync({ quality: 0.8, allowsEditing: true });
            } else {
                const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                if (status !== 'granted') return Alert.alert("Permission Denied", "Gallery access is required.");
                result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
            }

            if (!result.canceled) {
                const imageUri = result.assets[0].uri;
                setUploadedImage(imageUri);
                setIsAnalyzing(true);

                try {
                    // Run 100% on-device OCR — no API key, no network required
                    const extracted = await extractDetailsFromImageLocal(imageUri);

                    setIsAnalyzing(false);

                    // Map to the shape BookingForm expects
                    const hasData =
                        extracted.patientName ||
                        extracted.scanTypes.length > 0 ||
                        extracted.specificScan ||
                        extracted.reasonForVisit;

                    if (hasData) {
                        Alert.alert(
                            "Scan Complete",
                            "We've extracted the details from your form. Please review and confirm.",
                        );
                        onSuccess({
                            patientName: extracted.patientName || undefined,
                            age:         extracted.age || undefined,
                            phone:       extracted.patientPhone || undefined,
                            sex:         extracted.sex || undefined,
                            scanTypes:   extracted.scanTypes.length > 0 ? extracted.scanTypes : undefined,
                            specificScan: extracted.specificScan || undefined,
                            reason:      extracted.reasonForVisit || undefined,
                            referral:    extracted.referralSource || undefined,
                            doctorName:  extracted.doctorName || undefined,
                        });
                    } else {
                        // OCR found no useful text — still allow manual entry
                        Alert.alert(
                            "Couldn't Read Form",
                            "We couldn't extract details automatically. The image has been attached — please fill in the details manually.",
                        );
                        onSuccess({});
                    }
                } catch (error: any) {
                    setIsAnalyzing(false);
                    console.error('[UploadRequestForm] OCR error:', error);
                    Alert.alert(
                        "Scan Failed",
                        "Could not read the form. The image is attached — please enter the details manually.",
                    );
                    // Still call onSuccess with empty data so the user can proceed
                    onSuccess({});
                }
            }
        } catch (e) {
            setIsAnalyzing(false);
            Alert.alert("Error", "Could not capture image.");
        }
    };

    return (
        <View style={styles.uploadContainer}>
            <TouchableOpacity onPress={onCancel} style={styles.backLink}>
                <Feather name="arrow-left" size={20} color={COLORS.primary} />
                <Text style={styles.backLinkText}>Back</Text>
            </TouchableOpacity>

            <View style={styles.uploadCard}>
                {isAnalyzing ? (
                    <View style={styles.analyzingState}>
                        <ActivityIndicator size="large" color={COLORS.primary} />
                        <Text style={styles.analyzingText}>Reading Form...</Text>
                        <Text style={styles.analyzingSub}>Extracting referral details on device</Text>
                    </View>
                ) : uploadedImage ? (
                    <Image source={{ uri: uploadedImage }} style={styles.previewImage} />
                ) : (
                    <View style={styles.uploadPlaceholder}>
                        <View style={styles.iconCircle}>
                            <Feather name="file-text" size={40} color={COLORS.primary} />
                        </View>
                        <Text style={styles.uploadTitle}>Upload Referral</Text>
                        <Text style={styles.uploadDesc}>Take a photo of your doctor's note for auto-filling.</Text>
                        <Text style={styles.uploadNote}>Works offline — no internet required</Text>
                    </View>
                )}
            </View>

            {!isAnalyzing && (
                <View style={styles.uploadActions}>
                    <ScaleButton style={[styles.actionBtn, styles.btnOutline]} onPress={() => handlePickImage('gallery')}>
                        <Feather name="image" size={20} color={COLORS.textMain} />
                        <Text style={styles.btnTextDark}>Gallery</Text>
                    </ScaleButton>
                    <ScaleButton style={[styles.actionBtn, styles.btnPrimary]} onPress={() => handlePickImage('camera')}>
                        <LinearGradient colors={[COLORS.primary, COLORS.primaryDark]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
                        <Feather name="camera" size={20} color="#FFF" />
                        <Text style={styles.btnTextLight}>Camera</Text>
                    </ScaleButton>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    uploadContainer: { flex: 1, padding: 24 },
    backLink: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
    backLinkText: { marginLeft: 8, color: COLORS.primary, fontWeight: '600' },
    uploadCard: { flex: 1, backgroundColor: '#fff', borderRadius: 30, borderWidth: 2, borderColor: '#EEF2FF', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
    uploadPlaceholder: { alignItems: 'center', paddingHorizontal: 32 },
    iconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    uploadTitle: { fontSize: 20, fontWeight: '800', color: COLORS.textMain },
    uploadDesc: { fontSize: 14, color: COLORS.textSub, textAlign: 'center', marginTop: 8, maxWidth: 220 },
    uploadNote: { fontSize: 12, color: '#10B981', textAlign: 'center', marginTop: 6, fontWeight: '600' },
    uploadActions: { flexDirection: 'row', gap: 16 },
    actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 16, gap: 8, overflow: 'hidden' },
    btnOutline: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0' },
    btnPrimary: { backgroundColor: COLORS.primary, ...SHADOW },
    btnTextDark: { fontWeight: '700', color: COLORS.textMain },
    btnTextLight: { fontWeight: '700', color: '#fff' },
    previewImage: { width: '100%', height: '100%', borderRadius: 28, resizeMode: 'cover' },
    analyzingState: { alignItems: 'center' },
    analyzingText: { marginTop: 16, fontSize: 18, fontWeight: '700', color: COLORS.textMain },
    analyzingSub: { color: COLORS.textSub, marginTop: 4, textAlign: 'center', paddingHorizontal: 24 },
});
