import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import Osebe from '../pages/Osebe'

const mockOsebe = [
  {
    id: 10,
    ime: 'Janez',
    priimek: 'Novak',
    naziv: 'Direktor',
    institucija: 'Firma d.o.o.',
    fotografija_url: null,
    stevilo_povezav: 5,
  },
]

const mockOsebeSorted = [
  {
    id: 10,
    ime: 'Janez',
    priimek: 'Novak',
    naziv: 'Direktor',
    institucija: 'Firma d.o.o.',
    fotografija_url: null,
    stevilo_povezav: 5,
  },
  {
    id: 11,
    ime: 'Ana',
    priimek: 'Zupan',
    naziv: 'Raziskovalka',
    institucija: 'Univerza',
    fotografija_url: null,
    stevilo_povezav: 2,
  },
  {
    id: 12,
    ime: 'Marko',
    priimek: 'Kovač',
    naziv: 'Politik',
    institucija: 'Parlament',
    fotografija_url: null,
    stevilo_povezav: 10,
  },
]

const toggleMock = vi.fn()
const trackSearchMock = vi.fn()
const selectForCompareMock = vi.fn()
const clearCompareMock = vi.fn()

let savedIds
let comparisonCandidate

beforeEach(() => {
  vi.clearAllMocks()

  savedIds = new Set()
  comparisonCandidate = null

  global.fetch = vi.fn((url) => {
    const urlString = String(url)

    if (urlString.includes('/api/osebe')) {
      const parsed = new URL(urlString)

      const sort = parsed.searchParams.get('sort')

      let rows = [...mockOsebeSorted]

      if (sort === 'az') {
        rows.sort((a, b) =>
          `${a.ime} ${a.priimek}`.localeCompare(
            `${b.ime} ${b.priimek}`,
            'sl'
          )
        )
      }

      if (sort === 'za') {
        rows.sort((a, b) =>
          `${b.ime} ${b.priimek}`.localeCompare(
            `${a.ime} ${a.priimek}`,
            'sl'
          )
        )
      }

      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            osebe: rows,
            skupaj: 3,
          }),
      })
    }

    if (urlString.includes('/api/stats')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            osebe: 3,
          }),
      })
    }

    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve([]),
    })
  })
})

afterEach(() => {
  vi.useRealTimers()
})

vi.mock('../components/Layout', () => ({
  default: ({ children }) => <>{children}</>,
}))

vi.mock('../components/Avatar', () => ({
  default: ({ name }) => <span>{name}</span>,
}))

vi.mock('../components/ShareBtn', () => ({
  default: () => <span>Share</span>,
}))

vi.mock('../hooks/usePersonStorage', () => ({
  useSavedPersons: () => ({
    toggle: toggleMock,
    isSaved: (id) => savedIds.has(id),
  }),

  useComparison: () => ({
    candidate: comparisonCandidate,
    select: selectForCompareMock,
    clear: clearCompareMock,
  }),

  useSearchHistory: () => ({
    track: trackSearchMock,
  }),
}))

vi.mock('../api', () => ({
  API: 'http://test-api',
}))

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/osebe']}>
      <Routes>
        <Route path="/osebe" element={<Osebe />} />
        <Route
          path="/oseba/:id"
          element={<div>Profil osebe 10</div>}
        />
        <Route
          path="/omrezje/:id"
          element={<div>Omrežje</div>}
        />
        <Route
          path="/asistent"
          element={<div>AI</div>}
        />
        <Route
          path="/primerjava"
          element={<div>Primerjava</div>}
        />
      </Routes>
    </MemoryRouter>
  )
}

