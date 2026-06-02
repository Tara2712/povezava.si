import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Pot from '../pages/Pot'
import { vi } from 'vitest'

global.fetch = vi.fn()

vi.mock('../components/Layout', () => ({
  default: ({ children }) => children
}))

vi.mock('../hooks/useWatchlist', () => ({
  useWatchlist: () => ({
    notifications: [],
    dismissNotification: vi.fn(),
    dismissAll: vi.fn()
  })
}))

vi.mock('../firebase', () => ({
  db: {},
  auth: {}
}))

function mockSearch() {
  fetch.mockImplementation((url) => {
    if (url.includes('/search')) {
      return Promise.resolve({
        json: () => Promise.resolve([
          { id: 1, ime: 'Janez', priimek: 'Novak', tip: 'oseba' }
        ])
      })
    }

    if (url.includes('/pot')) {
      return Promise.resolve({
        json: () => Promise.resolve({
          stopnje: 1,
          path: [
            { type: 'oseba', id: 1, name: 'Janez Novak', vloga: 'Direktor' }
          ]
        })
      })
    }
  })
}

beforeEach(() => {
  fetch.mockReset()
})

describe('Pot page', () => {

    test('ne dovoli iskanja brez obeh oseb', async () => {
    render(
        <MemoryRouter>
        <Pot />
        </MemoryRouter>
    )

    fireEvent.click(screen.getByRole('button', { name: /poišči pot/i }))
    expect(fetch).not.toHaveBeenCalled()
    })

    test('prikaže rezultat poti', async () => {
    mockSearch()

    render(
        <MemoryRouter>
        <Pot />
        </MemoryRouter>
    )

    const inputs = screen.getAllByRole('textbox')

    fireEvent.change(inputs[0], { target: { value: 'jan' } })

    const option = await screen.findByText(/Janez Novak/i)
    fireEvent.click(option)

    await waitFor(() => {
        expect(fetch).toHaveBeenCalled()
    })

    fireEvent.click(screen.getByRole('button', { name: /poišči pot/i }))

    await waitFor(() => {
        expect(screen.getByText(/Janez Novak/i)).toBeInTheDocument()
    })
    })

    test('gumb za iskanje je onemogočen, če osebi nista izbrani', () => {
    render(
        <MemoryRouter>
        <Pot />
        </MemoryRouter>
    )

    const gumb = screen.getByRole('button', { name: /poišči pot/i })
    expect(gumb).toBeDisabled()
    })
})