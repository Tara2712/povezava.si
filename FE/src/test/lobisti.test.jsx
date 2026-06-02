import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
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

vi.mock('../components/Layout', () => ({
  default: ({ children }) => <div>{children}</div>,
}))

vi.mock('../components/Avatar', () => ({
  default: ({ name }) => <div data-testid="avatar" />,
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

  it('prikaže podatke iz API', async () => {
    renderPage()

    expect(await screen.findByText('Janez Novak')).toBeInTheDocument()
    expect(screen.getByText('Firma d.o.o.')).toBeInTheDocument()
    expect(screen.getByText(/Naročnik: Država/i)).toBeInTheDocument()
  })

  it('prikaže count badge', async () => {
    renderPage()

    expect(await screen.findByText(/2 lobist/i)).toBeInTheDocument()
  })

  it('klik na lobista navigira na profil', async () => {
    const user = userEvent.setup()
    renderPage()

    const card = await screen.findByText('Janez Novak', { selector: '.register-card-name' })
    await user.click(card.closest('button'))

    expect(mockNavigate).toHaveBeenCalledWith('/oseba/10')
  })

  it('empty state brez podatkov', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        json: () => Promise.resolve({ skupaj: 0, lobisti: [] }),
      })
    )

    renderPage()

    expect(await screen.findByText(/ni lobistov/i)).toBeInTheDocument()
  })

  it('aktiven status se prikaže', async () => {
    renderPage()

    expect(await screen.findByText('Aktiven')).toBeInTheDocument()
  })
})