import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import Oseba from '../pages/Oseba'

const mockPerson = {
  id: 10,
  ime: 'Janez',
  priimek: 'Novak',
  tip: 'klasicen',
  zadnja_posodobitev: '2024-01-01',
  fotografija_url: null,
  povezave: [
    {
      podjetje_id: 99,
      popolno_ime: 'Firma d.o.o.',
      vloga: 'Direktor',
      pravna_oblika: 'd.o.o.',
      datum_od: '2020-01-01',
      datum_do: null,
    },
  ],
}

const mockClanki = [
  {
    id: 1,
    vir: 'RTV',
    naslov: 'Primer članka',
    datum: '2024-01-10',
    url: 'https://example.com',
  },
]

const mockTveganje = {
  score: 12,
  indikatorji: {
    st_funkcij: 1,
    st_aktivnih_funkcij: 1,
    st_podjetij: 1,
    st_neaktivnih_podjetij: 0,
  },
}

beforeEach(() => {
  vi.clearAllMocks()

  global.fetch = vi.fn((url) => {
    if (url.includes('/tveganje')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockTveganje),
      })
    }

    if (url.includes('/clanki')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockClanki),
      })
    }

    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve(mockPerson),
    })
  })
})

vi.mock('../components/Layout', () => ({
  default: ({ children }) => <div>{children}</div>,
}))

vi.mock('../components/Avatar', () => ({
  default: ({ name }) => <div>{name}</div>,
}))

vi.mock('../components/ShareBtn', () => ({
  default: () => <button>Share</button>,
}))

vi.mock('../hooks/usePersonStorage', () => ({
  useSavedPersons: () => ({
    toggle: vi.fn(),
    isSaved: () => false,
  }),
  useRecentlyViewed: () => ({
    track: vi.fn(),
  }),
  useComparison: () => ({
    candidate: null,
    select: vi.fn(),
    clear: vi.fn(),
  }),
}))

vi.mock('../hooks/useWatchlist', () => ({
  useWatchlist: () => ({
    isFollowing: () => false,
    follow: vi.fn(),
    unfollow: vi.fn(),
    loading: false,
  }),
}))

vi.mock('../api', () => ({
  API: 'http://test-api',
}))

vi.mock('../utils/generateOsebaPdf', () => ({
  generateOsebaPdf: vi.fn(),
}))

function renderPage(id = 10) {
  return render(
    <MemoryRouter initialEntries={[`/oseba/${id}`]}>
      <Routes>
        <Route path="/oseba/:id" element={<Oseba />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('Oseba page', () => {
  it('prikaže loading state', () => {
    renderPage()

    expect(screen.getByText(/nalagam/i)).toBeInTheDocument()
  })

  it('prikaže osnovne podatke osebe', async () => {
    renderPage()

    expect(
      await screen.findByRole('heading', {
        name: /Janez Novak/i,
      })
    ).toBeInTheDocument()

    expect(
      screen.getByText(/Direktor.*Firma d\.o\.o\./i)
    ).toBeInTheDocument()
  })

  it('prikaže povezave', async () => {
    renderPage()

    const connCard = await screen.findByRole('link', {
      name: /Firma d\.o\.o\./i,
    })

    expect(connCard).toBeInTheDocument()

    const utils = within(connCard)

    expect(utils.getByText('Direktor')).toBeInTheDocument()
    expect(utils.getByText('d.o.o.')).toBeInTheDocument()
  })

  it('prikaže članke (omembe v medijih)', async () => {
    renderPage()

    expect(
      await screen.findByText(/Primer članka/i)
    ).toBeInTheDocument()

    expect(screen.getByText(/RTV/i)).toBeInTheDocument()
  })

  it('fetch se pokliče za osebo in članke', async () => {
    renderPage()

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/osebe/10'),
        expect.any(Object)
      )

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/clanki'),
        expect.any(Object)
      )

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/tveganje'),
        expect.any(Object)
      )
    })
  })

  it('empty povezave state', async () => {
    global.fetch = vi.fn((url) => {
      if (url.includes('/tveganje')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockTveganje),
        })
      }

      if (url.includes('/clanki')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]),
        })
      }

      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            ...mockPerson,
            povezave: [],
          }),
      })
    })

    renderPage()

    expect(
      await screen.findByText(/ni znanih povezav/i)
    ).toBeInTheDocument()
  })
})