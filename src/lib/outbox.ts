import type { SyncPayload } from './api'
import { planCommand, type Command } from './commands'
import type { AppData } from './types'

export interface OutboxDeps {
  // Latest server state; writes are always planned against it so ids and "already in progress" checks are current.
  fresh: () => Promise<AppData>
  send: (payload: SyncPayload) => Promise<unknown>
  reload: () => Promise<unknown>
}

// Online only for now: each command is planned and sent straight away. The offline queue will keep this
// submit() contract, so screens and the store do not change when it lands.
export function createOutbox(deps: OutboxDeps) {
  return {
    async submit<T>(cmd: Command): Promise<T> {
      const d = await deps.fresh()
      const plan = planCommand(d, cmd)
      if (plan.sync) {
        await deps.send(plan.sync)
        await deps.reload()
      }
      return plan.result as T
    },
  }
}
