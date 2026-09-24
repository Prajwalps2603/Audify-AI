// TeleCaller AI — Security Audit Service Unit Tests (Phase 15)
// Tests hardware KeyStore probe execution, unencrypted storage hygiene scanning,
// token freshness validation, and overall security score calculation.

import {SecurityAuditService} from '../src/services/security/SecurityAuditService';
import EncryptedStorage from 'react-native-encrypted-storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

describe('SecurityAuditService', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    await EncryptedStorage.clear();
  });

  it('runs complete audit and returns valid report structure', async () => {
    const report = await SecurityAuditService.runAudit();

    expect(report).toBeDefined();
    expect(report.totalChecks).toBeGreaterThanOrEqual(7);
    expect(report.overallScorePercent).toBeGreaterThanOrEqual(0);
    expect(report.overallScorePercent).toBeLessThanOrEqual(100);
    expect(Array.isArray(report.items)).toBe(true);

    const keystoreCheck = report.items.find(i => i.id === 'keystore_integrity');
    expect(keystoreCheck).toBeDefined();
    expect(keystoreCheck?.status).toBe('PASS');

    const hygieneCheck = report.items.find(i => i.id === 'storage_hygiene');
    expect(hygieneCheck).toBeDefined();
    expect(hygieneCheck?.status).toBe('PASS');
  });

  it('detects sensitive credential leakage in unencrypted AsyncStorage', async () => {
    // Intentionally inject an unencrypted token key into AsyncStorage to test detection
    await AsyncStorage.setItem('leaked_user_auth_token', 'secret_token_123');

    const report = await SecurityAuditService.runAudit();
    const hygieneCheck = report.items.find(i => i.id === 'storage_hygiene');

    expect(hygieneCheck).toBeDefined();
    expect(hygieneCheck?.status).toBe('WARN');
    expect(hygieneCheck?.description).toContain('leaked_user_auth_token');
  });

  it('handles KeyStore probe failure gracefully without crashing audit suite', async () => {
    // Mock EncryptedStorage.setItem to throw an error
    (EncryptedStorage.setItem as jest.Mock).mockRejectedValueOnce(
      new Error('Keystore hardware isolation unavailable'),
    );

    const report = await SecurityAuditService.runAudit();
    const keystoreCheck = report.items.find(i => i.id === 'keystore_integrity');

    expect(keystoreCheck).toBeDefined();
    expect(keystoreCheck?.status).toBe('FAIL');
    expect(keystoreCheck?.details).toContain('Keystore hardware isolation unavailable');
    // Overall audit should still complete
    expect(report.totalChecks).toBeGreaterThanOrEqual(7);
  });
});
