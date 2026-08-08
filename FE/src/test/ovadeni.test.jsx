import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
} from 'vitest'

import {
  render,
  screen,
  fireEvent,
} from '@testing-library/react'

import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Ovadeni from '../pages/Ovadeni'

const mockNavigate = vi.fn()

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: {
      email: 'test@test.com',
      displayName: 'Test',
    },
    logout: vi.fn(),
  }),
}))

vi.mock('../components/Layout', () => ({
  default: ({ children }) => children,
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')

  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.mock('../api', () => ({
  API: 'http://test-api',
}))

const mockData = {
  skupaj: 1,
  ovadeni: [
    {
      id: 1,
      oseba_id: 99,
      ime: 'Janez',
      priimek: 'Novak',
      status: 'obtožen',
      zadeva: 'KZ-123',
      sodisce: 'Okrožno sodišče',
      datum: '2024-01-01',
      vir: 'URS',
      vir_url: 'https://example.com',
    },
  ],
}

beforeEach(() => {
  vi.clearAllMocks()

  global.fetch = vi.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve(mockData),
    })
  )
})

afterEach(() => {
  vi.useRealTimers()
})

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/ovadeni']}>
      <Ovadeni />
    </MemoryRouter>
  )
}

describe('Ovadeni page', () => {
  it('prikaže loading state', () => {
    global.fetch = vi.fn(
      () => new Promise(() => {})
    )

    renderPage()

    expect(
      screen.getByText(/nalagam/i)
    ).toBeInTheDocument()
  })

  it('prikaže podatke iz API', async () => {
    renderPage()

    expect(
      await screen.findByText('Janez Novak')
    ).toBeInTheDocument()

    expect(
      screen.getByText('KZ-123')
    ).toBeInTheDocument()

    expect(
      screen.getByText('Okrožno sodišče')
    ).toBeInTheDocument()
  })

  it('prikaže count (skupaj)', async () => {
    renderPage()

    await screen.findByText('Janez Novak')

    expect(
      screen.getByText(/1 oseb v bazi/i)
    ).toBeInTheDocument()
  })

  it('klik na kartico navigira na profil', async () => {
    const user = userEvent.setup()

    renderPage()

    const name = await screen.findByText('Janez Novak')
    const card = name.closest('button')

    await user.click(card)

    expect(mockNavigate).toHaveBeenCalledWith(
      '/oseba/99'
    )
  })

  it('prikaže iskalno polje', async () => {
    renderPage()

    const input =
      await screen.findByPlaceholderText(
        'Išči po imenu, zadevi, viru...'
      )

    expect(input).toBeInTheDocument()
  })

  it('omogoča vnos iskalnega niza', async () => {
    const user = userEvent.setup()

    renderPage()

    const input =
      await screen.findByPlaceholderText(
        'Išči po imenu, zadevi, viru...'
      )

    await user.type(input, 'Janez')

    expect(input).toHaveValue('Janez')
  })

  it('uporablja autoFocus na iskalnem polju', async () => {
    renderPage()

    const input =
      await screen.findByPlaceholderText(
        'Išči po imenu, zadevi, viru...'
      )

    expect(input).toHaveFocus()
  })

  it('uporablja pravilen osnovni URL pri fetch klicu', async () => {
    renderPage()

    await screen.findByText('Janez Novak')

    expect(global.fetch).toHaveBeenCalledWith(
      'http://test-api/ovadeni?limit=200'
    )
  })

  it('prikaže vse statuse', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            skupaj: 4,
            ovadeni: [
              {
                id: 1,
                oseba_id: 1,
                ime: 'Oseba',
                priimek: 'Obtozena',
                status: 'obtožen',
              },
              {
                id: 2,
                oseba_id: 2,
                ime: 'Oseba',
                priimek: 'Obsojena',
                status: 'obsojen',
              },
              {
                id: 3,
                oseba_id: 3,
                ime: 'Oseba',
                priimek: 'Oproscena',
                status: 'oproščen',
              },
              {
                id: 4,
                oseba_id: 4,
                ime: 'Oseba',
                priimek: 'Postopek',
                status: 'v postopku',
              },
            ],
          }),
      })
    )

    renderPage()

    expect(
      await screen.findByText('obtožen')
    ).toBeInTheDocument()

    expect(
      screen.getByText('obsojen')
    ).toBeInTheDocument()

    expect(
      screen.getByText('oproščen')
    ).toBeInTheDocument()

    expect(
      screen.getByText('v postopku')
    ).toBeInTheDocument()
  })

  it('prikaže privzeti stil za neznan status', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            skupaj: 1,
            ovadeni: [
              {
                id: 1,
                oseba_id: 99,
                ime: 'Janez',
                priimek: 'Novak',
                status: 'neznan status',
              },
            ],
          }),
      })
    )

    renderPage()

    const badge =
      await screen.findByText('neznan status')

    expect(badge).toBeInTheDocument()

    expect(badge).toHaveStyle({
      background: '#f3f4f6',
      color: '#374151',
      border: '1px solid #d1d5db',
    })
  })

  it('prikaže in formatira datum', async () => {
    renderPage()

    await screen.findByText('Janez Novak')

    expect(
      screen.getByText(
        new Date('2024-01-01').toLocaleDateString('sl-SI')
      )
    ).toBeInTheDocument()
  })

  it('prikaže vir', async () => {
    renderPage()

    await screen.findByText('Janez Novak')

    expect(
      screen.getByText('URS')
    ).toBeInTheDocument()
  })

  it('prikaže povezavo vira s pravilnim href', async () => {
    renderPage()

    await screen.findByText('Janez Novak')

    const link =
      screen.getByRole('link', {
        name: /Vir/i,
      })

    expect(link).toHaveAttribute(
      'href',
      'https://example.com'
    )
  })

  it('klik na vir ne sproži navigacije na profil', async () => {
    const user = userEvent.setup()

    renderPage()

    await screen.findByText('Janez Novak')

    const link =
      screen.getByRole('link', {
        name: /Vir/i,
      })

    await user.click(link)

    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('oseba brez oseba_id ne navigira na profil', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            skupaj: 1,
            ovadeni: [
              {
                id: 1,
                oseba_id: null,
                ime: 'Janez',
                priimek: 'Novak',
                status: 'obtožen',
              },
            ],
          }),
      })
    )

    const user = userEvent.setup()

    renderPage()

    const name =
      await screen.findByText('Janez Novak')

    const card = name.closest('button')

    await user.click(card)

    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('ne pade pri manjkajoči zadevi, sodišču ali viru', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            skupaj: 1,
            ovadeni: [
              {
                id: 1,
                oseba_id: 99,
                ime: 'Janez',
                priimek: 'Novak',
                status: 'obtožen',
                datum: '2024-01-01',
              },
            ],
          }),
      })
    )

    renderPage()

    expect(
      await screen.findByText('Janez Novak')
    ).toBeInTheDocument()

    expect(
      screen.queryByText('KZ-123')
    ).not.toBeInTheDocument()

    expect(
      screen.queryByText('Okrožno sodišče')
    ).not.toBeInTheDocument()

    expect(
      screen.queryByText('URS')
    ).not.toBeInTheDocument()
  })

  it('prikaže več rezultatov v seznamu', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            skupaj: 3,
            ovadeni: [
              {
                id: 1,
                oseba_id: 1,
                ime: 'Janez',
                priimek: 'Novak',
                status: 'obtožen',
              },
              {
                id: 2,
                oseba_id: 2,
                ime: 'Ana',
                priimek: 'Zupan',
                status: 'obsojen',
              },
              {
                id: 3,
                oseba_id: 3,
                ime: 'Marko',
                priimek: 'Kovač',
                status: 'oproščen',
              },
            ],
          }),
      })
    )

    renderPage()

    expect(
      await screen.findByText('Janez Novak')
    ).toBeInTheDocument()

    expect(
      screen.getByText('Ana Zupan')
    ).toBeInTheDocument()

    expect(
      screen.getByText('Marko Kovač')
    ).toBeInTheDocument()
  })

  it('ob napaki API-ja prikaže prazno stanje', async () => {
    global.fetch = vi.fn(() =>
      Promise.reject(new Error('Network error'))
    )

    renderPage()

    expect(
      await screen.findByText(
        'V bazi še ni vnosov.'
      )
    ).toBeInTheDocument()
  })

  it('status badge ohrani pravilno besedilo', async () => {
    renderPage()

    const badge =
      await screen.findByText('obtožen')

    expect(badge).toHaveClass(
      'register-badge'
    )
  })

  it('prikaže vir in povezavo tudi skupaj', async () => {
    renderPage()

    await screen.findByText('Janez Novak')

    expect(
      screen.getByText('URS')
    ).toBeInTheDocument()

    expect(
      screen.getByRole('link', {
        name: /Vir/i,
      })
    ).toHaveAttribute(
      'href',
      'https://example.com'
    )
  })
})