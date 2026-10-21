import { fmtL } from '../format'
import { issueLabel } from '../issues'
import type { QueueItem } from './queue'

// One line for the sync screens: what the driver did, in their words.
export function describeItem(item: QueueItem, deviceRef: (id: string) => string | undefined) {
  const c = item.cmd
  if (!c) return `${item.photos?.files.length || 0} photo(s)`
  switch (c.kind) {
    case 'startPickup': return `Start pickup · ${deviceRef(c.deviceId) || c.deviceId}`
    case 'finishPickup': return `Finish pickup · ${fmtL(c.volume)}`
    case 'cancelPickup': return 'Cancel pickup'
    case 'serviceOnly': return `Service only · ${deviceRef(c.deviceId) || c.deviceId}`
    case 'reportIssue': return `Problem · ${issueLabel(c.category)} · ${deviceRef(c.deviceId) || c.deviceId}`
    case 'unload': return `Offload · ${fmtL(c.volume)}`
    case 'transfer': return 'Transfer all waste'
  }
}

export const itemTime = (item: QueueItem) => item.cmd?.at || null
