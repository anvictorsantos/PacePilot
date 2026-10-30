<template>
  <div class="bg-card border border-white/10 rounded-2xl p-5 flex flex-col gap-4">
    <div class="flex justify-between items-center gap-4">
      <p class="font-bold text-xs uppercase tracking-widest text-muted">
        {{ $t('ui.route_3d') }}
      </p>
      <div
        v-if="hasRoute"
        class="flex items-center gap-2 shrink-0 text-caption text-muted"
      >
        <span>{{ $t('ui.slow') }}</span>
        <span class="rounded h-0.5 w-10 bg-gradient-to-r from-blue-500 to-primary" />
        <span>{{ $t('ui.fast') }}</span>
      </div>
    </div>

    <div
      v-if="!hasRoute"
      class="h-56 flex items-center justify-center text-sm text-muted"
    >
      {{ $t('ui.no_gps_data') }}
    </div>

    <template v-else>
      <div class="relative overflow-hidden border border-white/10 rounded-card">
        <div
          ref="mapEl"
          class="h-64 w-full"
          role="region"
          :aria-label="mapAriaLabel"
        />
        <p
          v-if="loading"
          class="absolute inset-0 flex justify-center items-center bg-background/70 text-sm text-muted"
          aria-live="polite"
        >
          {{ $t('common.loading') }}
        </p>
        <p
          v-else-if="loadError"
          class="absolute inset-0 flex justify-center items-center bg-background/70 px-4 text-center text-sm text-muted"
        >
          {{ $t('common.loadFailed') }}
        </p>
      </div>

      <div class="flex flex-wrap justify-between items-start gap-2 text-caption">
        <p
          class="text-muted"
          aria-live="polite"
        >
          {{ activeText }}
        </p>
        <div class="flex flex-wrap items-center gap-3 text-muted">
          <span class="inline-flex items-center gap-1.5">
            <span class="bg-primary rounded-full w-2 h-2 shrink-0" />
            {{ $t('ui.fastest_point') }} · {{ fastestText }}
          </span>
          <span class="inline-flex items-center gap-1.5">
            <span class="bg-blue-500 rounded-full w-2 h-2 shrink-0" />
            {{ $t('ui.slowest_point') }} · {{ slowestText }}
          </span>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import 'maplibre-gl/dist/maplibre-gl.css'

import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'

import type { ActivitySamplePoint } from '@/modules/activities/infrastructure/dto/ActivitySamplePoint.ts'
import type { ActivityStreams } from '@/modules/activities/infrastructure/dto/ActivityStreams.ts'
import { paceFromSec } from '@/modules/shared/ui/training-vocabulary.ts'

import type { Map as MapLibreMap, Marker as MapLibreMarker } from 'maplibre-gl'

/** One GPS sample plus the chart values that live at the same index. */
interface RouteSample {
  lat: number
  lng: number
  distanceKm: number
  paceSecKm: number | null
  hr: number | null
}

/** The ESM bundle and its worker are copied from the installed package into
 *  `public/vendor/maplibre` at dev/build time. MapLibre is ~1.1 MB minified, so
 *  bundling it would break the per-chunk budget; serving it same-origin keeps
 *  the worker out of the cross-origin blob path Safari refuses to load. */
const MAPLIBRE_URL = new URL('/vendor/maplibre/maplibre-gl.mjs', window.location.origin).href
const MAPLIBRE_ATTRIBUTION = '© OpenStreetMap contributors · Terrain: Mapterhorn'
const BAND_COUNT = 5
/** Fast → slow, mirroring the pace (orange) and HR (blue) chart colours. */
const BAND_COLORS = ['#F97316', '#FB923C', '#A1A1AA', '#60A5FA', '#3B82F6']
const FAST_COLOR = '#F97316'
const SLOW_COLOR = '#3B82F6'

type MapLibreModule = {
  Map: typeof import('maplibre-gl').Map
  Marker: typeof import('maplibre-gl').Marker
  LngLatBounds: typeof import('maplibre-gl').LngLatBounds
  NavigationControl: typeof import('maplibre-gl').NavigationControl
  TerrainControl: typeof import('maplibre-gl').TerrainControl
}

