import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import MojProfil from '../pages/MojProfil'

const mockNavigate = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')

  return {
    ...actual,
    useNavigate: () => mockNavigate,
    Link: ({ to, children, ...props }) => (
      <a href={to} {...props}>
        {children}
      </a>
    ),
  }
})

const mockLogout = vi.fn()
const mockUpdateProfile = vi.fn()
const mockUpdateEmail = vi.fn()
const mockUpdatePassword = vi.fn()

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: {
      email: 'test@example.com',
      displayName: 'Test User',
      photoURL: null,
    },
    logout: mockLogout,
    updateUserProfile: mockUpdateProfile,
    updateUserEmail: mockUpdateEmail,
    updateUserPassword: mockUpdatePassword,
  }),
}))

const mockToggle = vi.fn()
const mockUnfollow = vi.fn()
const mockClearSearches = vi.fn()
const mockRemoveSearch = vi.fn()

let mockSaved = [
  {
    id: 1,
    ime: 'Janez',
    priimek: 'Novak',
  },
]

let mockRecent = [
  {
    id: 2,
    ime: 'Micka',
    priimek: 'Kovač',
  },
]

let mockHistory = [
  {
    q: 'test query',
    ts: 1,
  },
]

let mockFollowing = [
  {
    personId: 99,
    personName: 'Janez Novak',
    followedAt: Date.now(),
  },
]

vi.mock('../hooks/usePersonStorage', () => ({
  useSavedPersons: () => ({
    saved: mockSaved,
    toggle: mockToggle,
  }),

  useRecentlyViewed: () => ({
    recent: mockRecent,
  }),

  useSearchHistory: () => ({
    history: mockHistory,
    remove: mockRemoveSearch,
    clear: mockClearSearches,
  }),
}))

vi.mock('../hooks/useWatchlist', () => ({
  useWatchlist: () => ({
    following: mockFollowing,
    unfollow: mockUnfollow,
  }),
}))

vi.mock('../components/Layout', () => ({
  default: ({ children }) => <>{children}</>,
}))

vi.mock('../components/Avatar', () => ({
  default: ({ name }) => <div>{name}</div>,
}))

function renderPage() {
  return render(
    <MemoryRouter>
      <MojProfil />
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()

  mockSaved = [
    {
      id: 1,
      ime: 'Janez',
      priimek: 'Novak',
    },
  ]

  mockRecent = [
    {
      id: 2,
      ime: 'Micka',
      priimek: 'Kovač',
    },
  ]

  mockHistory = [
    {
      q: 'test query',
      ts: 1,
    },
  ]

  mockFollowing = [
    {
      personId: 99,
      personName: 'Janez Novak',
      followedAt: Date.now(),
    },
  ]

  mockUpdateProfile.mockResolvedValue(undefined)
  mockUpdateEmail.mockResolvedValue(undefined)
  mockUpdatePassword.mockResolvedValue(undefined)
})


