'use server'

import { claimCheck as dbClaimCheck } from '@/lib/db/checks'

export async function claimCheck(claimToken: string, userId: string): Promise<void> {
  await dbClaimCheck(claimToken, userId)
}