const props = defineProps({
  streams: { type: Object as PropType<ActivityStreams | null>, default: null },
  /** Set by the chart hover; the map follows it with a marker. */
  active: { type: Object as PropType<ActivitySamplePoint | null>, default: null },
})
// eslint-disable-next-line no-unused-vars -- the callback's parameter names are type-only
const emit = defineEmits<{ (e: 'select', point: ActivitySamplePoint): void }>()

const { t } = useI18n()
const mapEl = ref<HTMLElement | null>(null)
const loading = ref(false)
const loadError = ref(false)

let map: MapLibreMap | null = null
let activeMarker: MapLibreMarker | null = null
let fastestMarker: MapLibreMarker | null = null
let slowestMarker: MapLibreMarker | null = null

function finite(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/** Join latlng with the aligned distance/velocity/HR arrays, dropping gaps. */
const samples = computed<RouteSample[]>(() => {
  const streams = props.streams
  const latlng = streams?.latlng ?? []
  const distances = streams?.distance ?? []
  const velocities = streams?.velocity_smooth ?? []
  const heartrates = streams?.heartrate ?? []
  const route: RouteSample[] = []
  for (let i = 0; i < latlng.length; i += 1) {
    const pair = latlng[i]
    const distanceM = finite(distances[i])
    if (!pair || distanceM == null) continue
    const speed = finite(velocities[i])
    route.push({
      lat: pair[0],
      lng: pair[1],
      distanceKm: distanceM / 1000,
      paceSecKm: speed && speed > 0 ? 1000 / speed : null,
      hr: finite(heartrates[i]),
    })
  }
  return route
})

const hasRoute = computed(() => samples.value.length >= 2)

const stats = computed(() => {
  let fastest: RouteSample | null = null
  let slowest: RouteSample | null = null
  for (const sample of samples.value) {
    if (sample.paceSecKm == null) continue
    if (!fastest || sample.paceSecKm < (fastest.paceSecKm ?? Infinity)) fastest = sample
    if (!slowest || sample.paceSecKm > (slowest.paceSecKm ?? -Infinity)) slowest = sample
  }
  return fastest && slowest ? { fastest, slowest } : null
})

function pointText(sample: RouteSample): string {
  const pace = sample.paceSecKm != null ? paceFromSec(sample.paceSecKm) : '—'
  return `${sample.distanceKm.toFixed(1)} ${t('ui.km_unit')} · ${pace}`
}

const fastestText = computed(() => (stats.value ? pointText(stats.value.fastest) : '—'))
const slowestText = computed(() => (stats.value ? pointText(stats.value.slowest) : '—'))

const activeText = computed(() => {
  const point = props.active
  if (!point) return t('ui.map_hint')
  const pace = point.paceSecKm != null ? paceFromSec(point.paceSecKm) : '—'
  const hr = point.hr != null ? `${Math.round(point.hr)} ${t('ui.bpm')}` : '—'
  return `${point.distanceKm.toFixed(1)} ${t('ui.km_unit')} · ${pace} · ${hr}`
})

const mapAriaLabel = computed(() =>
  stats.value
    ? t('ui.route_map_aria', { fastest: fastestText.value, slowest: slowestText.value })
    : t('ui.no_gps_data'),
)

/** Pace cut-offs at the quintiles of the run, so each colour band carries
 *  roughly a fifth of the samples. Linear min/max bands collapse into one
 *  colour when a single GPS stop makes the range huge. */
const paceThresholds = computed<number[]>(() => {
  const paces = samples.value
    .map((sample) => sample.paceSecKm)
    .filter((pace): pace is number => pace != null)
    .sort((a, b) => a - b)
  if (paces.length < BAND_COUNT) return []
  return Array.from({ length: BAND_COUNT - 1 }, (_, index) => {
    const pace = paces[Math.floor(((index + 1) / BAND_COUNT) * paces.length)]
    return pace ?? paces[paces.length - 1] ?? 0
  })
})

function bandOf(paceSecKm: number): number {
  const thresholds = paceThresholds.value
  if (!thresholds.length) return Math.floor(BAND_COUNT / 2)
  return Math.min(BAND_COUNT - 1, thresholds.filter((threshold) => paceSecKm > threshold).length)
}

/** Group consecutive samples into one polyline per pace band. */
function buildBands(): Array<[number, number][][]> {
  const bands: Array<[number, number][][]> = Array.from({ length: BAND_COUNT }, () => [])
  const route = samples.value
  if (route.length < 2) return bands
  const midPace = stats.value?.fastest.paceSecKm ?? 0
  let currentBand = -1
  let line: [number, number][] = []
  for (let i = 1; i < route.length; i += 1) {
    const previous = route[i - 1]
    const sample = route[i]
    if (!previous || !sample) continue
    const pace = sample.paceSecKm ?? previous.paceSecKm ?? midPace
    const band = bandOf(pace)
    if (band !== currentBand) {
      if (currentBand >= 0 && line.length > 1) bands[currentBand]?.push(line)
      line = [[previous.lng, previous.lat]]
      currentBand = band
    }
    line.push([sample.lng, sample.lat])
  }
  if (currentBand >= 0 && line.length > 1) bands[currentBand]?.push(line)
  return bands
}

function bearingBetween(from: RouteSample, to: RouteSample): number {
  const toRad = Math.PI / 180
  const dLng = (to.lng - from.lng) * toRad
  const lat1 = from.lat * toRad
  const lat2 = to.lat * toRad
  const y = Math.sin(dLng) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng)
  return (Math.atan2(y, x) * 180) / Math.PI
}

