import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Easing,
  Dimensions,
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { Drawer } from "expo-router/drawer";
import { useRouter, usePathname } from "expo-router";
import { useAuth } from "../../hooks/useAuth";
import { Feather } from "@expo/vector-icons";

// --- THEME ENGINE ---
const THEME = {
  primary: "#4F46E5",
  primaryDark: "#4338CA",
  secondary: "#0EA5E9",
  accent: "#818CF8",
  bg: "#F8FAFC",
  surface: "#FFFFFF",
  text: "#0F172A",
  muted: "#94A3B8",
  success: "#10B981",
  danger: "#EF4444",
};

const { width } = Dimensions.get('window');

// --- INTERACTIVE COMPONENT: SCALE BUTTON ---
// Gives a physical "press" feel to every interaction
const ScaleButton = ({ onPress, style, children, activeScale = 0.96 }: any) => {
  const scaleValue = useRef(new Animated.Value(1)).current;

  const onPressIn = () => {
    Animated.spring(scaleValue, {
      toValue: activeScale,
      useNativeDriver: true,
      speed: 20,
      bounciness: 10,
    }).start();
  };

  const onPressOut = () => {
    Animated.spring(scaleValue, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 10,
    }).start();
  };

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      onPress={onPress}
    >
      <Animated.View style={[style, { transform: [{ scale: scaleValue }] }]}>
        {children}
      </Animated.View>
    </TouchableOpacity>
  );
};

// --- DRAWER CONTENT ---
function CustomDrawerContent(props: any) {
  const router = useRouter();
  const pathname = usePathname();
  const { signOut } = useAuth();

  // Animation Values
  const fadeAnim = useRef(new Animated.Value(0)).current;


  // Staggered Entry Animation
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
      easing: Easing.out(Easing.cubic),
    }).start();
  }, [fadeAnim]);

  const menuItems = [
    { label: "Dashboard", route: "/(patient)/", icon: "grid", badge: null },
    { label: "Make a Request", route: "/(patient)/appointments", icon: "calendar", badge: null },
    { label: "My Reports", route: "/(patient)/reports", icon: "file-text", badge: null },
    { label: "Profile", route: "/(patient)/profile", icon: "user", badge: null },
    { label: "Find Locations", route: "/(patient)/branches", icon: "map-pin", badge: null },
    { label: "Settings", route: "/(patient)/settings", icon: "sliders", badge: null },
  ];

  return (
    <View style={styles.container}>
      {/* Dynamic Background */}
      <View style={styles.bgBlobs}>
        <View style={[styles.blob, styles.blob1]} />
        <View style={[styles.blob, styles.blob2]} />
      </View>

      <SafeAreaView style={styles.safeArea}>



        {/* 2. MENU ITEMS */}
        <ScrollView contentContainerStyle={styles.menuContainer} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionLabel}>MAIN MENU</Text>

          {menuItems.map((item, index) => {
            const isActive = pathname === item.route;
            // Calculate delay for cascade effect (intended for future use)

            return (
              <ScaleButton
                key={item.label}
                onPress={() => {
                  props.navigation.closeDrawer();
                  router.push(item.route as any);
                }}
              >
                <Animated.View
                  style={[
                    styles.menuItem,
                    isActive && styles.menuItemActive,
                    // Simple inline fade-in for list items
                    { opacity: fadeAnim }
                  ]}
                >
                  <View style={[styles.iconBox, isActive && styles.iconBoxActive]}>
                    <Feather name={item.icon as any} size={20} color={isActive ? "#FFF" : THEME.muted} />
                  </View>

                  <Text style={[styles.menuLabel, isActive && styles.menuLabelActive]}>
                    {item.label}
                  </Text>

                  {item.badge && !isActive && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{item.badge}</Text>
                    </View>
                  )}

                  {isActive && <Feather name="chevron-right" size={18} color={THEME.primary} />}
                </Animated.View>
              </ScaleButton>
            );
          })}



        </ScrollView>

        {/* 3. FOOTER */}
        <View style={styles.footer}>
          <ScaleButton
            onPress={async () => {
              props.navigation.closeDrawer();
              try { await signOut(); } catch { }
              router.replace('/login');
            }}
          >
            <View style={styles.logoutBtn}>
              <View style={styles.logoutIcon}>
                <Feather name="log-out" size={20} color="#FFF" />
              </View>
              <Text style={styles.logoutText}>Sign Out</Text>
            </View>
          </ScaleButton>
          <Text style={styles.version}>Raaj Medhub v1.0</Text>
        </View>

      </SafeAreaView>
    </View>
  );
}

