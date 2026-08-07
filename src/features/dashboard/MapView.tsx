'use client'

import { useEffect, useRef, useState } from 'react'
import type { Map as LeafletMap, LayerGroup, Marker } from 'leaflet'
import type { AisPosition } from '@/shared/types'
import { OWN_COMPANY_NAME, VOYAGE_STATUS_COLORS } from '@/shared/constants'
import { formatDateTime } from '@/shared/utils/format'
import { MOCK_DANGER_ZONES, MOCK_TYPHOONS, MOCK_REGIONAL_ISSUES, MOCK_WEATHER_POINTS } from '@/mocks/map-overlays'
import { findPort } from '@/mocks/ports'
import { ALL_VOYAGES, ALL_VESSELS, ALL_POSITIONS } from './fleetData'
import type { LayerVisibility } from './filters'
import { WORLD_BOUNDS, wrapLng, wrapRouteSegments } from './mapSeam'
import { getDisplayRoute, computeActualRoute, buildVesselMarkerIcon, buildVesselPopupHtml } from './voyageLayer'
import { aggregateByPort, buildPortMarkerHtml, buildPortPopupHtml } from './portLayer'
import { buildTyphoonMarkerHtml, buildTyphoonPopupHtml, typhoonColor, buildIssueMarkerHtml, buildIssuePopupHtml, buildWeatherCardHtml } from './overlayLayer'

// 오류를 200 응답 이미지로 반환하는 타일 서버(OpenSeaMap 등) 대비 — 1×1 투명 PNG
const ERROR_TILE_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='

const LEAFLET_CSS_HREF = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'

// leaflet.css가 붙기 전에 지도를 만들면 .leaflet-pane 등에 position:absolute가 적용되지
// 않아 타일이 정상 위치를 벗어나 아무것도 안 보인다. JSX의 <link>는 React가 <head>로
// 옮겨주긴 하지만 로드 완료를 보장하지 않으므로, 같은 href의 <link>가 이미 있으면 그 로드를
// 기다리고 없으면 직접 만들어 로드를 기다린다.
function waitForLeafletCss(): Promise<void> {
  const existing = document.querySelector<HTMLLinkElement>(`link[href="${LEAFLET_CSS_HREF}"]`)
  if (existing) {
    if (existing.sheet) return Promise.resolve()
    return new Promise((resolve) => {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => resolve(), { once: true })
    })
  }
  return new Promise((resolve) => {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = LEAFLET_CSS_HREF
    link.onload = () => resolve()
    link.onerror = () => resolve()
    document.head.appendChild(link)
  })
}

interface MapViewProps {
  // 필터 바(7.6장)를 거쳐 파생된, 실제로 지도에 그려야 할 항차 id 집합
  visibleVoyageIds: Set<string>
  // 값이 바뀔 때마다(0은 초기값이라 무시) 기본 시야로 복귀한다 — 9.9장 MapFocusTarget의
  // token 패턴을 그대로 따른 최소 구현
  resetToken?: number
  // 필터 바(7.3장)에서 파생된 레이어 표시 여부
  layers: LayerVisibility
}

