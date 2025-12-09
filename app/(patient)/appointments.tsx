import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useAuth } from '../../hooks/useAuth';
import { subscribeToAppointments } from '../../services/appointments';
import { getDoctor } from '../../services/doctors';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView,
  ActivityIndicator,
  StatusBar,
  Alert,
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar } from 'react-native-calendars';
import moment from 'moment-timezone';
import { useForm, Controller, SubmitHandler } from 'react-hook-form';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
import { Feather } from "@expo/vector-icons";

// --- Theme Constants ---
const COLORS = {
  bg: "#F8FAFC",        // Slate 50
  surface: "#FFFFFF",
  primary: "#4F46E5",   // Indigo 600
  primarySoft: "#EEF2FF",
  textMain: "#1E293B",  // Slate 800
  textSec: "#64748B",   // Slate 500
  border: "#E2E8F0",
  success: "#10B981",
  warning: "#F59E0B",
  error: "#EF4444",
  inputBg: "#F1F5F9"
};

const SHADOW = {
  shadowColor: "#64748B",
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.08,
  shadowRadius: 12,
  elevation: 4,
};

// --- Data & Utilities ---

const scanTypes = [
  {
    id: 'ct',
    name: 'CT Scan',
    icon: 'layers',
    description: 'Computer Tomography scan using X-rays and computer processing',
    duration: '15-30 min',
    preparation: ['No food 4 hours before', 'No metallic objects', 'Wear comfortable clothing', 'Bring previous scans']
  },
  {
    id: 'xray',
    name: 'X-Ray',
    icon: 'image',
    description: 'Traditional radiographic imaging for bones and chest',
    duration: '5-10 min',
    preparation: ['Remove metallic objects', 'Wear comfortable clothing']
  },
  {
    id: 'mammogram',
    name: 'Mammogram',
    icon: 'aperture',
    description: 'X-ray examination of breast tissue for cancer screening',
    duration: '20-30 min',
    preparation: ['No deodorant/lotion', 'Wear two-piece clothing', 'Schedule 1 week after period']
  },
  {
    id: 'ultrasound',
    name: 'Ultrasound',
    icon: 'activity',
    description: 'Sound wave imaging for soft tissues and organs',
    duration: '15-30 min',
    preparation: ['Full bladder required', 'No food 6-8h before (abdominal)', 'Wear loose clothing']
  },
  {
    id: 'mri',
    name: 'MRI',
    icon: 'disc',
    description: 'Magnetic Resonance Imaging for detailed tissue examination',
    duration: '30-60 min',
    preparation: ['No metallic objects/implants', 'No makeup', 'Notify if claustrophobic', 'No food 4h before']
  }
];

// Custom sanitization functions
const sanitizeText = (value: string) => value.trim().replace(/[^\w\s-]/g, '');
const sanitizeMedicalNotes = (value: string) => value.trim().replace(/[^\w\s,.;:-]/g, '');

// Types & Validation
interface FormValues {
  phone: string;
  lastName?: string;
  firstName: string;
  middleName?: string;
  dob: string;
  sex: 'male' | 'female' | 'other';
  weight?: string;
  weightUnit?: 'kg' | 'lb';
  notes?: string;
}

const validationSchema = yup.object().shape({
  phone: yup.string().required('Required').matches(/^[+\d][\d\s\-().]{6,}$/, 'Invalid phone').transform(sanitizeText),
  lastName: yup.string().optional().matches(/^[A-Za-z\s-]*$/, 'Invalid characters').transform(v => v ? sanitizeText(v) : v),
  firstName: yup.string().required('Required').min(2).matches(/^[A-Za-z\s-]+$/, 'Invalid characters').transform(sanitizeText),
  middleName: yup.string().optional().matches(/^[A-Za-z\s-]*$/, 'Invalid characters').transform(v => v ? sanitizeText(v) : v),
  dob: yup.string().required('Required').test('age', 'Invalid age', v => { if(!v) return false; const age = moment().diff(moment(v), 'years'); return age >= 0 && age <= 120; }),
  sex: yup.string().required('Required').oneOf(['male', 'female', 'other']),
  weight: yup.string().optional().matches(/^\d*\.?\d*$/, 'Number only').test('range', 'Invalid weight', v => { if(!v) return true; const n = parseFloat(v); return !isNaN(n) && n > 0 && n <= 500; }),
  weightUnit: yup.string().optional().oneOf(['kg', 'lb']),
  notes: yup.string().optional().max(1000).transform(sanitizeMedicalNotes),
});



