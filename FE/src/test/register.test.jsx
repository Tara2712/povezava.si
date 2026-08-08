import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Register from '../pages/Register'

const mockNavigate = vi.fn()
const mockRegister = vi.fn()
const mockLoginWithGoogle = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')

  return {
    ...actual,
    useNavigate: () => mockNavigate
  }
})

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    register: mockRegister,
    loginWithGoogle: mockLoginWithGoogle
  })
}))

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/register']}>
      <Register />
    </MemoryRouter>
  )
}

async function fillValidForm(
  user,
  {
    name = 'Test User',
    email = 'test@test.com',
    password = '123456',
    confirm = '123456'
  } = {}
) {
  await user.type(
    screen.getByPlaceholderText('Jana Novak'),
    name
  )

  await user.type(
    screen.getByPlaceholderText('ime@example.com'),
    email
  )

  await user.type(
    screen.getAllByPlaceholderText('Vsaj 6 znakov')[0],
    password
  )

  await user.type(
    screen.getByPlaceholderText('••••••••'),
    confirm
  )
}

describe('Register page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })


  it('prikaže začetno stran registracije', () => {
    renderPage()

    expect(
      screen.getByText('Ustvarite račun')
    ).toBeInTheDocument()

    expect(
      screen.getByText('Brezplačna registracija')
    ).toBeInTheDocument()

    expect(
      screen.getByText('Pridružite se omrežju')
    ).toBeInTheDocument()

    expect(
      screen.getByText(/Ustvarite račun in pridobite dostop/i)
    ).toBeInTheDocument()
  })

  it('prikaže levi panel', () => {
    renderPage()

    expect(
      screen.getByAltText('Povezave.si')
    ).toBeInTheDocument()

    expect(
      screen.getByText('Pridružite se omrežju')
    ).toBeInTheDocument()

    expect(
      screen.getByText(/slovenskega poslovnega omrežja/i)
    ).toBeInTheDocument()
  })

  it('prikaže vse statistike na levem panelu', () => {
    renderPage()

    expect(screen.getByText('134k+')).toBeInTheDocument()
    expect(screen.getByText('200k+')).toBeInTheDocument()
    expect(screen.getByText('500k+')).toBeInTheDocument()

    expect(screen.getByText('oseb')).toBeInTheDocument()
    expect(screen.getByText('podjetij')).toBeInTheDocument()
    expect(screen.getByText('povezav')).toBeInTheDocument()
  })

  it('prikaže vsa polja obrazca', () => {
    renderPage()

    expect(
      screen.getByPlaceholderText('Jana Novak')
    ).toBeInTheDocument()

    expect(
      screen.getByPlaceholderText('ime@example.com')
    ).toBeInTheDocument()

    expect(
      screen.getAllByPlaceholderText('Vsaj 6 znakov')
    ).toHaveLength(1)

    expect(
      screen.getByPlaceholderText('••••••••')
    ).toBeInTheDocument()

    expect(
      screen.getByRole('button', {
        name: 'Ustvari račun'
      })
    ).toBeInTheDocument()
  })


  it('ima vsa polja registracijskega obrazca required', () => {
    renderPage()

    const nameInput =
      screen.getByPlaceholderText('Jana Novak')

    const emailInput =
      screen.getByPlaceholderText('ime@example.com')

    const passwordInput =
      screen.getByPlaceholderText('Vsaj 6 znakov')

    const confirmInput =
      screen.getByPlaceholderText('••••••••')

    expect(nameInput).toBeRequired()
    expect(emailInput).toBeRequired()
    expect(passwordInput).toBeRequired()
    expect(confirmInput).toBeRequired()
  })

  it('obrazca ni mogoče poslati brez podatkov', async () => {
    const user = userEvent.setup()

    renderPage()

    const form = screen.getByRole('button', {
      name: 'Ustvari račun'
    }).closest('form')

    expect(form).toBeInTheDocument()
    expect(form).not.toBeNull()
    expect(form.checkValidity()).toBe(false)

    await user.click(
      screen.getByRole('button', {
        name: 'Ustvari račun'
      })
    )

    expect(mockRegister).not.toHaveBeenCalled()
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('ne pokliče register, če manjkajo obvezni podatki', async () => {
    const user = userEvent.setup()

    renderPage()

    await user.type(
      screen.getByPlaceholderText('Jana Novak'),
      'Test User'
    )

    await user.click(
      screen.getByRole('button', {
        name: 'Ustvari račun'
      })
    )

    expect(mockRegister).not.toHaveBeenCalled()
  })

  it('email polje ima type="email"', () => {
    renderPage()

    expect(
      screen.getByPlaceholderText('ime@example.com')
    ).toHaveAttribute('type', 'email')
  })

  it('neveljaven email obrazec označi kot neveljaven', () => {
    renderPage()

    const emailInput =
      screen.getByPlaceholderText('ime@example.com')

    expect(emailInput).toHaveAttribute(
      'type',
      'email'
    )

    expect(emailInput.validity.valid).toBe(false)
  })

  it('registracija se ne izvede pri neveljavnem emailu', async () => {
    const user = userEvent.setup()

    renderPage()

    await fillValidForm(user, {
      email: 'napacen-email'
    })

    const form = screen
      .getByRole('button', {
        name: 'Ustvari račun'
      })
      .closest('form')

    expect(form.checkValidity()).toBe(false)

    await user.click(
      screen.getByRole('button', {
        name: 'Ustvari račun'
      })
    )

    expect(mockRegister).not.toHaveBeenCalled()
    expect(mockNavigate).not.toHaveBeenCalled()
  })


  it('prikaže error, če gesli nista enaki', async () => {
    const user = userEvent.setup()

    renderPage()

    await fillValidForm(user, {
      password: '123456',
      confirm: '654321'
    })

    await user.click(
      screen.getByRole('button', {
        name: /ustvari račun/i
      })
    )

    expect(
      await screen.findByText(
        'Gesli se ne ujemata.'
      )
    ).toBeInTheDocument()

    expect(mockRegister).not.toHaveBeenCalled()
  })

  it('ne pokliče register, če gesli nista enaki', async () => {
    const user = userEvent.setup()

    renderPage()

    await fillValidForm(user, {
      password: '123456',
      confirm: '654321'
    })

    await user.click(
      screen.getByRole('button', {
        name: /ustvari račun/i
      })
    )

    expect(mockRegister).not.toHaveBeenCalled()
  })

  it('prikaže error, če je geslo krajše od 6 znakov', async () => {
    const user = userEvent.setup()

    renderPage()

    await fillValidForm(user, {
      password: '123',
      confirm: '123'
    })

    await user.click(
      screen.getByRole('button', {
        name: /ustvari račun/i
      })
    )

    expect(
      await screen.findByText(
        'Geslo mora imeti vsaj 6 znakov.'
      )
    ).toBeInTheDocument()

    expect(mockRegister).not.toHaveBeenCalled()
  })

  it('ne pokliče register, če je geslo krajše od 6 znakov', async () => {
    const user = userEvent.setup()

    renderPage()

    await fillValidForm(user, {
      password: '123',
      confirm: '123'
    })

    await user.click(
      screen.getByRole('button', {
        name: /ustvari račun/i
      })
    )

    expect(mockRegister).not.toHaveBeenCalled()
  })

  it('geslo je privzeto skrito', () => {
    renderPage()

    const passwordInput =
      screen.getByPlaceholderText('Vsaj 6 znakov')

    expect(passwordInput).toHaveAttribute(
      'type',
      'password'
    )
  })

  it('klik na prikaz gesla spremeni password v text', async () => {
    const user = userEvent.setup()

    renderPage()

    const passwordInput =
      screen.getByPlaceholderText('Vsaj 6 znakov')

    const eyeButton = document.querySelector(
      '.auth-eye-btn'
    )

    expect(eyeButton).toBeInTheDocument()

    expect(passwordInput).toHaveAttribute(
      'type',
      'password'
    )

    await user.click(eyeButton)

    expect(passwordInput).toHaveAttribute(
      'type',
      'text'
    )
  })

  it('ponovni klik skrije geslo nazaj v password', async () => {
    const user = userEvent.setup()

    renderPage()

    const passwordInput =
      screen.getByPlaceholderText('Vsaj 6 znakov')

    const eyeButton = document.querySelector(
      '.auth-eye-btn'
    )

    await user.click(eyeButton)

    expect(passwordInput).toHaveAttribute(
      'type',
      'text'
    )

    await user.click(eyeButton)

    expect(passwordInput).toHaveAttribute(
      'type',
      'password'
    )
  })

  it('uspešna registracija pokliče register s pravilnimi vrednostmi in vrstnim redom', async () => {
    const user = userEvent.setup()

    mockRegister.mockResolvedValueOnce()

    renderPage()

    await fillValidForm(user, {
      name: 'Test User',
      email: 'test@test.com',
      password: '123456',
      confirm: '123456'
    })

    await user.click(
      screen.getByRole('button', {
        name: /ustvari račun/i
      })
    )

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledTimes(1)
    })

    expect(mockRegister).toHaveBeenCalledWith(
      'test@test.com',
      '123456',
      'Test User'
    )
  })

  it('po uspešni registraciji preusmeri uporabnika na /', async () => {
    const user = userEvent.setup()

    mockRegister.mockResolvedValueOnce()

    renderPage()

    await fillValidForm(user)

    await user.click(
      screen.getByRole('button', {
        name: /ustvari račun/i
      })
    )

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/')
    })
  })

  it('med registracijo prikaže "Ustvarjam račun..."', async () => {
    const user = userEvent.setup()

    mockRegister.mockImplementation(
      () => new Promise(() => {})
    )

    renderPage()

    await fillValidForm(user)

    await user.click(
      screen.getByRole('button', {
        name: /ustvari račun/i
      })
    )

    expect(
      await screen.findByRole('button', {
        name: 'Ustvarjam račun...'
      })
    ).toBeInTheDocument()
  })

  it('gumb Ustvari račun je onemogočen med registracijo', async () => {
    const user = userEvent.setup()

    mockRegister.mockImplementation(
      () => new Promise(() => {})
    )

    renderPage()

    await fillValidForm(user)

    await user.click(
      screen.getByRole('button', {
        name: /ustvari račun/i
      })
    )

    const button = await screen.findByRole(
      'button',
      {
        name: 'Ustvarjam račun...'
      }
    )

    expect(button).toBeDisabled()
  })

  it('med nalaganjem se registracija ne izvede večkrat', async () => {
    const user = userEvent.setup()

    let resolveRegister

    mockRegister.mockImplementation(
      () =>
        new Promise(resolve => {
          resolveRegister = resolve
        })
    )

    renderPage()

    await fillValidForm(user)

    const button = screen.getByRole('button', {
      name: /ustvari račun/i
    })

    await user.click(button)

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledTimes(1)
    })

    expect(button).toBeDisabled()

    // Drugi klik ni mogoč ker je gumb disabled
    await user.click(button)

    expect(mockRegister).toHaveBeenCalledTimes(1)

    resolveRegister()

    await waitFor(() => {
      expect(button).not.toBeDisabled()
    })
  })

  it('prikaže napako auth/invalid-email', async () => {
    const user = userEvent.setup()

    mockRegister.mockRejectedValueOnce({
      code: 'auth/invalid-email'
    })

    renderPage()

    await fillValidForm(user)

    await user.click(
      screen.getByRole('button', {
        name: /ustvari račun/i
      })
    )

    expect(
      await screen.findByText(
        'Neveljaven e-poštni naslov.'
      )
    ).toBeInTheDocument()

    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('prikaže napako auth/weak-password', async () => {
    const user = userEvent.setup()

    mockRegister.mockRejectedValueOnce({
      code: 'auth/weak-password'
    })

    renderPage()

    await fillValidForm(user)

    await user.click(
      screen.getByRole('button', {
        name: /ustvari račun/i
      })
    )

    expect(
      await screen.findByText(
        'Geslo je prešibko. Uporabite vsaj 6 znakov.'
      )
    ).toBeInTheDocument()

    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('prikaže privzeto Firebase napako za neznano kodo', async () => {
    const user = userEvent.setup()

    mockRegister.mockRejectedValueOnce({
      code: 'auth/some-unknown-error'
    })

    renderPage()

    await fillValidForm(user)

    await user.click(
      screen.getByRole('button', {
        name: /ustvari račun/i
      })
    )

    expect(
      await screen.findByText(
        'Napaka pri registraciji. Poskusite znova.'
      )
    ).toBeInTheDocument()

    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('po neuspešni registraciji uporabnika ne preusmeri', async () => {
    const user = userEvent.setup()

    mockRegister.mockRejectedValueOnce({
      code: 'auth/invalid-email'
    })

    renderPage()

    await fillValidForm(user)

    await user.click(
      screen.getByRole('button', {
        name: /ustvari račun/i
      })
    )

    await screen.findByText(
      'Neveljaven e-poštni naslov.'
    )

    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('po napaki registracije ponovno omogoči gumb', async () => {
    const user = userEvent.setup()

    mockRegister.mockRejectedValueOnce({
      code: 'auth/weak-password'
    })

    renderPage()

    await fillValidForm(user)

    const button = screen.getByRole('button', {
      name: /ustvari račun/i
    })

    await user.click(button)

    await screen.findByText(
      'Geslo je prešibko. Uporabite vsaj 6 znakov.'
    )

    await waitFor(() => {
      expect(button).not.toBeDisabled()
    })

    expect(button).toHaveTextContent(
      'Ustvari račun'
    )
  })

  it('prikaže povezavo Prijava', () => {
    renderPage()

    expect(
      screen.getByRole('link', {
        name: 'Prijava'
      })
    ).toBeInTheDocument()
  })

  it('povezava Prijava vodi na /login', () => {
    renderPage()

    expect(
      screen.getByRole('link', {
        name: 'Prijava'
      })
    ).toHaveAttribute(
      'href',
      '/login'
    )
  })

  it('prikaže error auth/email-already-in-use', async () => {
    const user = userEvent.setup()

    mockRegister.mockRejectedValueOnce({
      code: 'auth/email-already-in-use'
    })

    renderPage()

    await fillValidForm(user)

    await user.click(
      screen.getByRole('button', {
        name: /ustvari račun/i
      })
    )

    expect(
      await screen.findByText(
        'Ta e-poštni naslov je že registriran.'
      )
    ).toBeInTheDocument()
  })
})