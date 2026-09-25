// TeleCaller AI — Profile Screen
// User profile management: view details, edit name, switch Google account.

import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {Colors, FontSize, BorderRadius, Shadow, Spacing} from '../../theme';
import Avatar from '../../components/Avatar';
import Card from '../../components/Card';
import {useAuth} from '../../context/AuthContext';
import {toast} from '../../components/Toast';
import {showDestructiveConfirm} from '../../components/AppModal';
import {AdminConfigService} from '../../services/admin/AdminConfigService';

interface InfoRowProps {
  iconName: string;
  label: string;
  value: string;
  iconColor?: string;
}

const InfoRow: React.FC<InfoRowProps> = ({iconName, label, value, iconColor}) => (
  <View style={styles.infoRow}>
    <View style={[styles.infoIcon, {backgroundColor: (iconColor || Colors.primary) + '18'}]}>
      <Icon name={iconName} size={18} color={iconColor || Colors.primary} />
    </View>
    <View style={styles.infoContent}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={1}>{value || '—'}</Text>
    </View>
  </View>
);

const ProfileScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const {authState, signOut} = useAuth();

  const realUser = authState.status === 'SIGNED_IN' ? authState.session.user : null;
  const originalName = realUser?.name ?? '';
  const displayEmail = realUser?.email ?? '';
  const displayPhoto = realUser?.photo ?? undefined;
  const googleId = realUser?.id ?? '';
  const givenName = realUser?.givenName ?? '';
  const familyName = realUser?.familyName ?? '';

  const [displayName, setDisplayName] = useState(originalName);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const isAdmin = AdminConfigService.isAdmin(displayEmail);

  useEffect(() => {
    setDisplayName(originalName);
  }, [originalName]);

  const handleSave = async () => {
    if (!displayName.trim()) {
      toast.warning('Name Required', 'Display name cannot be empty.');
      return;
    }
    setIsSaving(true);
    try {
      await new Promise<void>(resolve => setTimeout(() => resolve(), 600));
      toast.success('Profile Updated', 'Your display name has been saved.');
      setIsEditing(false);
    } catch (e: any) {
      toast.error('Save Failed', e?.message || 'Could not save profile.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSwitchAccount = () => {
    showDestructiveConfirm(
      'Switch Google Account',
      'Switching accounts will sign you out. You can sign in with a different Google account.',
      async () => {
        await signOut();
        toast.info('Signed Out', 'Please sign in with your new account.');
      },
      'Switch Account',
    );
  };

  const handleCancel = () => {
    setDisplayName(originalName);
    setIsEditing(false);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            accessibilityLabel="Go back"
            accessibilityRole="button">
            <Icon name="arrow-left" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>Profile</Text>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => (isEditing ? handleSave() : setIsEditing(true))}
            disabled={isSaving}
            accessibilityRole="button"
            accessibilityLabel={isEditing ? 'Save profile' : 'Edit profile'}>
            {isSaving ? (
              <Text style={styles.editButtonText}>Saving...</Text>
            ) : isEditing ? (
              <Text style={styles.editButtonText}>Save</Text>
            ) : (
              <Icon name="pencil-outline" size={20} color={Colors.primary} />
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          <LinearGradient
            colors={['#EFF6FF', '#F5F3FF', '#F7F9FC']}
            start={{x: 0, y: 0}}
            end={{x: 1, y: 1}}
            style={styles.heroSection}>
            <Avatar
              name={displayName || 'User'}
              photoUrl={displayPhoto}
              size={88}
              style={styles.heroAvatar}
            />
            <View style={styles.googleBadgePill}>
              <Icon name="google" size={13} color="#EA4335" />
              <Text style={styles.googleBadgeText}>Google Account</Text>
            </View>
          </LinearGradient>

          <Text style={styles.sectionLabel}>DISPLAY NAME</Text>
          <Card variant="elevated" padding={0} style={styles.nameCard}>
            <View style={styles.nameRow}>
              <View style={[styles.nameIcon, {backgroundColor: Colors.primaryLight}]}>
                <Icon name="account-outline" size={18} color={Colors.primary} />
              </View>
              {isEditing ? (
                <TextInput
                  style={styles.nameInput}
                  value={displayName}
                  onChangeText={setDisplayName}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={handleSave}
                  placeholderTextColor={Colors.textTertiary}
                  placeholder="Enter your name"
                  accessibilityLabel="Display name input"
                />
              ) : (
                <Text style={styles.nameText} numberOfLines={1}>
                  {displayName || 'No name set'}
                </Text>
              )}
              {isEditing && (
                <TouchableOpacity
                  style={styles.cancelEditBtn}
                  onPress={handleCancel}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel edit">
                  <Icon name="close-circle" size={18} color={Colors.textTertiary} />
                </TouchableOpacity>
              )}
            </View>
          </Card>

          <Text style={styles.sectionLabel}>ACCOUNT DETAILS</Text>
          <Card variant="elevated" padding={0} style={styles.detailsCard}>
            <InfoRow iconName="email-outline" label="Email Address" value={displayEmail} iconColor="#2563EB" />
            <View style={styles.detailDivider} />
            <InfoRow iconName="badge-account-outline" label="Given Name" value={givenName} iconColor="#7C3AED" />
            <View style={styles.detailDivider} />
            <InfoRow iconName="badge-account-horizontal-outline" label="Family Name" value={familyName} iconColor="#7C3AED" />
            <View style={styles.detailDivider} />
            <InfoRow iconName="identifier" label="Google Account ID" value={googleId ? googleId.substring(0, 16) + '...' : '—'} iconColor="#059669" />
          </Card>

          {/* Admin Controls (Exclusive for hackerweb402@gmail.com) */}
          {isAdmin && (
            <>
              <Text style={styles.sectionLabel}>ADMINISTRATION</Text>
              <Card variant="elevated" padding={0} style={styles.adminCard}>
                <TouchableOpacity
                  style={styles.adminRow}
                  onPress={() => navigation.navigate('AdminSettings')}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Admin Controls">
                  <View style={[styles.actionIcon, {backgroundColor: '#FEF3C7'}]}>
                    <Icon name="shield-crown-outline" size={20} color="#D97706" />
                  </View>
                  <View style={styles.adminTextCol}>
                    <Text style={styles.adminTitle}>Admin Settings</Text>
                    <Text style={styles.adminSubtitle}>
                      Manage user settings visibility & feature toggles
                    </Text>
                  </View>
                  <View style={styles.adminBadgePill}>
                    <Text style={styles.adminBadgePillText}>ADMIN</Text>
                  </View>
                  <Icon name="chevron-right" size={20} color={Colors.textTertiary} />
                </TouchableOpacity>
              </Card>
            </>
          )}

          <Text style={styles.sectionLabel}>ACCOUNT ACTIONS</Text>
          <Card variant="elevated" padding={0} style={styles.actionsCard}>
            <TouchableOpacity
              style={styles.actionRow}
              onPress={handleSwitchAccount}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Switch Google Account">
              <View style={[styles.actionIcon, {backgroundColor: '#FFF7ED'}]}>
                <Icon name="account-switch-outline" size={18} color="#D97706" />
              </View>
              <Text style={styles.actionLabel}>Switch Google Account</Text>
              <Icon name="chevron-right" size={20} color={Colors.textTertiary} />
            </TouchableOpacity>
          </Card>

          <View style={styles.footerSpacer} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  flex: {flex: 1},
  safeArea: {flex: 1, backgroundColor: Colors.background},
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  editButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButtonText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.primary,
  },
  scroll: {flex: 1},
  scrollContent: {paddingBottom: Spacing['4xl']},
  heroSection: {
    alignItems: 'center',
    paddingVertical: Spacing['2xl'],
    paddingHorizontal: Spacing.xl,
    borderBottomLeftRadius: BorderRadius['2xl'],
    borderBottomRightRadius: BorderRadius['2xl'],
    marginBottom: Spacing.lg,
  },
  heroAvatar: {
    marginBottom: Spacing.md,
    ...(Shadow.md as object),
  },
  googleBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: Spacing.md,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  googleBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textTertiary,
    letterSpacing: 1.2,
    marginBottom: Spacing.sm,
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.xl,
  },
  nameCard: {marginHorizontal: Spacing.xl, overflow: 'hidden'},
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.base,
    gap: Spacing.md,
  },
  nameIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameText: {
    flex: 1,
    fontSize: FontSize.base,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  nameInput: {
    flex: 1,
    fontSize: FontSize.base,
    fontWeight: '600',
    color: Colors.textPrimary,
    padding: 0,
    borderBottomWidth: 2,
    borderBottomColor: Colors.primary,
  },
  cancelEditBtn: {padding: 4},
  detailsCard: {marginHorizontal: Spacing.xl, overflow: 'hidden'},
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  infoIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoContent: {flex: 1},
  infoLabel: {
    fontSize: FontSize.xs,
    fontWeight: '500',
    color: Colors.textTertiary,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  detailDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginLeft: Spacing.base + 36 + Spacing.md,
  },
  adminCard: {
    marginHorizontal: Spacing.xl,
    overflow: 'hidden',
    borderColor: '#FDE68A',
    borderWidth: 1,
  },
  adminRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.base,
    gap: Spacing.md,
  },
  adminTextCol: {
    flex: 1,
  },
  adminTitle: {
    fontSize: FontSize.base,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 2,
  },
  adminSubtitle: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    lineHeight: 16,
  },
  adminBadgePill: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  adminBadgePillText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#D97706',
    letterSpacing: 0.5,
  },
  actionsCard: {marginHorizontal: Spacing.xl, overflow: 'hidden'},
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.base,
    gap: Spacing.md,
  },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    flex: 1,
    fontSize: FontSize.base,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  footerSpacer: {height: Spacing['2xl']},
});

export default ProfileScreen;
