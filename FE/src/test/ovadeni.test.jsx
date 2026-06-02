import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Ovadeni from '../pages/Ovadeni'

const mockNavigate = vi.fn()

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { email: 'test@test.com', displayName: 'Test' },
    logout: vi.fn(),
  }),
}))

vi.mock('../components/Layout', () => ({
  default: ({ children }) => <div>{children}</div>,
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
      json: () => Promise.resolve(mockData),
    })
  )
})

afterEach(() => {
  vi.useRealTimers()
})

function renderPage() {
  return render(
    <MemoryRouter>
      <Ovadeni />
    </MemoryRouter>
  )
}

describe('Ovadeni page', () => {
  it('prikaže loading state', () => {
    renderPage()
    expect(screen.getByText(/nalagam/i)).toBeInTheDocument()
  })

  it('prikaže podatke iz API', async () => {
    renderPage()

    expect(await screen.findByText('Janez Novak')).toBeInTheDocument()
    expect(screen.getByText('KZ-123')).toBeInTheDocument()
    expect(screen.getByText('Okrožno sodišče')).toBeInTheDocument()
  })

  it('prikaže count (skupaj)', async () => {
    renderPage()

    await screen.findByText('Janez Novak')

    expect(screen.getByText(/1 oseb v bazi/i)).toBeInTheDocument()
  })

  it('klik na kartico navigira na profil', async () => {
    const user = userEvent.setup()
    renderPage()

    const card = await screen.findByText('Janez Novak')
    await user.click(card.closest('button'))

    expect(mockNavigate).toHaveBeenCalledWith('/oseba/99')
  })

  it('empty state brez rezultatov', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        json: () => Promise.resolve({ skupaj: 0, ovadeni: [] }),
      })
    )

    renderPage()

    expect(await screen.findByText(/v bazi še ni vnosov/i)).toBeInTheDocument()
  })

  it('fetch fallback na error vrne prazno stanje', async () => {
    global.fetch = vi.fn(() => Promise.reject('error'))

    renderPage()

    expect(await screen.findByText(/v bazi še ni vnosov/i)).toBeInTheDocument()
  })

  it('status badge se prikaže', async () => {
    renderPage()

    const badge = await screen.findByText('obtožen')
    expect(badge).toBeInTheDocument()
  })
})