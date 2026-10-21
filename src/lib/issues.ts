import type { IssueCategory, ReportedIssue } from './types'

// Same categories and labels as the web console (web-prototype/src/store/db.js ISSUE_CATEGORIES).
export const ISSUE_CATEGORIES: Record<IssueCategory, string> = {
  baffle_damaged: 'Baffle damaged',
  no_washdown_tap: 'No wash-down tap',
  premises_closed: 'Premises closed / renovating',
  no_access: 'No access',
  qr_missing: 'QR tag missing',
  other: 'Other',
}

export const issueLabel = (c: string) => ISSUE_CATEGORIES[c as IssueCategory] || c

export const openIssues = (issues: ReportedIssue[], deviceId: string) =>
  issues.filter((i) => i.deviceId === deviceId && i.status === 'open').sort((a, b) => b.at.localeCompare(a.at))
