import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useUserContext } from '../context/UserContext';
import { LinearGradient } from '../utils/LinearGradient';
import { socialApi } from '../services/api/social';
import type { CreatorDashboard } from '../types';

const C = {
  bg: '#FDFBF8',
  surface: '#FFFFFF',
  bronze: '#A67C52',
  deep: '#4D3227',
  muted: '#8B7355',
  border: '#E9D4BE',
  soft: '#FBEFE2',
};

const LEVELS = ['Explorer', 'Pathfinder', 'Storyteller', 'Ambassador'];
const XP_PER_LEVEL = 500;

const compact = (value: number) =>
  value >= 1000 ? `${(value / 1000).toFixed(1)}K` : String(value);

type MenuItem = {
  icon: string;
  title: string;
  subtitle: string;
  onPress: () => void;
};

export default function CreatorStudioProfileScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { user } = useUserContext();
  const [data, setData] = useState<CreatorDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState('');
  const [bio, setBio] = useState('');
  const [instagram, setInstagram] = useState('');
  const [youtube, setYoutube] = useState('');
  const [facebook, setFacebook] = useState('');

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const d = (await socialApi.getCreatorDashboard()).data;
      setData(d);
      setFullName(d.profile.fullName || '');
      setBio(d.profile.bio || '');
      setInstagram(d.profile.instagramUrl || '');
      setYoutube(d.profile.youtubeUrl || '');
      setFacebook(d.profile.facebookUrl || '');
    } catch (e: any) {
      setLoadError(e?.message || 'Could not load creator profile.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    try {
      await socialApi.updateCreatorProfile({
        fullName,
        bio,
        instagramUrl: instagram,
        youtubeUrl: youtube,
        facebookUrl: facebook,
      });
      setEditing(false);
      await load();
    } catch (e: any) {
      Alert.alert('Could not save profile', e?.message || 'Please try again.');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={C.bronze} />
      </SafeAreaView>
    );
  }

  if (loadError && !data) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.errorText}>{loadError}</Text>
        <TouchableOpacity style={styles.retry} onPress={() => { setLoading(true); void load(); }}>
          <Text style={styles.retryText}>Try again</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const p = data?.profile;
  const displayName = p?.fullName || p?.username || user.displayName || 'Creator';
  const locationLabel = user.city ? `${user.city}, Madhya Pradesh` : 'Jabalpur, Madhya Pradesh';
  const bioText = p?.bio || 'Exploring places | Capturing stories | Inspiring journeys 🌿';

  const xp = user.totalPoints % XP_PER_LEVEL;
  const levelIndex = Math.min(LEVELS.length - 1, Math.floor(user.totalPoints / XP_PER_LEVEL));
  const levelName = LEVELS[levelIndex];
  const levelNumber = levelIndex + 1;

  const stats = [
    { icon: 'eye-outline', label: 'Views', value: compact(p?.totalViews || 0) },
    { icon: 'people-outline', label: 'Followers', value: compact(p?.followerCount || 0) },
    { icon: 'play-outline', label: 'Reels', value: String(data?.reelCount || 0) },
    { icon: 'heart-outline', label: 'Likes', value: compact(data?.totalLikes || 0) },
  ];

  const mainMenu: MenuItem[] = [
    {
      icon: 'person-outline',
      title: 'Account Information',
      subtitle: 'Manage your personal details',
      onPress: () => setEditing(true),
    },
    {
      icon: 'ribbon-outline',
      title: 'My Achievements',
      subtitle: 'Badges, milestones and rewards',
      onPress: () => navigation.navigate('Leaderboard'),
    },
    {
      icon: 'bar-chart-outline',
      title: 'Insights',
      subtitle: 'Detailed analytics and performance',
      onPress: () => navigation.navigate('CreatorAnalytics'),
    },
    {
      icon: 'wallet-outline',
      title: 'Earnings',
      subtitle: 'Track your earnings and history',
      onPress: () => navigation.navigate('Wallet'),
    },
    {
      icon: 'settings-outline',
      title: 'Settings',
      subtitle: 'Preferences and account settings',
      onPress: () => navigation.navigate('Settings'),
    },
  ];

  const supportMenu: MenuItem[] = [
    {
      icon: 'help-circle-outline',
      title: 'Help Center',
      subtitle: 'Get help and support',
      onPress: () => navigation.navigate('LegalHub'),
    },
    {
      icon: 'shield-checkmark-outline',
      title: 'Privacy & Safety',
      subtitle: 'Manage privacy and safety',
      onPress: () =>
        navigation.navigate('LegalDocument', { type: 'PRIVACY_POLICY', title: 'Privacy Policy' }),
    },
    {
      icon: 'chatbubble-ellipses-outline',
      title: 'Feedback',
      subtitle: 'Share your feedback with us',
      onPress: () =>
        Alert.alert(
          'Share feedback',
          'Tell us how we can improve the creator studio. Email support@palsafar.com with your ideas.',
        ),
    },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]}
      >
        <View style={[styles.topHeader, { paddingTop: insets.top + 8 }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>CREATOR PROFILE</Text>
            <Text style={styles.greeting}>Hello, {displayName} 👋</Text>
            <Text style={styles.handle}>
              @{p?.username}{p?.verified ? '  ✓' : ''}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.bellBtn}
            onPress={() => navigation.navigate('Notifications')}
            accessibilityLabel="Notifications"
          >
            <Icon name="notifications-outline" size={22} color={C.bronze} />
          </TouchableOpacity>
        </View>

        <View style={styles.coverWrap}>
          <LinearGradient
            colors={['#E8C4A0', '#C9886B', '#7A5C47', '#4A382F']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.cover}
          >
            <MaterialCommunityIcons
              name="image-filter-hdr"
              size={120}
              color="rgba(255,255,255,0.12)"
              style={styles.coverDecor}
            />
          </LinearGradient>

          <View style={styles.coverOverlay}>
            <View style={styles.avatarWrap}>
              {p?.avatar ? (
                <Image source={{ uri: p.avatar }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Text style={styles.avatarLetter}>{displayName.slice(0, 1).toUpperCase()}</Text>
                </View>
              )}
              <View style={styles.cameraBadge}>
                <Icon name="camera" size={11} color="#fff" />
              </View>
            </View>

            <TouchableOpacity style={styles.editProfileBtn} onPress={() => setEditing(true)}>
              <Icon name="create-outline" size={14} color={C.deep} />
              <Text style={styles.editProfileText}>Edit Profile</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.identityBlock}>
          <Text style={styles.profileName}>{displayName}</Text>
          <Text style={styles.profileRole}>Travel Creator</Text>
          <View style={styles.locationRow}>
            <Icon name="location-outline" size={14} color={C.muted} />
            <Text style={styles.locationText}>{locationLabel}</Text>
          </View>
          <Text style={styles.bio}>{bioText}</Text>
        </View>

        <View style={styles.statsRow}>
          {stats.map((stat, index) => (
            <React.Fragment key={stat.label}>
              {index > 0 ? <View style={styles.statDivider} /> : null}
              <View style={styles.statCell}>
                <Icon name={stat.icon} size={16} color={C.bronze} />
                <Text style={styles.statValue}>{stat.value}</Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </View>
            </React.Fragment>
          ))}
        </View>

        <View style={styles.levelCard}>
          <View style={styles.levelBadgeWrap}>
            <MaterialCommunityIcons name="hexagon-slice-6" size={44} color={C.bronze} />
            <Icon name="star" size={13} color="#fff" style={styles.levelStar} />
          </View>
          <View style={styles.levelBody}>
            <Text style={styles.levelTitle}>{levelName}</Text>
            <Text style={styles.levelSub}>Level {levelNumber}</Text>
            <View style={styles.xpTrack}>
              <View style={[styles.xpFill, { width: `${Math.min(100, (xp / XP_PER_LEVEL) * 100)}%` }]} />
            </View>
            <Text style={styles.xpText}>
              {xp} / {XP_PER_LEVEL} XP
            </Text>
          </View>
          <TouchableOpacity style={styles.viewProgressBtn} onPress={() => navigation.navigate('Leaderboard')}>
            <Text style={styles.viewProgressText}>View Progress</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.menuCard}>
          {mainMenu.map((item, index) => (
            <MenuRow key={item.title} item={item} isLast={index === mainMenu.length - 1} />
          ))}
        </View>

        <Text style={styles.sectionTitle}>Tools & Support</Text>
        <View style={styles.menuCard}>
          {supportMenu.map((item, index) => (
            <MenuRow key={item.title} item={item} isLast={index === supportMenu.length - 1} />
          ))}
        </View>

        {p?.username ? (
          <TouchableOpacity
            style={styles.publicLink}
            onPress={() => navigation.navigate('CreatorProfile', { username: p.username })}
          >
            <Text style={styles.publicLinkText}>View public creator page ›</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>

      <Modal visible={editing} transparent animationType="slide" onRequestClose={() => setEditing(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit profile</Text>
              <TouchableOpacity onPress={() => setEditing(false)}>
                <Icon name="close" size={24} color={C.deep} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Field label="Display name" value={fullName} onChangeText={setFullName} />
              <Field label="Bio" value={bio} onChangeText={setBio} multiline />
              <Field label="Instagram URL" value={instagram} onChangeText={setInstagram} />
              <Field label="YouTube URL" value={youtube} onChangeText={setYoutube} />
              <Field label="Facebook URL" value={facebook} onChangeText={setFacebook} />
              <TouchableOpacity style={styles.saveBtn} onPress={save}>
                <Text style={styles.saveBtnText}>Save profile</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function MenuRow({ item, isLast }: { item: MenuItem; isLast: boolean }) {
  return (
    <TouchableOpacity
      style={[styles.menuRow, !isLast && styles.menuRowBorder]}
      onPress={item.onPress}
      activeOpacity={0.85}
    >
      <View style={styles.menuIconWrap}>
        <Icon name={item.icon} size={18} color={C.bronze} />
      </View>
      <View style={styles.menuCopy}>
        <Text style={styles.menuTitle}>{item.title}</Text>
        <Text style={styles.menuSub}>{item.subtitle}</Text>
      </View>
      <Icon name="chevron-forward" size={18} color={C.muted} />
    </TouchableOpacity>
  );
}

function Field({ label, ...props }: any) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        {...props}
        placeholderTextColor={C.muted}
        style={[styles.input, props.multiline && styles.textarea]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorText: { color: C.muted, textAlign: 'center', marginBottom: 14, fontWeight: '600' },
  retry: { backgroundColor: C.bronze, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 12 },
  retryText: { color: '#fff', fontWeight: '800' },
  content: { paddingHorizontal: 20 },
  topHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 },
  eyebrow: { fontWeight: '800', fontSize: 11, letterSpacing: 1.5, color: C.bronze },
  greeting: { fontSize: 24, fontWeight: '800', color: C.deep, marginTop: 4 },
  handle: { fontSize: 13, color: C.muted, marginTop: 2 },
  bellBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    marginLeft: 10,
  },
  coverWrap: { marginBottom: 52, position: 'relative' },
  cover: {
    height: 140,
    borderRadius: 16,
    overflow: 'hidden',
  },
  coverDecor: { position: 'absolute', right: 16, bottom: -10 },
  coverOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: -36,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  avatarWrap: { position: 'relative' },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 3,
    borderColor: C.surface,
    backgroundColor: C.soft,
  },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { fontSize: 28, fontWeight: '800', color: C.bronze },
  cameraBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: C.bronze,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: C.surface,
  },
  editProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 6,
  },
  editProfileText: { fontSize: 12, fontWeight: '700', color: C.deep },
  identityBlock: { marginBottom: 18 },
  profileName: { fontSize: 18, fontWeight: '800', color: C.deep },
  profileRole: { fontSize: 13, color: C.muted, marginTop: 3 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  locationText: { fontSize: 12, color: C.muted },
  bio: { fontSize: 13, color: C.deep, marginTop: 10, lineHeight: 19 },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: C.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: 14,
    marginBottom: 14,
  },
  statCell: { flex: 1, alignItems: 'center', gap: 4 },
  statDivider: { width: 1, backgroundColor: C.border, marginVertical: 4 },
  statValue: { fontSize: 15, fontWeight: '800', color: C.deep },
  statLabel: { fontSize: 10, color: C.muted, fontWeight: '600' },
  levelCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: C.soft,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
    marginBottom: 16,
  },
  levelBadgeWrap: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelStar: { position: 'absolute' },
  levelBody: { flex: 1, minWidth: 0 },
  levelTitle: { fontSize: 15, fontWeight: '800', color: C.deep },
  levelSub: { fontSize: 11, color: C.muted, marginTop: 2, marginBottom: 8 },
  xpTrack: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.7)', overflow: 'hidden' },
  xpFill: { height: '100%', backgroundColor: C.bronze, borderRadius: 3 },
  xpText: { fontSize: 10, fontWeight: '700', color: C.deep, marginTop: 5 },
  viewProgressBtn: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: C.surface,
  },
  viewProgressText: { fontSize: 10, fontWeight: '800', color: C.deep },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: C.deep, marginBottom: 10, marginTop: 4 },
  menuCard: {
    backgroundColor: C.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
    marginBottom: 16,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  menuRowBorder: { borderBottomWidth: 1, borderBottomColor: C.border },
  menuIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuCopy: { flex: 1, minWidth: 0 },
  menuTitle: { fontSize: 14, fontWeight: '800', color: C.deep },
  menuSub: { fontSize: 11, color: C.muted, marginTop: 2 },
  publicLink: { alignItems: 'center', paddingVertical: 8 },
  publicLinkText: { fontSize: 12, fontWeight: '700', color: C.bronze },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(44,24,16,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: C.bg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 16,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: C.deep },
  field: { marginBottom: 12 },
  fieldLabel: { fontSize: 12, fontWeight: '800', color: C.deep, marginBottom: 6 },
  input: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    padding: 12,
    color: C.deep,
  },
  textarea: { height: 100, textAlignVertical: 'top' },
  saveBtn: {
    backgroundColor: C.bronze,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 12,
  },
  saveBtnText: { color: '#fff', fontWeight: '800' },
});
