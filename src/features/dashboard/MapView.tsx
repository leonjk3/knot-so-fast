'use client'

import { useEffect, useRef, useState } from 'react'
import type { Map as LeafletMap, LayerGroup, Marker, TileLayer, PopupEvent } from 'leaflet'
import type { AisPosition } from '@/shared/types'
import { OWN_COMPANY_NAME, VOYAGE_STATUS_COLORS } from '@/shared/constants'
import { formatDateTime } from '@/shared/utils/format'
import { MOCK_DANGER_ZONES, MOCK_REGIONAL_ISSUES } from '@/mocks/map-overlays'
import { findPort } from '@/mocks/ports'
import { useMarineWeather } from './useMarineWeather'
import { useTyphoons } from './useTyphoons'
import { sendSpeedRecommendation, buildSpeedRecommendationAlert } from './speedRecommendation'
import { ALL_VOYAGES, ALL_VESSELS, ALL_POSITIONS } from './fleetData'
import type { LayerVisibility } from './filters'
import type { MapFocusTarget } from './mapFocus'
import { WORLD_BOUNDS, wrapLng, wrapRouteSegments } from './mapSeam'
import { getDisplayRoute, computeActualRoute, buildVesselMarkerIcon, buildVesselPopupHtml } from './voyageLayer'
import { aggregateByPort, buildPortMarkerHtml, buildPortPopupHtml } from './portLayer'
import { buildTyphoonMarkerHtml, buildTyphoonPopupHtml, typhoonColor, buildIssueMarkerHtml, buildIssuePopupHtml, buildWeatherCardHtml } from './overlayLayer'
import { getMapLabels, type MapLanguage } from './mapLabels'
import { MapLanguageSelector, MapTypeToggle, MapLegend, type MapKind } from './MapOverlayUI'

// ② 지도 유형 — 레이어를 추가·제거하지 않고 기본 타일의 setUrl()만 교체한다(9.10장).
const BASE_TILE_URLS: Record<MapKind, string> = {
  standard: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
  satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
}

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
  // 필터 바(7.3장)에서 파생된 레이어 표시 여부
  layers: LayerVisibility
  // 리스트·게이지 카드 등 외부에서 지도를 이동시키는 요청 (9.9장)
  focusTarget?: MapFocusTarget | null
}

