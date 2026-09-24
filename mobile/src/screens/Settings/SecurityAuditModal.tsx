// TeleCaller AI — Security & Privacy Audit Modal (Phase 14)
// Interactive live security inspector visualizing KeyStore integrity,
// storage hygiene, scoped storage compliance, OAuth token health, and TLS transport security.

import React, {useState, useEffect, useCallback} from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Colors, FontSize, BorderRadius, Spacing, Shadow} from '../../theme';
import {SecurityAuditReport, SecurityCheckItem, SecurityCheckStatus} from '../../types/security';
import {SecurityAuditService} from '../../services/security/SecurityAuditService';

interface SecurityAuditModalProps {
  visible: boolean;
  onClose: () => void;
}

export const SecurityAuditModal: React.FC<SecurityAuditModalProps> = ({
  visible,
  onClose,
}) => {
  const [report, setReport] = useState<SecurityAuditReport | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const executeAudit = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await SecurityAuditService.runAudit();
      setReport(result);
    } catch {
      // Keep previous report if error occurs
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      executeAudit();
    }
  }, [visible, executeAudit]);

  const toggleExpand = (id: string) => {
    setExpandedId(prev => (prev === id ? null : id));
  };

  const getStatusColor = (status: SecurityCheckStatus) => {
    switch (status) {
      case 'PASS':
        return {
          bg: '#DCFCE7',
          border: '#86EFAC',
          text: '#15803D',
        };
      case 'WARN':
        return {
          bg: '#FEF3C7',
          border: '#FCD34D',
          text: '#B45309',
        };
      case 'FAIL':
        return {
          bg: '#FEE2E2',
          border: '#FCA5A5',
          text: '#B91C1C',
        };
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'STORAGE':
        return '💾';
      case 'AUTH':
        return '🔐';
      case 'PERMISSIONS':
        return '🛡️';
      case 'NETWORK':
        return '🌐';
      case 'PRIVACY':
        return '👁️';
      default:
        return '🔍';
    }
  };

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
              <Text style={styles.title}>Security & Privacy Audit</Text>
              <Text style={styles.subtitle}>
                System architecture & hardware security verification
              </Text>
            </View>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollContent}
            contentContainerStyle={styles.scrollInner}
            showsVerticalScrollIndicator={false}>
            {/* Score & Overview Card */}
            {report && (
              <View style={styles.scoreCard}>
                <View style={styles.scoreTopRow}>
                  <View style={styles.scoreBadge}>
                    <Text style={styles.scoreValue}>
                      {report.overallScorePercent}%
                    </Text>
                    <Text style={styles.scoreSubtext}>COMPLIANCE</Text>
                  </View>
                  <View style={styles.scoreDetails}>
                    <Text style={styles.scoreStatusTitle}>
                      {report.statusText}
                    </Text>
                    <Text style={styles.scoreTimestamp}>
                      Last checked: {new Date(report.timestamp).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}
                    </Text>
                    <View style={styles.countersRow}>
                      <View style={[styles.counterPill, {backgroundColor: '#DCFCE7'}]}>
                        <Text style={[styles.counterText, {color: '#15803D'}]}>
                          ✓ {report.passedChecks} Passed
                        </Text>
                      </View>
                      {report.warnChecks > 0 && (
                        <View style={[styles.counterPill, {backgroundColor: '#FEF3C7'}]}>
                          <Text style={[styles.counterText, {color: '#B45309'}]}>
                            ⚠ {report.warnChecks} Warn
                          </Text>
                        </View>
                      )}
                      {report.failedChecks > 0 && (
                        <View style={[styles.counterPill, {backgroundColor: '#FEE2E2'}]}>
                          <Text style={[styles.counterText, {color: '#B91C1C'}]}>
                            ✕ {report.failedChecks} Fail
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              </View>
            )}

            {/* Section Header */}
            <View style={styles.sectionHeadingRow}>
              <Text style={styles.sectionHeadingText}>AUDITED SYSTEM CHECKS</Text>
              {isLoading && <ActivityIndicator size="small" color={Colors.primary} />}
            </View>

            {/* List of check items */}
            {report?.items.map((item: SecurityCheckItem) => {
              const statusColors = getStatusColor(item.status);
              const isExpanded = expandedId === item.id;

              return (
                <TouchableOpacity
                  key={item.id}
                  style={styles.itemCard}
                  activeOpacity={0.7}
                  onPress={() => toggleExpand(item.id)}>
                  <View style={styles.itemHeader}>
                    <View style={styles.itemTitleRow}>
                      <Text style={styles.itemIcon}>{getCategoryIcon(item.category)}</Text>
                      <View style={styles.itemTitleContainer}>
                        <Text style={styles.itemTitle}>{item.title}</Text>
                        <Text style={styles.itemCategory}>{item.category}</Text>
                      </View>
                    </View>
                    <View
                      style={[
                        styles.statusBadge,
                        {
                          backgroundColor: statusColors.bg,
                          borderColor: statusColors.border,
                        },
                      ]}>
                      <Text
                        style={[
                          styles.statusBadgeText,
                          {color: statusColors.text},
                        ]}>
                        {item.status}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.itemDescription}>{item.description}</Text>

                  {/* Expandable Technical Details */}
                  {isExpanded && (
                    <View style={styles.detailsContainer}>
                      <Text style={styles.detailsLabel}>DIAGNOSTIC EVIDENCE:</Text>
                      <Text style={styles.detailsText}>{item.details}</Text>
                    </View>
                  )}

                  <View style={styles.itemFooter}>
                    <Text style={styles.expandHint}>
                      {isExpanded ? '▲ Hide technical details' : '▼ View technical details'}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Action Bar */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.rescanButton}
              onPress={executeAudit}
              disabled={isLoading}>
              {isLoading ? (
                <ActivityIndicator size="small" color={Colors.textInverse} />
              ) : (
                <Text style={styles.rescanButtonText}>🔄 Re-run Security Audit</Text>
              )}
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
    maxHeight: '92%',
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
    backgroundColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  scrollContent: {
    flex: 1,
  },
  scrollInner: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  scoreCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.sm,
  },
  scoreTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scoreBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#EEF2FF',
    borderWidth: 2,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  scoreValue: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    color: Colors.primary,
  },
  scoreSubtext: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.primary,
    letterSpacing: 0.5,
  },
  scoreDetails: {
    flex: 1,
  },
  scoreStatusTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  scoreTimestamp: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    marginBottom: 6,
  },
  countersRow: {
    flexDirection: 'row',
    gap: 6,
  },
  counterPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  counterText: {
    fontSize: 11,
    fontWeight: '600',
  },
  sectionHeadingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  sectionHeadingText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.textTertiary,
    letterSpacing: 0.8,
  },
  itemCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.sm,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  itemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: Spacing.sm,
  },
  itemIcon: {
    fontSize: 20,
    marginRight: Spacing.sm,
  },
  itemTitleContainer: {
    flex: 1,
  },
  itemTitle: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  itemCategory: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.textTertiary,
    letterSpacing: 0.5,
    marginTop: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  itemDescription: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  detailsContainer: {
    marginTop: Spacing.sm,
    padding: Spacing.sm,
    backgroundColor: '#F8FAFC',
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  detailsLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  detailsText: {
    fontSize: FontSize.xs,
    color: '#334155',
    lineHeight: 16,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  itemFooter: {
    marginTop: 6,
    alignItems: 'flex-start',
  },
  expandHint: {
    fontSize: 10,
    color: Colors.primary,
    fontWeight: '600',
  },
  footer: {
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  rescanButton: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.sm,
  },
  rescanButtonText: {
    color: Colors.textInverse,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
});
