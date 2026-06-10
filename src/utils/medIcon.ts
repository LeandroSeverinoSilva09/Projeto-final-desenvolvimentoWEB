export type MedIconType = 'pill' | 'droplet'

export function getMedIconType(dose: string): MedIconType {
  return dose.toLowerCase().includes('gota') ? 'droplet' : 'pill'
}