export default function MapView({ visibleVoyageIds, layers, focusTarget }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<LeafletMap | null>(null)
  const voyageLayerRef = useRef<LayerGroup | null>(null)
  const portLayerRef = useRef<LayerGroup | null>(null)
  const overlayLayerRef = useRef<LayerGroup | null>(null)
  const resizeHandlerRef = useRef<(() => void) | null>(null)
  const portMarkersRef = useRef<Map<string, Marker>>(new Map())
  const issueMarkersRef = useRef<Map<string, Marker>>(new Map())
  const baseLayerRef = useRef<TileLayer | null>(null)
  const radarLayerRef = useRef<TileLayer | null>(null)
  const radarPathRef = useRef<string | null>(null)
  const [mapReady, setMapReady] = useState(false)
  const [mapLanguage, setMapLanguage] = useState<MapLanguage>('ko')
  const [mapKind, setMapKind] = useState<MapKind>('standard')
  const [legendOpen, setLegendOpen] = useState(false)
  const weatherPoints = useMarineWeather()
  const typhoons = useTyphoons()

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
      baseLayerRef.current = L.tileLayer(BASE_TILE_URLS.standard, {
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
      baseLayerRef.current = null
      radarLayerRef.current = null
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
        const labels = getMapLabels(mapLanguage)

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
              labels,
            }),
            { minWidth: 200 },
          )
        }
      })
    }

    return () => {
      cancelled = true
    }
  }, [mapReady, visibleVoyageIds, mapLanguage])

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
        const labels = getMapLabels(mapLanguage)

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
          marker.bindPopup(buildPortPopupHtml(code, agg, labels), { minWidth: 220, maxWidth: 260 })
          portMarkersRef.current.set(code, marker)
        }
      })
    }

    return () => {
      cancelled = true
    }
  }, [mapReady, layers.ports, mapLanguage])

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
      const labels = getMapLabels(mapLanguage)

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
        for (const t of typhoons) {
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
          L.marker(latLng, { icon }).addTo(overlayLayer).bindPopup(buildTyphoonPopupHtml(t, labels), { minWidth: 180 })
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
          marker.bindPopup(buildIssuePopupHtml(issue, labels), { minWidth: 200 })
          issueMarkersRef.current.set(issue.id, marker)
        }
      }

      if (layers.weather) {
        for (const w of weatherPoints) {
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
  }, [mapReady, layers.dangerZones, layers.typhoon, layers.issues, layers.weather, mapLanguage, typhoons, weatherPoints])

  // 지도 이동(9.9장) — direct면 setView(줌 델타가 큰 이동, KNOWN_PITFALLS.md 2.7), 아니면
  // flyTo. 의존성은 token뿐이다 — 좌표가 같아도 같은 지점을 다시 클릭하면 재실행되어야 한다.
  useEffect(() => {
    if (!mapReady || !focusTarget) return
    const map = mapRef.current
    if (!map) return

    const { lat, lng, zoom, direct, marker } = focusTarget
    if (direct) {
      map.setView([lat, wrapLng(lng)], zoom, { animate: true })
    } else {
      map.flyTo([lat, wrapLng(lng)], zoom, { duration: 0.8 })
    }

    if (marker) {
      const markerMap = marker.kind === 'issue' ? issueMarkersRef.current : portMarkersRef.current
      map.once('moveend', () => {
        markerMap.get(marker.id)?.openPopup()
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, focusTarget?.token])

  // 지도 유형(9.10장 ②) — 레이어를 추가·제거하지 않고 기본 타일의 setUrl()만 교체한다.
  useEffect(() => {
    if (!mapReady) return
    baseLayerRef.current?.setUrl(BASE_TILE_URLS[mapKind])
  }, [mapReady, mapKind])

  // 강수 레이더(11.3장) — "기상" 필터에 편입되어 layers.radar로 켜지고 꺼진다.
  // 프레임 경로는 한 번 조회하면 radarPathRef에 캐시해 토글할 때마다 재요청하지 않는다.
  // 실패는 조용히 무시한다 — 레이더 없이도 화면은 그대로 동작해야 한다.
  useEffect(() => {
    if (!mapReady) return
    const map = mapRef.current
    if (!map) return

    let cancelled = false

    async function syncRadar() {
      if (!layers.radar) {
        if (radarLayerRef.current) {
          map!.removeLayer(radarLayerRef.current)
          radarLayerRef.current = null
        }
        return
      }
      if (radarLayerRef.current) return

      try {
        let path = radarPathRef.current
        if (!path) {
          const res = await fetch('https://api.rainviewer.com/public/weather-maps.json', { signal: AbortSignal.timeout(8000) })
          if (!res.ok) throw new Error('bad_response')
          const data = await res.json()
          const pastFrames = data?.radar?.past
          if (!Array.isArray(pastFrames) || pastFrames.length === 0) throw new Error('no_frames')
          path = pastFrames[pastFrames.length - 1].path
          radarPathRef.current = path
        }
        if (cancelled) return

        const L = await import('leaflet')
        if (cancelled || !mapRef.current) return

        const layer = L.tileLayer(`https://tilecache.rainviewer.com${path}/256/{z}/{x}/{y}/6/1_1.png`, {
          opacity: 0.45,
          maxZoom: 10,
          errorTileUrl: ERROR_TILE_URL,
        })
        layer.addTo(mapRef.current)
        radarLayerRef.current = layer
      } catch {
        // 조용히 무시(11.3장)
      }
    }

    syncRadar()

    return () => {
      cancelled = true
    }
  }, [mapReady, layers.radar])

  // 팝업 내 전송 버튼 이벤트 위임(9.11장) — 팝업은 React 트리 밖의 raw HTML이라 onClick을
  // 붙일 수 없다. popupopen에서 data 속성으로 대상을 찾아 핸들러를 연결한다. mapLanguage가
  // 바뀌면 팝업 HTML도 다시 그려지므로(labels.sendSpeedSending 등) 핸들러도 다시 건다.
  useEffect(() => {
    if (!mapReady) return
    const map = mapRef.current
    if (!map) return

    const labels = getMapLabels(mapLanguage)

    function handlePopupOpen(e: PopupEvent) {
      const el = e.popup.getElement()
      const btn = el?.querySelector<HTMLButtonElement>('[data-send-speed-vessel-id]')
      if (!btn) return

      const vesselId = btn.dataset.sendSpeedVesselId
      const voyageId = btn.dataset.sendSpeedVoyageId
      if (!vesselId || !voyageId) return

      const originalHtml = btn.innerHTML

      btn.onclick = async () => {
        const voyage = ALL_VOYAGES.find((v) => v.id === voyageId)
        const vessel = ALL_VESSELS.find((v) => v.id === vesselId)
        const position = ALL_POSITIONS.find((p) => p.vesselId === vesselId)
        if (!voyage || !vessel || !position) return

        btn.disabled = true
        btn.style.opacity = '0.7'
        btn.textContent = labels.sendSpeedSending

        const request = {
          vesselId,
          vesselName: vessel.name,
          imo: vessel.imo,
          voyageId,
          departurePort: voyage.departurePort,
          arrivalPort: voyage.arrivalPort,
          currentSpeedKnots: position.speedKnots,
          recommendedSpeedKnots: voyage.recommendedSpeedKnots,
          plannedSpeedKnots: voyage.plannedSpeedKnots,
          eta: voyage.eta,
        }
        const result = await sendSpeedRecommendation(request)

        btn.disabled = false
        btn.style.opacity = ''
        btn.innerHTML = originalHtml

        window.alert(buildSpeedRecommendationAlert(result, request))
      }
    }

    map.on('popupopen', handlePopupOpen)
    return () => {
      map.off('popupopen', handlePopupOpen)
    }
  }, [mapReady, mapLanguage])

  return (
    <>
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      {/* h-full(퍼센트)은 부모(min-h-[500px] flex-1)의 height 속성 자체가 auto라 해석되지
          않는다 — flex-grow로 실제 픽셀 높이가 잡혀도 퍼센트 기준으로는 auto다. 절대 위치로
          부모의 실제 박스 크기를 직접 채운다. */}
      <div className="absolute inset-0">
        <div ref={containerRef} className="absolute inset-0" />
        <MapLanguageSelector value={mapLanguage} onChange={setMapLanguage} />
        <MapTypeToggle value={mapKind} onChange={setMapKind} />
        <MapLegend open={legendOpen} onToggle={() => setLegendOpen((v) => !v)} />
      </div>
    </>
  )
}
