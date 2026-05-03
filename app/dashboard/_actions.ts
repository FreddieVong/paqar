'use server'

import { revalidatePath }            from 'next/cache'
import { createClient }              from '@/lib/supabase/server'
import { upsertDocumentExpiry }      from '@/lib/db/document-expiries'
import { getOrCreateVehicleForUser } from '@/lib/db/vehicles'
import type { DocType }              from '@/types/domain'

export async function saveDocumentExpiry(params: {
  docType: DocType
  expiresOn: string
}): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Tidak log masuk' }

  const expiry  = new Date(params.expiresOn)
  const today   = new Date()
  today.setHours(0, 0, 0, 0)
  const maxDate = new Date()
  maxDate.setFullYear(maxDate.getFullYear() + 15)

  if (isNaN(expiry.getTime()) || expiry < today || expiry > maxDate) {
    return { error: 'Tarikh tidak sah — mestilah antara hari ini dan 15 tahun akan datang' }
  }

  let vehicleId: string | null = null

  if (params.docType !== 'driving_licence') {
    const result = await getOrCreateVehicleForUser(user.id)
    if (!result) return { error: 'Tiada kenderaan ditemui — buat semakan dahulu' }
    vehicleId = result.vehicle.id
  }

  try {
    await upsertDocumentExpiry({
      userId:    user.id,
      vehicleId,
      docType:   params.docType,
      expiresOn: params.expiresOn,
    })
    revalidatePath('/dashboard')
    return { error: null }
  } catch (err) {
    console.error('[saveDocumentExpiry]', err)
    return { error: 'Ralat menyimpan — sila cuba semula' }
  }
}
