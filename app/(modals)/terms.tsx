import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
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

const PolicySection = ({ title, content }: { title: string; content: string }) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>{title}</Text>
    <Text style={styles.sectionContent}>{content}</Text>
  </View>
);

export default function TermsAndPolicyModal() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Header with Close button for Modal */}
      <View style={styles.header}>
        <View style={{ width: 40 }} />
        <Text style={styles.headerTitle}>Terms & Policy</Text>
        <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
          <Feather name="x" size={20} color={COLORS.textMain} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.introBox}>
          <Text style={styles.lastUpdated}>Last Updated: March 31, 2026</Text>
          <Text style={styles.introText}>
            At MediCare, we are committed to protecting your personal health information (PHI). 
            This Privacy Policy explains how we collect, use, and safe-guard your data.
          </Text>
        </View>

        <PolicySection 
          title="1. Information We Collect"
          content="• Profile Data: Your name, age, phone number, and email.
• Medical Documentation: Images of referrals and medical records that you upload.
• Usage Data: We collect minimal technical data via Firebase for app performance and crash reports."
        />

        <PolicySection 
          title="2. How We Use Information"
          content="• To manage and schedule your medical appointments.
• To provide doctors with necessary medical history for your consults.
• To send appointment reminders via notifications."
        />

        <PolicySection 
          title="3. Data Storage and Security"
          content="• Firebase Encryption: All data is stored using Google's secure Firebase infrastructure with industry-standard encryption at rest and in transit.
• Local Security: Sensitive session identifiers are stored using expo-secure-store on your device."
        />

        <PolicySection 
          title="4. Your Rights"
          content="You can request a copy of your medical data or ask for the deletion of your account at any time via the settings menu in the MediCare app."
        />

        <PolicySection 
          title="5. Third-Party Sharing"
          content="We do not sell your medical data to third parties. Data is shared only with the medical professionals at your chosen branch (Koforidua, Takoradi, or Cape Coast)."
        />

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            By using MediCare, you agree to these terms. If you have any questions, 
            please contact our support team.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 18,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textMain,
  },
  scrollContent: { padding: 20, paddingBottom: 60 },
  introBox: {
    marginBottom: 24,
  },
  lastUpdated: {
    fontSize: 12,
    color: COLORS.textSec,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  introText: {
    fontSize: 16,
    color: COLORS.textMain,
    lineHeight: 24,
    fontWeight: '500',
  },
  section: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.primary,
    marginBottom: 12,
  },
  sectionContent: {
    fontSize: 14,
    color: COLORS.textSec,
    lineHeight: 22,
  },
  footer: {
    marginTop: 20,
    padding: 20,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 13,
    color: COLORS.textSec,
    textAlign: 'center',
    lineHeight: 20,
  },
});
