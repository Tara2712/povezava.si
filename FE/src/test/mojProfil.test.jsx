import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import MojProfil from '../pages/MojProfil'

// ---------------- MOCK NAVIGATE ----------------
const mockNavigate = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    Link: ({ to, children }) => <a href={to}>{children}</a>,
  }
})

// ---------------- MOCK AUTH ----------------
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

// ---------------- MOCK HOOKS ----------------
const mockToggle = vi.fn()
const mockUnfollow = vi.fn()
const mockClearSearches = vi.fn()
const mockRemoveSearch = vi.fn()

vi.mock('../hooks/usePersonStorage', () => ({
  useSavedPersons: () => ({
    saved: [{ id: 1, ime: 'Janez', priimek: 'Novak' }],
    toggle: mockToggle,
  }),
  useRecentlyViewed: () => ({
    recent: [{ id: 2, ime: 'Micka', priimek: 'Kovač' }],
  }),
  useSearchHistory: () => ({
    history: [{ q: 'test query', ts: 1 }],
    remove: mockRemoveSearch,
    clear: mockClearSearches,
  }),
}))

vi.mock('../hooks/useWatchlist', () => ({
  useWatchlist: () => ({
    following: [
      { personId: 99, personName: 'Janez Novak', followedAt: Date.now() },
    ],
    unfollow: mockUnfollow,
  }),
}))

// ---------------- MOCK LAYOUT / AVATAR ----------------
vi.mock('../components/Layout', () => ({
  default: ({ children }) => <div>{children}</div>,
}))

vi.mock('../components/Avatar', () => ({
  default: ({ name }) => <div>{name}</div>,
}))

// ---------------- HELPERS ----------------
function renderPage() {
  return render(
    <MemoryRouter>
      <MojProfil />
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ---------------- TESTS ----------------
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

    expect(screen.getByText(/shrani spremembe/i)).toBeInTheDocument()
  })

  it('save profil kliče updateUserProfile', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByText(/uredi profil/i))

    await user.click(screen.getByText(/shrani spremembe/i))

    expect(mockUpdateProfile).toHaveBeenCalled()
  })

  it('toggle saved person kliče hook', async () => {
    const user = userEvent.setup()
    renderPage()

    const removeBtn = screen.getAllByTitle('Odstrani')[0]
    await user.click(removeBtn)

    expect(mockToggle).toHaveBeenCalled()
  })

  it('search history remove kliče removeSearch', async () => {
    const user = userEvent.setup()
    renderPage()

    const removeBtn = screen.getByText('✕')
    await user.click(removeBtn)

    expect(mockRemoveSearch).toHaveBeenCalled()
  })

  it('clear search history kliče clearSearches', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByText(/počisti vse/i))

    expect(mockClearSearches).toHaveBeenCalled()
  })

  it('odpre watchlist modal', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByText(/slediš/i))

    expect(screen.getByText(/sledim/i)).toBeInTheDocument()
  })

  it('unfollow kliče hook', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByText(/slediš/i))

    const unfollowBtn = screen.getByTitle(/prenehi slediti/i)
    await user.click(unfollowBtn)

    expect(mockUnfollow).toHaveBeenCalled()
  })
})