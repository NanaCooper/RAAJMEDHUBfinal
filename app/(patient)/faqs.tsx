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
import { APP_NAME } from '../../constants/AppStrings';



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
    question: "How do I book an appointment?",
    answer: "Go to the Home screen, find your preferred doctor or branch, and tap 'Book Appointment'. Select an available time slot and confirm your details."
  },
  {
    question: "Where can I see my reports?",
    answer: "All your uploaded scans and reports are available in the 'Reports' tab at the bottom of the screen."
  },
  {
    question: "How do I contact support?",
    answer: "You can reach us via the 'Support' section below or email us at raajmedhub@gmail.com. You can also call us at +233559559910."
  },
  {
    question: "Is my data secure?",
    answer: "Yes, we use industry-standard encryption and Firebase's secure storage to ensure your personal information remains private and protected."
  },
  {
    question: "How can I update my profile?",
    answer: "Navigate to Settings > Personal Information. You can update your phone number, preferences, and profile photo there."
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

export default function FAQsScreen() {
  const router = useRouter();

  if (Platform.OS === 'android') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar style="dark" />
        
        <View style={styles.header}>
          <TouchableOpacity style={styles.iconButton} onPress={() => router.push('/(patient)/settings')}>
            <Feather name="arrow-left" size={20} color={COLORS.textMain} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Help & Support</Text>
          <View style={{ width: 44 }} />
        </View>

        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
            <Feather name="help-circle" size={36} color="#4F46E5" />
          </View>
          <Text style={{ fontSize: 24, fontWeight: '800', color: '#1E293B', textAlign: 'center', marginBottom: 12 }}>
            Help Desk Coming Soon
          </Text>
          <Text style={{ fontSize: 15, color: '#64748B', textAlign: 'center', lineHeight: 24 }}>
            Our online support center and FAQs are being updated. For any immediate assistance, please contact us directly.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />
      
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={() => router.push('/(patient)/settings')}>
          <Feather name="arrow-left" size={20} color={COLORS.textMain} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Help & FAQs</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.introBox}>
          <Feather name="help-circle" size={40} color={COLORS.primary} />
          <Text style={styles.introTitle}>How can we help you?</Text>
          <Text style={styles.introSub}>Find answers to frequently asked questions or learn how to navigate {APP_NAME}.</Text>
        </View>

        <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
        {FAQ_DATA.map((item, index) => (
          <FAQItem key={index} question={item.question} answer={item.answer} />
        ))}

        <View style={styles.supportCard}>
          <Text style={styles.supportTitle}>Still need help?</Text>
          <Text style={styles.supportText}>
            Our support team is ready to assist you with any issues.{"\n"}
            Email: raajmedhub@gmail.com{"\n"}
            Phone: +233559559910
          </Text>
          <View style={styles.supportActions}>
            <TouchableOpacity 
              style={styles.supportBtn} 
              onPress={() => Linking.openURL('mailto:raajmedhub@gmail.com')}
            >
              <Feather name="mail" size={16} color={COLORS.primary} />
              <Text style={styles.supportBtnText}>Email Us</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.supportBtn, { marginLeft: 10 }]} 
              onPress={() => Linking.openURL('tel:+233559559910')}
            >
              <Feather name="phone" size={16} color={COLORS.primary} />
              <Text style={styles.supportBtnText}>Call Us</Text>
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
