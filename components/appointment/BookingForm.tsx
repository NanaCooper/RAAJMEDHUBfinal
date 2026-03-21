import React, { useState, useMemo, useEffect } from "react";
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    Modal,
    ScrollView,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
} from "react-native";
import { fetchMinPricesPerCategory, ProcedureMinPrices } from '../../services/procedures';
import { Calendar } from 'react-native-calendars';
import moment from 'moment-timezone';
import { useForm, Controller, SubmitHandler } from 'react-hook-form';
import { useRouter } from 'expo-router';
import * as yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
import { Feather } from "@expo/vector-icons";
import DateTimePicker from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../hooks/useAuth';
import ScaleButton from '../ui/ScaleButton';

// --- Theme Constants ---
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

// --- Types ---
interface Props {
    onCancel: () => void;
    isDoctorBooking?: boolean;
    // We now receive a flexible extractedData object instead of just a notes string
    extractedData?: {
        patientName?: string;
        age?: string;
        phone?: string;
        scanTypes?: string[];
        specificScan?: string;
        notes?: string;
        urgency?: string;
        reason?: string;
        referral?: string;
    } | null;
}

// Updated Config
const scanTypesConfig = [
    {
        id: 'ct', name: 'CT Scan', icon: 'layers', duration: '20 min', price: 950,
        description: [
            'Wear comfortable, loose-fitting clothing.',
            'You may be asked to remove hairpins, jewelry, eyeglasses, hearing aids and any removable dental work.',
            'Do not eat or drink for a few hours before if contrast material is used.'
        ]
    },
    {
        id: 'xray', name: 'X-Ray', icon: 'image', duration: '10 min', price: 250,
        description: [
            'Remove jewelry, eyeglasses, and any metal objects.',
            'Tell your doctor if you are pregnant.',
            'Wear a hospital gown if required.'
        ]
    },
    {
        id: 'mri', name: 'MRI', icon: 'disc', duration: '45 min', price: 1800,
        description: [
            'Eat and take medications as usual unless told otherwise.',
            'Remove all metal items, jewelry, and watches.',
            'Inform staff if you have a pacemaker or metal implants.'
        ]
    },
    {
        id: 'ultrasound', name: 'Ultrasound', icon: 'activity', duration: '30 min', price: 400,
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

export default function BookingForm({ onCancel, extractedData, isDoctorBooking = false }: Props) {
    const router = useRouter();
    const { session, user } = useAuth();

    // State
    const [selectedScans, setSelectedScans] = useState<string[]>([]);
    const [minPrices, setMinPrices] = useState<ProcedureMinPrices>({});
    const [pricesLoading, setPricesLoading] = useState(true);
    const [bookingFor, setBookingFor] = useState<'me' | 'other'>('me');
    const [patientSex, setPatientSex] = useState<string>('');

    // UI State
    const [showBranchPicker, setShowBranchPicker] = useState(false);
    const [showSexPicker, setShowSexPicker] = useState(false);
    const [previewScan, setPreviewScan] = useState<any>(null); // For showing description/price

    // Fetch live minimum prices from Firestore
    useEffect(() => {
        let active = true;
        setPricesLoading(true);
        fetchMinPricesPerCategory()
            .then((prices) => { if (active) setMinPrices(prices); })
            .catch(() => { /* silently fall back to hardcoded prices */ })
            .finally(() => { if (active) setPricesLoading(false); });
        return () => { active = false; };
    }, []);

    /** Returns a formatted price range string e.g. "GHS 200 – 950" or "GHS 200".
     *  Always returns a plain string — safe to use directly as a React child. */
    const getPriceText = (scan: typeof scanTypesConfig[0]): string => {
        const liveRange = minPrices[scan.id];
        const lo: number = (liveRange?.min != null) ? liveRange.min : scan.price;
        const hi: number | null = (liveRange?.max != null && liveRange.max !== liveRange.min) ? liveRange.max : null;
        return hi !== null ? `GHS ${lo} \u2013 ${hi}` : `GHS ${lo}`;
    };

    // Dynamic Schema
    const formSchema = useMemo(() => {
        const needsPatientFields = isDoctorBooking || bookingFor === 'other';
        return yup.object().shape({
            branch: yup.string().required('Required'),
            referral: yup.string().optional(),
            specificScan: yup.string().optional(),
            notes: yup.string().optional(),
            patientFirstName: needsPatientFields ? yup.string().required('First Name is required') : yup.string().optional(),
            patientLastName: needsPatientFields ? yup.string().required('Last Name is required') : yup.string().optional(),
            patientPhone: needsPatientFields ? yup.string().required('Phone is required') : yup.string().optional(),
            patientAge: needsPatientFields ? yup.string().required('Age is required') : yup.string().optional(),
        });
    }, [isDoctorBooking, bookingFor]);

    // Initialize form with extracted data
    const defaultValues = useMemo(() => {
        let firstName = '';
        let lastName = '';
        if (extractedData?.patientName) {
            const parts = extractedData.patientName.trim().split(' ');
            if (parts.length > 0) firstName = parts[0];
            if (parts.length > 1) lastName = parts.slice(1).join(' ');
        }

        return {
            branch: '',
            referral: extractedData?.referral || '',
            specificScan: extractedData?.specificScan || '',
            notes: extractedData?.reason || extractedData?.notes || '',
            patientFirstName: firstName,
            patientLastName: lastName,
            patientPhone: extractedData?.phone || '',
            patientAge: extractedData?.age || '',
        };
    }, [extractedData]);

    const { control, handleSubmit, setValue, formState: { errors } } = useForm({
        defaultValues,
        resolver: yupResolver(formSchema)
    });

    // Auto-select scans
    useMemo(() => {
        if (extractedData?.scanTypes && Array.isArray(extractedData.scanTypes)) {
            const matches: string[] = [];
            extractedData.scanTypes.forEach((type: string) => {
                const lowerType = type.toLowerCase();
                const matchedScan = scanTypesConfig.find(s => lowerType.includes(s.name.toLowerCase()) || lowerType.includes(s.id));
                if (matchedScan) matches.push(matchedScan.id);
            });
            if (matches.length > 0) setSelectedScans(prev => prev.length === 0 ? matches : prev);
        }
    }, [extractedData]);



    const toggleScanSelection = (id: string) => {
        setSelectedScans(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
        setPreviewScan(null);
    };

    const onConfirm: SubmitHandler<any> = async (values) => {
        if (selectedScans.length === 0) {
            return Alert.alert("Incomplete", "Please select at least one scan type.");
        }

        const selectedScanObjects = scanTypesConfig.filter(s => selectedScans.includes(s.id));
        const isForOther = !isDoctorBooking && bookingFor === 'other';

        const appointmentData = {
            patientId: isDoctorBooking ? null : session?.uid,
            doctorId: isDoctorBooking ? session?.uid : null,
            bookedForOther: isForOther,
            startAt: null,
            status: 'pending',
            scanTypes: selectedScanObjects,
            branch: values.branch,
            patientDetails: isForOther ? {
                firstName: values.patientFirstName,
                lastName: values.patientLastName,
                phone: values.patientPhone,
                age: values.patientAge,
                sex: patientSex,
            } : isDoctorBooking ? {
                firstName: values.patientFirstName,
                lastName: values.patientLastName,
                phone: values.patientPhone,
                age: values.patientAge,
                sex: patientSex,
            } : {
                firstName: user?.firstName || user?.fullName?.split(' ')[0] || session?.email?.split('@')[0] || 'Patient',
                lastName: user?.lastName || user?.fullName?.split(' ').slice(1).join(' ') || '',
                phone: user?.phone || '',
                age: user?.age || '',
                sex: user?.sex || '',
            },
            referral: isDoctorBooking ? `Dr. ${user?.fullName || user?.firstName || 'Doctor'}` : values.referral,
            specificScan: values.specificScan,
            notes: values.notes,
            isAiBooking: !!extractedData,
            createdByRole: isDoctorBooking ? 'doctor' : 'patient'
        };

        router.push({
            pathname: "/(modals)/booking-confirmation",
            params: { appointmentData: JSON.stringify(appointmentData) }
        });
    };

    return (
        <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
        >
            <ScrollView
                contentContainerStyle={styles.formContainer}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                <TouchableOpacity onPress={onCancel} style={styles.backLink}>
                    <Feather name="arrow-left" size={20} color={COLORS.primary} />
                    <Text style={styles.backLinkText}>Back</Text>
                </TouchableOpacity>

                {/* For Me / For Someone Else toggle (patient mode only) */}
                {!isDoctorBooking && (
                    <View style={styles.forWhomContainer}>
                        <TouchableOpacity
                            style={[styles.forWhomTab, bookingFor === 'me' && styles.forWhomTabActive]}
                            onPress={() => setBookingFor('me')}
                            activeOpacity={0.8}
                        >
                            <Feather name="user" size={15} color={bookingFor === 'me' ? COLORS.primary : COLORS.textSub} />
                            <Text style={[styles.forWhomTabText, bookingFor === 'me' && styles.forWhomTabTextActive]}>For Me</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.forWhomTab, bookingFor === 'other' && styles.forWhomTabActive]}
                            onPress={() => setBookingFor('other')}
                            activeOpacity={0.8}
                        >
                            <Feather name="users" size={15} color={bookingFor === 'other' ? COLORS.primary : COLORS.textSub} />
                            <Text style={[styles.forWhomTabText, bookingFor === 'other' && styles.forWhomTabTextActive]}>For Someone Else</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Patient Details - shown when booking for someone else OR in doctor mode */}
                {(isDoctorBooking || bookingFor === 'other') && (
                    <View style={styles.sectionCard}>
                        <Text style={styles.sectionTitle}>
                            {isDoctorBooking ? 'Patient Details' : "Patient's Details"}
                        </Text>

                        <View style={{ flexDirection: 'row', gap: 12 }}>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.inputLabel, { width: '100%', marginBottom: 6 }]}>First Name</Text>
                                <Controller control={control} name="patientFirstName" render={({ field: { onChange, value } }) => (
                                    <TextInput style={[styles.inputField, { marginBottom: 4 }]} value={value} onChangeText={onChange} placeholder="First Name" placeholderTextColor={COLORS.textSub} />
                                )} />
                                {errors.patientFirstName && <Text style={{ color: COLORS.error, fontSize: 11, marginBottom: 8 }}>{errors.patientFirstName.message as string}</Text>}
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.inputLabel, { width: '100%', marginBottom: 6 }]}>Last Name</Text>
                                <Controller control={control} name="patientLastName" render={({ field: { onChange, value } }) => (
                                    <TextInput style={[styles.inputField, { marginBottom: 4 }]} value={value} onChangeText={onChange} placeholder="Last Name" placeholderTextColor={COLORS.textSub} />
                                )} />
                                {errors.patientLastName && <Text style={{ color: COLORS.error, fontSize: 11, marginBottom: 8 }}>{errors.patientLastName.message as string}</Text>}
                            </View>
                        </View>

                        <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.inputLabel, { width: '100%', marginBottom: 6 }]}>Phone</Text>
                                <Controller control={control} name="patientPhone" render={({ field: { onChange, value } }) => (
                                    <TextInput style={[styles.inputField, { marginBottom: 4 }]} value={value} onChangeText={onChange} placeholder="05XXXXXXXX" keyboardType="phone-pad" placeholderTextColor={COLORS.textSub} />
                                )} />
                                {errors.patientPhone && <Text style={{ color: COLORS.error, fontSize: 11 }}>{errors.patientPhone.message as string}</Text>}
                            </View>
                            <View style={{ width: 90 }}>
                                <Text style={[styles.inputLabel, { width: '100%', marginBottom: 6 }]}>Age</Text>
                                <Controller control={control} name="patientAge" render={({ field: { onChange, value } }) => (
                                    <TextInput style={[styles.inputField, { marginBottom: 4 }]} value={value} onChangeText={onChange} placeholder="Age" keyboardType="numeric" placeholderTextColor={COLORS.textSub} />
                                )} />
                                {errors.patientAge && <Text style={{ color: COLORS.error, fontSize: 11 }}>{errors.patientAge.message as string}</Text>}
                            </View>
                        </View>

                        {/* Sex picker */}
                        <View style={{ marginTop: 8 }}>
                            <Text style={[styles.inputLabel, { width: '100%', marginBottom: 6 }]}>Sex</Text>
                            <TouchableOpacity style={[styles.inputField, { flexDirection: 'row', justifyContent: 'space-between' }]} onPress={() => setShowSexPicker(true)}>
                                <Text style={patientSex ? styles.inputValue : { fontSize: 16, color: COLORS.textSub, flex: 1 }}>
                                    {patientSex || 'Select Sex'}
                                </Text>
                                <Feather name="chevron-down" size={18} color={COLORS.textSub} />
                            </TouchableOpacity>
                        </View>

                        {/* Sex Modal */}
                        <Modal visible={showSexPicker} transparent animationType="fade">
                            <View style={styles.modalOverlay}>
                                <View style={styles.modalContent}>
                                    <Text style={styles.modalHeader}>Select Sex</Text>
                                    {['Male', 'Female', 'Other', 'Prefer not to say'].map(opt => (
                                        <TouchableOpacity key={opt} style={styles.modalItem} onPress={() => { setPatientSex(opt); setShowSexPicker(false); }}>
                                            <Text style={styles.modalItemText}>{opt}</Text>
                                            {patientSex === opt && <Feather name="check" size={18} color={COLORS.primary} />}
                                        </TouchableOpacity>
                                    ))}
                                    <TouchableOpacity style={styles.modalClose} onPress={() => setShowSexPicker(false)}>
                                        <Text style={styles.modalCloseText}>Cancel</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </Modal>
                    </View>
                )}



                {/* Scan Types */}
                <View style={styles.sectionNoCard}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                        <Text style={[styles.sectionTitle, { marginBottom: 0, marginLeft: 4 }]}>Examination Type</Text>
                        <Text style={{ fontSize: 12, color: COLORS.textSub, marginLeft: 8 }}>(Tap for info)</Text>
                    </View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingVertical: 10 }}>
                        {scanTypesConfig.map(scan => {
                            const isSelected = selectedScans.includes(scan.id);
                            return (
                                <ScaleButton key={scan.id} style={[styles.scanCard, isSelected && styles.scanCardSelected]} onPress={() => setPreviewScan(scan)}>
                                    <View style={[styles.scanIcon, isSelected && { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                                        <Feather name={scan.icon as any} size={20} color={isSelected ? '#FFF' : COLORS.primary} />
                                    </View>
                                    <Text style={[styles.scanName, isSelected && { color: '#FFF' }]}>{scan.name}</Text>
                                    {pricesLoading ? (
                                        <ActivityIndicator size="small" color={isSelected ? 'rgba(255,255,255,0.7)' : COLORS.primary} style={{ marginTop: 4 }} />
                                    ) : (
                                        <Text style={[styles.scanStartingFrom, isSelected && { color: 'rgba(255,255,255,0.85)' }]}>
                                            {getPriceText(scan)}
                                        </Text>
                                    )}
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

                {/* Scan Info Modal */}
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
                                        <Text style={{ fontSize: 13, color: COLORS.textSub, fontWeight: '500', marginBottom: 2 }}>Price range</Text>
                                        <Text style={{ fontSize: 20, fontWeight: '800', color: COLORS.primary }}>
                                            {getPriceText(previewScan)}
                                        </Text>
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


                {/* Details */}
                <View style={styles.sectionCard}>
                    <Text style={styles.sectionTitle}>Details</Text>

                    {/* Branch */}
                    <TouchableOpacity style={styles.inputField} onPress={() => setShowBranchPicker(true)}>
                        <Text style={styles.inputLabel}>Location</Text>
                        <Controller control={control} name="branch" render={({ field: { value } }) => (
                            <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-between' }}>
                                <Text style={styles.inputValue}>{value || 'Select Branch'}</Text>
                                <Feather name="chevron-down" size={18} color={COLORS.textSub} />
                            </View>
                        )} />
                    </TouchableOpacity>

                    {/* Branch Modal */}
                    <Modal visible={showBranchPicker} transparent animationType="fade">
                        <View style={styles.modalOverlay}>
                            <View style={styles.modalContent}>
                                <Text style={styles.modalHeader}>Select Branch</Text>
                                {['Koforidua', 'Takoradi', 'Cape Coast'].map(b => (
                                    <TouchableOpacity key={b} style={styles.modalItem} onPress={() => { setValue('branch', b); setShowBranchPicker(false); }}>
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

                    {/* Referral Field - Only for Patients */}
                    {!isDoctorBooking && (
                        <View style={{ marginBottom: 12 }}>
                            <Text style={[styles.inputLabel, { width: '100%', marginBottom: 6 }]}>Referral Source <Text style={{ fontWeight: '400', fontSize: 11 }}>(Optional)</Text></Text>
                            <Controller control={control} name="referral" render={({ field: { onChange, value } }) => (
                                <TextInput
                                    style={[styles.inputField, errors.referral && { borderColor: COLORS.error, borderWidth: 1 }]}
                                    placeholder="e.g. Korle Bu Teaching Hospital"
                                    value={value}
                                    onChangeText={onChange}
                                    placeholderTextColor={COLORS.textSub}
                                />
                            )} />
                            {errors.referral && <Text style={{ color: COLORS.error, fontSize: 11 }}>{errors.referral.message}</Text>}
                        </View>
                    )}

                    {/* Specific Scan Field */}
                    <View style={{ marginBottom: 12 }}>
                        <Text style={[styles.inputLabel, { width: '100%', marginBottom: 6 }]}>Specific Scan Details <Text style={{ fontWeight: '400', fontSize: 11 }}>(Optional)</Text></Text>
                        <Controller control={control} name="specificScan" render={({ field: { onChange, value } }) => (
                            <TextInput
                                style={[styles.inputField, { height: 100, textAlignVertical: 'top' }]}
                                placeholder="e.g. Head CT Scan with Contrast"
                                value={value}
                                onChangeText={onChange}
                                placeholderTextColor={COLORS.textSub}
                                multiline
                            />
                        )} />
                    </View>

                    {/* Reason Field */}
                    <View>
                        <Text style={[styles.inputLabel, { width: '100%', marginBottom: 6 }]}>Reason for Visit</Text>
                        <Controller control={control} name="notes" render={({ field: { onChange, value } }) => (
                            <TextInput
                                style={[styles.inputField, { height: 120, textAlignVertical: 'top' }]}
                                placeholder="Clinical indication or symptoms..."
                                multiline
                                value={value}
                                onChangeText={onChange}
                                placeholderTextColor={COLORS.textSub}
                            />
                        )} />
                    </View>
                </View>

                <ScaleButton style={styles.confirmBtn} onPress={handleSubmit(onConfirm)}>
                    <LinearGradient colors={[COLORS.primary, COLORS.primaryDark]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} />
                    <Text style={styles.confirmBtnText}>Confirm Appointment</Text>
                    <Feather name="arrow-right" size={20} color="#FFF" />
                </ScaleButton>
                <View style={{ height: 40 }} />
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    formContainer: { padding: 24 },
    backLink: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
    backLinkText: { marginLeft: 8, color: COLORS.primary, fontWeight: '600' },
    sectionCard: { backgroundColor: '#fff', borderRadius: 20, padding: 20, marginBottom: 20, ...SHADOW },
    sectionNoCard: { marginBottom: 20 },
    sectionTitle: { fontSize: 16, fontWeight: '800', color: COLORS.textMain, marginBottom: 12 },
    inputField: { backgroundColor: COLORS.bg, borderRadius: 12, padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
    inputValue: { fontSize: 16, color: COLORS.textMain, flex: 1, fontWeight: '500' },
    inputLabel: { fontSize: 12, color: COLORS.textSub, marginRight: 8, fontWeight: '600', width: 60 },
    rowGap: { flexDirection: 'row', gap: 12 },

    // For Whom toggle
    forWhomContainer: { flexDirection: 'row', backgroundColor: '#E2E8F0', borderRadius: 16, padding: 4, marginBottom: 20, height: 48 },
    forWhomTab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12 },
    forWhomTabActive: { backgroundColor: '#FFF', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
    forWhomTabText: { fontSize: 13, fontWeight: '600', color: COLORS.textSub },
    forWhomTabTextActive: { color: COLORS.primary, fontWeight: '700' },

    scanCard: { width: 130, padding: 16, backgroundColor: '#fff', borderRadius: 16, marginRight: 12, ...SHADOW },
    scanCardSelected: { backgroundColor: COLORS.primary },
    scanIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: COLORS.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
    scanName: { fontSize: 14, fontWeight: '700', color: COLORS.textMain },
    scanDuration: { fontSize: 11, color: COLORS.textSub, marginTop: 4 },
    scanStartingFrom: { fontSize: 11, color: COLORS.primary, marginTop: 4, fontWeight: '600' },

    confirmBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 18, borderRadius: 20, gap: 8, overflow: 'hidden', ...SHADOW },
    confirmBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

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
