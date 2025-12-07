import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Linking, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { listDoctors } from '../../services/doctors';
import { useAuth } from '../../hooks/useAuth';

const COLORS = {
  bg: '#F8FAFC',
  surface: '#FFFFFF',
  primary: '#0A2463',
  textMain: '#1E293B',
  textSec: '#64748B',
  border: '#E2E8F0',
};

const SHADOW = {
  shadowColor: '#0A2463',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.06,
  shadowRadius: 12,
  elevation: 3,
};

const MyDoctorsScreen = () => {
  const router = useRouter();
  const [doctors, setDoctors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    const fetchDoctors = async () => {
      try {
        const doctorList = await listDoctors();
        setDoctors(doctorList);
      } catch (error) {
        console.error("Failed to fetch doctors:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDoctors();
  }, []);

  const handleCall = (phoneNumber: string) => {
    if (phoneNumber) {
      Linking.openURL(`tel:${phoneNumber}`);
    }
  };

  const renderDoctorCard = ({ item }: { item: any }) => (
    <TouchableOpacity 
      style={styles.card} 
      onPress={() => router.push({ pathname: "/(patient)/doctor-details", params: { id: item.id } })}
    >
      <View style={styles.cardHeader}>
        <View style={styles.avatarContainer}>
          <Text style={styles.avatarText}>{item.fullName?.charAt(0) || 'D'}</Text>
        </View>
        <View style={styles.infoContainer}>
          <Text style={styles.doctorName}>{item.fullName}</Text>
          <Text style={styles.doctorSpecialty}>{item.specialization || 'General Practice'}</Text>
        </View>
        <TouchableOpacity style={styles.callButton} onPress={() => handleCall(item.contact)}>
          <Feather name="phone" size={20} color={COLORS.primary} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Doctors</Text>
      </View>
      <FlatList
        data={doctors}
        renderItem={renderDoctorCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Text style={styles.emptyText}>No doctors found.</Text>}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.textMain,
  },
  listContent: {
    padding: 20,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    ...SHADOW,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#E0E7FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  infoContainer: {
    flex: 1,
  },
  doctorName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textMain,
  },
  doctorSpecialty: {
    fontSize: 14,
    color: COLORS.textSec,
  },
  callButton: {
    padding: 10,
    borderRadius: 20,
    backgroundColor: '#E0E7FF',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
    color: COLORS.textSec,
  },
});

export default MyDoctorsScreen;