type Tab = 'upcoming' | 'past' | 'book';

// --- Main Component ---

export default function Appointments() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { session } = useAuth();
  
  // State
  const [activeTab, setActiveTab] = useState<Tab>('upcoming');

  useEffect(() => {
    if (params?.tab && ['upcoming', 'past', 'book'].includes(params.tab as string)) {
      setActiveTab(params.tab as Tab);
    }
  }, [params?.tab]);

  const [selectedDate, setSelectedDate] = useState<string>(moment().format('YYYY-MM-DD'));
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [showDobPicker, setShowDobPicker] = useState(false);
  const [selectedScan, setSelectedScan] = useState<string | null>(null);
  const [showScanDetails, setShowScanDetails] = useState<boolean>(false);
  const [availableSlots, setAvailableSlots] = useState<{ [date: string]: string[] }>({});
  const [loadingSlots, setLoadingSlots] = useState<boolean>(false);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [userTimezone] = useState(moment.tz.guess());

  useEffect(() => {
    (async () => {
      
    })();
  }, []);

  // Mock Logic (Preserved)
  const doctorSchedule = useMemo(() => ({
    workDays: [0, 1, 2, 3, 4, 5, 6], // All days (Sun-Sat)
    workHours: { start: '00:00', end: '23:59', lunchBreak: { start: '', end: '' } }, // 24 hours
    appointmentDuration: 30,
    unavailableDates: ['2025-11-25', '2025-12-25']
  }), []);

  // Form Setup
  const methods = useForm<FormValues>({
    defaultValues: { 
      phone: '', lastName: '', firstName: '', middleName: undefined, 
      dob: '', sex: 'male', weightUnit: 'kg', weight: undefined, notes: undefined 
    },
    mode: 'onBlur',
    resolver: (yupResolver(validationSchema) as any)
  });
  
  const { control, handleSubmit, setValue, watch, setError, formState: { errors } } = methods;
  const dob = watch('dob');
  moment().diff(moment(dob), 'years');

  // --- Effects ---

  // Load Appointments
  useEffect(() => {
    if (!session?.uid) return;

    // Pass user email for fallback query
    const unsubscribe = subscribeToAppointments(session.uid, 'patient', async (appts) => {
      // console.log("[Appointments] Received updates:", appts.length);
      
      // 1. Immediate update (Optimistic) - Show appointments immediately
      const mapAppointment = (a: any, docMap: { [id: string]: string } = {}) => {
        let doctorName = a.doctorName;
        const rawId = a.doctorId;
        const docId = (typeof rawId === 'object' && rawId?.id) ? rawId.id : rawId;

        if (!doctorName && docId && typeof docId === 'string') {
            doctorName = docMap[docId];
        }

        // Ensure doctorName is valid and not a stringified null/undefined
        if (doctorName === 'null' || doctorName === 'undefined') {
            doctorName = null;
        }

        // Handle Admin App 'serviceType' string
        let finalScanType = a.scanType;
        if (!finalScanType && a.serviceType) {
            finalScanType = { name: a.serviceType, id: 'custom' };
        }

        let date = '';
        let time = '';

        if (a.startAt) {
            if (typeof a.startAt === 'string') {
                // Use moment to handle both ISO (T) and space-separated formats robustly
                const d = moment(a.startAt);
                if (d.isValid()) {
                    date = d.format('YYYY-MM-DD');
                    time = d.format('HH:mm');
                } else {
                    // Fallback for very unusual formats
                    console.warn(`[Appointments] Could not parse startAt with moment: ${a.startAt}`);
                    const parts = a.startAt.split(' ');
                    date = parts[0];
                    time = parts[1] || '';
                }
            } else if (a.startAt.toDate) {
                const d = moment(a.startAt.toDate());
                date = d.format('YYYY-MM-DD');
                time = d.format('HH:mm');
            }
        } else if (a.date && a.time) {
            // Fallback to direct date/time fields
            date = a.date;
            time = a.time;
        }

        return {
          id: a.id,
          date,
          time,
          doctor: doctorName || null,
          status: a.status || 'upcoming',
          patientId: a.patientId,
          scanType: finalScanType,
        };
      };

      // Render immediately with what we have
      setAppointments(appts.map(a => mapAppointment(a)));

      // 2. Identify unique doctor IDs that need fetching
      const doctorIdsToFetch = new Set<string>();
      appts.forEach((a: any) => {
        const rawId = a.doctorId;
        const docId = (typeof rawId === 'object' && rawId?.id) ? rawId.id : rawId;
        
        if (!a.doctorName && docId && typeof docId === 'string') {
          doctorIdsToFetch.add(docId);
        }
      });

      if (doctorIdsToFetch.size === 0) return;

      // 3. Fetch doctors in parallel (with caching in service layer)
      const doctorMap: { [id: string]: string } = {};
      await Promise.all(Array.from(doctorIdsToFetch).map(async (id) => {
        try {
          const doc = await getDoctor(id);
          if (doc) {
            doctorMap[id] = (doc as any).fullName || (doc as any).name || 'Doctor';
          }
        } catch (e) {
          console.warn('Failed to fetch doctor details for', id, e);
        }
      }));

      // 4. Final update with doctor names
      setAppointments(appts.map(a => mapAppointment(a, doctorMap)));
    }, (err) => console.error(err), session.email); // Pass email here

    return () => unsubscribe();
  }, [session?.uid, session?.email]);

  // Load Profile
  useEffect(() => {
    async function loadProfile() {
      if (!session?.uid) return;
      try {
        const { doc, getDoc, db } = await import('../../utils/firebaseConfig');
        const userRef = doc(db, 'users', session.uid);
        const snap = await getDoc(userRef);
        if (snap.exists()) {
          const data = snap.data();
          // --- ROBUST NAME HANDLING ---
          const nameParts = (data.fullName || '').split(' ').filter(Boolean);
          const firstName = nameParts[0] || '';
          const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

          setValue('firstName', firstName);
          setValue('lastName', lastName);
          // --- END FIX ---
          setValue('dob', data.dob || '');
          setValue('phone', data.contact || data.phone || '');
        }
      } catch (e) { console.error('Failed to load profile', e); }
    }
    loadProfile();
  }, [session?.uid, setValue]);

  // --- Logic Helpers ---

  const isDateDisabled = useCallback((date: string) => {
    const dayOfWeek = moment(date).day();
    const isWorkDay = doctorSchedule.workDays.includes(dayOfWeek);
    const isUnavailable = doctorSchedule.unavailableDates.includes(date);
    const isPast = moment(date).isBefore(moment(), 'day');
    return !isWorkDay || isUnavailable || isPast;
  }, [doctorSchedule]);

  const generateTimeSlots = useCallback((date: string) => {
    const slots: string[] = [];
    const startTime = moment.tz(date + ' ' + doctorSchedule.workHours.start, userTimezone);
    const endTime = moment.tz(date + ' ' + doctorSchedule.workHours.end, userTimezone);
    
    // Only check lunch break if it's defined and valid
    const hasLunch = doctorSchedule.workHours.lunchBreak.start && doctorSchedule.workHours.lunchBreak.end;
    const lunchStart = hasLunch ? moment.tz(date + ' ' + doctorSchedule.workHours.lunchBreak.start, userTimezone) : null;
    const lunchEnd = hasLunch ? moment.tz(date + ' ' + doctorSchedule.workHours.lunchBreak.end, userTimezone) : null;

    let currentTime = startTime.clone();
    while (currentTime.isBefore(endTime)) {
      if (hasLunch && lunchStart && lunchEnd && currentTime.isSameOrAfter(lunchStart) && currentTime.isBefore(lunchEnd)) {
        currentTime = lunchEnd.clone();
        continue;
      }
      slots.push(currentTime.format('HH:mm'));
      currentTime.add(doctorSchedule.appointmentDuration, 'minutes');
    }
    return slots;
  }, [doctorSchedule, userTimezone]);

  const checkConflicts = useCallback((date: string, time: string) => {
    const selectedDateTime = moment.tz(date + ' ' + time, userTimezone);
    const duration = doctorSchedule.appointmentDuration;
    const selectedEnd = selectedDateTime.clone().add(duration, 'minutes');

    return appointments.filter(apt => {
      const aptDateTime = moment.tz(apt.date + ' ' + apt.time, userTimezone);
      const aptEnd = aptDateTime.clone().add(duration, 'minutes');
      return (
        (selectedDateTime.isSameOrAfter(aptDateTime) && selectedDateTime.isBefore(aptEnd)) ||
        (selectedEnd.isAfter(aptDateTime) && selectedEnd.isSameOrBefore(aptEnd))
      );
    });
  }, [appointments, doctorSchedule, userTimezone]);

  // Fetch Slots
  useEffect(() => {
    if (!selectedDate || isDateDisabled(selectedDate)) { setAvailableSlots({}); return; }
    setLoadingSlots(true);
    const fetchSlots = async () => {
      try {
        await new Promise(resolve => setTimeout(resolve, 300)); // Smoother UI transition
        const slots = generateTimeSlots(selectedDate);
        const validSlots = slots.filter(time => checkConflicts(selectedDate, time).length === 0);
        setAvailableSlots(prev => ({ ...prev, [selectedDate]: validSlots }));
      } finally { setLoadingSlots(false); }
    };
    fetchSlots();
  }, [selectedDate, generateTimeSlots, isDateDisabled, checkConflicts]);

  // --- Event Handlers ---

  const filteredAppointments = useMemo(() => {
    const now = moment().startOf('day'); // Compare dates at start of day
    console.log(`[Appointments] Filtering ${appointments.length} appointments for tab: ${activeTab}`);
    
    if (activeTab === 'upcoming') {
      return appointments.filter(a => {
        const apptDate = moment(a.date);
        const isValid = apptDate.isValid();
        const isFuture = isValid && apptDate.isSameOrAfter(now);
        const isNotFinished = a.status !== 'completed' && a.status !== 'cancelled';
        
        if (!isValid) console.warn(`[Appointments] Invalid date for appt ${a.id}: ${a.date}`);
        
        return isFuture && isNotFinished;
      });
    }
    if (activeTab === 'past') {
      return appointments.filter(a => {
        const apptDate = moment(a.date);
        return apptDate.isBefore(now) || a.status === 'completed' || a.status === 'cancelled';
      });
    }
    return appointments;
  }, [appointments, activeTab]);

  const currentDaySlots = useMemo(() => selectedDate ? (availableSlots[selectedDate] || []) : [], [selectedDate, availableSlots]);

  const onInvalid = (errors: any) => {
    console.error("--- [appointments.tsx] Form Validation FAILED ---");
    console.error("[LOG] Validation Errors:", JSON.stringify(errors, null, 2));
    setError('root', { message: 'Form is invalid. Please check all fields and try again.' });
  };

  const onConfirm: SubmitHandler<FormValues> = async (values) => {
    console.log("--- [appointments.tsx] onConfirm triggered ---");

    // Check active appointments limit (Max 3)
    const activeAppointments = appointments.filter(a => 
      a.status !== 'completed' && a.status !== 'cancelled'
    );
    
    if (activeAppointments.length >= 3) {
       Alert.alert(
         "Booking Limit Reached", 
         "You can only have a maximum of 3 active appointments. Please complete existing appointments before booking a new one."
       );
       return;
    }

    if (!selectedSlot) {
      console.error("[LOG] onConfirm: Failed. No time slot selected.");
      setError('root', { message: 'Please select a time slot.' });
      return;
    }
    if (!selectedScan) {
      console.error("[LOG] onConfirm: Failed. No scan type selected.");
      setError('root', { message: 'Please select a scan type.' });
      return;
    }
    console.log(`[LOG] onConfirm: Slot selected: ${selectedSlot}, Scan selected: ${selectedScan}`);
    console.log("[LOG] onConfirm: Form values:", JSON.stringify(values, null, 2));

    const selectedScanType = scanTypes.find(s => s.id === selectedScan);
    
    const appointmentData = {
      patientId: session?.uid,
      doctorId: null, // To be assigned by admin
      startAt: `${selectedDate} ${selectedSlot}`,
      status: 'pending',
      scanType: { id: selectedScanType?.id, name: selectedScanType?.name },
      patientDetails: { ...values },
    };

    console.log("[LOG] onConfirm: Prepared appointment data:", JSON.stringify(appointmentData, null, 2));
    console.log("[LOG] onConfirm: Navigating to booking-confirmation modal...");

    router.push({
      pathname: "/(modals)/booking-confirmation",
      params: {
        date: selectedDate,
        time: selectedSlot,
        appointmentData: JSON.stringify({
          ...appointmentData,
          startAt: moment
            .tz(`${selectedDate} ${selectedSlot}`, userTimezone)
            .toISOString(),
        }),
      },
    });
  };



  // --- Renderers ---

  const renderAppointmentCard = ({ item }: { item: any }) => {
    const statusColors = {
      upcoming: { bg: '#ECFDF5', text: '#047857' }, // Emerald
      completed: { bg: '#F1F5F9', text: '#475569' }, // Slate
      cancelled: { bg: '#FEF2F2', text: '#DC2626' }, // Red
      pending: { bg: '#FEFCE8', text: '#A16207' }, // Yellow
    };

    let displayStatus = item.status;
    const appointmentDateTime = moment(item.date + ' ' + item.time);
    if (appointmentDateTime.isBefore(moment()) && (displayStatus === 'upcoming' || displayStatus === 'pending')) {
      displayStatus = 'completed';
    }

    const style = statusColors[displayStatus as keyof typeof statusColors] || statusColors.upcoming;

    return (
      <TouchableOpacity 
        style={styles.card} 
        activeOpacity={0.9}
        onPress={() => router.push({ pathname: '/(patient)/appointment-details', params: { appointment: JSON.stringify(item) }})}
      >
        <View style={styles.cardDate}>
           <Text style={styles.cardDay}>{moment(item.date).format('DD')}</Text>
           <Text style={styles.cardMonth}>{moment(item.date).format('MMM')}</Text>
        </View>
        
        <View style={styles.cardContent}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle}>{item.scanType?.name || 'Consultation'}</Text>
          </View>
          <Text style={styles.cardSubtitle}>
            {item.doctor && item.doctor !== 'null' && item.doctor !== 'undefined' ? `Dr. ${item.doctor}` : 'Doctor to be assigned soon'}
          </Text>
          <View style={styles.cardMetaRow}>
             <Feather name="clock" size={14} color={COLORS.textSec} />
             <Text style={styles.cardMetaText}>{moment(item.date + ' ' + item.time).format('h:mm A')}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderBookingForm = () => (
    <ScrollView contentContainerStyle={styles.bookingContent} showsVerticalScrollIndicator={false}>
      
      {/* Calendar Section */}
      <View style={styles.sectionContainer}>
        <Text style={styles.sectionHeader}>Select Date</Text>
        <View style={styles.calendarWrapper}>
          <Calendar
            onDayPress={(d) => { if (!isDateDisabled(d.dateString)) { setSelectedDate(d.dateString); setSelectedSlot(null); } }}
            minDate={moment().format('YYYY-MM-DD')}
            markedDates={{
              [selectedDate]: { selected: true, selectedColor: COLORS.primary },
              ...doctorSchedule.unavailableDates.reduce((acc, date) => ({...acc, [date]: { disabled: true, disableTouchEvent: true, textColor: '#cbd5e1' }}), {})
            }}
            theme={{
              backgroundColor: '#ffffff',
              calendarBackground: '#ffffff',
              textSectionTitleColor: '#b6c1cd',
              selectedDayBackgroundColor: COLORS.primary,
              selectedDayTextColor: '#ffffff',
              todayTextColor: COLORS.primary,
              dayTextColor: '#2d4150',
              textDisabledColor: '#d9e1e8',
              arrowColor: COLORS.primary,
              monthTextColor: COLORS.textMain,
              textDayFontWeight: '500',
              textMonthFontWeight: 'bold',
              textDayHeaderFontWeight: '500',
              textDayFontSize: 14,
            }}
            disabledDaysIndexes={[0, 6]}
          />
        </View>
      </View>

      {/* Time Slots */}
      <View style={styles.sectionContainer}>
        <Text style={styles.sectionHeader}>
          Available Times <Text style={{fontWeight: '400', color: COLORS.textSec}}>{selectedDate ? `• ${moment(selectedDate).format('MMM DD')}` : ''}</Text>
        </Text>
        {loadingSlots ? (
          <ActivityIndicator color={COLORS.primary} style={{ marginTop: 20 }} />
        ) : currentDaySlots.length > 0 ? (
          <View>
            {['Morning', 'Afternoon', 'Evening', 'Night'].map(period => {
               const periodSlots = currentDaySlots.filter(time => {
                 const hour = parseInt(time.split(':')[0]);
                 if (period === 'Morning') return hour >= 6 && hour < 12;
                 if (period === 'Afternoon') return hour >= 12 && hour < 18;
                 if (period === 'Evening') return hour >= 18 && hour <= 23;
                 if (period === 'Night') return hour >= 0 && hour < 6;
                 return false;
               });
               
               if (periodSlots.length === 0) return null;

               return (
                 <View key={period} style={{ marginBottom: 16 }}>
                   <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.textSec, marginBottom: 8, marginLeft: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>{period}</Text>
                   <FlatList
                      data={periodSlots}
                      keyExtractor={(s) => s}
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ gap: 10 }}
                      renderItem={({ item }) => (
                        <TouchableOpacity 
                          onPress={() => setSelectedSlot(item)} 
                          style={[styles.timeChip, item === selectedSlot && styles.timeChipSelected]}
                        >
                          <Text style={[styles.timeChipText, item === selectedSlot && styles.timeChipTextSelected]}>
                            {moment(selectedDate + ' ' + item).format('h:mm A')}
                          </Text>
                        </TouchableOpacity>
                      )}
                   />
                 </View>
               );
            })}
          </View>
        ) : (
           <View style={styles.emptyState}>
             <Feather name="calendar" size={24} color={COLORS.textSec} />
             <Text style={styles.emptyStateText}>No slots available for this date.</Text>
           </View>
        )}
      </View>

      {/* Scan Types */}
      <View style={styles.sectionContainer}>
        <Text style={styles.sectionHeader}>Examination Type</Text>
        <FlatList
          data={scanTypes}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 12, paddingRight: 20 }}
          renderItem={({ item }) => {
            const selected = item.id === selectedScan;
            return (
              <TouchableOpacity 
                onPress={() => { setSelectedScan(selected ? null : item.id); setShowScanDetails(true); }}
                style={[styles.scanCard, selected && styles.scanCardSelected]}
                activeOpacity={0.8}
              >
                <View style={[styles.scanIcon, selected && { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                   <Feather name={item.icon as any} size={20} color={selected ? '#fff' : COLORS.primary} />
                </View>
                <Text style={[styles.scanCardTitle, selected && { color: '#fff' }]}>{item.name}</Text>
              </TouchableOpacity>
            );
          }}
        />

        {selectedScan && showScanDetails && (
          <View style={styles.detailsCard}>
             <View style={styles.rowBetween}>
               <Text style={styles.detailsTitle}>{scanTypes.find(s => s.id === selectedScan)?.name} Details</Text>
               <TouchableOpacity onPress={() => setShowScanDetails(false)}>
                 <Feather name="x" size={18} color={COLORS.textSec} />
               </TouchableOpacity>
             </View>
             <Text style={styles.detailsDesc}>{scanTypes.find(s => s.id === selectedScan)?.description}</Text>
             <Text style={styles.detailsLabel}>Preparation:</Text>
             {scanTypes.find(s => s.id === selectedScan)?.preparation.map((p, i) => (
               <View key={i} style={styles.bulletRow}>
                 <View style={styles.bullet} />
                 <Text style={styles.bulletText}>{p}</Text>
               </View>
             ))}
          </View>
        )}
      </View>

      {/* Patient Form */}
      <View style={styles.sectionContainer}>
        <Text style={styles.sectionHeader}>Patient Information</Text>
        
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Phone Number</Text>
          <Controller control={control} name="phone" render={({ field: { onChange, value } }) => (
             <TextInput style={styles.input} value={value} onChangeText={onChange} placeholder="+1 234 567 8900" keyboardType="phone-pad" placeholderTextColor="#94A3B8" />
          )} />
          {errors.phone && <Text style={styles.errorText}>{errors.phone.message}</Text>}
        </View>

        <View style={styles.rowGap}>
           <View style={{ flex: 1 }}>
             <Text style={styles.inputLabel}>First Name</Text>
             <Controller control={control} name="firstName" render={({ field: { onChange, value } }) => (
               <TextInput style={[styles.input, styles.readOnlyInput]} value={value} onChangeText={onChange} editable={false} />
             )} />
           </View>
           <View style={{ flex: 1 }}>
             <Text style={styles.inputLabel}>Last Name</Text>
             <Controller control={control} name="lastName" render={({ field: { onChange, value } }) => (
               <TextInput style={[styles.input, styles.readOnlyInput]} value={value} onChangeText={onChange} editable={false} />
             )} />
           </View>
        </View>

        <View style={styles.rowGap}>
           <View style={{ flex: 1 }}>
              <Text style={styles.inputLabel}>Date of Birth</Text>
              <Controller control={control} name="dob" render={({ field: { onChange, value } }) => (
                 <TouchableOpacity onPress={() => setShowDobPicker(true)} style={[styles.input, styles.readOnlyInput, { justifyContent: 'center' }]}>
                    <Text style={{ color: value ? COLORS.textMain : '#94A3B8' }}>{value ? moment(value).format('MMM DD, YYYY') : 'Select'}</Text>
                 </TouchableOpacity>
              )} />
           </View>
           <View style={{ flex: 1 }}>
              <Text style={styles.inputLabel}>Sex</Text>
              <View style={styles.segmentControl}>
                {['male', 'female'].map((s) => (
                   <Controller key={s} control={control} name="sex" render={({ field: { onChange, value } }) => (
                      <TouchableOpacity onPress={() => onChange(s)} style={[styles.segmentBtn, value === s && styles.segmentBtnActive]}>
                        <Text style={[styles.segmentText, value === s && styles.segmentTextActive]}>{s.charAt(0).toUpperCase() + s.slice(1)}</Text>
                      </TouchableOpacity>
                   )} />
                ))}
              </View>
           </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Notes (Optional)</Text>
          <Controller control={control} name="notes" render={({ field: { onChange, value } }) => (
             <TextInput style={[styles.input, { height: 80, paddingTop: 12 }]} value={value} onChangeText={onChange} multiline placeholder="Medical history, allergies..." placeholderTextColor="#94A3B8" />
          )} />
        </View>
      </View>

      {errors.root && (
        <View style={styles.errorBanner}>
          <Feather name="alert-circle" size={20} color="#B91C1C" />
          <Text style={styles.errorBannerText}>{errors.root.message}</Text>
        </View>
      )}

      <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit(onConfirm, onInvalid)} activeOpacity={0.8}>
        <Text style={styles.submitBtnText}>Confirm Booking</Text>
        <Feather name="arrow-right" size={20} color="#fff" />
      </TouchableOpacity>

      {/* Date Picker Modal */}
      <Modal visible={showDobPicker} transparent animationType="fade">
         <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
               <Calendar onDayPress={(d) => { setValue('dob', d.dateString); setShowDobPicker(false); }} maxDate={moment().format('YYYY-MM-DD')} />
               <TouchableOpacity style={styles.modalClose} onPress={() => setShowDobPicker(false)}>
                 <Text style={styles.modalCloseText}>Close</Text>
               </TouchableOpacity>
            </View>
         </View>
      </Modal>
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />
      
      {/* Header */}
     

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <View style={styles.tabWrapper}>
          {['upcoming', 'past', 'book'].map((t) => (
            <TouchableOpacity 
              key={t} 
              style={[styles.tabBtn, activeTab === t && styles.tabBtnActive]} 
              onPress={() => setActiveTab(t as Tab)}
            >
               <Text style={[styles.tabText, activeTab === t && styles.tabTextActive]}>
                 {t === 'book' ? 'New Booking' : t.charAt(0).toUpperCase() + t.slice(1)}
               </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {activeTab === 'book' ? renderBookingForm() : (
          <FlatList
            data={filteredAppointments}
            keyExtractor={(i) => i.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            renderItem={renderAppointmentCard}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                 <Feather name="calendar" size={40} color="#CBD5E1" />
                 <Text style={[styles.emptyStateText, { fontSize: 16, marginTop: 12 }]}>No appointments found.</Text>
              </View>
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { flex: 1 },
  
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: COLORS.bg,
  },
  headerTitle: { fontSize: 28, fontWeight: '800', color: COLORS.textMain, letterSpacing: -0.5 },
  historyBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.primarySoft, alignItems: 'center', justifyContent: 'center' },

  // Tabs
  tabContainer: { paddingHorizontal: 20, marginBottom: 10 },
  tabWrapper: { flexDirection: 'row', backgroundColor: '#E2E8F0', borderRadius: 12, padding: 4 },
  tabBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  tabBtnActive: { backgroundColor: '#fff', ...SHADOW },
  tabText: { fontSize: 13, fontWeight: '600', color: COLORS.textSec },
  tabTextActive: { color: COLORS.textMain },

  // Lists
  listContent: { padding: 20, paddingBottom: 100 },
  bookingContent: { padding: 20, paddingBottom: 120 },

  // Cards
  card: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    ...SHADOW,
  },
  cardDate: { 
    alignItems: 'center', 
    justifyContent: 'center', 
    backgroundColor: COLORS.primarySoft, 
    borderRadius: 12, 
    width: 60, 
    height: 60, 
    marginRight: 16 
  },
  cardDay: { fontSize: 20, fontWeight: '800', color: COLORS.primary },
  cardMonth: { fontSize: 12, fontWeight: '600', color: COLORS.primary, textTransform: 'uppercase' },
  cardContent: { flex: 1, justifyContent: 'center' },
  cardTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textMain },
  cardSubtitle: { fontSize: 14, color: COLORS.textSec, marginTop: 2 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  cardMetaText: { fontSize: 12, color: COLORS.textSec, marginLeft: 6 },
  calendarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 'auto',
    backgroundColor: COLORS.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  calendarButtonText: {
    marginLeft: 4,
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '600',
  },

  // Booking Form Sections
  sectionContainer: { marginBottom: 24 },
  sectionHeader: { fontSize: 18, fontWeight: '700', color: COLORS.textMain, marginBottom: 12 },
  
  // Calendar
  calendarWrapper: { borderRadius: 16, overflow: 'hidden', ...SHADOW, backgroundColor: '#fff' },
  
  // Time Slots
  timeChip: { 
    paddingVertical: 10, paddingHorizontal: 16, 
    borderRadius: 20, backgroundColor: '#fff', 
    borderWidth: 1, borderColor: COLORS.border 
  },
  timeChipSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  timeChipText: { fontSize: 14, fontWeight: '600', color: COLORS.textMain },
  timeChipTextSelected: { color: '#fff' },

  // Scan Cards
  scanCard: {
    width: 140, padding: 16, borderRadius: 16,
    backgroundColor: '#fff', marginRight: 12,
    borderWidth: 1, borderColor: COLORS.border,
    ...SHADOW
  },
  scanCardSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  scanIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: COLORS.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  scanCardTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textMain, marginBottom: 4 },

  // Scan Details
  detailsCard: { marginTop: 16, padding: 16, backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1, borderColor: COLORS.border },
  detailsTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textMain },
  detailsDesc: { fontSize: 13, color: COLORS.textSec, marginTop: 6, lineHeight: 20 },
  detailsLabel: { fontSize: 13, fontWeight: '600', color: COLORS.textMain, marginTop: 12, marginBottom: 6 },
  bulletRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  bullet: { width: 4, height: 4, borderRadius: 2, backgroundColor: COLORS.primary, marginRight: 8 },
  bulletText: { fontSize: 13, color: COLORS.textSec },

  // Inputs
  inputGroup: { marginBottom: 16 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: COLORS.textMain, marginBottom: 6 },
  input: { 
    backgroundColor: COLORS.inputBg, borderRadius: 12, 
    paddingHorizontal: 16, height: 50, 
    fontSize: 15, color: COLORS.textMain 
  },
  readOnlyInput: { backgroundColor: '#F1F5F9', opacity: 0.7, color: COLORS.textSec },
  rowGap: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  errorText: { color: COLORS.error, fontSize: 12, marginTop: 4 },

  // Segment Control (Sex)
  segmentControl: { flexDirection: 'row', backgroundColor: COLORS.inputBg, borderRadius: 12, padding: 4, height: 50 },
  segmentBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  segmentBtnActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
  segmentText: { fontSize: 13, color: COLORS.textSec, fontWeight: '500' },
  segmentTextActive: { color: COLORS.textMain, fontWeight: '600' },

  // Submit
  submitBtn: { 
    backgroundColor: COLORS.primary, flexDirection: 'row', 
    alignItems: 'center', justifyContent: 'center', 
    paddingVertical: 16, borderRadius: 16, 
    ...SHADOW, shadowColor: COLORS.primary 
  },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700', marginRight: 8 },
  errorBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF2F2', padding: 12, borderRadius: 12, marginBottom: 16 },
  errorBannerText: { color: '#B91C1C', marginLeft: 8, fontSize: 13, flex: 1 },

  // Empty States
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 20 },
  emptyStateText: { color: COLORS.textSec, fontStyle: 'italic' },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', borderRadius: 20, padding: 20, ...SHADOW },
  modalClose: { marginTop: 16, alignSelf: 'center', padding: 10 },
  modalCloseText: { color: COLORS.primary, fontWeight: '600' }
});