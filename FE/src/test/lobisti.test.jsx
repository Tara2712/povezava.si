import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  render,
  screen,
  waitFor,
  fireEvent,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Lobisti from '../pages/Lobisti'

const mockNavigate = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')

  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

/*
 * Pomembno:
 * Layout mora dejansko vrniti children.
 */
vi.mock('../components/Layout', () => ({
  default: ({ children }) => <>{children}</>,
}))

/*
 * Avatar naj ne izpisuje dodatnega imena.
 * Prejšnji mock je povzročil:
 *
 * Janez Novak
 * Janez Novak
 *
 * zato getByText ni vedel, katerega naj izbere.
 */
vi.mock('../components/Avatar', () => ({
  default: ({ name }) => (
    <div data-testid="avatar">{name}</div>
  ),
}))

vi.mock('../api', () => ({
  API: 'http://test-api',
}))

const mockResponse = {
  skupaj: 2,
  lobisti: [
    {
      id: 10,
      ime: 'Janez',
      priimek: 'Novak',
      delodajalec: 'Firma d.o.o.',
      narocnik: 'Država',
      registrska_st: '123',
      datum_vpisa: '2024-01-01',
      datum_izpisa: null,
    },
  ],
}

const secondLobist = {
  id: 20,
  ime: 'Marija',
  priimek: 'Kovač',
  delodajalec: 'Druga d.o.o.',
  narocnik: 'Občina',
  registrska_st: '456',
  datum_vpisa: '2023-05-15',
  datum_izpisa: null,
}

const thirdLobist = {
  id: 30,
  ime: 'Peter',
  priimek: 'Kralj',
  delodajalec: 'Tretja d.o.o.',
  narocnik: 'Ministrstvo',
  registrska_st: '789',
  datum_vpisa: '2022-10-20',
  datum_izpisa: null,
}

beforeEach(() => {
  vi.clearAllMocks()

  global.fetch = vi.fn(() =>
    Promise.resolve({
      json: () => Promise.resolve(mockResponse),
    })
  )
})

afterEach(() => {
  vi.useRealTimers()
})

function renderPage() {
  return render(
    <MemoryRouter>
      <Lobisti />
    </MemoryRouter>
  )
}

