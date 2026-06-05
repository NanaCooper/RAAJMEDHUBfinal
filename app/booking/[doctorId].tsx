import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  Alert,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Calendar } from 'react-native-calendars';
import dayjs from 'dayjs';
import { useForm, Controller } from 'react-hook-form';
import { getDoctor } from '../../services/doctors';
import { useAuth } from '../../hooks/useAuth';
import { doc, getDoc, db } from '../../utils/firebaseConfig';

type Params = { doctorId?: string };

type FormValues = {
  phone: string;
  lastName: string;
  firstName: string;
  middleName?: string;
  dob?: string; // ISO date
  sex?: 'male' | 'female' | 'other';
  weight?: string; // numeric as string
  weightUnit?: 'kg' | 'lb';
  notes?: string;
  branch: 'Koforidua' | 'Takoradi' | 'Cape Coast';
};

export default function BookingScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const params = useLocalSearchParams<Params>();
  const doctorId = params.doctorId ?? 'unknown';

  const [doctor, setDoctor] = useState<any>({ id: doctorId, name: 'Doctor', specialty: '' });
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const d = await getDoctor(doctorId);
        if (!mounted) return;
        if (d) setDoctor(d);
      } catch (e) {
        console.error('Failed to load doctor', e);
      }
    }
    load();
    return () => { mounted = false; };
  }, [doctorId]);

  const [showDobPicker, setShowDobPicker] = useState(false);

  const { control, handleSubmit, watch, setValue } = useForm<FormValues>({
    defaultValues: { phone: '', lastName: '', firstName: '', middleName: '', dob: undefined, sex: 'male', weightUnit: 'kg', weight: '', notes: '', branch: undefined },
  });

  const dob = watch('dob');
  const age = dob ? dayjs().diff(dayjs(dob), 'years') : undefined;

  // Load user profile and auto-fill form
  useEffect(() => {
    async function loadProfile() {
      if (!session?.uid) {
        setLoadingProfile(false);
        return;
      }
      setLoadingProfile(true);
      try {
        const userRef = doc(db, 'users', session.uid);
        const snap = await getDoc(userRef);
        if (snap.exists()) {
          const data = snap.data();
          // Auto-fill form with profile data
          if (data.firstName) setValue('firstName', data.firstName);
          else setValue('firstName', data.fullName?.split(' ')[0] || '');

          if (data.lastName) setValue('lastName', data.lastName);
          else setValue('lastName', data.fullName?.split(' ').slice(1).join(' ') || '');

          if (data.middleName) setValue('middleName', data.middleName);

          setValue('dob', data.dob || '');
          setValue('phone', data.contact || data.phone || '');
        }
      } catch (e) {
        console.error('Failed to load profile', e);
      } finally {
        setLoadingProfile(false);
      }
    }
    loadProfile();
  }, [session?.uid, setValue]);

  const onConfirm = (values: FormValues) => {
    // basic validation
    if (!values.phone || !values.lastName || !values.firstName || !values.dob || !values.branch) {
      Alert.alert('Missing fields', 'Please complete required personal details (Phone, Last name, First name, DOB, Branch).');
      return;
    }

    if (!session?.uid) {
      Alert.alert('Error', 'You must be logged in to book an appointment.');
      return;
    }

    const appointmentData = {
      patientId: session.uid,
      doctorId,
      startAt: null, // Pending scheduling
      status: 'pending',
      notes: values.notes,
      branch: values.branch,
      scanType: { name: 'Consultation', id: 'consultation' },
      patientDetails: {
        firstName: values.firstName,
        middleName: values.middleName,
        lastName: values.lastName,
        phone: values.phone,
        dob: values.dob,
        sex: values.sex,
        weight: values.weight,
        weightUnit: values.weightUnit,
        age,
      }
    };

    console.log('Confirm booking payload:', appointmentData);
    // open booking-confirmation modal and pass details
    const q = `?appointmentData=${encodeURIComponent(JSON.stringify(appointmentData))}`;
    router.push((`/(modals)/booking-confirmation${q}`) as any);
  };

  if (loadingProfile) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#0b6efd" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Book with {doctor.name}</Text>
        <Text style={styles.sub}>{doctor.specialty}</Text>
      </View>

      <View style={styles.form}>
        <Text style={styles.sectionTitle}>Patient Details</Text>

        <Controller
          control={control}
          name="branch"
          rules={{ required: 'Please select a branch' }}
          render={({ field: { onChange, value } }) => (
            <View style={{ marginBottom: 16 }}>
              <Text style={styles.label}>Branch <Text style={{ color: 'red' }}>*</Text></Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
                {['Koforidua', 'Takoradi', 'Cape Coast'].map((branch) => (
                  <TouchableOpacity
                    key={branch}
                    onPress={() => onChange(branch)}
                    style={[
                      styles.branchOption,
                      value === branch && styles.branchOptionSelected
                    ]}
                  >
                    <Text style={[
                      styles.branchText,
                      value === branch && styles.branchTextSelected
                    ]}>{branch}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        />

        <Controller
          control={control}
          name="phone"
          render={({ field: { onChange, value } }) => (
            <>
              <Text style={styles.label}>Phone Number</Text>
              <TextInput style={styles.input} value={value} onChangeText={onChange} placeholder="+1 555-0100" keyboardType="phone-pad" />
            </>
          )}
        />

        <View style={styles.rowInputs}>
          <Controller control={control} name="lastName" render={({ field: { onChange, value } }) => (
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={[styles.label, { color: '#0b6efd', fontWeight: '700' }]}>Last Name (from profile)</Text>
              <TextInput style={[styles.input, { backgroundColor: '#f0f7ff', borderColor: '#0b6efd' }]} value={value} onChangeText={onChange} placeholder="Last name" />
            </View>
          )} />

          <Controller control={control} name="firstName" render={({ field: { onChange, value } }) => (
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: '#0b6efd', fontWeight: '700' }]}>First Name (from profile)</Text>
              <TextInput style={[styles.input, { backgroundColor: '#f0f7ff', borderColor: '#0b6efd' }]} value={value} onChangeText={onChange} placeholder="First name" />
            </View>
          )} />
        </View>

        <Controller control={control} name="middleName" render={({ field: { onChange, value } }) => (
          <>
            <Text style={styles.label}>Middle Name</Text>
            <TextInput style={styles.input} value={value} onChangeText={onChange} placeholder="Middle name (optional)" />
          </>
        )} />

        <View style={{ marginTop: 10 }}>
          <Text style={[styles.label, { color: '#0b6efd', fontWeight: '700' }]}>Date of Birth (from profile)</Text>
          <Controller control={control} name="dob" render={({ field: { onChange, value } }) => (
            <>
              <TouchableOpacity onPress={() => setShowDobPicker(true)} style={[styles.input, { backgroundColor: '#f0f7ff', borderColor: '#0b6efd', justifyContent: 'center', paddingVertical: 12 }]}>
                <Text style={{ fontSize: 16, color: value ? '#333' : '#999' }}>
                  {value ? dayjs(value).format('MMMM DD, YYYY') : 'Select date of birth'}
                </Text>
              </TouchableOpacity>
              {age !== undefined && value ? (
                <Text style={{ marginTop: 8, color: '#0b6efd', fontWeight: '600', fontSize: 13 }}>
                  ✓ Age: {age} years old
                </Text>
              ) : null}
            </>
          )} />
        </View>

        <Modal visible={showDobPicker} transparent animationType="fade">
          <View style={styles.dobModalOverlay}>
            <View style={styles.dobModalContent}>
              <View style={styles.dobModalHeader}>
                <Text style={styles.dobModalTitle}>Select Your Date of Birth</Text>
                <TouchableOpacity onPress={() => setShowDobPicker(false)}>
                  <Text style={styles.dobModalCloseBtn}>✕</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.calendarContainer}>
                <Calendar
                  onDayPress={(d) => {
                    setValue('dob', d.dateString);
                    setShowDobPicker(false);
                  }}
                  maxDate={dayjs().format('YYYY-MM-DD')}
                  minDate={dayjs().subtract(120, 'years').format('YYYY-MM-DD')}
                  theme={{
                    backgroundColor: '#fff',
                    calendarBackground: '#fff',
                    textSectionTitleColor: '#0b6efd',
                    selectedDayBackgroundColor: '#0b6efd',
                    selectedDayTextColor: '#fff',
                    todayTextColor: '#0b6efd',
                    todayBackgroundColor: '#e8f4ff',
                    dayTextColor: '#333',
                    textDisabledColor: '#ddd',
                    dotColor: '#0b6efd',
                    selectedDotColor: '#fff',
                    arrowColor: '#0b6efd',
                    monthTextColor: '#333',
                  }}
                />
              </View>

              <View style={styles.dobModalFooter}>
                <TouchableOpacity
                  onPress={() => setShowDobPicker(false)}
                  style={styles.dobModalDismissBtn}
                >
                  <Text style={styles.dobModalDismissText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <View style={{ marginTop: 10 }}>
          <Text style={styles.label}>Sex</Text>
          <View style={{ flexDirection: 'row', marginTop: 8 }}>
            {[
              { key: 'male', label: 'Male' },
              { key: 'female', label: 'Female' },
              { key: 'other', label: 'Other' },
            ].map((opt) => (
              <Controller key={opt.key} control={control} name="sex" render={({ field: { onChange, value } }) => (
                <TouchableOpacity onPress={() => onChange(opt.key as any)} style={[styles.sexOption, value === opt.key && styles.sexOptionSelected]}>
                  <Text style={value === opt.key ? { color: '#fff' } : { color: '#333' }}>{opt.label}</Text>
                </TouchableOpacity>
              )} />
            ))}
          </View>
        </View>

        <View style={{ marginTop: 10 }}>
          <Text style={styles.label}>Weight</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
            <Controller control={control} name="weight" render={({ field: { onChange, value } }) => (
              <TextInput keyboardType="numeric" style={[styles.input, { flex: 1 }]} value={value} onChangeText={onChange} placeholder="e.g. 70" />
            )} />

            <Controller control={control} name="weightUnit" render={({ field: { onChange, value } }) => (
              <View style={{ marginLeft: 8, flexDirection: 'row' }}>
                <TouchableOpacity onPress={() => onChange('kg')} style={[styles.unitBtn, value === 'kg' && styles.unitBtnActive]}><Text style={value === 'kg' ? { color: '#fff' } : {}}>-kg</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => onChange('lb')} style={[styles.unitBtn, value === 'lb' && styles.unitBtnActive]}><Text style={value === 'lb' ? { color: '#fff' } : {}}>lb</Text></TouchableOpacity>
              </View>
            )} />
          </View>
        </View>

        <Controller control={control} name="notes" render={({ field: { onChange, value } }) => (
          <>
            <Text style={[styles.label, { marginTop: 12 }]}>Additional Comments / Background</Text>
            <TextInput style={[styles.input, { height: 100 }]} value={value} onChangeText={onChange} multiline placeholder="Add any relevant background information" />
          </>
        )} />

        <View style={styles.actions}>
          <TouchableOpacity style={styles.confirmBtn} onPress={handleSubmit(onConfirm)}>
            <Text style={styles.confirmText}>Confirm Booking</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  header: { marginBottom: 12 },
  title: { fontSize: 20, fontWeight: '700' },
  sub: { color: '#666', marginTop: 4 },

  calendarWrap: { marginBottom: 12 },
  sectionTitle: { fontSize: 14, fontWeight: '700', marginBottom: 8 },

  form: { marginTop: 8 },
  label: { color: '#666', fontSize: 13 },
  input: { height: 44, borderWidth: 1, borderColor: '#eee', borderRadius: 8, paddingHorizontal: 10, marginTop: 6, backgroundColor: '#fafafa' },

  rowInputs: { flexDirection: 'row', justifyContent: 'space-between' },

  slot: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1, borderColor: '#eee', marginRight: 8, backgroundColor: '#fff' },
  slotSelected: { backgroundColor: '#0b6efd', borderColor: '#0b6efd' },
  slotText: { color: '#333', fontWeight: '600' },

  actions: { marginTop: 18, alignItems: 'center' },
  confirmBtn: { backgroundColor: '#0b6efd', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8 },
  confirmText: { color: '#fff', fontWeight: '700' },

  sexOption: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: '#eee', marginRight: 8 },
  sexOptionSelected: { backgroundColor: '#0b6efd', borderColor: '#0b6efd' },

  unitBtn: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#eee', marginLeft: 6 },
  unitBtnActive: { backgroundColor: '#0b6efd', borderColor: '#0b6efd' },

  branchOption: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: '#eee', backgroundColor: '#fff' },
  branchOptionSelected: { backgroundColor: '#0b6efd', borderColor: '#0b6efd' },
  branchText: { color: '#333', fontWeight: '600' },
  branchTextSelected: { color: '#fff' },

  dobModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  dobModalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 24,
    maxHeight: '90%',
  },
  dobModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  dobModalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  dobModalCloseBtn: {
    fontSize: 24,
    color: '#999',
    fontWeight: '600',
  },
  calendarContainer: {
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  dobModalFooter: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  dobModalDismissBtn: {
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
  },
  dobModalDismissText: {
    color: '#666',
    fontWeight: '600',
    fontSize: 14,
  },
});