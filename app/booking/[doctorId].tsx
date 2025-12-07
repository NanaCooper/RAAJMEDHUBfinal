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
import moment from 'moment';
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

  const [selectedDate, setSelectedDate] = useState<string>(moment().format('YYYY-MM-DD'));
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [showDobPicker, setShowDobPicker] = useState(false);

  const { control, handleSubmit, watch, setValue } = useForm<FormValues>({
    defaultValues: { phone: '', lastName: '', firstName: '', middleName: '', dob: undefined, sex: 'male', weightUnit: 'kg', weight: '', notes: '' },
  });

  const dob = watch('dob');
  const age = dob ? moment().diff(moment(dob), 'years') : undefined;

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
          setValue('firstName', data.fullName?.split(' ')[0] || '');
          setValue('lastName', data.fullName?.split(' ').slice(1).join(' ') || '');
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

  // Mock availability per-date (could be fetched from services/appointments)
  const mockSlotsForDate = (date: string) => {
    // simple deterministic mock: change slots based on day
    const day = moment(date).day();
    if (day === 0 || day === 6) return ['10:00 AM', '11:00 AM', '01:00 PM'];
    return ['09:00 AM', '10:00 AM', '11:30 AM', '02:00 PM', '03:30 PM'];
  };

  const slots = mockSlotsForDate(selectedDate);

  const onConfirm = (values: FormValues) => {
    if (!selectedSlot) {
      Alert.alert('Select time', 'Please select a time slot before confirming.');
      return;
    }

    // basic validation
    if (!values.phone || !values.lastName || !values.firstName || !values.dob) {
      Alert.alert('Missing fields', 'Please complete required personal details (Phone, Last name, First name, DOB).');
      return;
    }

    if (!session?.uid) {
      Alert.alert('Error', 'You must be logged in to book an appointment.');
      return;
    }

    const startAt = moment(`${selectedDate} ${selectedSlot}`, 'YYYY-MM-DD hh:mm A').toISOString();

    const appointmentData = {
      patientId: session.uid,
      doctorId,
      startAt,
      status: 'pending',
      notes: values.notes,
      scanType: { name: 'Consultation', id: 'consultation' },
      patientDetails: {
        firstName: values.firstName,
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
    const q = `?date=${encodeURIComponent(selectedDate)}&time=${encodeURIComponent(selectedSlot || '')}&appointmentData=${encodeURIComponent(JSON.stringify(appointmentData))}`;
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

      <View style={styles.calendarWrap}>
        <Text style={styles.sectionTitle}>Select Date</Text>
        <Calendar
          onDayPress={(d) => {
            setSelectedDate(d.dateString);
            setSelectedSlot(null);
          }}
          markedDates={{ [selectedDate]: { selected: true, selectedColor: '#0b6efd' } }}
          disableAllTouchEventsForDisabledDays
        />
      </View>

      <View style={styles.form}>
        <Text style={styles.sectionTitle}>Available Time Slots — {moment(selectedDate).format('ddd, DD MMM')}</Text>
        <FlatList
          data={slots}
          keyExtractor={(s) => s}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingVertical: 8 }}
          renderItem={({ item }) => {
            const selected = item === selectedSlot;
            return (
              <TouchableOpacity onPress={() => setSelectedSlot(item)} style={[styles.slot, selected && styles.slotSelected]}>
                <Text style={[styles.slotText, selected && { color: '#fff' }]}>{item}</Text>
              </TouchableOpacity>
            );
          }}
        />

        <Text style={[styles.sectionTitle, { marginTop: 12 }]}>Patient Details</Text>

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
                  {value ? moment(value).format('MMMM DD, YYYY') : 'Select date of birth'}
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
                  maxDate={moment().format('YYYY-MM-DD')}
                  minDate={moment().subtract(120, 'years').format('YYYY-MM-DD')}
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
            <Text style={[styles.label, { marginTop: 12 }]}>Medical Comments / History</Text>
            <TextInput style={[styles.input, { height: 100 }]} value={value} onChangeText={onChange} multiline placeholder="Add any relevant medical history" />
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