import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import SearchResultsPage from '../pages/Search'

const mockNavigate = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')

  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({
      search: '?q=test',
    }),
    Link: ({ to, children }) => <a href={to}>{children}</a>,
  }
})

let mockCandidate = null
const mockSelect = vi.fn()
const mockClear = vi.fn()

vi.mock('../hooks/usePersonStorage', () => ({
  useComparison: () => ({
    candidate: mockCandidate,
    select: mockSelect,
    clear: mockClear,
  }),
}))

vi.mock('../components/Layout', () => ({
  default: ({ children }) => <div>{children}</div>,
}))

vi.mock('../components/Avatar', () => ({
  default: ({ name }) => <div data-testid="avatar">{name}</div>,
}))

vi.mock('../components/ShareBtn', () => ({
  default: () => <button>share</button>,
}))

const mockOsebe = [
  {
    id: 1,
    ime: 'Janez',
    priimek: 'Novak',
    stevilo_povezav: 3,
  },
]

const mockPodjetja = [
  {
    id: 10,
    popolno_ime: 'Test d.o.o.',
    stevilo_povezav: 5,
  },
]

beforeEach(() => {
  vi.clearAllMocks()

global.fetch = vi.fn((url) => {
  if (url.includes('/osebe')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve(mockOsebe),
    })
  }

  if (url.includes('/podjetja')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve(mockPodjetja),
    })
  }

  return Promise.reject(new Error('Unknown fetch: ' + url))
})
})

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/?q=test']}>
      <SearchResultsPage />
    </MemoryRouter>
  )
}

describe('SearchResultsPage', () => {
  it('prikaže loading state', async () => {
    renderPage()
    expect(screen.getByText(/Nalaganje rezultatov/i)).toBeInTheDocument()
  })

    it('klik na osebo navigira na profil', async () => {
    const user = userEvent.setup()
    renderPage()

    const imeElement = (await screen.findAllByText('Janez Novak'))[1] 
    const personCard = imeElement.closest('.osebe-card')
    
    await user.click(personCard)
    expect(mockNavigate).toHaveBeenCalledWith('/oseba/1')
    })

  it('klik na "Poglej vse osebe"', async () => {
    const user = userEvent.setup()
    renderPage()

    const buttons = await screen.findAllByText(/Poglej vse rezultate/i)

    await user.click(buttons[0])

    expect(mockNavigate).toHaveBeenCalledWith('/osebe?q=test')
  })

  it('klik na "Poglej vse podjetja"', async () => {
    const user = userEvent.setup()
    renderPage()

    const buttons = await screen.findAllByText(/Poglej vse rezultate/i)

    await user.click(buttons[1])

    expect(mockNavigate).toHaveBeenCalledWith('/podjetja?q=test')
  })

  it('select for compare kliče hook', async () => {
    const user = userEvent.setup()
    renderPage()

    const compareBtn = await screen.findAllByRole('button')

    const btn = compareBtn.find(b =>
      b.className.includes('compare-icon')
    )

    await user.click(btn)

    expect(mockSelect).toHaveBeenCalled()
  })

  it('prikaže error state', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({ ok: false })
    )

    renderPage()

    expect(
      await screen.findByText(/prišlo je do napake/i)
    ).toBeInTheDocument()
  })
})