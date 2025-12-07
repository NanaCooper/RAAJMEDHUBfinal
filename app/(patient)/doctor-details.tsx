import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Image, TouchableOpacity, Linking } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { getDoctor } from '../../services/doctors';

const COLORS = {
  bg: '#F8FAFC',
  surface: '#FFFFFF',
  primary: '#4F46E5',
  textMain: '#1E293B',
  textSec: '#64748B',
  border: '#E2E8F0',
};

export default function DoctorDetailsScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [doctor, setDoctor] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDoctor() {
      if (typeof id === 'string') {
        const doc = await getDoctor(id);
        setDoctor(doc);
      }
      setLoading(false);
    }
    fetchDoctor();
  }, [id]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  if (!doctor) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <Text style={styles.errorText}>Doctor not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const handleCall = () => {
    if (doctor.contact) {
      Linking.openURL(`tel:${doctor.contact}`);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={24} color={COLORS.textMain} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Doctor Details</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <View style={styles.avatarContainer}>
             {doctor.photoURL ? (
                <Image source={{ uri: doctor.photoURL }} style={styles.avatar} />
             ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarText}>{doctor.fullName?.charAt(0) || 'D'}</Text>
                </View>
             )}
          </View>
          
          <Text style={styles.name}>{doctor.fullName}</Text>
          <Text style={styles.specialty}>{doctor.specialization || 'General Practice'}</Text>
          
          <View style={styles.divider} />
          
          <View style={styles.infoRow}>
            <Feather name="mail" size={18} color={COLORS.textSec} />
            <Text style={styles.infoText}>{doctor.email}</Text>
          </View>
          
          {doctor.contact && (
            <View style={styles.infoRow}>
              <Feather name="phone" size={18} color={COLORS.textSec} />
              <Text style={styles.infoText}>{doctor.contact}</Text>
              <TouchableOpacity style={styles.callBtn} onPress={handleCall}>
                <Text style={styles.callBtnText}>Call</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>About</Text>
          <Text style={styles.bio}>{doctor.bio || "No biography available."}</Text>

          <View style={styles.divider} />

          
          
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  center: { justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20 },
  backBtn: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.textMain },
  content: { padding: 20 },
  card: { backgroundColor: COLORS.surface, borderRadius: 20, padding: 24, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  avatarContainer: { marginBottom: 16 },
  avatar: { width: 100, height: 100, borderRadius: 50 },
  avatarPlaceholder: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#E0E7FF', justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 32, fontWeight: 'bold', color: COLORS.primary },
  name: { fontSize: 22, fontWeight: 'bold', color: COLORS.textMain, marginBottom: 4 },
  specialty: { fontSize: 16, color: COLORS.textSec, marginBottom: 16 },
  divider: { width: '100%', height: 1, backgroundColor: COLORS.border, marginVertical: 16 },
  infoRow: { flexDirection: 'row', alignItems: 'center', width: '100%', marginBottom: 12 },
  infoText: { marginLeft: 12, fontSize: 16, color: COLORS.textMain, flex: 1 },
  callBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  callBtnText: { color: '#fff', fontWeight: '600', fontSize: 12 },
  sectionTitle: { alignSelf: 'flex-start', fontSize: 18, fontWeight: 'bold', color: COLORS.textMain, marginBottom: 8 },
  bio: { alignSelf: 'flex-start', fontSize: 14, color: COLORS.textSec, lineHeight: 22 },
  errorText: { fontSize: 18, color: COLORS.textSec, marginBottom: 20 },
  backButton: { padding: 12, backgroundColor: COLORS.primary, borderRadius: 8 },
  backButtonText: { color: '#fff', fontWeight: 'bold' },
  bookBtn: { width: '100%', backgroundColor: COLORS.primary, paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  bookBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