export default function MapView({ visibleVoyageIds, resetToken = 0, layers }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<LeafletMap | null>(null)
  const voyageLayerRef = useRef<LayerGroup | null>(null)
  const portLayerRef = useRef<LayerGroup | null>(null)
  const overlayLayerRef = useRef<LayerGroup | null>(null)
  const resizeHandlerRef = useRef<(() => void) | null>(null)
  const portMarkersRef = useRef<Map<string, Marker>>(new Map())
  const issueMarkersRef = useRef<Map<string, Marker>>(new Map())
  const [mapReady, setMapReady] = useState(false)

  useEffect(() => {
    let active = true
    const portMarkers = portMarkersRef.current
    const issueMarkers = issueMarkersRef.current

    async function init() {
      if (!containerRef.current) return
      const [L] = await Promise.all([import('leaflet'), waitForLeafletCss()])
      // StrictMode 이중 실행 대비 — await 도중 언마운트됐으면 지도를 만들지 않는다.
      if (!active || !containerRef.current) return

      const map = L.map(containerRef.current, {
        center: [20, 100],
        zoom: 3,
        zoomControl: true,
        maxZoom: 15,
        worldCopyJump: false,
        maxBoundsViscosity: 1.0,
        zoomAnimationThreshold: 20,
      })
      mapRef.current = map

      // 지구 1개 범위 밖으로 패닝 불가. noWrap은 주지 않는다 — 이음매가 표준 180°가 아니라서
      // 타일 x인덱스 랩핑이 그대로 필요하고, 중복 방지는 maxBounds + 최소 줌으로만 처리한다.
      map.setMaxBounds(WORLD_BOUNDS)

      // 타일 레이어에 bounds 옵션을 주면 안 된다 — 랩핑된 타일 좌표가 표준 -180~180으로
      // 재정규화되어 태평양 부근이 회색으로 빠진다.
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png', {
        maxZoom: 18,
        maxNativeZoom: 17,
        errorTileUrl: ERROR_TILE_URL,
      }).addTo(map)

      // 해도(OpenSeaMap) — 이 서버는 지원 범위를 넘는 줌에서 오류 문구가 그려진 이미지를
      // 200으로 반환해 errorTileUrl로 걸러지지 않으므로, maxZoom을 낮게 고정해 요청 자체를 막는다.
      L.tileLayer('https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png', {
        opacity: 0.7,
        maxZoom: 12,
        errorTileUrl: ERROR_TILE_URL,
      }).addTo(map)

      // 기상 카드를 선박 마커(markerPane, z-index 600)보다 아래에 두기 위한 pane
      const weatherPane = map.createPane('weatherPane')
      weatherPane.style.zIndex = '400'
      weatherPane.style.pointerEvents = 'none'

      voyageLayerRef.current = L.layerGroup().addTo(map)
      portLayerRef.current = L.layerGroup().addTo(map)
      overlayLayerRef.current = L.layerGroup().addTo(map)

      // 최소 줌은 가로 폭 기준으로만 계산한다. 세로(위도)까지 맞추면 화면 비율에 따라
      // 과도한 최소 줌이 잡혀 좌우가 잘린다.
      function applyMinZoom() {
        if (!containerRef.current) return
        const width = containerRef.current.clientWidth
        if (width <= 0) return
        const minZoom = Math.ceil(Math.log2(width / 256))
        map.setMinZoom(minZoom)
        if (map.getZoom() < minZoom) map.setZoom(minZoom)
      }

      applyMinZoom()
      requestAnimationFrame(() => {
        applyMinZoom()
        map.invalidateSize()
      })

      function handleResize() {
        applyMinZoom()
        map.invalidateSize()
      }
      window.addEventListener('resize', handleResize)
      resizeHandlerRef.current = handleResize

      setMapReady(true)
    }

    init().catch((err) => console.error('[MapView] init failed:', err))

    return () => {
      active = false
      setMapReady(false)
      if (resizeHandlerRef.current) {
        window.removeEventListener('resize', resizeHandlerRef.current)
        resizeHandlerRef.current = null
      }
      mapRef.current?.remove()
      mapRef.current = null
      voyageLayerRef.current = null
      portLayerRef.current = null
      overlayLayerRef.current = null
      portMarkers.clear()
      issueMarkers.clear()
    }
  }, [])

  // 항차 레이어(9.7장) — 계획 항로 + 실제 항적 + 선박 마커. 표시 대상이 바뀔 때마다
  // clearLayers()로 비우고 다시 그린다(9.5장). 자사·타사 모두 여기서 조회한다(fleetData).
  useEffect(() => {
    if (!mapReady) return
    const voyageLayer = voyageLayerRef.current
    if (!voyageLayer) return

    let cancelled = false
    voyageLayer.clearLayers()

    if (visibleVoyageIds.size > 0) {
      import('leaflet').then((L) => {
        if (cancelled) return

        for (const voyageId of visibleVoyageIds) {
          const voyage = ALL_VOYAGES.find((v) => v.id === voyageId)
          if (!voyage) continue
          const vessel = ALL_VESSELS.find((v) => v.id === voyage.vesselId)
          if (!vessel) continue
          const position: AisPosition | undefined = ALL_POSITIONS.find((p) => p.vesselId === voyage.vesselId)

          const statusColor = VOYAGE_STATUS_COLORS[voyage.status]
          const displayRoute = getDisplayRoute(voyage)

          // ① 계획 항로 — 점선
          L.polyline(wrapRouteSegments(displayRoute), {
            color: statusColor,
            weight: 2,
            dashArray: '8,6',
            opacity: 0.6,
          }).addTo(voyageLayer)

          // ② 실제 항적 — 계획 항로를 현재 위치까지 슬라이싱한 실선
          const actualRoute = computeActualRoute(voyage, displayRoute, position)
          L.polyline(wrapRouteSegments(actualRoute), {
            color: statusColor,
            weight: 2.5,
            opacity: 0.85,
          }).addTo(voyageLayer)

          if (!position) continue

          // ③ 선박 마커
          const isOwn = vessel.company === OWN_COMPANY_NAME
          const { html, size } = buildVesselMarkerIcon({ isOwn, cogDegrees: position.cogDegrees, statusColor })
          const icon = L.divIcon({ html, className: '', iconSize: [size, size], iconAnchor: [size / 2, size / 2] })
          const marker = L.marker([position.lat, wrapLng(position.lng)], { icon }).addTo(voyageLayer)

          // ④ 팝업
          marker.bindPopup(
            buildVesselPopupHtml({
              vesselName: vessel.name,
              companyName: vessel.company,
              isOwn,
              departurePort: voyage.departurePort,
              arrivalPort: voyage.arrivalPort,
              speedKnots: position.speedKnots,
              etaLabel: formatDateTime(voyage.eta),
              status: voyage.status,
              statusColor,
              vesselId: vessel.id,
              voyageId: voyage.id,
            }),
            { minWidth: 200 },
          )
        }
      })
    }

    return () => {
      cancelled = true
    }
  }, [mapReady, visibleVoyageIds])

  // 항구 레이어(9.6장) — 선박 필터·선택과 무관하게 항상 전체 항차 기준으로 집계한다.
  useEffect(() => {
    if (!mapReady) return
    const portLayer = portLayerRef.current
    if (!portLayer) return

    let cancelled = false
    portLayer.clearLayers()
    portMarkersRef.current.clear()

    if (layers.ports) {
      import('leaflet').then((L) => {
        if (cancelled) return

        const aggregates = aggregateByPort(ALL_VOYAGES, ALL_VESSELS)
        for (const [code, agg] of aggregates) {
          const port = findPort(code)
          if (!port) continue

          const totalCount = agg.berthed.length + agg.departing.length + agg.arriving.length
          const icon = L.divIcon({
            html: buildPortMarkerHtml(totalCount),
            className: '',
            iconSize: [30, 30],
            iconAnchor: [15, 15],
          })
          const marker = L.marker([port.lat, wrapLng(port.lng)], { icon }).addTo(portLayer)
          marker.bindPopup(buildPortPopupHtml(code, agg), { minWidth: 220, maxWidth: 260 })
          portMarkersRef.current.set(code, marker)
        }
      })
    }

    return () => {
      cancelled = true
    }
  }, [mapReady, layers.ports])

  // 오버레이 레이어(9.8장) — 위험구역·태풍·지역 이슈·기상 카드. issues 플래그 하나로
  // 위험구역·태풍·이슈가 함께 켜지고 꺼진다(7.3장 — 태풍·위험구역은 "이슈"에 편입).
  useEffect(() => {
    if (!mapReady) return
    const overlayLayer = overlayLayerRef.current
    if (!overlayLayer) return

    let cancelled = false
    overlayLayer.clearLayers()
    issueMarkersRef.current.clear()

    import('leaflet').then((L) => {
      if (cancelled) return

      if (layers.dangerZones) {
        for (const zone of MOCK_DANGER_ZONES) {
          L.circle([zone.center[0], wrapLng(zone.center[1])], {
            radius: zone.radiusKm * 1000,
            color: zone.color,
            fillColor: zone.color,
            fillOpacity: 0.08,
            weight: 2,
            dashArray: '8,4',
          })
            .bindTooltip(zone.label, { sticky: true })
            .addTo(overlayLayer)
        }
      }

      if (layers.typhoon) {
        for (const t of MOCK_TYPHOONS) {
          const color = typhoonColor(t.intensity)
          const latLng: [number, number] = [t.lat, wrapLng(t.lng)]

          L.circle(latLng, {
            radius: t.radiusKm * 1000,
            color,
            fillColor: color,
            fillOpacity: 0.07,
            weight: 2,
            dashArray: '10,5',
          }).addTo(overlayLayer)

          const icon = L.divIcon({
            html: buildTyphoonMarkerHtml(t.intensity),
            className: '',
            iconSize: [36, 36],
            iconAnchor: [18, 18],
          })
          L.marker(latLng, { icon }).addTo(overlayLayer).bindPopup(buildTyphoonPopupHtml(t), { minWidth: 180 })
        }
      }

      if (layers.issues) {
        for (const issue of MOCK_REGIONAL_ISSUES) {
          const icon = L.divIcon({
            html: buildIssueMarkerHtml(issue.type),
            className: '',
            iconSize: [36, 36],
            iconAnchor: [18, 18],
          })
          const marker = L.marker([issue.lat, wrapLng(issue.lng)], { icon }).addTo(overlayLayer)
          marker.bindPopup(buildIssuePopupHtml(issue), { minWidth: 200 })
          issueMarkersRef.current.set(issue.id, marker)
        }
      }

      if (layers.weather) {
        for (const w of MOCK_WEATHER_POINTS) {
          const icon = L.divIcon({
            html: buildWeatherCardHtml(w.windSpeed, w.windDir, w.waveHeight, w.name),
            className: '',
            iconSize: [0, 0],
            iconAnchor: [0, 0],
          })
          L.marker([w.lat, wrapLng(w.lng)], { icon, pane: 'weatherPane' }).addTo(overlayLayer)
        }
      }
    })

    return () => {
      cancelled = true
    }
  }, [mapReady, layers.dangerZones, layers.typhoon, layers.issues, layers.weather])

  // 필터 리셋(7.2장 resetMapView) — 줌 델타가 큰 이동이라 flyTo가 아닌 setView로 한 번에
  // 전환한다(KNOWN_PITFALLS.md 2.7). resetToken은 9.9장 MapFocusTarget과 같은 token 패턴.
  useEffect(() => {
    if (!mapReady || resetToken === 0) return
    mapRef.current?.setView([20, 100], 3, { animate: true })
  }, [mapReady, resetToken])

  return (
    <>
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      {/* h-full(퍼센트)은 부모(min-h-[500px] flex-1)의 height 속성 자체가 auto라 해석되지
          않는다 — flex-grow로 실제 픽셀 높이가 잡혀도 퍼센트 기준으로는 auto다. 절대 위치로
          부모의 실제 박스 크기를 직접 채운다. */}
      <div ref={containerRef} className="absolute inset-0" />
    </>
  )
}