function nearestByDistance(distanceKm: number): RouteSample | null {
  let best: RouteSample | null = null
  let bestDelta = Infinity
  for (const sample of samples.value) {
    const delta = Math.abs(sample.distanceKm - distanceKm)
    if (delta < bestDelta) {
      best = sample
      bestDelta = delta
    }
  }
  return best
}

function nearestByLngLat(lng: number, lat: number): RouteSample | null {
  let best: RouteSample | null = null
  let bestDistance = Infinity
  for (const sample of samples.value) {
    const dLng = sample.lng - lng
    const dLat = sample.lat - lat
    const distance = dLng * dLng + dLat * dLat
    if (distance < bestDistance) {
      best = sample
      bestDistance = distance
    }
  }
  return best
}

function toPoint(sample: RouteSample): ActivitySamplePoint {
  return { distanceKm: sample.distanceKm, paceSecKm: sample.paceSecKm, hr: sample.hr }
}

function markerElement(color: string, size: number, label: string): HTMLElement {
  const element = document.createElement('span')
  element.className = 'block rounded-full border-2 border-white shadow-lg'
  element.style.width = `${size}px`
  element.style.height = `${size}px`
  element.style.backgroundColor = color
  element.title = label
  return element
}

function addMarker(
  instance: MapLibreModule,
  sample: RouteSample,
  color: string,
  size: number,
  label: string,
): MapLibreMarker {
  return new instance.Marker({
    element: markerElement(color, size, label),
    anchor: 'center',
  })
    .setLngLat([sample.lng, sample.lat])
    .addTo(map as MapLibreMap)
}

function addRouteLayers(instance: MapLibreModule): void {
  if (!map) return
  buildBands().forEach((lines, index) => {
    const sourceId = `route-band-${index}`
    map?.addSource(sourceId, {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: {},
        geometry: { type: 'MultiLineString', coordinates: lines },
      },
    })
    map?.addLayer({
      id: sourceId,
      type: 'line',
      source: sourceId,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': BAND_COLORS[index] ?? '#A1A1AA',
        'line-width': 5,
        'line-opacity': 0.95,
      },
    })
  })
  if (!map || !stats.value) return
  fastestMarker = addMarker(instance, stats.value.fastest, FAST_COLOR, 12, t('ui.fastest_point'))
  slowestMarker = addMarker(instance, stats.value.slowest, SLOW_COLOR, 12, t('ui.slowest_point'))
  const first = samples.value[0]
  if (!first) return
  activeMarker = new instance.Marker({
    element: markerElement('#FFFFFF', 16, t('ui.pace')),
    anchor: 'center',
  }).setLngLat([first.lng, first.lat])
  activeMarker.getElement().style.display = 'none'
  activeMarker.addTo(map)
}

