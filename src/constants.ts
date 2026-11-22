export const CASE_DOCUMENT_TYPES = [
  'Petition/Complaint/Chargesheet',
  'Written Submission',
  'Replication',
  'Re-Joinder',
  'Bail Application',
  'Bail Reply',
  'Bail Bond',
  'Reply of Application',
  'Income Affidavit',
  'Evidence by way of Affidavit',
  'Ex-Parte Evidence by way of Affidavit',
]

export const CLIENT_DOCUMENT_TYPES = [
  'ID Proof',
  'Address Proof',
  'Vakalatnama',
  'Authority Letter',
  'Agreement / Engagement Letter',
]

export const ALL_CATEGORIES = [...CASE_DOCUMENT_TYPES, ...CLIENT_DOCUMENT_TYPES, 'Other']

export type QualityId = 'high' | 'balanced' | 'small'

export const QUALITY: Record<QualityId, { label: string; hint: string; maxEdge: number; jpeg: number }> = {
  high: { label: 'High', hint: 'Sharpest, largest file', maxEdge: 2600, jpeg: 88 },
  balanced: { label: 'Balanced', hint: 'Recommended for court records', maxEdge: 2000, jpeg: 78 },
  small: { label: 'Small', hint: 'Fastest upload', maxEdge: 1400, jpeg: 62 },
}

export const MAX_PAGES = 60
export const WORKING_EDGE = 2600
