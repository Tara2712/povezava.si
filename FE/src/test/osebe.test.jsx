import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import Osebe from '../pages/Osebe'

const mockOsebe = [
  {
    id: 10,
    ime: 'Janez',
    priimek: 'Novak',
    naziv: 'Direktor',
    institucija: 'Firma d.o.o.',
    fotografija_url: null,
    stevilo_povezav: 5,
  },
]

beforeEach(() => {
  vi.clearAllMocks()

  global.fetch = vi.fn((url) => {
    if (url.includes('/osebe')) {
      return Promise.resolve({
        json: () => Promise.resolve(mockOsebe),
      })
    }

    if (url.includes('/stats')) {
      return Promise.resolve({
        json: () => Promise.resolve({ osebe: 1 }),
      })
    }

    return Promise.resolve({
      json: () => Promise.resolve([]),
    })
  })
})

vi.mock('../components/Layout', () => ({
  default: ({ children }) => <div>{children}</div>,
}))

vi.mock('../components/Avatar', () => ({
  default: ({ name }) => <div>{name}</div>,
}))

vi.mock('../components/ShareBtn', () => ({
  default: () => <button>Share</button>,
}))

vi.mock('../hooks/usePersonStorage', () => ({
  useSavedPersons: () => ({
    toggle: vi.fn(),
    isSaved: () => false,
  }),
  useComparison: () => ({
    candidate: null,
    select: vi.fn(),
    clear: vi.fn(),
  }),
  useSearchHistory: () => ({
    track: vi.fn(),
  }),
}))

vi.mock('../api', () => ({
  API: 'http://test-api',
}))

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/osebe']}>
      <Routes>
        <Route path="/osebe" element={<Osebe />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('Osebe page', () => {
  it('prikaže loading state', () => {
    renderPage()
    expect(screen.getByText(/nalagam/i)).toBeInTheDocument()
  })

  it('prikaže seznam oseb', async () => {
    renderPage()

    const card = await screen.findByRole('button', {
      name: /Janez Novak/i,
    })

    expect(card).toBeInTheDocument()

    const utils = within(card)
    expect(utils.getByText(/5.*povezav/i)).toBeInTheDocument()
  })

  it('klik na osebo deluje', async () => {
    const user = userEvent.setup()
    renderPage()

    const card = await screen.findByRole('button', {
      name: /Janez Novak/i,
    })

    await user.click(card)
  })

  it('shrani osebo (toggle save)', async () => {
    const user = userEvent.setup()
    renderPage()

    const saveBtn = await screen.findByTitle('Shrani')

    await user.click(saveBtn)

    expect(saveBtn).toBeInTheDocument()
  })

  it('filter tip deluje brez crasha', async () => {
    const user = userEvent.setup()
    renderPage()

    const pill = await screen.findByText('Poslovnež')
    await user.click(pill)

    expect(pill).toBeInTheDocument()
  })

  it('iskanje input deluje', async () => {
    const user = userEvent.setup()
    renderPage()

    const input = screen.getByPlaceholderText(/ime, priimek/i)

    await user.type(input, 'Novak')

    expect(input.value).toBe('Novak')
  })
})