function fitRoute(instance: MapLibreModule): void {
  if (!map || !samples.value.length) return
  const bounds = new instance.LngLatBounds()
  for (const sample of samples.value) bounds.extend([sample.lng, sample.lat])
  const first = samples.value[0]
  const next = samples.value[Math.min(15, samples.value.length - 1)]
  map.fitBounds(bounds, {
    padding: 48,
    maxZoom: 16,
    pitch: 62,
    bearing: first && next ? bearingBetween(first, next) : 0,
    duration: 0,
  })
}

function updateMarker(): void {
  if (!activeMarker) return
  const element = activeMarker.getElement()
  if (!props.active) {
    element.style.display = 'none'
    return
  }
  const sample = nearestByDistance(props.active.distanceKm)
  if (!sample) {
    element.style.display = 'none'
    return
  }
  element.style.display = 'block'
  activeMarker.setLngLat([sample.lng, sample.lat])
}

async function initMap(): Promise<void> {
  if (!mapEl.value || !hasRoute.value || map) return
  loading.value = true
  loadError.value = false
  try {
    const instance = (await import(/* @vite-ignore */ MAPLIBRE_URL)) as MapLibreModule
    await nextTick()
    if (!mapEl.value) return
    const created = new instance.Map({
      container: mapEl.value,
      style: {
        version: 8,
        sources: {
          osm: {
            type: 'raster',
            tiles: ['https://a.tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            maxzoom: 19,
            attribution: MAPLIBRE_ATTRIBUTION,
          },
          terrainSource: { type: 'raster-dem', url: 'https://tiles.mapterhorn.com/tilejson.json' },
          hillshadeSource: {
            type: 'raster-dem',
            url: 'https://tiles.mapterhorn.com/tilejson.json',
          },
        },
        layers: [
          {
            id: 'osm',
            type: 'raster',
            source: 'osm',
            paint: {
              'raster-brightness-max': 0.55,
              'raster-saturation': -0.35,
            },
          },
          {
            id: 'hills',
            type: 'hillshade',
            source: 'hillshadeSource',
            paint: { 'hillshade-shadow-color': '#0B0B0F', 'hillshade-exaggeration': 0.35 },
          },
        ],
        terrain: { source: 'terrainSource', exaggeration: 1.25 },
        sky: {},
      },
      center: [samples.value[0]?.lng ?? 0, samples.value[0]?.lat ?? 0],
      zoom: 13,
      pitch: 62,
      maxPitch: 85,
      attributionControl: { compact: true },
    })
    map = created
    created.addControl(new instance.NavigationControl({ visualizePitch: true, showZoom: true }))
    created.addControl(new instance.TerrainControl({ source: 'terrainSource', exaggeration: 1.25 }))
    created.on('load', () => {
      addRouteLayers(instance)
      fitRoute(instance)
      // State the 3D pose after the fit: some MapLibre builds drop the pitch
      // passed to fitBounds once terrain finishes loading.
      created.jumpTo({ pitch: 62 })
      updateMarker()
      loading.value = false
    })
    created.on('click', (event) => {
      const sample = nearestByLngLat(event.lngLat.lng, event.lngLat.lat)
      if (sample) emit('select', toPoint(sample))
    })
  } catch {
    loadError.value = true
    loading.value = false
  }
}

watch(
  () => props.active,
  () => updateMarker(),
)

watch(hasRoute, (present) => {
  if (present && !map) void initMap()
})

onMounted(() => {
  if (hasRoute.value) void initMap()
})

onBeforeUnmount(() => {
  fastestMarker?.remove()
  slowestMarker?.remove()
  activeMarker?.remove()
  map?.remove()
  map = null
  fastestMarker = null
  slowestMarker = null
  activeMarker = null
})
</script>