export default function PatientLayout() {
  return (
    <Drawer
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        drawerStyle: { width: width * 0.85, backgroundColor: "transparent" },
        drawerType: "slide",
        headerShown: true,
        headerStyle: { backgroundColor: THEME.bg, elevation: 0, shadowOpacity: 0 },
        headerTintColor: THEME.text,
        headerTitleStyle: { fontWeight: "800", fontSize: 18 },
        overlayColor: 'rgba(15, 23, 42, 0.7)',
      }}
    >
      <Drawer.Screen name="index" options={{ title: "Dashboard" }} />
      <Drawer.Screen name="appointments" options={{ title: "Appointments" }} />
      <Drawer.Screen name="reports" options={{ title: "My Reports" }} />
      <Drawer.Screen name="profile" options={{ title: "Profile" }} />
      <Drawer.Screen name="branches" options={{ title: "Locations" }} />
      <Drawer.Screen name="settings" options={{ title: "Settings" }} />
    </Drawer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.bg,
    overflow: 'hidden',
    borderTopRightRadius: 30,
    borderBottomRightRadius: 30,
  },
  safeArea: {
    flex: 1,
  },
  // Ambient Background
  bgBlobs: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    zIndex: -1,
  },
  blob: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.15,
  },
  blob1: {
    width: 300,
    height: 300,
    backgroundColor: THEME.primary,
    top: -100,
    left: -100,
  },
  blob2: {
    width: 250,
    height: 250,
    backgroundColor: THEME.secondary,
    bottom: -50,
    right: -50,
  },

  // 1. PROFILE HEADER
  headerContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
    marginBottom: 10,
  },
  profileCardWrapper: {
    width: '100%',
    shadowColor: THEME.primary,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 10,
  },
  profileCard: {
    borderRadius: 24,
    padding: 20,
    position: 'relative',
    overflow: 'hidden',
  },
  cardTexture: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFF',
    opacity: 0.05,
    transform: [{ rotate: '45deg' }, { scale: 2 }],
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarWrapper: {
    position: 'relative',
    marginRight: 16,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  statusDot: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: THEME.success,
    borderWidth: 2,
    borderColor: THEME.primary,
  },
  profileTexts: {
    flex: 1,
  },
  welcomeText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  nameText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
  },
  planBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  planText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 16,
    padding: 12,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
  },
  statLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 10,
    marginTop: 2,
    fontWeight: '600',
  },
  verticalDivider: {
    width: 1,
    height: '80%',
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignSelf: 'center',
  },

  // 2. MENU
  menuContainer: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 40,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.muted,
    letterSpacing: 1.2,
    marginBottom: 12,
    marginLeft: 8,
    marginTop: 24,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    marginBottom: 10,
    borderRadius: 18,
    backgroundColor: 'transparent', // Default
  },
  menuItemActive: {
    backgroundColor: '#FFF',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  iconBoxActive: {
    backgroundColor: THEME.primary,
    shadowColor: THEME.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  menuLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: THEME.text,
    flex: 1,
  },
  menuLabelActive: {
    color: THEME.primaryDark,
    fontWeight: '700',
  },
  badge: {
    backgroundColor: THEME.danger,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 10,
    marginHorizontal: 10,
  },

  // Custom Controls
  toggleSwitch: {
    width: 40,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E2E8F0',
    padding: 2,
  },
  toggleKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFF',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },

  // 3. FOOTER
  footer: {
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.danger,
    paddingVertical: 16,
    borderRadius: 20,
    shadowColor: THEME.danger,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  logoutIcon: {
    marginRight: 10,
  },
  logoutText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
  },
  version: {
    textAlign: 'center',
    marginTop: 16,
    color: THEME.muted,
    fontSize: 11,
    fontWeight: '500',
  },
});