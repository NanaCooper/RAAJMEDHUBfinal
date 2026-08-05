import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Image, Alert, Modal } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import dayjs from 'dayjs';
import ScaleButton from '../../components/ui/ScaleButton';
import { useAuth } from '../../hooks/useAuth';
import { PROC_CT_SCAN, PROC_XRAY, PROC_MRI, PREGNANCY_WARNING } from '../../constants/AppStrings';

// --- THEME ---
const COLORS = {
    primary: "#4F46E5",
    primaryDark: "#4338CA",
    primarySoft: "#EEF2FF",
    bg: "#F8FAFC",
    surface: "#FFFFFF",
    textMain: "#0F172A",
    textSub: "#64748B",
    border: "#E2E8F0",
    success: "#10B981",
    error: "#EF4444",
};

const SHADOW = {
    shadowColor: "#4F46E5",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 5,
};

// Reuse config from BookingForm (should ideally be shared constant)
const scanTypesConfig = [
    {
        id: 'ct', name: PROC_CT_SCAN, icon: 'layers', duration: '20 min', price: 950,
        description: [
            'Wear comfortable, loose-fitting clothing.',
            'You may be asked to remove hairpins, jewelry, eyeglasses, hearing aids and any removable dental work.',
            'Do not eat or drink for a few hours before if contrast material is used.'
        ]
    },
    {
        id: 'xray', name: PROC_XRAY, icon: 'image', duration: '10 min', price: 250,
        description: [
            'Remove jewelry, eyeglasses, and any metal objects.',
            PREGNANCY_WARNING,
            'Wear standard provided attire if required.'
        ]
    },
    {
        id: 'mri', name: PROC_MRI, icon: 'disc', duration: '45 min', price: 1800,
        description: [
            'Eat and take medications as usual unless told otherwise.',
            'Remove all metal items, jewelry, and watches.',
            'Inform staff if you have a pacemaker or metal implants.'
        ]
    },
    {
        id: 'ultrasound', name: 'Standard Service D', icon: 'activity', duration: '30 min', price: 400,
        description: [
            'For abdominal scans: Fast for 8-12 hours.',
            'For pelvic scans: Drink plenty of water 1 hour before and do not empty your bladder.',
            'Wear loose clothing.'
        ]
    },
    {
        id: 'mammogram', name: 'Mammogram', icon: 'aperture', duration: '25 min', price: 350,
        description: [
            'Do not wear deodorant, talcum powder, or lotion under your arms or on your breasts.',
            'Describe any breast symptoms to the technologist.',
            'Bring prior mammogram images if available.'
        ]
    },
];

