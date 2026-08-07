export interface TyphoonWarning {
  id: string
  name: string
  lat: number
  lng: number
  intensity: 'TD' | 'TS' | 'TY' | 'STY'
  windSpeedKnots: number
  radiusKm: number
  movingDir: string
  movingSpeedKnots: number
}

export interface RegionalIssue {
  id: string
  lat: number
  lng: number
  type: 'piracy' | 'port_congestion' | 'geopolitical' | 'canal_control'
  title: string
  description: string
  severity: 'high' | 'medium' | 'low'
  source: string
}

export interface DangerZone {
  id: string
  center: [number, number]
  radiusKm: number
  type: 'collision_risk' | 'restricted' | 'piracy'
  label: string
  color: string
}

export interface WeatherPoint {
  name: string
  lat: number
  lng: number
  windSpeed: number
  windDir: number
  waveHeight: number
}
