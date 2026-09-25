// TeleCaller AI — Security & Privacy Audit Modal
// Real-time verification of local hardware security, sandbox containment, and API configuration.

import React, {useState, useEffect} from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {Colors, FontSize, BorderRadius, Spacing, Shadow} from '../../theme';
import {
  SecurityAuditService,
  SecurityAuditReport,
  SecurityCheckItem,
  AuditStatus,
} from '../../services/security/SecurityAuditService';

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

  useEffect(() => {
    if (visible) {
      executeAudit();
    }
  }, [visible]);

  const executeAudit = async () => {
    setIsLoading(true);
    try {
      const result = await SecurityAuditService.runFullAudit();
      setReport(result);
    } catch (e) {
      console.error('Audit execution error:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId(prev => (prev === id ? null : id));
  };

  const getStatusColor = (status: AuditStatus) => {
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
      default:
        return {
          bg: '#DCFCE7',
          border: '#86EFAC',
          text: '#15803D',
        };
    }
  };

  const getCategoryIcon = (category: string): {icon: string; color: string} => {
    switch (category) {
      case 'STORAGE':
        return {icon: 'harddisk', color: Colors.primary};
      case 'AUTH':
        return {icon: 'key-outline', color: '#8B5CF6'};
      case 'PERMISSIONS':
        return {icon: 'shield-check-outline', color: '#10B981'};
      case 'NETWORK':
        return {icon: 'web', color: '#06B6D4'};
      case 'PRIVACY':
        return {icon: 'eye-outline', color: '#F59E0B'};
      default:
        return {icon: 'magnify', color: Colors.textSecondary};
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
              <Icon name="close" size={20} color={Colors.textSecondary} />
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
                        <Icon name="check" size={12} color="#15803D" style={{marginRight: 3}} />
                        <Text style={[styles.counterText, {color: '#15803D'}]}>
                          {report.passedChecks} Passed
                        </Text>
                      </View>
                      {report.warnChecks > 0 && (
                        <View style={[styles.counterPill, {backgroundColor: '#FEF3C7'}]}>
                          <Icon name="alert-outline" size={12} color="#B45309" style={{marginRight: 3}} />
                          <Text style={[styles.counterText, {color: '#B45309'}]}>
                            {report.warnChecks} Warn
                          </Text>
                        </View>
                      )}
                      {report.failedChecks > 0 && (
                        <View style={[styles.counterPill, {backgroundColor: '#FEE2E2'}]}>
                          <Icon name="close" size={12} color="#B91C1C" style={{marginRight: 3}} />
                          <Text style={[styles.counterText, {color: '#B91C1C'}]}>
                            {report.failedChecks} Fail
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
              const catIcon = getCategoryIcon(item.category);

              return (
                <TouchableOpacity
                  key={item.id}
                  style={styles.itemCard}
                  activeOpacity={0.7}
                  onPress={() => toggleExpand(item.id)}>
                  <View style={styles.itemHeader}>
                    <View style={styles.itemTitleRow}>
                      <View style={styles.categoryIconCircle}>
                        <Icon name={catIcon.icon} size={18} color={catIcon.color} />
                      </View>
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
                    <Icon
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={14}
                      color={Colors.primary}
                      style={{marginRight: 4}}
                    />
                    <Text style={styles.expandHint}>
                      {isExpanded ? 'Hide technical details' : 'View technical details'}
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
                <View style={styles.btnContentRow}>
                  <Icon name="refresh" size={18} color={Colors.textInverse} style={{marginRight: 6}} />
                  <Text style={styles.rescanButtonText}>Re-run Security Audit</Text>
                </View>
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
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: '800',
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    flex: 1,
  },
  scrollInner: {
    padding: Spacing.xl,
    paddingBottom: Spacing['3xl'],
  },
  scoreCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.sm,
  },
  scoreTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scoreBadge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#EFF6FF',
    borderWidth: 2,
    borderColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.lg,
  },
  scoreValue: {
    fontSize: FontSize['2xl'],
    fontWeight: '900',
    color: Colors.primary,
  },
  scoreSubtext: {
    fontSize: 8,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: 0.8,
  },
  scoreDetails: {
    flex: 1,
  },
  scoreStatusTitle: {
    fontSize: FontSize.base,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  scoreTimestamp: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    marginBottom: Spacing.sm,
  },
  countersRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    flexWrap: 'wrap',
  },
  counterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
  },
  counterText: {
    fontSize: 11,
    fontWeight: '700',
  },
  sectionHeadingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionHeadingText: {
    fontSize: FontSize.xs,
    fontWeight: '800',
    color: Colors.textSecondary,
    letterSpacing: 0.8,
  },
  itemCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.xs,
  },
  itemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: Spacing.sm,
  },
  categoryIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
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
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  itemDescription: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginTop: 4,
  },
  detailsContainer: {
    marginTop: Spacing.sm,
    padding: Spacing.sm,
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: BorderRadius.sm,
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
  },
  detailsLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.textTertiary,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  detailsText: {
    fontSize: 11,
    color: Colors.textPrimary,
    fontFamily: 'monospace',
    lineHeight: 16,
  },
  itemFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.xs,
    paddingTop: 4,
  },
  expandHint: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.primary,
  },
  footer: {
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  rescanButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.sm,
  },
  btnContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rescanButtonText: {
    color: Colors.textInverse,
    fontSize: FontSize.base,
    fontWeight: '700',
  },
});
