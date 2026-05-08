export type Scenario =
  | 'clean' | 'saman1' | 'black' | 'partial' | 'timeout' | 'worst' | 'default'

export function getScenario(plate: string): Scenario {
  if (plate.startsWith('TEST-CLEAN'))   return 'clean'
  if (plate.startsWith('TEST-SAMAN1')) return 'saman1'
  if (plate.startsWith('TEST-BLACK'))  return 'black'
  if (plate.startsWith('TEST-PARTIAL'))return 'partial'
  if (plate.startsWith('TEST-TIMEOUT'))return 'timeout'
  if (plate.startsWith('TEST-WORST'))  return 'worst'
  return 'default'
}

export const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

export const STUB_DELAYS: Record<string, number> = {
  pdrm:          200,
  jpj:           350,
  aes:           500,
  local_councils:650,
}
