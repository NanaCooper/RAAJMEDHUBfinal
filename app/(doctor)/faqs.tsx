import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity,
  LayoutAnimation,
  Platform,
  Linking
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';



const COLORS = {
  bg: "#F8FAFC",
  surface: "#FFFFFF",
  primary: "#4F46E5",
  textMain: "#1E293B",
  textSec: "#64748B",
  border: "#E2E8F0",
};

const FAQ_DATA = [
  {
    question: "How do I upload medical reports?",
    answer: "Go to the 'Reports' tab, search for the patient, and select 'Upload Request'. You can then attach files and add clinical notes for the patient to view."
  },
  {
    question: "How can I set my availability?",
    answer: "Navigate to 'Availability' from the main menu. You can set your daily working hours and block off specific dates when you are away."
  },
  {
    question: "How do I contact clinic administration?",
    answer: "For administrative issues or schedule conflicts, please email raajmedhub@gmail.com or call our hotline at +233559559910."
  },
  {
    question: "Can I edit a patient's diagnosis?",
    answer: "Yes, you can update a patient's clinical records through the 'My Patients' section. Select a patient and update their history or active conditions."
  },
  {
    question: "Is my professional data secure?",
    answer: "Absolutely. Raaj Medhub uses HIPAA-compliant security standards to ensure all patient-doctor communications and records remain encrypted and private."
  }
];

const FAQItem = ({ question, answer }: any) => {
  const [expanded, setExpanded] = useState(false);

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(!expanded);
  };

  return (
    <TouchableOpacity style={styles.faqItem} onPress={toggle} activeOpacity={0.7}>
      <View style={styles.faqHeader}>
        <Text style={styles.question}>{question}</Text>
        <Feather name={expanded ? "chevron-up" : "chevron-down"} size={20} color={COLORS.textSec} />
      </View>
      {expanded && (
        <View style={styles.faqBody}>
          <Text style={styles.answer}>{answer}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

export default function DoctorFAQsScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />
      
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={() => router.push('/(doctor)/settings')}>
          <Feather name="arrow-left" size={20} color={COLORS.textMain} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Professional Help</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.introBox}>
          <Feather name="book-open" size={40} color={COLORS.primary} />
          <Text style={styles.introTitle}>Doctor&apos;s Guide</Text>
          <Text style={styles.introSub}>Common questions about managing your practice on Raaj Medhub.</Text>
        </View>

        <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
        {FAQ_DATA.map((item, index) => (
          <FAQItem key={index} question={item.question} answer={item.answer} />
        ))}

        <View style={styles.supportCard}>
          <Text style={styles.supportTitle}>Need Admin Support?</Text>
          <Text style={styles.supportText}>
            Our technical team is ready to assist you.{"\n"}
            Email: raajmedhub@gmail.com{"\n"}
            Phone: +233559559910
          </Text>
          <View style={styles.supportActions}>
            <TouchableOpacity 
              style={styles.supportBtn} 
              onPress={() => Linking.openURL('mailto:raajmedhub@gmail.com')}
            >
              <Feather name="mail" size={16} color={COLORS.primary} />
              <Text style={styles.supportBtnText}>Email Admin</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.supportBtn, { marginLeft: 10 }]} 
              onPress={() => Linking.openURL('tel:+233559559910')}
            >
              <Feather name="phone" size={16} color={COLORS.primary} />
              <Text style={styles.supportBtnText}>Call Admin</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: COLORS.surface,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: COLORS.textMain, letterSpacing: -0.5 },
  content: { padding: 20 },
  introBox: {
    alignItems: 'center',
    paddingVertical: 30,
    marginBottom: 20,
  },
  introTitle: { fontSize: 22, fontWeight: '800', color: COLORS.textMain, marginTop: 16 },
  introSub: { fontSize: 14, color: COLORS.textSec, textAlign: 'center', marginTop: 8, paddingHorizontal: 20 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textSec,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 16,
  },
  faqItem: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  question: { fontSize: 15, fontWeight: '700', color: COLORS.textMain, flex: 1, marginRight: 10 },
  faqBody: { marginTop: 12, borderTopWidth: 1, borderTopColor: COLORS.bg, paddingTop: 12 },
  answer: { fontSize: 14, color: COLORS.textSec, lineHeight: 20 },
  supportCard: {
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    padding: 24,
    marginTop: 20,
    alignItems: 'center',
    marginBottom: 40,
  },
  supportTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },
  supportText: { fontSize: 14, color: 'rgba(255,255,255,0.8)', textAlign: 'center', marginTop: 8, marginBottom: 20 },
  supportBtn: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  supportBtnText: { color: COLORS.primary, fontWeight: '700', fontSize: 14, marginLeft: 8 },
  supportActions: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    marginTop: 5,
  },
});
