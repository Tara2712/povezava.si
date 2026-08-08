import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Login from '../pages/Login'

const mockNavigate = vi.fn()
const mockLogin = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')

  return {
    ...actual,
    useNavigate: () => mockNavigate,
    Link: ({ to, children }) => (
      <a href={to}>{children}</a>
    ),
  }
})

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    login: mockLogin,
    loginWithGoogle: vi.fn(),
  }),
}))

function renderPage() {
  return render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>
  )
}

function getLoginButton() {
  return screen.getByRole('button', {
    name: /^Prijava$/i,
  })
}

function getPasswordToggle() {
  return document.querySelector('.auth-eye-btn')
}

describe('Login page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('prikaže login formo', () => {
    renderPage()

    expect(
      screen.getByText('Dobrodošli nazaj!')
    ).toBeInTheDocument()

    expect(
      screen.getByPlaceholderText('ime@example.com')
    ).toBeInTheDocument()

    expect(
      screen.getByPlaceholderText('••••••••')
    ).toBeInTheDocument()
  })

  it('prikaže povezavo Registracija', () => {
    renderPage()

    expect(
      screen.getByRole('link', {
        name: 'Registracija',
      })
    ).toBeInTheDocument()
  })

  it('povezava Registracija vodi na /register', () => {
    renderPage()

    const registerLink = screen.getByRole('link', {
      name: 'Registracija',
    })

    expect(registerLink).toHaveAttribute(
      'href',
      '/register'
    )
  })

  it('ima polji e-pošta in geslo required atribut', () => {
    renderPage()

    expect(
      screen.getByPlaceholderText('ime@example.com')
    ).toBeRequired()

    expect(
      screen.getByPlaceholderText('••••••••')
    ).toBeRequired()
  })

  it('ima polje za e-pošto tip email', () => {
    renderPage()

    expect(
      screen.getByPlaceholderText('ime@example.com')
    ).toHaveAttribute('type', 'email')
  })

  it('ima polje za geslo privzeto tip password', () => {
    renderPage()

    expect(
      screen.getByPlaceholderText('••••••••')
    ).toHaveAttribute('type', 'password')
  })

  it('toggle password visibility spremeni password -> text -> password', async () => {
    const user = userEvent.setup()

    renderPage()

    const input = screen.getByPlaceholderText('••••••••')
    const toggleBtn = getPasswordToggle()

    expect(input).toHaveAttribute('type', 'password')

    await user.click(toggleBtn)

    expect(input).toHaveAttribute('type', 'text')

    await user.click(toggleBtn)

    expect(input).toHaveAttribute('type', 'password')
  })

  it('ima e-pošta polje ob odprtju strani fokus', () => {
    renderPage()

    expect(
      screen.getByPlaceholderText('ime@example.com')
    ).toHaveFocus()
  })

  it('ima pravilna autoComplete atributa', () => {
    renderPage()

    expect(
      screen.getByPlaceholderText('ime@example.com')
    ).toHaveAttribute('autocomplete', 'email')

    expect(
      screen.getByPlaceholderText('••••••••')
    ).toHaveAttribute(
      'autocomplete',
      'current-password'
    )
  })

  it('gumb za prikaz gesla je tipa button', () => {
    renderPage()

    const toggleBtn = getPasswordToggle()

    expect(toggleBtn).toHaveAttribute(
      'type',
      'button'
    )
  })

  it('klik na gumb za prikaz gesla ne sproži prijave', async () => {
    const user = userEvent.setup()

    renderPage()

    const toggleBtn = getPasswordToggle()

    await user.click(toggleBtn)

    expect(mockLogin).not.toHaveBeenCalled()
  })

  it('uspešen login kliče login z e-pošto in geslom ter navigate', async () => {
    const user = userEvent.setup()

    mockLogin.mockResolvedValueOnce()

    renderPage()

    await user.type(
      screen.getByPlaceholderText('ime@example.com'),
      'test@test.com'
    )

    await user.type(
      screen.getByPlaceholderText('••••••••'),
      '123456'
    )

    await user.click(getLoginButton())

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith(
        'test@test.com',
        '123456'
      )

      expect(mockNavigate).toHaveBeenCalledWith('/')
    })
  })

  it('login se ob oddaji obrazca pokliče samo enkrat', async () => {
    const user = userEvent.setup()

    mockLogin.mockResolvedValueOnce()

    renderPage()

    await user.type(
      screen.getByPlaceholderText('ime@example.com'),
      'test@test.com'
    )

    await user.type(
      screen.getByPlaceholderText('••••••••'),
      '123456'
    )

    await user.click(getLoginButton())

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledTimes(1)
    })
  })

  it('login prejme pravilne različne vrednosti e-pošte in gesla', async () => {
    const user = userEvent.setup()

    mockLogin.mockResolvedValueOnce()

    renderPage()

    await user.type(
      screen.getByPlaceholderText('ime@example.com'),
      'drugi@example.com'
    )

    await user.type(
      screen.getByPlaceholderText('••••••••'),
      'MojeGeslo123!'
    )

    await user.click(getLoginButton())

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith(
        'drugi@example.com',
        'MojeGeslo123!'
      )
    })
  })

  it('med oddajo prikaže Prijavljam... in onemogoči gumb', async () => {
    const user = userEvent.setup()

    mockLogin.mockImplementation(
      () => new Promise(() => {})
    )

    renderPage()

    await user.type(
      screen.getByPlaceholderText('ime@example.com'),
      'test@test.com'
    )

    await user.type(
      screen.getByPlaceholderText('••••••••'),
      '123456'
    )

    await user.click(getLoginButton())

    const loadingButton = screen.getByRole('button', {
      name: /^Prijavljam\.\.\.$/i,
    })

    expect(
      screen.getByText('Prijavljam...')
    ).toBeInTheDocument()

    expect(loadingButton).toBeDisabled()
  })

  it('po uspešni prijavi loading stanje odstrani', async () => {
    const user = userEvent.setup()

    mockLogin.mockResolvedValueOnce()

    renderPage()

    await user.type(
      screen.getByPlaceholderText('ime@example.com'),
      'test@test.com'
    )

    await user.type(
      screen.getByPlaceholderText('••••••••'),
      '123456'
    )

    await user.click(getLoginButton())

    await waitFor(() => {
      expect(
        screen.queryByText('Prijavljam...')
      ).not.toBeInTheDocument()
    })

    expect(getLoginButton()).not.toBeDisabled()
  })

  it('po neuspešni prijavi loading stanje odstrani', async () => {
    const user = userEvent.setup()

    mockLogin.mockRejectedValueOnce({
      code: 'auth/user-not-found',
    })

    renderPage()

    await user.type(
      screen.getByPlaceholderText('ime@example.com'),
      'test@test.com'
    )

    await user.type(
      screen.getByPlaceholderText('••••••••'),
      'wrongpass'
    )

    await user.click(getLoginButton())

    await waitFor(() => {
      expect(
        screen.queryByText('Prijavljam...')
      ).not.toBeInTheDocument()
    })

    expect(getLoginButton()).not.toBeDisabled()
  })

  it('po neuspešni prijavi ne izvede navigacije', async () => {
    const user = userEvent.setup()

    mockLogin.mockRejectedValueOnce({
      code: 'auth/user-not-found',
    })

    renderPage()

    await user.type(
      screen.getByPlaceholderText('ime@example.com'),
      'test@test.com'
    )

    await user.type(
      screen.getByPlaceholderText('••••••••'),
      'wrongpass'
    )

    await user.click(getLoginButton())

    await waitFor(() => {
      expect(
        screen.getByText(
          'Napačen e-poštni naslov ali geslo.'
        )
      ).toBeInTheDocument()
    })

    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('prikaže napako auth/invalid-email', async () => {
    const user = userEvent.setup()

    mockLogin.mockRejectedValueOnce({
      code: 'auth/invalid-email',
    })

    renderPage()

    // Uporabimo veljaven email, da HTML validacija
    // dovoli oddajo obrazca in dosežemo mockLogin.
    await user.type(
      screen.getByPlaceholderText('ime@example.com'),
      'test@test.com'
    )

    await user.type(
      screen.getByPlaceholderText('••••••••'),
      '123456'
    )

    await user.click(getLoginButton())

    expect(
      await screen.findByText(
        'Neveljaven e-poštni naslov.'
      )
    ).toBeInTheDocument()
  })

  it('prikaže napako auth/invalid-credential', async () => {
    const user = userEvent.setup()

    mockLogin.mockRejectedValueOnce({
      code: 'auth/invalid-credential',
    })

    renderPage()

    await user.type(
      screen.getByPlaceholderText('ime@example.com'),
      'test@test.com'
    )

    await user.type(
      screen.getByPlaceholderText('••••••••'),
      'wrongpass'
    )

    await user.click(getLoginButton())

    expect(
      await screen.findByText(
        'Napačen e-poštni naslov ali geslo.'
      )
    ).toBeInTheDocument()
  })

  it('prikaže napako auth/wrong-password', async () => {
    const user = userEvent.setup()

    mockLogin.mockRejectedValueOnce({
      code: 'auth/wrong-password',
    })

    renderPage()

    await user.type(
      screen.getByPlaceholderText('ime@example.com'),
      'test@test.com'
    )

    await user.type(
      screen.getByPlaceholderText('••••••••'),
      'wrongpass'
    )

    await user.click(getLoginButton())

    expect(
      await screen.findByText(
        'Napačen e-poštni naslov ali geslo.'
      )
    ).toBeInTheDocument()
  })

  it('prikaže privzeto sporočilo za neznano Firebase napako', async () => {
    const user = userEvent.setup()

    mockLogin.mockRejectedValueOnce({
      code: 'auth/unknown-error',
    })

    renderPage()

    await user.type(
      screen.getByPlaceholderText('ime@example.com'),
      'test@test.com'
    )

    await user.type(
      screen.getByPlaceholderText('••••••••'),
      '123456'
    )

    await user.click(getLoginButton())

    expect(
      await screen.findByText(
        'Napaka pri prijavi. Poskusite znova.'
      )
    ).toBeInTheDocument()
  })

  it('pred novo prijavo počisti prejšnje sporočilo o napaki', async () => {
    const user = userEvent.setup()

    mockLogin
      .mockRejectedValueOnce({
        code: 'auth/invalid-email',
      })
      .mockResolvedValueOnce()

    renderPage()

    const emailInput = screen.getByPlaceholderText(
      'ime@example.com'
    )

    const passwordInput = screen.getByPlaceholderText(
      '••••••••'
    )

    await user.type(
      emailInput,
      'test@test.com'
    )

    await user.type(
      passwordInput,
      '123456'
    )

    await user.click(getLoginButton())

    expect(
      await screen.findByText(
        'Neveljaven e-poštni naslov.'
      )
    ).toBeInTheDocument()

    // Drugi submit mora na začetku izvesti setError('')
    await user.click(getLoginButton())

    await waitFor(() => {
      expect(
        screen.queryByText(
          'Neveljaven e-poštni naslov.'
        )
      ).not.toBeInTheDocument()
    })

    expect(mockLogin).toHaveBeenCalledTimes(2)
  })

  it('prikaže napako auth/user-not-found', async () => {
    const user = userEvent.setup()

    mockLogin.mockRejectedValueOnce({
      code: 'auth/user-not-found',
    })

    renderPage()

    await user.type(
      screen.getByPlaceholderText('ime@example.com'),
      'test@test.com'
    )

    await user.type(
      screen.getByPlaceholderText('••••••••'),
      'wrongpass'
    )

    await user.click(getLoginButton())

    expect(
      await screen.findByText(
        'Napačen e-poštni naslov ali geslo.'
      )
    ).toBeInTheDocument()
  })

  it('prikaže too many requests error', async () => {
    const user = userEvent.setup()

    mockLogin.mockRejectedValueOnce({
      code: 'auth/too-many-requests',
    })

    renderPage()

    await user.type(
      screen.getByPlaceholderText('ime@example.com'),
      'test@test.com'
    )

    await user.type(
      screen.getByPlaceholderText('••••••••'),
      '123456'
    )

    await user.click(getLoginButton())

    expect(
      await screen.findByText(
        'Preveč poskusov. Počakajte trenutek.'
      )
    ).toBeInTheDocument()
  })
})
