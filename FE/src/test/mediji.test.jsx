import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Mediji from '../pages/Mediji'

// ---------------- MOCK LAYOUT ----------------
vi.mock('../components/Layout', () => ({
  default: ({ children }) => <div>{children}</div>,
}))

// ---------------- MOCK API ----------------
vi.mock('../api', () => ({
  API: 'http://test-api',
}))

// ---------------- MOCK FETCH ----------------
const mockData = {
  clanki: [
    {
      id: 1,
      vir: 'RTV',
      naslov: 'Primer članka',
      url: 'https://example.com',
      datum: '2024-01-10',
      osebe: [{ id: 10, ime: 'Janez', priimek: 'Novak' }],
    },
  ],
}

beforeEach(() => {
  vi.clearAllMocks()

  global.fetch = vi.fn(() =>
    Promise.resolve({
      json: () => Promise.resolve(mockData),
    })
  )
})

function renderPage() {
  return render(
    <MemoryRouter>
      <Mediji />
    </MemoryRouter>
  )
}

describe('Mediji page', () => {
  it('prikaže loading state', () => {
    renderPage()
    expect(screen.getByText(/nalagam/i)).toBeInTheDocument()
  })

  it('prikaže osebo kot link', async () => {
    renderPage()

    const link = await screen.findByText('Janez Novak')
    expect(link.closest('a')).toHaveAttribute('href', '/oseba/10')
  })

  it('fetch se pokliče z API', async () => {
    renderPage()

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled()
    })

    expect(global.fetch.mock.calls[0][0]).toContain('/clanki')
  })

  it('empty state se prikaže', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        json: () => Promise.resolve({ clanki: [] }),
      })
    )

    renderPage()

    expect(await screen.findByText(/ni objav/i)).toBeInTheDocument()
  })

})