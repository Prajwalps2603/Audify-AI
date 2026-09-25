// TeleCaller AI — Privacy & User Consent Modal
// Provides full transparency on data architecture, zero-data-selling pledge,
// least-privilege OAuth scopes, and local-first audio privacy.

import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {Colors, FontSize, BorderRadius, Spacing, Shadow} from '../../theme';

interface PrivacyConsentModalProps {
  visible: boolean;
  onClose: () => void;
}

export const PrivacyConsentModal: React.FC<PrivacyConsentModalProps> = ({
  visible,
  onClose,
}) => {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <SafeAreaView style={styles.modalContainer} edges={['bottom', 'top']}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Privacy & User Consent</Text>
              <Text style={styles.subtitle}>
                Local-first architecture & data transparency pledge
              </Text>
            </View>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
              <Icon name="close" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollContent}
            contentContainerStyle={styles.scrollInner}
            showsVerticalScrollIndicator={false}>
            {/* Top Badge */}
            <View style={styles.guaranteeBanner}>
              <Icon name="shield-check" size={28} color="#166534" style={{marginRight: Spacing.sm, marginTop: 2}} />
              <View style={styles.guaranteeTextContainer}>
                <Text style={styles.guaranteeTitle}>Zero Data Selling Pledge</Text>
                <Text style={styles.guaranteeDescription}>
                  TeleCaller AI does not sell, broker, or monetize your call
                  recordings, transcripts, or contact records. You maintain 100%
                  ownership of your data.
                </Text>
              </View>
            </View>

            {/* Principle 1 */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <Icon name="cellphone" size={20} color={Colors.primary} style={styles.sectionIcon} />
                <Text style={styles.sectionTitle}>Local-First Storage & Scoped Sandbox</Text>
              </View>
              <Text style={styles.sectionBody}>
                All audio recordings remain saved locally on your device within
                Android Scoped Storage. TeleCaller AI accesses audio files solely
                via Android MediaStore or user-selected folder URIs using the
                Storage Access Framework (SAF), never requesting root filesystem
                access.
              </Text>
            </View>

            {/* Principle 2 */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <Icon name="lock-check" size={20} color="#8B5CF6" style={styles.sectionIcon} />
                <Text style={styles.sectionTitle}>Hardware KeyStore Encryption</Text>
              </View>
              <Text style={styles.sectionBody}>
                Google OAuth tokens and sensitive credentials are encrypted with
                AES-256 GCM backed by the Android KeyStore hardware security
                module. Plaintext tokens are never stored in AsyncStorage or
                logged to logcat.
              </Text>
            </View>

            {/* Principle 3 */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <Icon name="target" size={20} color="#10B981" style={styles.sectionIcon} />
                <Text style={styles.sectionTitle}>Least-Privilege Google OAuth Scopes</Text>
              </View>
              <Text style={styles.sectionBody}>
                We strictly request minimal OAuth scopes:
              </Text>
              <View style={styles.bulletItem}>
                <Text style={styles.bulletDot}>•</Text>
                <Text style={styles.bulletText}>
                  <Text style={styles.boldText}>drive.file</Text>: Restricts access
                  exclusively to audio files uploaded by TeleCaller AI. The app
                  cannot view or modify any of your other Google Drive files.
                </Text>
              </View>
              <View style={styles.bulletItem}>
                <Text style={styles.bulletDot}>•</Text>
                <Text style={styles.bulletText}>
                  <Text style={styles.boldText}>spreadsheets</Text>: Used strictly to
                  append customer CRM rows to your designated TeleCaller spreadsheet.
                </Text>
              </View>
            </View>

            {/* Principle 4 */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <Icon name="microphone" size={20} color="#F59E0B" style={styles.sectionIcon} />
                <Text style={styles.sectionTitle}>AI Speech-to-Text Handling</Text>
              </View>
              <Text style={styles.sectionBody}>
                When transcription is executed, audio slices are transmitted
                securely over encrypted TLS/HTTPS to your chosen provider (Google
                Cloud STT, Whisper API, or AssemblyAI). Audio data is processed in
                ephemeral memory and is never used to train global AI models
                without explicit authorization.
              </Text>
            </View>

            {/* Principle 5 */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <Icon name="phone-outline" size={20} color="#06B6D4" style={styles.sectionIcon} />
                <Text style={styles.sectionTitle}>Call Log & Contact Permissions</Text>
              </View>
              <Text style={styles.sectionBody}>
                The optional READ_CALL_LOG permission is utilized exclusively on-device
                to match incoming/outgoing call timestamps with caller names and phone
                numbers. Call logs are never transmitted to third parties.
              </Text>
            </View>

            {/* Principle 6 */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <Icon name="delete-outline" size={20} color={Colors.error} style={styles.sectionIcon} />
                <Text style={styles.sectionTitle}>Data Revocation & Purge</Text>
              </View>
              <Text style={styles.sectionBody}>
                Signing out clears all encrypted tokens from the Android KeyStore.
                You can disconnect Google Drive and Google Sheets at any moment or
                revoke access via your Google Account security settings.
              </Text>
            </View>
          </ScrollView>

          {/* Footer Action */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.doneButton} onPress={onClose}>
              <Text style={styles.doneButtonText}>I Understand & Agree</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: '90%',
    ...Shadow.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  subtitle: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    flex: 1,
  },
  scrollInner: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  guaranteeBanner: {
    flexDirection: 'row',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'flex-start',
  },
  guaranteeTextContainer: {
    flex: 1,
  },
  guaranteeTitle: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: '#166534',
    marginBottom: 4,
  },
  guaranteeDescription: {
    fontSize: FontSize.xs,
    color: '#15803D',
    lineHeight: 18,
  },
  sectionCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.sm,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  sectionIcon: {
    marginRight: Spacing.xs,
  },
  sectionTitle: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  sectionBody: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  bulletItem: {
    flexDirection: 'row',
    marginTop: 6,
    paddingLeft: 4,
  },
  bulletDot: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    marginRight: 6,
    lineHeight: 18,
  },
  bulletText: {
    flex: 1,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  boldText: {
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  footer: {
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  doneButton: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.sm,
  },
  doneButtonText: {
    color: Colors.textInverse,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
});
