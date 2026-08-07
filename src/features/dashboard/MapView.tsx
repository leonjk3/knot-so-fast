'use client'

import { useEffect, useRef, useState } from 'react'
import type { Map as LeafletMap, LayerGroup } from 'leaflet'
import type { AisPosition } from '@/shared/types'
import { OWN_COMPANY_NAME, VOYAGE_STATUS_COLORS } from '@/shared/constants'
import { formatDateTime } from '@/shared/utils/format'
import { MOCK_VOYAGES } from '@/mocks/voyages'
import { MOCK_VESSELS } from '@/mocks/vessels'
import { MOCK_POSITIONS } from '@/mocks/positions'
import { WORLD_BOUNDS, wrapLng, wrapRouteSegments } from './mapSeam'
import { getDisplayRoute, computeActualRoute, buildVesselMarkerIcon, buildVesselPopupHtml } from './voyageLayer'

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
  selectedVoyageIds: Set<string>
}

export default function MapView({ selectedVoyageIds }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<LeafletMap | null>(null)
  const voyageLayerRef = useRef<LayerGroup | null>(null)
  const portLayerRef = useRef<LayerGroup | null>(null)
  const overlayLayerRef = useRef<LayerGroup | null>(null)
  const resizeHandlerRef = useRef<(() => void) | null>(null)
  const [mapReady, setMapReady] = useState(false)

  useEffect(() => {
    let active = true

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
    }
  }, [])

  // 항차 레이어(9.7장) — 계획 항로 + 실제 항적 + 선박 마커. 선택 항차가 바뀔 때마다
  // clearLayers()로 비우고 다시 그린다(9.5장).
  useEffect(() => {
    if (!mapReady) return
    const voyageLayer = voyageLayerRef.current
    if (!voyageLayer) return

    let cancelled = false
    voyageLayer.clearLayers()

    if (selectedVoyageIds.size > 0) {
      import('leaflet').then((L) => {
        if (cancelled) return

        for (const voyageId of selectedVoyageIds) {
          const voyage = MOCK_VOYAGES.find((v) => v.id === voyageId)
          if (!voyage) continue
          const vessel = MOCK_VESSELS.find((v) => v.id === voyage.vesselId)
          if (!vessel) continue
          const position: AisPosition | undefined = MOCK_POSITIONS.find((p) => p.vesselId === voyage.vesselId)

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
  }, [mapReady, selectedVoyageIds])

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