export default function ReviewRequestScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const { session, user } = useAuth(); // Get user profile data

    // Parse Params
    const extractedData = useMemo(() => {
        return params.extractedData ? JSON.parse(params.extractedData as string) : null;
    }, [params.extractedData]);

    const uploadedImageUri = params.imageUri as string;

    // State
    const [branch, setBranch] = useState(''); // Default or extract?
    const [showBranchPicker, setShowBranchPicker] = useState(false);

    // Form State (Initialized from Extracted)
    const [referral, setReferral] = useState(extractedData?.referral || '');
    const [reason, setReason] = useState(extractedData?.reason || '');
    const [procedure, setProcedure] = useState(extractedData?.procedure || '');

    // Patient Details State
    const [patientDetails, setPatientDetails] = useState({
        firstName: extractedData?.patientName ? extractedData.patientName.split(' ')[0] : (user?.firstName || 'Patient'),
        lastName: extractedData?.patientName ? extractedData.patientName.split(' ').slice(1).join(' ') : (user?.lastName || ''),
        phone: extractedData?.phone || user?.phone || '',
        age: extractedData?.age ? String(extractedData.age) : (user?.age ? String(user.age) : '')
    });

    // Scans State
    const [selectedScans, setSelectedScans] = useState<string[]>([]);
    const [previewScan, setPreviewScan] = useState<any>(null); // For info modal

    // Auto-select scans on mount
    useMemo(() => {
        if (extractedData?.scanTypes && Array.isArray(extractedData.scanTypes)) {
            const matches: string[] = [];
            extractedData.scanTypes.forEach((type: string) => {
                const lowerType = type.toLowerCase();
                const matchedScan = scanTypesConfig.find(s => lowerType.includes(s.name.toLowerCase()) || lowerType.includes(s.id));
                if (matchedScan) matches.push(matchedScan.id);
            });
            if (matches.length > 0 && selectedScans.length === 0) {
                setSelectedScans(matches);
            }
        }
    }, [extractedData]);

    const toggleScanSelection = (id: string) => {
        setSelectedScans(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
        setPreviewScan(null);
    };

    const handleConfirm = () => {
        if (selectedScans.length === 0) {
            return Alert.alert("Missing Info", "Please select at least one scan type.");
        }
        if (!branch) return Alert.alert("Missing Info", "Please select a branch.");
        if (!referral) return Alert.alert("Missing Info", "Please enter a referral source.");

        const selectedScanObjects = scanTypesConfig.filter(s => selectedScans.includes(s.id));

        const appointmentData = {
            patientId: session?.uid,
            startAt: null, // Pending scheduling
            status: 'pending',
            scanTypes: selectedScanObjects,
            specificProcedure: procedure, // Added specific procedure
            branch: branch,
            patientDetails: {
                firstName: patientDetails.firstName,
                lastName: patientDetails.lastName,
                phone: patientDetails.phone,
                age: patientDetails.age
            },
            referral: referral,
            notes: reason,
            isAiBooking: true
        };

        router.push({
            pathname: "/(modals)/booking-confirmation",
            params: { appointmentData: JSON.stringify(appointmentData) }
        });
    };

    return (
        <View style={styles.root}>
            <LinearGradient colors={[COLORS.bg, "#EEF2FF"]} style={StyleSheet.absoluteFill} />
            <SafeAreaView style={styles.safeArea}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <Feather name="arrow-left" size={24} color={COLORS.textMain} />
                    </TouchableOpacity>
                    <View>
                        <Text style={styles.headerTitle}>Review Request</Text>
                        <Text style={styles.headerSub}>Verify extracted details</Text>
                    </View>
                </View>

                <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

                    {/* Image Thumbnail & AI Badge */}
                    <View style={styles.mediaSection}>
                        {uploadedImageUri ? (
                            <Image source={{ uri: uploadedImageUri }} style={styles.thumbnail} />
                        ) : (
                            <View style={[styles.thumbnail, { backgroundColor: COLORS.border, alignItems: 'center', justifyContent: 'center' }]}>
                                <Feather name="image" size={24} color={COLORS.textSub} />
                            </View>
                        )}
                        <View style={styles.aiBadge}>
                            <Ionicons name="sparkles" size={16} color="#FFF" />
                            <Text style={styles.aiBadgeText}>AI Data Extracted</Text>
                        </View>
                    </View>



                    {/* Scans */}
                    <View style={styles.sectionNoCard}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, paddingHorizontal: 4 }}>
                            <Text style={styles.sectionTitle}>Service Type</Text>
                            <Text style={{ fontSize: 12, color: COLORS.textSub, marginLeft: 8 }}>(Tap for info)</Text>
                        </View>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingHorizontal: 4 }}>
                            {scanTypesConfig.map(scan => {
                                const isSelected = selectedScans.includes(scan.id);
                                return (
                                    <ScaleButton key={scan.id} style={[styles.scanCard, isSelected && styles.scanCardSelected]} onPress={() => setPreviewScan(scan)}>
                                        <View style={[styles.scanIcon, isSelected && { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                                            <Feather name={scan.icon as any} size={20} color={isSelected ? '#FFF' : COLORS.primary} />
                                        </View>
                                        <Text style={[styles.scanName, isSelected && { color: '#FFF' }]}>{scan.name}</Text>
                                        <Text style={[styles.scanDuration, isSelected && { color: 'rgba(255,255,255,0.7)' }]}>GHS {scan.price}</Text>
                                        {isSelected && (
                                            <View style={{ position: 'absolute', top: 10, right: 10 }}>
                                                <Feather name="check-circle" size={16} color="#FFF" />
                                            </View>
                                        )}
                                    </ScaleButton>
                                )
                            })}
                        </ScrollView>
                    </View>

                    {/* Fields */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Customer Details</Text>
                        <View style={styles.fieldRow}>
                            <View style={{ flexDirection: 'row', gap: 12 }}>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.inputLabel, { width: '100%', marginBottom: 6 }]}>First Name</Text>
                                    <TextInput
                                        style={[styles.inputField, { width: '100%' }]}
                                        value={patientDetails.firstName}
                                        onChangeText={(text) => setPatientDetails(prev => ({ ...prev, firstName: text }))}
                                        placeholder="First Name"
                                        placeholderTextColor={COLORS.textSub}
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.inputLabel, { width: '100%', marginBottom: 6 }]}>Last Name</Text>
                                    <TextInput
                                        style={[styles.inputField, { width: '100%' }]}
                                        value={patientDetails.lastName}
                                        onChangeText={(text) => setPatientDetails(prev => ({ ...prev, lastName: text }))}
                                        placeholder="Last Name"
                                        placeholderTextColor={COLORS.textSub}
                                    />
                                </View>
                            </View>
                        </View>

                        <View style={styles.fieldRow}>
                            <View style={{ flexDirection: 'row', gap: 12 }}>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.inputLabel, { width: '100%', marginBottom: 6 }]}>Phone</Text>
                                    <TextInput
                                        style={[styles.inputField, { width: '100%' }]}
                                        value={patientDetails.phone}
                                        onChangeText={(text) => setPatientDetails(prev => ({ ...prev, phone: text }))}
                                        placeholder="Phone Number"
                                        keyboardType="phone-pad"
                                        placeholderTextColor={COLORS.textSub}
                                    />
                                </View>
                                <View style={{ width: 100 }}>
                                    <Text style={[styles.inputLabel, { width: '100%', marginBottom: 6 }]}>Age</Text>
                                    <TextInput
                                        style={[styles.inputField, { width: '100%' }]}
                                        value={patientDetails.age}
                                        onChangeText={(text) => setPatientDetails(prev => ({ ...prev, age: text }))}
                                        placeholder="Age"
                                        keyboardType="numeric"
                                        placeholderTextColor={COLORS.textSub}
                                    />
                                </View>
                            </View>
                        </View>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Request Details</Text>

                        {/* Branch */}
                        <TouchableOpacity style={styles.inputField} onPress={() => setShowBranchPicker(true)}>
                            <Text style={styles.inputLabel}>Location</Text>
                            <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-between' }}>
                                <Text style={styles.inputValue}>{branch || 'Select Branch'}</Text>
                                <Feather name="chevron-down" size={18} color={COLORS.textSub} />
                            </View>
                        </TouchableOpacity>

                        {/* Specific Procedure */}
                        <View style={styles.fieldRow}>
                            <Text style={[styles.inputLabel, { width: '100%', marginBottom: 6 }]}>Specific Scan Details</Text>
                            <TextInput
                                style={[styles.inputField, { width: '100%' }]}
                                value={procedure}
                                onChangeText={setProcedure}
                                placeholder="e.g. Detailed specific request"
                                placeholderTextColor={COLORS.textSub}
                            />
                        </View>

                        {/* Referral */}
                        <View style={styles.fieldRow}>
                            <Text style={[styles.inputLabel, { width: '100%', marginBottom: 6 }]}>Referral Source</Text>
                            <TextInput
                                style={[styles.inputField, { width: '100%' }]}
                                value={referral}
                                onChangeText={setReferral}
                                placeholder="e.g. Korle Bu"
                                placeholderTextColor={COLORS.textSub}
                            />
                        </View>

                        {/* Reason */}
                        <View style={styles.fieldRow}>
                            <Text style={[styles.inputLabel, { width: '100%', marginBottom: 6 }]}>Reason for Visit</Text>
                            <TextInput
                                style={[styles.inputField, { width: '100%', height: 80, textAlignVertical: 'top' }]}
                                value={reason}
                                onChangeText={setReason}
                                placeholder="Reason for visit..."
                                multiline
                                placeholderTextColor={COLORS.textSub}
                            />
                        </View>
                    </View>

                    <View style={{ height: 100 }} />
                </ScrollView>

                {/* Bottom Bar */}
                <View style={styles.bottomBar}>
                    <ScaleButton style={styles.confirmBtn} onPress={handleConfirm}>
                        <LinearGradient colors={[COLORS.primary, COLORS.primaryDark]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} />
                        <Text style={styles.confirmBtnText}>Confirm & Book</Text>
                        <Feather name="arrow-right" size={20} color="#FFF" />
                    </ScaleButton>
                </View>
            </SafeAreaView>

            {/* Branch Picker Modal */}
            <Modal visible={showBranchPicker} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalHeader}>Select Branch</Text>
                        {['Koforidua', 'Takoradi', 'Cape Coast'].map(b => (
                            <TouchableOpacity key={b} style={styles.modalItem} onPress={() => { setBranch(b); setShowBranchPicker(false); }}>
                                <Text style={styles.modalItemText}>{b}</Text>
                                <Feather name="chevron-right" size={18} color={COLORS.textSub} />
                            </TouchableOpacity>
                        ))}
                        <TouchableOpacity style={styles.modalClose} onPress={() => setShowBranchPicker(false)}>
                            <Text style={styles.modalCloseText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Scan Info Modal (Reused) */}
            <Modal visible={!!previewScan} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        {previewScan && (
                            <>
                                <View style={{ alignItems: 'center', marginBottom: 16 }}>
                                    <View style={{ width: 56, height: 56, borderRadius: 20, backgroundColor: COLORS.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                                        <Feather name={previewScan.icon} size={28} color={COLORS.primary} />
                                    </View>
                                    <Text style={styles.modalHeader}>{previewScan.name}</Text>
                                    <Text style={{ fontSize: 18, fontWeight: '700', color: COLORS.primary }}>GHS {previewScan.price}</Text>
                                </View>

                                <View style={{ padding: 16, backgroundColor: COLORS.bg, borderRadius: 16, marginBottom: 20 }}>
                                    <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.textSub, marginBottom: 8 }}>PREPARATION</Text>
                                    <View style={{ gap: 6 }}>
                                        {Array.isArray(previewScan.description) ? (
                                            previewScan.description.map((point: string, i: number) => (
                                                <View key={i} style={{ flexDirection: 'row', gap: 8 }}>
                                                    <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: COLORS.textSub, marginTop: 8 }} />
                                                    <Text style={{ fontSize: 14, color: COLORS.textMain, lineHeight: 20, flex: 1 }}>{point}</Text>
                                                </View>
                                            ))
                                        ) : (
                                            <Text style={{ fontSize: 14, color: COLORS.textMain, lineHeight: 20 }}>{previewScan.description}</Text>
                                        )}
                                    </View>
                                </View>

                                <View style={{ gap: 10 }}>
                                    <TouchableOpacity
                                        style={[styles.modalBtn, { backgroundColor: COLORS.primary }]}
                                        onPress={() => toggleScanSelection(previewScan.id)}
                                    >
                                        <Text style={styles.modalBtnText}>
                                            {selectedScans.includes(previewScan.id) ? 'Remove Selection' : 'Select This Scan'}
                                        </Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={[styles.modalBtn, { backgroundColor: 'transparent' }]} onPress={() => setPreviewScan(null)}>
                                        <Text style={[styles.modalBtnText, { color: COLORS.textSub }]}>Close</Text>
                                    </TouchableOpacity>
                                </View>
                            </>
                        )}
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1 },
    safeArea: { flex: 1 },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 12, marginBottom: 10 },
    backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center', marginRight: 16, ...SHADOW },
    headerTitle: { fontSize: 20, fontWeight: '800', color: COLORS.textMain },
    headerSub: { fontSize: 12, fontWeight: '600', color: COLORS.textSub },

    content: { padding: 24, paddingBottom: 100 },

    mediaSection: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', padding: 12, borderRadius: 20, marginBottom: 24, ...SHADOW },
    thumbnail: { width: 60, height: 60, borderRadius: 12, backgroundColor: '#F1F5F9' },
    aiBadge: { marginLeft: 16, backgroundColor: COLORS.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 6 },
    aiBadgeText: { color: '#FFF', fontSize: 12, fontWeight: '700' },

    section: { backgroundColor: '#FFF', borderRadius: 20, padding: 20, marginBottom: 20, ...SHADOW },
    sectionNoCard: { marginBottom: 20 },
    sectionTitle: { fontSize: 16, fontWeight: '800', color: COLORS.textMain, marginBottom: 16 },

    inputField: { backgroundColor: COLORS.bg, borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 10 },
    inputValue: { fontSize: 16, color: COLORS.textMain, flex: 1, fontWeight: '500' },
    inputLabel: { fontSize: 12, color: COLORS.textSub, marginRight: 8, fontWeight: '600' },
    fieldRow: { marginBottom: 12 },

    // Scan Cards
    scanCard: { width: 130, padding: 16, backgroundColor: '#fff', borderRadius: 16, marginRight: 12, ...SHADOW },
    scanCardSelected: { backgroundColor: COLORS.primary },
    scanIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: COLORS.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
    scanName: { fontSize: 14, fontWeight: '700', color: COLORS.textMain },
    scanDuration: { fontSize: 11, color: COLORS.textSub, marginTop: 4 },

    // Bottom Bar
    bottomBar: {
        position: 'absolute', bottom: 0, left: 0, right: 0,
        backgroundColor: '#FFF', padding: 24, paddingBottom: 40,
        borderTopLeftRadius: 24, borderTopRightRadius: 24,
        shadowColor: "#000", shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 10
    },
    confirmBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 18, borderRadius: 20, gap: 8, overflow: 'hidden', ...SHADOW },
    confirmBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

    // Modals
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
    modalContent: { backgroundColor: '#fff', borderRadius: 24, padding: 20, ...SHADOW },
    modalHeader: { fontSize: 18, fontWeight: '700', color: COLORS.textMain, marginBottom: 16, textAlign: 'center' },
    modalItem: { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border, flexDirection: 'row', justifyContent: 'space-between' },
    modalItemText: { fontSize: 16, color: COLORS.textMain, fontWeight: '500' },
    modalClose: { marginTop: 16, alignItems: 'center', padding: 10 },
    modalCloseText: { color: COLORS.primary, fontWeight: '700' },
    modalBtn: { paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
    modalBtnText: { color: '#FFF', fontWeight: '700', fontSize: 16 },
});