describe('Osebe page', () => {
  it('prikaže loading state', async () => {
    global.fetch = vi.fn(
      () =>
        new Promise(() => {})
    )

    renderPage()

    expect(screen.getByText(/nalagam/i)).toBeInTheDocument()
  })

  it('prikaže seznam oseb', async () => {
    renderPage()

    expect(
      await screen.findByRole('button', {
        name: /Janez Novak/i,
      })
    ).toBeInTheDocument()

    expect(
      screen.getByRole('button', {
        name: /Ana Zupan/i,
      })
    ).toBeInTheDocument()

    expect(
      screen.getByRole('button', {
        name: /Marko Kovač/i,
      })
    ).toBeInTheDocument()
  })

  it('prikaže število povezav osebe', async () => {
    renderPage()

    const card = await screen.findByRole('button', {
      name: /Janez Novak/i,
    })

    expect(
      within(card).getByText(/5\s*povezav/i)
    ).toBeInTheDocument()
  })

  it('sortira osebe po številu povezav', async () => {
    renderPage()

    await waitFor(() => {
      expect(
        global.fetch.mock.calls.some(([url]) =>
          String(url).includes('/api/osebe')
        )
      ).toBe(true)
    })

    expect(
      global.fetch.mock.calls.some(([url]) =>
        String(url).includes('sort=povezave')
      )
    ).toBe(true)
  })

  it('spremeni sortiranje na A → Ž', async () => {
    const user = userEvent.setup()

    renderPage()

    await screen.findByRole('button', {
      name: /Janez Novak/i,
    })

    const select = screen.getByRole('combobox')

    await user.selectOptions(select, 'az')

    await waitFor(() => {
      expect(
        global.fetch.mock.calls.some(([url]) =>
          String(url).includes('sort=az')
        )
      ).toBe(true)
    })
  })

  it('spremeni sortiranje na Ž → A', async () => {
    const user = userEvent.setup()

    renderPage()

    await screen.findByRole('button', {
      name: /Janez Novak/i,
    })

    const select = screen.getByRole('combobox')

    await user.selectOptions(select, 'za')

    await waitFor(() => {
      expect(
        global.fetch.mock.calls.some(([url]) =>
          String(url).includes('sort=za')
        )
      ).toBe(true)
    })
  })

  it('pošlje minimalno število povezav', async () => {
    const user = userEvent.setup()

    renderPage()

    const input = await screen.findByPlaceholderText('Min')

    await user.type(input, '3')

    await waitFor(() => {
      expect(
        global.fetch.mock.calls.some(([url]) =>
          String(url).includes('min_povezave=3')
        )
      ).toBe(true)
    })
  })

  it('pošlje maksimalno število povezav', async () => {
    const user = userEvent.setup()

    renderPage()

    const input = await screen.findByPlaceholderText('Max')

    await user.type(input, '10')

    await waitFor(() => {
      expect(
        global.fetch.mock.calls.some(([url]) =>
          String(url).includes('max_povezave=10')
        )
      ).toBe(true)
    })
  })


  it('shrani osebo in pokliče toggle', async () => {
    const user = userEvent.setup()

    renderPage()

    const janezCard = await screen.findByRole('button', {
      name: /Janez Novak/i,
    })

    const wrapper = janezCard.closest('.osebe-card-wrap')

    const saveButton = within(wrapper).getByTitle('Shrani')

    await user.click(saveButton)

    expect(toggleMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 10,
        ime: 'Janez',
        priimek: 'Novak',
      })
    )
  })

  it('prikaže shranjeno osebo', async () => {
    savedIds.add(10)

    renderPage()

    await screen.findByRole('button', {
      name: /Janez Novak/i,
    })

    expect(
      screen.getByTitle('Odstrani iz shranjenih')
    ).toBeInTheDocument()
  })

  it('spremeni stran pri paginaciji', async () => {
    global.fetch = vi.fn((url) => {
      if (String(url).includes('/api/osebe')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              osebe: mockOsebe,
              skupaj: 100,
            }),
        })
      }

      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            osebe: 100,
          }),
      })
    })

    const user = userEvent.setup()

    renderPage()

    expect(
      await screen.findByText(/stran 1 \/ 3/i)
    ).toBeInTheDocument()

    await user.click(
      screen.getByRole('button', {
        name: /naprej/i,
      })
    )

    expect(
      await screen.findByText(/stran 2 \/ 3/i)
    ).toBeInTheDocument()

    expect(
      global.fetch.mock.calls.some(([url]) =>
        String(url).includes('offset=40')
      )
    ).toBe(true)
  })

  it('gumb Naprej preide na naslednjo stran', async () => {
    global.fetch = vi.fn((url) => {
      if (String(url).includes('/api/osebe')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              osebe: mockOsebe,
              skupaj: 100,
            }),
        })
      }

      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            osebe: 100,
          }),
      })
    })

    const user = userEvent.setup()

    renderPage()

    await screen.findByText(/stran 1 \/ 3/i)

    await user.click(
      screen.getByRole('button', {
        name: /naprej/i,
      })
    )

    expect(
      await screen.findByText(/stran 2 \/ 3/i)
    ).toBeInTheDocument()
  })

  it('prikaže pravilno številko strani', async () => {
    global.fetch = vi.fn((url) => {
      if (String(url).includes('/api/osebe')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              osebe: mockOsebe,
              skupaj: 81,
            }),
        })
      }

      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            osebe: 81,
          }),
      })
    })

    renderPage()

    expect(
      await screen.findByText(/stran 1 \/ 3/i)
    ).toBeInTheDocument()
  })

  it('navigira na profil osebe', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter initialEntries={['/osebe']}>
        <Routes>
          <Route path="/osebe" element={<Osebe />} />
          <Route
            path="/oseba/:id"
            element={<div>Profil osebe 10</div>}
          />
        </Routes>
      </MemoryRouter>
    )

    const card = await screen.findByRole('button', {
      name: /Janez Novak/i,
    })

    await user.click(card)

    expect(
      await screen.findByText('Profil osebe 10')
    ).toBeInTheDocument()
  })

  it('povezava Omrežje vodi na pravilen URL', async () => {
    renderPage()

    const janezCard = await screen.findByRole('button', {
      name: /Janez Novak/i,
    })

    const wrapper = janezCard.closest('.osebe-card-wrap')

    const link = within(wrapper).getByRole('link', {
      name: /Omrežje/i,
    })

    expect(link).toHaveAttribute(
      'href',
      '/omrezje/10'
    )
  })

  it('povezava AI vsebuje pravilno vprašanje', async () => {
    renderPage()

    const janezCard = await screen.findByRole('button', {
      name: /Janez Novak/i,
    })

    const wrapper = janezCard.closest('.osebe-card-wrap')

    const link = within(wrapper).getByRole('link', {
      name: /AI/i,
    })

    expect(link).toHaveAttribute(
      'href',
      '/asistent?q=Janez%20Novak'
    )
  })