describe('Lobisti page', () => {
  it('prikaže loading state', () => {
    renderPage()

    expect(screen.getByText(/nalagam/i)).toBeInTheDocument()
  })

  it('ob nalaganju pokliče pravilen API endpoint', async () => {
    renderPage()

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        'http://test-api/lobisti?limit=100'
      )
    })
  })

  it('prikaže podatke iz API', async () => {
    renderPage()

    expect(await screen.findByText('Janez Novak', {
      selector: '.register-card-name',
    })).toBeInTheDocument()

    expect(screen.getByText('Firma d.o.o.')).toBeInTheDocument()
    expect(
      screen.getByText(/Naročnik: Država/i)
    ).toBeInTheDocument()
  })

  it('prikaže count badge', async () => {
    renderPage()

    expect(
      await screen.findByText(/2 lobistov/i)
    ).toBeInTheDocument()
  })

  it('pravilno prikaže 1 lobista', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        json: () =>
          Promise.resolve({
            skupaj: 1,
            lobisti: [mockResponse.lobisti[0]],
          }),
      })
    )

    renderPage()

    expect(
      await screen.findByText(/1 lobist$/i)
    ).toBeInTheDocument()
  })

  it('klik na lobista navigira na profil', async () => {
    const user = userEvent.setup()

    renderPage()

    const name = await screen.findByText('Janez Novak', {
      selector: '.register-card-name',
    })

    await user.click(name.closest('button'))

    expect(mockNavigate).toHaveBeenCalledWith('/oseba/10')
  })

  it('prikaže več kartic, če API vrne več lobistov', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        json: () =>
          Promise.resolve({
            skupaj: 3,
            lobisti: [
              mockResponse.lobisti[0],
              secondLobist,
              thirdLobist,
            ],
          }),
      })
    )

    renderPage()

    expect(
      await screen.findByText('Janez Novak', {
        selector: '.register-card-name',
      })
    ).toBeInTheDocument()

    expect(
      screen.getByText('Marija Kovač', {
        selector: '.register-card-name',
      })
    ).toBeInTheDocument()

    expect(
      screen.getByText('Peter Kralj', {
        selector: '.register-card-name',
      })
    ).toBeInTheDocument()

    expect(
      screen.getAllByRole('button', {
        name: /Janez Novak|Marija Kovač|Peter Kralj/,
      })
    ).toHaveLength(3)
  })

  it('klik na različne lobiste navigira na pravilne profile', async () => {
    const user = userEvent.setup()

    global.fetch = vi.fn(() =>
      Promise.resolve({
        json: () =>
          Promise.resolve({
            skupaj: 2,
            lobisti: [
              mockResponse.lobisti[0],
              secondLobist,
            ],
          }),
      })
    )

    renderPage()

    const janez = await screen.findByText('Janez Novak', {
      selector: '.register-card-name',
    })

    const marija = screen.getByText('Marija Kovač', {
      selector: '.register-card-name',
    })

    await user.click(janez.closest('button'))
    await user.click(marija.closest('button'))

    expect(mockNavigate).toHaveBeenNthCalledWith(
      1,
      '/oseba/10'
    )

    expect(mockNavigate).toHaveBeenNthCalledWith(
      2,
      '/oseba/20'
    )
  })

  it('empty state brez podatkov', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        json: () =>
          Promise.resolve({
            skupaj: 0,
            lobisti: [],
          }),
      })
    )

    renderPage()

    expect(
      await screen.findByText(
        'V bazi še ni lobistov. Podatki bodo dodani.'
      )
    ).toBeInTheDocument()
  })

  it('aktiven status se prikaže', async () => {
    renderPage()

    expect(
      await screen.findByText('Aktiven')
    ).toBeInTheDocument()
  })

  it('prikaže neaktivnega lobista z oznako Izpisan', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        json: () =>
          Promise.resolve({
            skupaj: 1,
            lobisti: [
              {
                ...mockResponse.lobisti[0],
                datum_izpisa: '2025-03-10',
              },
            ],
          }),
      })
    )

    renderPage()

    expect(
      await screen.findByText('Izpisan')
    ).toBeInTheDocument()

    expect(
      screen.queryByText('Aktiven')
    ).not.toBeInTheDocument()
  })

  it('pravilno prikaže datum vpisa', async () => {
    renderPage()

    const expectedDate = new Date(
      '2024-01-01'
    ).toLocaleDateString('sl-SI')

    expect(
      await screen.findByText(expectedDate)
    ).toBeInTheDocument()
  })

  it('datuma vpisa ne prikaže, če datum_vpisa ni podan', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        json: () =>
          Promise.resolve({
            skupaj: 1,
            lobisti: [
              {
                ...mockResponse.lobisti[0],
                datum_vpisa: null,
              },
            ],
          }),
      })
    )

    renderPage()

    await screen.findByText('Janez Novak', {
      selector: '.register-card-name',
    })

    expect(
      screen.queryByText(/1\. 1\. 2024/)
    ).not.toBeInTheDocument()
  })

  it('registrsko številko prikaže samo, če obstaja', async () => {
    renderPage()

    expect(
      await screen.findByText('#123')
    ).toBeInTheDocument()
  })

  it('registrske številke ne prikaže, če ne obstaja', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        json: () =>
          Promise.resolve({
            skupaj: 1,
            lobisti: [
              {
                ...mockResponse.lobisti[0],
                registrska_st: null,
              },
            ],
          }),
      })
    )

    renderPage()

    await screen.findByText('Janez Novak', {
      selector: '.register-card-name',
    })

    expect(
      screen.queryByText('#123')
    ).not.toBeInTheDocument()
  })

  it('delodajalca ne prikaže, če ga ni', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        json: () =>
          Promise.resolve({
            skupaj: 1,
            lobisti: [
              {
                ...mockResponse.lobisti[0],
                delodajalec: null,
              },
            ],
          }),
      })
    )

    renderPage()

    await screen.findByText('Janez Novak', {
      selector: '.register-card-name',
    })

    expect(
      screen.queryByText('Firma d.o.o.')
    ).not.toBeInTheDocument()
  })

  it('naročnika ne prikaže, če ga ni', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        json: () =>
          Promise.resolve({
            skupaj: 1,
            lobisti: [
              {
                ...mockResponse.lobisti[0],
                narocnik: null,
              },
            ],
          }),
      })
    )

    renderPage()

    await screen.findByText('Janez Novak', {
      selector: '.register-card-name',
    })

    expect(
      screen.queryByText(/Naročnik:/i)
    ).not.toBeInTheDocument()
  })

  it('ima iskalno polje ob odprtju strani fokus', () => {
    renderPage()

    const input = screen.getByPlaceholderText(
      'Išči po imenu, delodajalcu, naročniku...'
    )

    expect(input).toHaveFocus()
  })

  it('ob praznem iskalnem polju prikaže privzeto prazno stanje', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        json: () =>
          Promise.resolve({
            skupaj: 0,
            lobisti: [],
          }),
      })
    )

    renderPage()

    expect(
      await screen.findByText(
        'V bazi še ni lobistov. Podatki bodo dodani.'
      )
    ).toBeInTheDocument()
  })

  it('ob napaki fetch prikaže prazen seznam', async () => {
    global.fetch = vi.fn(() =>
      Promise.reject(new Error('API error'))
    )

    renderPage()

    expect(
      await screen.findByText(
        'V bazi še ni lobistov. Podatki bodo dodani.'
      )
    ).toBeInTheDocument()

    expect(
      screen.queryByText('Janez Novak', {
        selector: '.register-card-name',
      })
    ).not.toBeInTheDocument()
  })

  it('po napaki pravilno skrije loading stanje', async () => {
    global.fetch = vi.fn(() =>
      Promise.reject(new Error('API error'))
    )

    renderPage()

    await screen.findByText(
      'V bazi še ni lobistov. Podatki bodo dodani.'
    )

    expect(
      screen.queryByText('Nalagam...')
    ).not.toBeInTheDocument()
  })

  it('pravilno obravnava prazen API objekt', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        json: () => Promise.resolve({}),
      })
    )

    renderPage()

    expect(
      await screen.findByText(
        'V bazi še ni lobistov. Podatki bodo dodani.'
      )
    ).toBeInTheDocument()

    expect(
      screen.queryByText('Nalagam...')
    ).not.toBeInTheDocument()
  })

  it('pravilno obravnava manjkajoče lastnosti API odgovora', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        json: () =>
          Promise.resolve({
            skupaj: undefined,
            lobisti: undefined,
          }),
      })
    )

    renderPage()

    expect(
      await screen.findByText(
        'V bazi še ni lobistov. Podatki bodo dodani.'
      )
    ).toBeInTheDocument()

    expect(
      screen.queryByText('Nalagam...')
    ).not.toBeInTheDocument()
  })
})