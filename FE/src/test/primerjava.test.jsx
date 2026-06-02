import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Primerjava from '../pages/Primerjava'
import { vi } from 'vitest'

/* =========================
   MOCK Layout + Avatar
========================= */
vi.mock('../components/Layout', () => ({
  default: ({ children }) => <div>{children}</div>
}))

vi.mock('../components/Avatar', () => ({
  default: ({ name }) => <div data-testid="avatar">{name}</div>
}))

/* =========================
   MOCK API
========================= */
vi.mock('../api', () => ({
  API: 'http://test-api'
}))

/* =========================
   FETCH MOCK
========================= */
global.fetch = vi.fn()

beforeEach(() => {
  fetch.mockReset()
})

/* helper */
function renderWithParams(url) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Primerjava />
    </MemoryRouter>
  )
}

/* =========================
   TESTI
========================= */
describe('Primerjava page', () => {

  test('prikaže loading state', () => {
    fetch.mockImplementation(() =>
      new Promise(() => {}) // nikoli ne resolve-a
    )

    renderWithParams('/primerjava?a=1&b=2')

    expect(screen.getByText(/nalagam primerjavo/i)).toBeInTheDocument()
  })

  test('prikaže error, če manjkata parametra', async () => {
    renderWithParams('/primerjava')

    expect(await screen.findByText(/manjkata osebi/i)).toBeInTheDocument()
  })

  test('prikaže podatke in primerjavo', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        oseba_a: {
          id: 1,
          ime: 'Janez',
          priimek: 'Novak',
          stevilo_povezav: 5,
          institucija: 'ABC d.o.o.',
          fotografija_url: ''
        },
        oseba_b: {
          id: 2,
          ime: 'Marija',
          priimek: 'Kovač',
          stevilo_povezav: 3,
          institucija: 'XYZ d.o.o.',
          fotografija_url: ''
        },
        skupna_podjetja: [
          {
            id: 10,
            popolno_ime: 'Podjetje A',
            pravna_oblika: 'd.o.o.',
            vloga_a: 'Direktor',
            vloga_b: 'Član',
            od_a: '2020-01-01',
            do_a: null,
            od_b: '2019-01-01',
            do_b: '2021-01-01'
          }
        ]
      })
    })

    renderWithParams('/primerjava?a=1&b=2')

    await waitFor(() => {
      expect(screen.getAllByText(/Janez Novak/i)).toHaveLength(2)
      expect(screen.getAllByText(/Marija Kovač/i)).toHaveLength(2)
      expect(screen.getByText('Skupna podjetja (1)')).toBeInTheDocument()
    })

    expect(screen.getByText(/Podjetje A/i)).toBeInTheDocument()
    expect(screen.getAllByText(/d\.o\.o\./i).length).toBeGreaterThanOrEqual(1)
  })

  test('prikaže empty state, če ni skupnih podjetij', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        oseba_a: {
          id: 1,
          ime: 'Janez',
          priimek: 'Novak',
          stevilo_povezav: 1
        },
        oseba_b: {
          id: 2,
          ime: 'Marija',
          priimek: 'Kovač',
          stevilo_povezav: 1
        },
        skupna_podjetja: []
      })
    })

    renderWithParams('/primerjava?a=1&b=2')

    expect(
      await screen.findByText(/nimata skupnih podjetij/i)
    ).toBeInTheDocument()
  })

})