it('gumb Prej vrne na prejšnjo stran', async () => {
  global.fetch = vi.fn((url) => {
    if (String(url).includes('/api/osebe')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            osebe: mockOsebe,
            skupaj: 100,
          }),
      })
    }

    return Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve({
          osebe: 100,
        }),
    })
  })

  const user = userEvent.setup()

  renderPage()

  await screen.findByText(/stran 1 \/ 3/i)

  // Najprej pojdi na stran 2
  await user.click(
    screen.getByRole('button', {
      name: /^Naprej →$/i,
    })
  )

  await screen.findByText(/stran 2 \/ 3/i)

  // Nato nazaj na stran 1
  await user.click(
    screen.getByRole('button', {
      name: /^← Prej$/i,
    })
  )

  expect(
    await screen.findByText(/stran 1 \/ 3/i)
  ).toBeInTheDocument()
})


it('omogoča primerjavo dveh oseb', async () => {
  // Kandidat mora biti null, da komponenta prikaže
  // gumb "Primerjaj".
  comparisonCandidate = null

  renderPage()

  const janezCard = await screen.findByRole('button', {
    name: /Janez Novak/i,
  })

  const wrapper = janezCard.closest('.osebe-card-wrap')

  const compareButton = within(wrapper).getByTitle(
    'Primerjaj'
  )

  expect(compareButton).toBeInTheDocument()
})



it('izbere prvo osebo za primerjavo', async () => {
  comparisonCandidate = null

  const user = userEvent.setup()

  renderPage()

  const janezCard = await screen.findByRole('button', {
    name: /Janez Novak/i,
  })

  const wrapper = janezCard.closest('.osebe-card-wrap')

  const compareButton = within(wrapper).getByTitle(
    'Primerjaj'
  )

  await user.click(compareButton)

  expect(selectForCompareMock).toHaveBeenCalledWith(
    expect.objectContaining({
      id: 10,
      ime: 'Janez',
      priimek: 'Novak',
    })
  )
})


  it('prikaže stanje brez rezultatov iskanja', async () => {
    global.fetch = vi.fn((url) => {
      if (String(url).includes('/api/osebe')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              osebe: [],
              skupaj: 0,
            }),
        })
      }

      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            osebe: 0,
          }),
      })
    })

    renderPage()

    expect(
      await screen.findByText('0 oseb')
    ).toBeInTheDocument()

    expect(
      screen.queryByRole('button', {
        name: /Janez Novak/i,
      })
    ).not.toBeInTheDocument()
  })


  it('filter tip sproži nov API klic', async () => {
    const user = userEvent.setup()

    renderPage()

    await screen.findByRole('button', {
      name: /Janez Novak/i,
    })

    await user.click(
      screen.getByRole('button', {
        name: 'Poslovnež',
      })
    )

    await waitFor(() => {
      expect(
        global.fetch.mock.calls.some(([url]) =>
          String(url).includes('tip=poslovnez')
        )
      ).toBe(true)
    })
  })
})
