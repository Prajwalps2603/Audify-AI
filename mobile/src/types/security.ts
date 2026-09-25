// TeleCaller AI — Security & Privacy Audit Types

export type SecurityCheckStatus = 'PASS' | 'WARN' | 'FAIL';

export interface SecurityCheckItem {
  id: string;
  category: 'STORAGE' | 'AUTH' | 'PERMISSIONS' | 'NETWORK' | 'PRIVACY';
  title: string;
  status: SecurityCheckStatus;
  description: string;
  details: string;
}

export interface SecurityAuditReport {
  timestamp: string;
  overallScorePercent: number;
  totalChecks: number;
  passedChecks: number;
  warnChecks: number;
  failedChecks: number;
  statusText: string;
  items: SecurityCheckItem[];
}
