import { currentCoords, FIX_TIMEOUT_MS, prefetchCoords, quietCoords, resetGeoCache } from '../geo'

const Location = jest.requireMock('expo-location') as {
  requestForegroundPermissionsAsync: jest.Mock
  getForegroundPermissionsAsync: jest.Mock
  getLastKnownPositionAsync: jest.Mock
  watchPositionAsync: jest.Mock
  Accuracy: { High: number }
}

jest.mock('expo-location', () => ({
  Accuracy: { High: 4 },
  requestForegroundPermissionsAsync: jest.fn(),
  getForegroundPermissionsAsync: jest.fn(),
  getLastKnownPositionAsync: jest.fn(),
  watchPositionAsync: jest.fn(),
}))

const pos = (lat: number, accuracy: number) => ({ coords: { latitude: lat, longitude: 150, accuracy } })

// The GPS feeds `samples` in order; the subscription records when it is removed.
function gps(samples: ReturnType<typeof pos>[]) {
  const remove = jest.fn()
  Location.watchPositionAsync.mockImplementation(async (_o: unknown, cb: (p: unknown) => void) => {
    setTimeout(() => samples.forEach(cb), 0)
    return { remove }
  })
  return remove
}

beforeEach(() => {
  jest.useFakeTimers()
  resetGeoCache()
  jest.clearAllMocks()
  Location.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' })
  Location.getForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' })
  Location.getLastKnownPositionAsync.mockResolvedValue(null)
})
afterEach(() => jest.useRealTimers())

async function settle(p: Promise<unknown>, ms = 0) {
  await jest.advanceTimersByTimeAsync(ms)
  return p
}

test('ends the wait at the first sample accurate enough', async () => {
  const remove = gps([pos(-33, 120), pos(-33.1, 30)])
  const c = await settle(currentCoords())
  expect(c).toEqual({ lat: -33.1, lng: 150, accuracy: 30 })
  expect(remove).toHaveBeenCalled()
})

test('returns the best sample seen when the timeout passes', async () => {
  gps([pos(-33, 120), pos(-33.2, 80)])
  const c = await settle(currentCoords(), FIX_TIMEOUT_MS)
  expect(c).toEqual({ lat: -33.2, lng: 150, accuracy: 80 })
})

test('falls back to the last known position when no sample arrives', async () => {
  gps([])
  Location.getLastKnownPositionAsync.mockResolvedValue(pos(-34, 500))
  const c = await settle(currentCoords(), FIX_TIMEOUT_MS)
  expect(c).toEqual({ lat: -34, lng: 150, accuracy: 500 })
})

test('null without permission', async () => {
  gps([pos(-33, 10)])
  Location.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'denied' })
  expect(await settle(currentCoords())).toBeNull()
  expect(Location.watchPositionAsync).not.toHaveBeenCalled()
})

test('a prefetched good fix is reused without asking the GPS again', async () => {
  gps([pos(-33, 10)])
  await settle(prefetchCoords())
  expect(Location.watchPositionAsync).toHaveBeenCalledTimes(1)
  expect(await currentCoords()).toEqual({ lat: -33, lng: 150, accuracy: 10 })
  expect(await quietCoords()).toEqual({ lat: -33, lng: 150, accuracy: 10 })
  expect(Location.watchPositionAsync).toHaveBeenCalledTimes(1)
})

test('a poor fix is not reused', async () => {
  gps([pos(-33, 300)])
  await settle(prefetchCoords(), FIX_TIMEOUT_MS)
  gps([pos(-33.5, 10)])
  expect(await settle(currentCoords())).toEqual({ lat: -33.5, lng: 150, accuracy: 10 })
  expect(Location.watchPositionAsync).toHaveBeenCalledTimes(2)
})

test('a stale fix is replaced', async () => {
  gps([pos(-33, 10)])
  await settle(prefetchCoords())
  await jest.advanceTimersByTimeAsync(61000)
  gps([pos(-33.5, 10)])
  expect(await settle(currentCoords())).toEqual({ lat: -33.5, lng: 150, accuracy: 10 })
})

test('callers waiting at the same time share one GPS request', async () => {
  gps([pos(-33, 10)])
  const a = prefetchCoords()
  const b = currentCoords()
  await settle(Promise.all([a, b]))
  expect(Location.watchPositionAsync).toHaveBeenCalledTimes(1)
})
