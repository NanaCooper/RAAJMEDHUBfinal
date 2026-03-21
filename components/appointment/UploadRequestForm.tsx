import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Alert, ActivityIndicator } from 'react-native';
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { LinearGradient } from 'expo-linear-gradient';
import ScaleButton from '../ui/ScaleButton';
import { scanMedicalRequest } from '../../services/gemini';

interface Props {
    onCancel: () => void;
    onSuccess: (notes: string) => void;
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
                result = await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: true });
            } else {
                const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                if (status !== 'granted') return Alert.alert("Permission Denied", "Gallery access is required.");
                result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
            }

            if (!result.canceled) {
                const imageUri = result.assets[0].uri;
                setUploadedImage(imageUri);
                setIsAnalyzing(true);

                try {
                    // Convert image to Base64
                    const base64 = await FileSystem.readAsStringAsync(imageUri, {
                        encoding: 'base64',
                    });

                    // Call the Cloud Function
                    const response: any = await scanMedicalRequest(base64);

                    setIsAnalyzing(false);

                    if (response.success && response.data) {
                        const data = response.data;
                        // Format the extracted data into notes
                        let notes = 'Extracted from medical form:\n\n';
                        if (data.patientName) notes += `Patient: ${data.patientName}\n`;
                        if (data.age) notes += `Age: ${data.age}\n`;
                        if (data.dateOfBirth) notes += `DOB: ${data.dateOfBirth}\n`;
                        if (data.scanType) notes += `Scan Type: ${data.scanType}\n`;
                        if (data.urgency) notes += `Urgency: ${data.urgency}\n`;
                        if (data.notes) notes += `\nNotes: ${data.notes}`;

                        Alert.alert("Analysis Complete", "We've extracted the details from your form.");
                        onSuccess(notes);
                    } else {
                        throw new Error('Failed to extract data');
                    }
                } catch (error: any) {
                    setIsAnalyzing(false);
                    console.error('Scanning error:', error);
                    Alert.alert(
                        "Scanning Failed",
                        error.message || "Could not analyze the form. Please try again or enter details manually."
                    );
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
                        <Text style={styles.analyzingText}>Scanning Document...</Text>
                        <Text style={styles.analyzingSub}>Extracting referral details</Text>
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
    uploadPlaceholder: { alignItems: 'center' },
    iconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    uploadTitle: { fontSize: 20, fontWeight: '800', color: COLORS.textMain },
    uploadDesc: { fontSize: 14, color: COLORS.textSub, textAlign: 'center', marginTop: 8, maxWidth: 200 },
    uploadActions: { flexDirection: 'row', gap: 16 },
    actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 16, gap: 8, overflow: 'hidden' },
    btnOutline: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0' },
    btnPrimary: { backgroundColor: COLORS.primary, ...SHADOW },
    btnTextDark: { fontWeight: '700', color: COLORS.textMain },
    btnTextLight: { fontWeight: '700', color: '#fff' },
    previewImage: { width: '100%', height: '100%', borderRadius: 28, resizeMode: 'cover' },
    analyzingState: { alignItems: 'center' },
    analyzingText: { marginTop: 16, fontSize: 18, fontWeight: '700', color: COLORS.textMain },
    analyzingSub: { color: COLORS.textSub },
});
