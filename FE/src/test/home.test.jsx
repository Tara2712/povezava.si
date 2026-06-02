import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Home from '../pages/Home'

const mockNavigate = vi.fn()
const mockTrackSearch = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')

  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.mock('../components/Layout', () => ({
  default: ({ children }) => <div>{children}</div>,
}))

vi.mock('../components/Avatar', () => ({
  default: ({ name }) => (
    <div data-testid="avatar" aria-label={name} />
  ),
}))

vi.mock('../hooks/usePersonStorage', () => ({
  useSearchHistory: () => ({
    track: mockTrackSearch,
  }),
}))

vi.mock('../api', () => ({
  API: 'http://localhost:3000',
}))

function renderHome() {
  return render(
    <MemoryRouter>
      <Home />
    </MemoryRouter>
  )
}

describe('Home', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    global.fetch = vi.fn((url) => {
      if (url.includes('/osebe')) {
        return Promise.resolve({
          json: () =>
            Promise.resolve([
              {
                id: 1,
                ime: 'Janez',
                priimek: 'Novak',
                stevilo_povezav: 50,
              },
            ]),
        })
      }

      if (url.includes('/akademiki')) {
        return Promise.resolve({
          json: () =>
            Promise.resolve([
              {
                id: 2,
                ime: 'Maja',
                priimek: 'Kovač',
                stevilo_povezav: 30,
              },
            ]),
        })
      }

      if (url.includes('/clanki')) {
        return Promise.resolve({
          json: () =>
            Promise.resolve([
              {
                id: 1,
                naslov: 'Nov članek',
                vir: 'RTV',
                datum: new Date().toISOString(),
                url: 'https://example.com',
                osebe: [
                  {
                    ime: 'Janez',
                    priimek: 'Novak',
                  },
                ],
              },
            ]),
        })
      }


      if (url.includes('/lobisti')) {
        return Promise.resolve({
          json: () =>
            Promise.resolve({
              skupaj: 25,
            }),
        })
      }

      if (url.includes('/ovadeni')) {
        return Promise.resolve({
          json: () =>
            Promise.resolve({
              skupaj: 10,
            }),
        })
      }

      if (url.includes('/search')) {
        return Promise.resolve({
          json: () =>
            Promise.resolve([
              {
                id: 11,
                tip: 'oseba',
                ime: 'Janez',
                priimek: 'Novak',
                stevilo_povezav: 12,
              },
            ]),
        })
      }

      return Promise.reject(new Error('Unknown endpoint'))
    })
  })

  it('prikaže naslov in search input', async () => {
    renderHome()

    expect(
      screen.getByPlaceholderText('Išči osebo ali podjetje…')
    ).toBeInTheDocument()

    await waitFor(() => {
      expect(
        screen.getByText(/Kaj vas zanima/i)
      ).toBeInTheDocument()
    })
  })


  it('prikaže top osebe', async () => {
    renderHome()

    expect(await screen.findByText('Janez Novak')).toBeInTheDocument()
    expect(screen.getByText('Maja Kovač')).toBeInTheDocument()
  })

  it('prikaže članke', async () => {
    renderHome()

    expect(await screen.findByText('Nov članek')).toBeInTheDocument()
    expect(screen.getByText('RTV')).toBeInTheDocument()
  })

  it('prikaže število lobistov in ovadenih', async () => {
    renderHome()

    expect(await screen.findByText('25')).toBeInTheDocument()
    expect(screen.getByText('10')).toBeInTheDocument()
  })

  it('išče po vnosu v search', async () => {
    const user = userEvent.setup()

    renderHome()

    const input = screen.getByPlaceholderText(
      'Išči osebo ali podjetje…'
    )

    await user.type(input, 'Janez')

    await waitFor(() => {
      expect(
        screen.getByText(/1 rezultatov za/i)
      ).toBeInTheDocument()
    })

    screen.getByText('Janez Novak', { selector: '.card-name' })
  })

  it('počisti search z clear gumbom', async () => {
    const user = userEvent.setup()

    renderHome()

    const input = screen.getByPlaceholderText(
      'Išči osebo ali podjetje…'
    )

    await user.type(input, 'test')

    const clearBtn = document.querySelector('.hd-clear-btn')

    await user.click(clearBtn)

    expect(input).toHaveValue('')
  })

  it('ob Enter navigira na search page', async () => {
    renderHome()

    const input = screen.getByPlaceholderText(
      'Išči osebo ali podjetje…'
    )

    fireEvent.change(input, {
      target: { value: 'Novak' },
    })

    fireEvent.keyDown(input, {
      key: 'Enter',
      code: 'Enter',
    })

    expect(mockTrackSearch).toHaveBeenCalledWith('Novak')

    expect(mockNavigate).toHaveBeenCalledWith(
      '/search?q=Novak'
    )
  })

  it('klik na rezultat osebe odpre osebo', async () => {
    const user = userEvent.setup()

    renderHome()

    const input = screen.getByPlaceholderText(
      'Išči osebo ali podjetje…'
    )

    await user.type(input, 'Janez')

    const result = await screen.findByText('Janez Novak')

    await user.click(result)

    expect(mockNavigate).toHaveBeenCalledWith('/oseba/11')
  })
})