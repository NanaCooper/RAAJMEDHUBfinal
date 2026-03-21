import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Linking,
  Alert,
  Share,
  Platform,
  FlatList
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { getPatientReports, Report } from '../../services/reports';

// --- Global Theme ---
const COLORS = {
  bg: '#F8FAFC',
  card: '#FFFFFF',
  primary: '#4F46E5',
  primaryDark: '#312E81',
  textMain: '#1E293B',
  textSec: '#64748B',
  accent: '#EEF2FF',
  success: '#10B981',
  warning: '#F59E0B',
  border: '#E2E8F0',
};
const SPACING = 20;

export default function ReportsScreen() {
  const { session } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReports = useCallback(async (isRefresh = false) => {
    if (!session?.uid) return;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const data = await getPatientReports(session.uid);
      console.log('[Reports] Fetched reports count:', data.length, data.map(r => ({ id: r.id, title: r.title, status: r.status })));
      const sorted = data.sort((a, b) => {
        if (a.status !== b.status) return a.status === 'ready' ? -1 : 1;
        const da = a.createdAt?.seconds || 0;
        const db = b.createdAt?.seconds || 0;
        return db - da; 
      });
      setReports(sorted);
    } catch (_err: any) {
      setError('Could not connect. Pull down to try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session?.uid]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const formatDate = (createdAt: any): string => {
    if (!createdAt) return 'Date Unavailable';
    const ts = createdAt.seconds ? new Date(createdAt.seconds * 1000) : new Date(createdAt);
    return ts.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const handleShare = async (report: Report) => {
    const url = report.fileUrl || report.reportUrl;
    if (!url) {
      Alert.alert('Not Ready', 'This report file is not available to share yet.');
      return;
    }
    
    try {
      const message = `Medical Report: ${report.title}\nDate: ${formatDate(report.createdAt)}\nLink: ${url}`;
      
      const result = await Share.share({
        message,
        url: Platform.OS === 'ios' ? url : undefined,
        title: report.title,
      });

      if (result.action === Share.sharedAction) {
        if (result.activityType) {
          // shared with activity type
        } else {
          // shared
        }
      } else if (result.action === Share.dismissedAction) {
        // dismissed
      }
    } catch (error: any) {
      Alert.alert('Share Error', error.message);
    }
  };

  const [downloading, setDownloading] = useState<string | null>(null);

  const handleDownload = async (report: Report) => {
    const url = report.fileUrl || report.reportUrl;
    if (!url) {
      Alert.alert('Not Ready', 'This report file is not available yet.');
      return;
    }

    try {
      setDownloading(report.id || null);
      // Open the file URL in the browser — triggers native download for PDFs
      await Linking.openURL(url);
    } catch (error: any) {
      console.error('[Reports] Download error:', error);
      Alert.alert('Download Error', error.message || 'Something went wrong.');
    } finally {
      setDownloading(null);
    }
  };

  const renderStatus = (status: string) => {
    const isReady = status === 'ready';
    return (
      <View
        style={[
          styles.statusBadge,
          isReady ? styles.statusBadgeReady : styles.statusBadgeProcessing,
        ]}
      >
        <View
          style={[
            styles.statusDot,
            { backgroundColor: isReady ? COLORS.success : COLORS.warning },
          ]}
        />
        <Text
          style={[
            styles.statusText,
            { color: isReady ? COLORS.success : '#b45309' },
          ]}
        >
          {isReady ? 'Ready' : 'Processing'}
        </Text>
      </View>
    );
  };

  const renderReportCard = ({ item }: { item: Report }) => {
    const isReady = item.status === 'ready';

    return (
      <View style={[styles.card, !isReady && { opacity: 0.85 }]}>
        <View style={styles.cardHeader}>
          <View style={styles.iconContainer}>
            <Feather name="file-text" size={24} color={COLORS.primary} />
          </View>
          <View style={styles.cardTitleArea}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.cardDate}>{formatDate(item.createdAt)}</Text>
          </View>
          {renderStatus(item.status)}
        </View>

        {isReady && (
          <View style={styles.cardFooter}>
            <TouchableOpacity
              style={[styles.actionBtn, { borderRightWidth: 1, borderColor: COLORS.border }]}
              onPress={() => Linking.openURL((item.fileUrl || item.reportUrl)!)}
            >
              <Feather name="eye" size={18} color={COLORS.primary} />
              <Text style={styles.actionBtnText}>View</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, { borderRightWidth: 1, borderColor: COLORS.border }]}
              onPress={() => handleDownload(item)}
              disabled={downloading === item.id}
            >
              {downloading === item.id ? (
                <ActivityIndicator size={18} color={COLORS.primary} />
              ) : (
                <Feather name="download" size={18} color={COLORS.primary} />
              )}
              <Text style={styles.actionBtnText}>{downloading === item.id ? 'Saving...' : 'Download'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionBtn} onPress={() => handleShare(item)}>
              <Feather name="share-2" size={18} color={COLORS.primary} />
              <Text style={styles.actionBtnText}>Share</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <Text style={styles.headerSubtitle}>
        Access and share your medical results securely.
      </Text>
    </View>
  );

  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.statusMsg}>Loading your reports...</Text>
        </View>
      );
    }
    
    if (error) {
      return (
        <View style={styles.centerContainer}>
          <Feather name="wifi-off" size={48} color={COLORS.textSec} style={{ marginBottom: 12 }} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => fetchReports()}>
            <Text style={styles.retryBtnText}>Retry Connection</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <FlatList
        data={reports}
        keyExtractor={(item) => item.id ?? item.title}
        renderItem={renderReportCard}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchReports(true)}
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
          />
        }
        ListEmptyComponent={
          <View style={styles.centerContainer}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="folder-open-outline" size={40} color={COLORS.primary} />
            </View>
            <Text style={styles.emptyMainText}>No Reports Available</Text>
            <Text style={styles.emptySubText}>
              Any physical or imaging scans requested by your doctor will appear here once processed.
            </Text>
          </View>
        }
      />
    );
  };

  return (
    <SafeAreaView style={styles.screen} edges={['bottom']}>
      {renderHeader()}
      {renderContent()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  header: {
    paddingHorizontal: SPACING,
    paddingTop: Platform.OS === 'android' ? 40 : 20,
    paddingBottom: 16,
    backgroundColor: COLORS.bg,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.textMain,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 15,
    color: COLORS.textSec,
    lineHeight: 22,
  },
  listContent: {
    paddingHorizontal: SPACING,
    paddingTop: 8,
    paddingBottom: 40,
    gap: 16,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  cardTitleArea: {
    flex: 1,
    justifyContent: 'center',
    marginRight: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textMain,
    marginBottom: 4,
  },
  cardDate: {
    fontSize: 13,
    color: COLORS.textSec,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  statusBadgeReady: {
    backgroundColor: '#ECFDF5',
  },
  statusBadgeProcessing: {
    backgroundColor: '#FFFBEB',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  cardFooter: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: '#FAFAFA',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
  centerContainer: {
    alignItems: 'center',
    paddingHorizontal: 32,
    marginTop: 80,
  },
  statusMsg: {
    marginTop: 12,
    fontSize: 15,
    color: COLORS.textSec,
  },
  errorText: {
    fontSize: 15,
    color: COLORS.textMain,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  retryBtn: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryBtnText: {
    color: COLORS.primary,
    fontWeight: '600',
    fontSize: 14,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyMainText: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textMain,
    marginBottom: 10,
  },
  emptySubText: {
    fontSize: 14,
    color: COLORS.textSec,
    textAlign: 'center',
    lineHeight: 22,
  },
});
