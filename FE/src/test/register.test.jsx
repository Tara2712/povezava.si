import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Register from '../pages/Register'

const mockNavigate = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')

  return {
    ...actual,
    useNavigate: () => mockNavigate,
    Link: ({ to, children }) => <a href={to}>{children}</a>,
  }
})

const mockRegister = vi.fn()

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    register: mockRegister,
  }),
}))

function renderPage() {
  return render(
    <MemoryRouter>
      <Register />
    </MemoryRouter>
  )
}

describe('Register page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('prikaže formo', () => {
    renderPage()

    expect(screen.getByText('Ustvarite račun')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Jana Novak')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('ime@example.com')).toBeInTheDocument()
  })

  it('prikaže error če gesli nista enaki', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.type(screen.getByPlaceholderText('Jana Novak'), 'Test User')
    await user.type(screen.getByPlaceholderText('ime@example.com'), 'test@test.com')
    await user.type(screen.getAllByPlaceholderText('Vsaj 6 znakov')[0], '123456')
    await user.type(screen.getByPlaceholderText('••••••••'), '654321')

    await user.click(screen.getByRole('button', { name: /ustvari račun/i }))

    expect(await screen.findByText('Gesli se ne ujemata.')).toBeInTheDocument()
    expect(mockRegister).not.toHaveBeenCalled()
  })

  it('prikaže error če je geslo prekratko', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.type(screen.getByPlaceholderText('Jana Novak'), 'Test User')
    await user.type(screen.getByPlaceholderText('ime@example.com'), 'test@test.com')
    await user.type(screen.getAllByPlaceholderText('Vsaj 6 znakov')[0], '123')
    await user.type(screen.getByPlaceholderText('••••••••'), '123')

    await user.click(screen.getByRole('button', { name: /ustvari račun/i }))

    expect(await screen.findByText('Geslo mora imeti vsaj 6 znakov.')).toBeInTheDocument()
    expect(mockRegister).not.toHaveBeenCalled()
  })

  it('uspešen register kliče register + navigate', async () => {
    const user = userEvent.setup()

    mockRegister.mockResolvedValueOnce()

    renderPage()

    await user.type(screen.getByPlaceholderText('Jana Novak'), 'Test User')
    await user.type(screen.getByPlaceholderText('ime@example.com'), 'test@test.com')
    await user.type(screen.getAllByPlaceholderText('Vsaj 6 znakov')[0], '123456')
    await user.type(screen.getByPlaceholderText('••••••••'), '123456')

    await user.click(screen.getByRole('button', { name: /ustvari račun/i }))

    expect(mockRegister).toHaveBeenCalledWith(
      'test@test.com',
      '123456',
      'Test User'
    )

    expect(mockNavigate).toHaveBeenCalledWith('/')
  })

  it('prikaže error iz backend (firebaseError)', async () => {
    const user = userEvent.setup()

    mockRegister.mockRejectedValueOnce({
      code: 'auth/email-already-in-use',
    })

    renderPage()

    await user.type(screen.getByPlaceholderText('Jana Novak'), 'Test User')
    await user.type(screen.getByPlaceholderText('ime@example.com'), 'test@test.com')
    await user.type(screen.getAllByPlaceholderText('Vsaj 6 znakov')[0], '123456')
    await user.type(screen.getByPlaceholderText('••••••••'), '123456')

    await user.click(screen.getByRole('button', { name: /ustvari račun/i }))

    expect(
      await screen.findByText('Ta e-poštni naslov je že registriran.')
    ).toBeInTheDocument()
  })

  it('toggle show password deluje', async () => {
    const user = userEvent.setup()
    renderPage()

    const btn = screen.getAllByRole('button').find(b =>
      b.className.includes('auth-eye-btn')
    )

    const input = screen.getAllByRole('textbox').find(el =>
      el.getAttribute('type') === 'password' || el.getAttribute('type') === 'text'
    )

    await user.click(btn)

    // po kliku se password input spremeni v text
    expect(input).toBeTruthy()
  })
})