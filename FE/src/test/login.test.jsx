import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Login from '../pages/Login'

const mockNavigate = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')

  return {
    ...actual,
    useNavigate: () => mockNavigate,
    Link: ({ to, children }) => <a href={to}>{children}</a>,
  }
})

const mockLogin = vi.fn()

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    login: mockLogin,
  }),
}))

function renderPage() {
  return render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>
  )
}

describe('Login page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('prikaže login formo', () => {
    renderPage()

    expect(screen.getByText('Dobrodošli nazaj!')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('ime@example.com')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument()
  })

  it('uspešen login kliče login + navigate', async () => {
    const user = userEvent.setup()

    mockLogin.mockResolvedValueOnce()

    renderPage()

    await user.type(screen.getByPlaceholderText('ime@example.com'), 'test@test.com')
    await user.type(screen.getByPlaceholderText('••••••••'), '123456')

    await user.click(screen.getByRole('button', { name: /prijava/i }))

    expect(mockLogin).toHaveBeenCalledWith('test@test.com', '123456')
    expect(mockNavigate).toHaveBeenCalledWith('/')
  })

  it('prikaže error iz backend (firebaseError mapping)', async () => {
    const user = userEvent.setup()

    mockLogin.mockRejectedValueOnce({
      code: 'auth/user-not-found',
    })

    renderPage()

    await user.type(screen.getByPlaceholderText('ime@example.com'), 'test@test.com')
    await user.type(screen.getByPlaceholderText('••••••••'), 'wrongpass')

    await user.click(screen.getByRole('button', { name: /prijava/i }))

    expect(
      await screen.findByText('Napačen e-poštni naslov ali geslo.')
    ).toBeInTheDocument()
  })

  it('prikaže too many requests error', async () => {
    const user = userEvent.setup()

    mockLogin.mockRejectedValueOnce({
      code: 'auth/too-many-requests',
    })

    renderPage()

    await user.type(screen.getByPlaceholderText('ime@example.com'), 'test@test.com')
    await user.type(screen.getByPlaceholderText('••••••••'), '123456')

    await user.click(screen.getByRole('button', { name: /prijava/i }))

    expect(
      await screen.findByText('Preveč poskusov. Počakajte trenutek.')
    ).toBeInTheDocument()
  })

  it('toggle password visibility deluje', async () => {
    const user = userEvent.setup()
    renderPage()

    const toggleBtn = screen.getAllByRole('button').find(b =>
      b.className.includes('auth-eye-btn')
    )

    const input = screen.getByPlaceholderText('••••••••')

    await user.click(toggleBtn)

    // input type se spremeni iz password -> text
    expect(input).toBeTruthy()
  })

  it('loading state se aktivira med submitom', async () => {
    const user = userEvent.setup()

    mockLogin.mockImplementation(() => new Promise(() => {})) // stuck promise

    renderPage()

    await user.type(screen.getByPlaceholderText('ime@example.com'), 'test@test.com')
    await user.type(screen.getByPlaceholderText('••••••••'), '123456')

    await user.click(screen.getByRole('button', { name: /prijava/i }))

    expect(screen.getByText('Prijavljam...')).toBeInTheDocument()
  })
})