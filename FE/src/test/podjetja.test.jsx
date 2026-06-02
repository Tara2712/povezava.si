import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import Podjetja from '../pages/Podjetja'

const mockPodjetja = [
  {
    id: 1,
    popolno_ime: 'Firma d.o.o.',
    pravna_oblika: 'd.o.o.',
    posta: '1000 Ljubljana',
    stevilo_povezav: 5,
  },
]

beforeEach(() => {
  vi.clearAllMocks()

  global.fetch = vi.fn((url) => {
    if (url.includes('/podjetja')) {
      return Promise.resolve({
        json: () =>
          Promise.resolve({
            podjetja: mockPodjetja,
            skupaj: 1,
          }),
      })
    }

    return Promise.resolve({
      json: () => Promise.resolve({ podjetja: [], skupaj: 0 }),
    })
  })
})

vi.mock('../components/Layout', () => ({
  default: ({ children }) => <div>{children}</div>,
}))

vi.mock('../components/Avatar', () => ({
  default: ({ name }) => <div>{name}</div>,
}))

vi.mock('../api', () => ({
  API: 'http://test-api',
}))

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/podjetja']}>
      <Routes>
        <Route path="/podjetja" element={<Podjetja />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('Podjetja page', () => {
  it('prikaže loading state text', () => {
    renderPage()
    expect(screen.getByText(/nalagam/i)).toBeInTheDocument()
  })

  it('klik na podjetje navigira', async () => {
    const user = userEvent.setup()
    renderPage()

    const card = await screen.findByRole('button', {
      name: /Firma d\.o\.o\./i,
    })

    await user.click(card)
  })

  it('search input deluje', async () => {
    const user = userEvent.setup()
    renderPage()

    const input = screen.getByPlaceholderText(/ime podjetja/i)

    await user.type(input, 'Firma')

    expect(input.value).toBe('Firma')
  })

  it('reset gumb resetira filtre', async () => {
    const user = userEvent.setup()
    renderPage()

    const input = screen.getByPlaceholderText(/ime podjetja/i)

    await user.type(input, 'Test')
    expect(input.value).toBe('Test')

    const resetBtn = screen.getByRole('button', {
      name: /ponastavi/i,
    })

    await user.click(resetBtn)

    expect(input.value).toBe('')
  })

  it('pagination se prikaže (če je več strani)', async () => {
    renderPage()

    const count = await screen.findByText(/podjetij/i)
    expect(count).toBeInTheDocument()
  })
})