describe('MojProfil page', () => {

  it('prikaže osnovne podatke uporabnika', () => {
    renderPage()

    expect(screen.getByText('Test User')).toBeInTheDocument()
    expect(screen.getByText('test@example.com')).toBeInTheDocument()
  })

  it('logout kliče navigate + logout', async () => {
    const user = userEvent.setup()

    renderPage()

    await user.click(screen.getByText(/odjava/i))

    expect(mockLogout).toHaveBeenCalled()
    expect(mockNavigate).toHaveBeenCalledWith('/login')
  })

  it('odpre edit mode', async () => {
    const user = userEvent.setup()

    renderPage()

    await user.click(screen.getByText(/uredi profil/i))

    expect(
      screen.getByText(/shrani spremembe/i)
    ).toBeInTheDocument()
  })

  it('save profil kliče updateUserProfile', async () => {
    const user = userEvent.setup()

    renderPage()

    await user.click(screen.getByText(/uredi profil/i))
    await user.click(screen.getByText(/shrani spremembe/i))

    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalled()
    })
  })


  it('prikaže napako "Gesli se ne ujemata." če sta gesli različni', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByText(/uredi profil/i))

    const passwordInputs = document.querySelectorAll(
      '.mp-edit-input[type="password"]'
    )

    expect(passwordInputs).toHaveLength(2)

    const passwordInput = passwordInputs[0]
    const passwordConfirmInput = passwordInputs[1]

    await user.type(passwordInput, 'geslo123')
    await user.type(passwordConfirmInput, 'drugogeslo')

    await user.click(screen.getByText('Shrani spremembe'))

    expect(
      screen.getByText('Gesli se ne ujemata.')
    ).toBeInTheDocument()

    expect(mockUpdatePassword).not.toHaveBeenCalled()
  })


  it('prikaže napako "Geslo mora imeti vsaj 6 znakov." če je novo geslo prekratko', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByText(/uredi profil/i))

    const passwordInputs = document.querySelectorAll(
      '.mp-edit-input[type="password"]'
    )

    expect(passwordInputs).toHaveLength(2)

    const passwordInput = passwordInputs[0]
    const passwordConfirmInput = passwordInputs[1]

    await user.type(passwordInput, '12345')
    await user.type(passwordConfirmInput, '12345')

    await user.click(screen.getByText('Shrani spremembe'))

    expect(
      screen.getByText('Geslo mora imeti vsaj 6 znakov.')
    ).toBeInTheDocument()

    expect(mockUpdatePassword).not.toHaveBeenCalled()
  })


  it('ob vnosu novega veljavnega gesla pokliče updateUserPassword', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByText(/uredi profil/i))

    const passwordInputs = document.querySelectorAll(
      '.mp-edit-input[type="password"]'
    )

    expect(passwordInputs).toHaveLength(2)

    const passwordInput = passwordInputs[0]
    const passwordConfirmInput = passwordInputs[1]

    await user.type(passwordInput, 'novoGeslo123')
    await user.type(passwordConfirmInput, 'novoGeslo123')

    await user.click(screen.getByText('Shrani spremembe'))

    await waitFor(() => {
      expect(mockUpdatePassword).toHaveBeenCalledWith('novoGeslo123')
    })
  })


  it('gumb "Prekliči" zapre obrazec za urejanje profila', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByText('Uredi profil'))

    const passwordInputs = document.querySelectorAll(
      '.mp-edit-input[type="password"]'
    )

    expect(passwordInputs).toHaveLength(2)

    expect(passwordInputs[0]).toBeInTheDocument()

    const cancelButton = document.querySelector('.mp-cancel-btn')

    expect(cancelButton).toBeTruthy()

    await user.click(cancelButton)

    await waitFor(() => {
      expect(
        document.querySelector('.mp-edit-form')
      ).not.toBeInTheDocument()
    })

    expect(
      screen.getByText('Uredi profil')
    ).toBeInTheDocument()
  })


  it('watchlist modal se zapre ob kliku na gumb ✕', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByText(/slediš/i))

    expect(screen.getByText(/Sledim \(1\)/)).toBeInTheDocument()

    const closeButton = document.querySelector('.mp-modal-close')

    expect(closeButton).toBeTruthy()

    await user.click(closeButton)

    expect(screen.queryByText(/Sledim \(1\)/)).not.toBeInTheDocument()
  })


  it('ob spremenjenem e-poštnem naslovu pokliče updateUserEmail', async () => {
    const user = userEvent.setup()

    renderPage()

    await user.click(screen.getByText(/uredi profil/i))

    const emailInput = screen.getByDisplayValue(
      'test@example.com'
    )

    await user.clear(emailInput)
    await user.type(
      emailInput,
      'nov@email.com'
    )

    await user.click(
      screen.getByText(/shrani spremembe/i)
    )

    await waitFor(() => {
      expect(mockUpdateEmail).toHaveBeenCalledWith(
        'nov@email.com'
      )
    })
  })

  it('po uspešnem shranjevanju prikaže "Profil posodobljen."', async () => {
    const user = userEvent.setup()

    renderPage()

    await user.click(screen.getByText(/uredi profil/i))
    await user.click(
      screen.getByText(/shrani spremembe/i)
    )

    await waitFor(() => {
      expect(
        screen.getByText('Profil posodobljen.')
      ).toBeInTheDocument()
    })
  })

  it('ob napaki auth/requires-recent-login prikaže ustrezno obvestilo', async () => {
    const user = userEvent.setup()

    mockUpdateProfile.mockRejectedValue({
      code: 'auth/requires-recent-login',
    })

    renderPage()

    await user.click(screen.getByText(/uredi profil/i))
    await user.click(
      screen.getByText(/shrani spremembe/i)
    )

    await waitFor(() => {
      expect(
        screen.getByText(
          'Odjavi se in se znova prijavi, nato poskusi znova.'
        )
      ).toBeInTheDocument()
    })
  })

  it('ob splošni napaki pri shranjevanju prikaže e.message', async () => {
    const user = userEvent.setup()

    mockUpdateProfile.mockRejectedValue(
      new Error('Nekaj je šlo narobe.')
    )

    renderPage()

    await user.click(screen.getByText(/uredi profil/i))
    await user.click(
      screen.getByText(/shrani spremembe/i)
    )

    await waitFor(() => {
      expect(
        screen.getByText('Nekaj je šlo narobe.')
      ).toBeInTheDocument()
    })
  })

  it('ob napaki brez sporočila prikaže privzeto sporočilo', async () => {
    const user = userEvent.setup()

    mockUpdateProfile.mockRejectedValue({})

    renderPage()

    await user.click(screen.getByText(/uredi profil/i))
    await user.click(
      screen.getByText(/shrani spremembe/i)
    )

    await waitFor(() => {
      expect(
        screen.getByText(
          'Napaka pri shranjevanju.'
        )
      ).toBeInTheDocument()
    })
  })

  it('toggle saved person kliče hook', async () => {
    const user = userEvent.setup()

    renderPage()

    const removeBtn =
      screen.getAllByTitle('Odstrani')[0]

    await user.click(removeBtn)

    expect(mockToggle).toHaveBeenCalled()
  })

  it('prikaže ustrezno prazno stanje, ko ni shranjenih oseb', () => {
    mockSaved = []

    renderPage()

    expect(
      screen.getByText(
        'Še nisi shranila nobene osebe. Na profilu ali v seznamu oseb klikni ikono zaznamka.'
      )
    ).toBeInTheDocument()
  })


  it('prikaže ustrezno prazno stanje, ko ni nedavno ogledanih oseb', () => {
    mockRecent = []

    renderPage()

    expect(
      screen.getByText(
        'Še nisi ogledala nobenega profila.'
      )
    ).toBeInTheDocument()
  })


  it('search history remove kliče removeSearch', async () => {
    const user = userEvent.setup()

    renderPage()

    const removeBtn =
      screen.getByText('✕')

    await user.click(removeBtn)

    expect(
      mockRemoveSearch
    ).toHaveBeenCalled()
  })

  it('clear search history kliče clearSearches', async () => {
    const user = userEvent.setup()

    renderPage()

    await user.click(
      screen.getByText(/počisti vse/i)
    )

    expect(
      mockClearSearches
    ).toHaveBeenCalled()
  })

  it('če ni zgodovine iskanj, se sekcija "Moje poizvedbe" ne izriše', () => {
    mockHistory = []

    renderPage()

    expect(
      screen.queryByText('Moje poizvedbe')
    ).not.toBeInTheDocument()
  })


  it('odpre watchlist modal', async () => {
    const user = userEvent.setup()

    renderPage()

    await user.click(
      screen.getByText(/slediš/i)
    )

    expect(
      screen.getByText(/sledim/i)
    ).toBeInTheDocument()
  })

  it('unfollow kliče hook', async () => {
    const user = userEvent.setup()

    renderPage()

    await user.click(
      screen.getByText(/slediš/i)
    )

    const unfollowBtn =
      screen.getByTitle(/prenehi slediti/i)

    await user.click(unfollowBtn)

    expect(
      mockUnfollow
    ).toHaveBeenCalledWith(99)
  })


  it('če uporabnik ne sledi nobeni osebi, se gumb "Slediš X osebam" ne prikaže', () => {
    mockFollowing = []

    renderPage()

    expect(
      screen.queryByText(/slediš/i)
    ).not.toBeInTheDocument()
  })
})