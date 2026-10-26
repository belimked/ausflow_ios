import { currentCoords, FIX_TIMEOUT_MS, FRESH_MS, instantCoords, prefetchCoords, quietCoords, resetGeoCache, STALE_MS, TAP_WAIT_MS } from '../geo'

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

const pos = (lat: number, accuracy: number) => ({ coords: { latitude: lat, longitude: 150, accuracy }, timestamp: Date.now() })

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
  const remove = gps([pos(-33, 150), pos(-33.1, 30)])
  const c = await settle(currentCoords())
  expect(c).toEqual({ lat: -33.1, lng: 150, accuracy: 30 })
  expect(remove).toHaveBeenCalled()
})

test('a tap takes the best sample so far after TAP_WAIT_MS, while the watch carries on', async () => {
  gps([pos(-33, 300), pos(-33.2, 150)])
  const c = await settle(currentCoords(), TAP_WAIT_MS)
  expect(c).toEqual({ lat: -33.2, lng: 150, accuracy: 150 })
  // The prefetch keeps the best sample for the next screen.
  await jest.advanceTimersByTimeAsync(FIX_TIMEOUT_MS)
  expect(await quietCoords()).toEqual({ lat: -33.2, lng: 150, accuracy: 150 })
})

test('a prefetch keeps the best sample seen when the watch times out', async () => {
  gps([pos(-33, 120), pos(-33.2, 110)])
  const c = await settle(prefetchCoords(), FIX_TIMEOUT_MS)
  expect(c).toEqual({ lat: -33.2, lng: 150, accuracy: 110 })
})

test('falls back to the last known position when no sample arrives', async () => {
  gps([])
  Location.getLastKnownPositionAsync.mockResolvedValue(pos(-34, 500))
  const c = await settle(currentCoords(), TAP_WAIT_MS)
  expect(c).toEqual({ lat: -34, lng: 150, accuracy: 500 })
})

test('a sample at Wi-Fi accuracy (65 m) is good enough', async () => {
  const remove = gps([pos(-33, 65)])
  expect(await settle(currentCoords())).toEqual({ lat: -33, lng: 150, accuracy: 65 })
  expect(remove).toHaveBeenCalled()
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

test('a poor fix is still used rather than making the driver wait', async () => {
  gps([pos(-33, 300)])
  await settle(prefetchCoords(), FIX_TIMEOUT_MS)
  expect(await currentCoords()).toEqual({ lat: -33, lng: 150, accuracy: 300 })
  expect(Location.watchPositionAsync).toHaveBeenCalledTimes(1)
})

test('finishing with a fix older than FRESH_MS asks the GPS again', async () => {
  gps([pos(-33, 10)])
  await settle(prefetchCoords())
  await jest.advanceTimersByTimeAsync(FRESH_MS + 1000)
  gps([pos(-33.5, 10)])
  expect(await settle(currentCoords())).toEqual({ lat: -33.5, lng: 150, accuracy: 10 })
  expect(Location.watchPositionAsync).toHaveBeenCalledTimes(2)
})

test('finishing keeps the older fix when the GPS gives nothing in time', async () => {
  gps([pos(-33, 10)])
  await settle(prefetchCoords())
  await jest.advanceTimersByTimeAsync(FRESH_MS + 1000)
  gps([])
  expect(await settle(currentCoords(), TAP_WAIT_MS)).toEqual({ lat: -33, lng: 150, accuracy: 10 })
})

test('callers waiting at the same time share one GPS request', async () => {
  gps([pos(-33, 10)])
  const a = prefetchCoords()
  const b = currentCoords()
  await settle(Promise.all([a, b]))
  expect(Location.watchPositionAsync).toHaveBeenCalledTimes(1)
})

describe('instantCoords (actions that never wait)', () => {
  test('null when nothing is known yet, without touching the GPS', async () => {
    gps([pos(-33, 10)])
    expect(await instantCoords()).toBeNull()
    expect(Location.watchPositionAsync).not.toHaveBeenCalled()
  })

  test('the best sample of the watch in progress', async () => {
    gps([pos(-33, 300), pos(-33.2, 150)])
    prefetchCoords()
    await jest.advanceTimersByTimeAsync(0)
    expect(await instantCoords()).toEqual({ lat: -33.2, lng: 150, accuracy: 150 })
  })

  test('the last fix while it is not stale', async () => {
    gps([pos(-33, 40)])
    await settle(prefetchCoords())
    await jest.advanceTimersByTimeAsync(STALE_MS - 1000)
    expect(await instantCoords()).toEqual({ lat: -33, lng: 150, accuracy: 40 })
    await jest.advanceTimersByTimeAsync(2000)
    Location.getLastKnownPositionAsync.mockResolvedValue(pos(-34, 500))
    expect(await instantCoords()).toEqual({ lat: -34, lng: 150, accuracy: 500 })
  })

  test('the system last known position without prompting for permission', async () => {
    Location.getForegroundPermissionsAsync.mockResolvedValue({ status: 'denied' })
    Location.getLastKnownPositionAsync.mockResolvedValue(pos(-34, 500))
    expect(await instantCoords()).toBeNull()
    expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled()
  })
})

test('finishing uses the fix in hand and asks the GPS only when nothing is known', async () => {
  gps([pos(-33, 40)])
  await settle(prefetchCoords())
  expect(await currentCoords()).toEqual({ lat: -33, lng: 150, accuracy: 40 })
  expect(Location.watchPositionAsync).toHaveBeenCalledTimes(1)
})
