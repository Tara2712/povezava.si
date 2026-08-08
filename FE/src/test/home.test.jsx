import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  render,
  screen,
  waitFor,
  fireEvent,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Home from '../pages/Home'

const mockNavigate = vi.fn()
const mockTrackSearch = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')

  return {
    ...actual,
    useNavigate: () => mockNavigate,
    Link: ({ children, to, ...props }) => (
      <a href={to} {...props}>
        {children}
      </a>
    ),
  }
})

vi.mock('../components/Layout', () => ({
  default: ({ children }) => <>{children}</>,
}))

vi.mock('../components/Avatar', () => ({
  default: ({ name }) => (
    <div data-testid="avatar">{name}</div>
  ),
}))

vi.mock('../hooks/usePersonStorage', () => ({
  useSearchHistory: () => ({
    track: mockTrackSearch,
  }),
}))

vi.mock('../api', () => ({
  API: 'https://povezava-si.vercel.app',
}))

function jsonResponse(data) {
  return Promise.resolve({
    json: () => Promise.resolve(data),
  })
}

function createDefaultFetchMock() {
  return vi.fn((url) => {
    if (url.includes('/osebe')) {
      return jsonResponse([
        {
          id: 1,
          ime: 'Janez',
          priimek: 'Novak',
          stevilo_povezav: 50,
          institucija: 'Podjetje A',
        },
        {
          id: 3,
          ime: 'Ana',
          priimek: 'Kranjc',
          stevilo_povezav: 45,
        },
      ])
    }

    if (url.includes('/akademiki')) {
      return jsonResponse([
        {
          id: 2,
          ime: 'Maja',
          priimek: 'Kovač',
          stevilo_povezav: 30,
          institucija: 'FERI',
        },
        {
          id: 4,
          ime: 'Peter',
          priimek: 'Horvat',
          stevilo_povezav: 25,
          institucija: 'Univerza',
        },
      ])
    }

    if (url.includes('/clanki')) {
      return jsonResponse([
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
      ])
    }

    if (url.includes('/stats')) {
      return jsonResponse({
        osebe: 1234,
        podjetja: 567,
        povezave: 8901,
      })
    }

    if (url.includes('/lobisti')) {
      return jsonResponse({
        skupaj: 25,
      })
    }

    if (url.includes('/ovadeni')) {
      return jsonResponse({
        skupaj: 10,
      })
    }

    if (url.includes('/search')) {
      return jsonResponse([
        {
          id: 11,
          tip: 'oseba',
          ime: 'Janez',
          priimek: 'Novak',
          stevilo_povezav: 12,
        },
      ])
    }

    return Promise.reject(new Error(`Unknown endpoint: ${url}`))
  })
}

function renderHome() {
  return render(<Home />)
}

describe('Home', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = createDefaultFetchMock()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })


  it('prikaže naslov in search input', async () => {
    renderHome()

    expect(
      screen.getByPlaceholderText(
        'Išči osebo ali podjetje…'
      )
    ).toBeInTheDocument()

    await waitFor(() => {
      expect(
        screen.getByText(/Kaj vas zanima/i)
      ).toBeInTheDocument()
    })
  })


  it('ob nalaganju pokliče vse začetne fetch endpointe', async () => {
    renderHome()

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        'https://povezava-si.vercel.app/osebe?limit=4&tip=poslovnez'
      )

      expect(global.fetch).toHaveBeenCalledWith(
        'https://povezava-si.vercel.app/akademiki?limit=4'
      )

      expect(global.fetch).toHaveBeenCalledWith(
        'https://povezava-si.vercel.app/clanki?limit=50'
      )

      expect(global.fetch).toHaveBeenCalledWith(
        'https://povezava-si.vercel.app/stats'
      )

      expect(global.fetch).toHaveBeenCalledWith(
        'https://povezava-si.vercel.app/lobisti?limit=1'
      )

      expect(global.fetch).toHaveBeenCalledWith(
        'https://povezava-si.vercel.app/ovadeni?limit=1'
      )
    })
  })


  it('prikaže statistiko oseb, podjetij in povezav', async () => {
    renderHome()

    expect(
      await screen.findByText('1.234')
    ).toBeInTheDocument()

    expect(
      screen.getByText('567')
    ).toBeInTheDocument()

    expect(
      screen.getByText('8.901')
    ).toBeInTheDocument()

    expect(
      screen.getByText('oseb v bazi')
    ).toBeInTheDocument()

    expect(
      screen.getByText('podjetij & org.')
    ).toBeInTheDocument()

    expect(
      screen.getByText('poslovnih povezav')
    ).toBeInTheDocument()
  })


  it('se ne sesuje, če začetni fetch vrne napako', async () => {
    global.fetch = vi.fn((url) => {
      if (url.includes('/stats')) {
        return Promise.reject(
          new Error('Stats error')
        )
      }

      if (url.includes('/osebe')) {
        return Promise.reject(
          new Error('Osebe error')
        )
      }

      return createDefaultFetchMock()(url)
    })

    expect(() => renderHome()).not.toThrow()

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText(
          'Išči osebo ali podjetje…'
        )
      ).toBeInTheDocument()
    })
  })

  it('se ne sesuje, če fetch za iskanje vrne napako', async () => {
    const user = userEvent.setup()

    global.fetch = vi.fn((url) => {
      if (url.includes('/search')) {
        return Promise.reject(
          new Error('Search error')
        )
      }

      return createDefaultFetchMock()(url)
    })

    renderHome()

    const input = screen.getByPlaceholderText(
      'Išči osebo ali podjetje…'
    )

    await user.type(input, 'Napaka')

    await waitFor(
      () => {
        expect(
          screen.getByText(/Ni rezultatov za/i)
        ).toBeInTheDocument()
      },
      { timeout: 1000 }
    )
  })


  it('prikaže Dobro jutro zjutraj', () => {
    vi.spyOn(Date.prototype, 'getHours')
      .mockReturnValue(9)

    renderHome()

    expect(
      screen.getByText('Dobro jutro')
    ).toBeInTheDocument()
  })

  it('prikaže Dober dan čez dan', () => {
    vi.spyOn(Date.prototype, 'getHours')
      .mockReturnValue(14)

    renderHome()

    expect(
      screen.getByText('Dober dan')
    ).toBeInTheDocument()
  })

  it('prikaže Dober večer zvečer', () => {
    vi.spyOn(Date.prototype, 'getHours')
      .mockReturnValue(20)

    renderHome()

    expect(
      screen.getByText('Dober večer')
    ).toBeInTheDocument()
  })


  it('prikaže top osebe', async () => {
    renderHome()

    expect(
      await screen.findByText('Janez Novak', {
        selector: '.hd-row-name',
      })
    ).toBeInTheDocument()

    expect(
      screen.getByText('Maja Kovač', {
        selector: '.hd-row-name',
      })
    ).toBeInTheDocument()
  })

  it('prikaže največ 4 oseb (2 poslovneža + 2 akademika)', async () => {
    global.fetch = vi.fn((url) => {
      if (url.includes('/osebe')) {
        return jsonResponse([
          {
            id: 1,
            ime: 'Oseba',
            priimek: 'Poslovna1',
            stevilo_povezav: 100,
          },
          {
            id: 2,
            ime: 'Oseba',
            priimek: 'Poslovna2',
            stevilo_povezav: 90,
          },
          {
            id: 3,
            ime: 'Oseba',
            priimek: 'Poslovna3',
            stevilo_povezav: 80,
          },
        ])
      }

      if (url.includes('/akademiki')) {
        return jsonResponse([
          {
            id: 4,
            ime: 'Akademik',
            priimek: 'Prvi',
            stevilo_povezav: 70,
          },
          {
            id: 5,
            ime: 'Akademik',
            priimek: 'Drugi',
            stevilo_povezav: 60,
          },
          {
            id: 6,
            ime: 'Akademik',
            priimek: 'Tretji',
            stevilo_povezav: 50,
          },
        ])
      }

      return createDefaultFetchMock()(url)
    })

    renderHome()

    const topList = await waitFor(() => {
      const rows = document.querySelectorAll('.hd-row-name')

      expect(rows.length).toBe(4)

      return rows
    })

    expect(topList[0]).toHaveTextContent('Oseba Poslovna1')
    expect(topList[1]).toHaveTextContent('Oseba Poslovna2')
    expect(topList[2]).toHaveTextContent('Akademik Prvi')
    expect(topList[3]).toHaveTextContent('Akademik Drugi')

    expect(
      screen.queryByText('Oseba Poslovna3', {
        selector: '.hd-row-name',
      })
    ).not.toBeInTheDocument()

    expect(
      screen.queryByText('Akademik Tretji', {
        selector: '.hd-row-name',
      })
    ).not.toBeInTheDocument()
  })

  it('prikaže članke', async () => {
    renderHome()

    expect(
      await screen.findByText('Nov članek')
    ).toBeInTheDocument()

    expect(
      screen.getByText('RTV')
    ).toBeInTheDocument()
  })

  it('prikaže največ 3 članke', async () => {
    global.fetch = vi.fn((url) => {
      if (url.includes('/clanki')) {
        return jsonResponse(
          Array.from({ length: 5 }, (_, i) => ({
            id: i + 1,
            naslov: `Članek ${i + 1}`,
            vir: 'RTV',
            datum: new Date().toISOString(),
            url: `https://example.com/${i + 1}`,
            osebe: [
              {
                ime: 'Janez',
                priimek: 'Novak',
              },
            ],
          }))
        )
      }

      return createDefaultFetchMock()(url)
    })

    renderHome()

    await waitFor(() => {
      expect(
        screen.getByText('Članek 1')
      ).toBeInTheDocument()
    })

    expect(
      screen.getByText('Članek 2')
    ).toBeInTheDocument()

    expect(
      screen.getByText('Članek 3')
    ).toBeInTheDocument()

    expect(
      screen.queryByText('Članek 4')
    ).not.toBeInTheDocument()

    expect(
      screen.queryByText('Članek 5')
    ).not.toBeInTheDocument()
  })

  it('filtrira članke brez veljavnih oseb', async () => {
    global.fetch = vi.fn((url) => {
      if (url.includes('/clanki')) {
        return jsonResponse([
          {
            id: 1,
            naslov: 'Veljaven članek',
            vir: 'RTV',
            datum: new Date().toISOString(),
            url: 'https://example.com/1',
            osebe: [
              {
                ime: 'Janez',
                priimek: 'Novak',
              },
            ],
          },
          {
            id: 2,
            naslov: 'Neveljaven članek',
            vir: 'RTV',
            datum: new Date().toISOString(),
            url: 'https://example.com/2',
            osebe: [
              {
                ime: 'J',
                priimek: 'N',
              },
            ],
          },
        ])
      }

      return createDefaultFetchMock()(url)
    })

    renderHome()

    expect(
      await screen.findByText('Veljaven članek')
    ).toBeInTheDocument()

    expect(
      screen.queryByText('Neveljaven članek')
    ).not.toBeInTheDocument()
  })

  it('prikaže "Ni člankov.", če ni nobenega veljavnega članka', async () => {
    global.fetch = vi.fn((url) => {
      if (url.includes('/clanki')) {
        return jsonResponse([
          {
            id: 1,
            naslov: 'Neveljaven članek',
            vir: 'RTV',
            datum: new Date().toISOString(),
            url: 'https://example.com',
            osebe: [
              {
                ime: 'A',
                priimek: 'B',
              },
            ],
          },
        ])
      }

      return createDefaultFetchMock()(url)
    })

    renderHome()

    expect(
      await screen.findByText('Ni člankov.')
    ).toBeInTheDocument()
  })


  it('pravilno prikaže "pravkar"', async () => {
    const now = Date.now()

    vi.spyOn(Date, 'now')
      .mockReturnValue(now)

    global.fetch = vi.fn((url) => {
      if (url.includes('/clanki')) {
        return jsonResponse([
          {
            id: 1,
            naslov: 'Pravkar članek',
            vir: 'RTV',
            datum: new Date(now - 10 * 60 * 1000).toISOString(),
            url: 'https://example.com',
            osebe: [
              {
                ime: 'Janez',
                priimek: 'Novak',
              },
            ],
          },
        ])
      }

      return createDefaultFetchMock()(url)
    })

    renderHome()

    expect(
      await screen.findByText('pravkar')
    ).toBeInTheDocument()
  })

  it('pravilno prikaže xh nazaj', async () => {
    const now = Date.now()

    vi.spyOn(Date, 'now')
      .mockReturnValue(now)

    global.fetch = vi.fn((url) => {
      if (url.includes('/clanki')) {
        return jsonResponse([
          {
            id: 1,
            naslov: 'Starejši članek',
            vir: 'RTV',
            datum: new Date(
              now - 3 * 60 * 60 * 1000
            ).toISOString(),
            url: 'https://example.com',
            osebe: [
              {
                ime: 'Janez',
                priimek: 'Novak',
              },
            ],
          },
        ])
      }

      return createDefaultFetchMock()(url)
    })

    renderHome()

    expect(
      await screen.findByText('3h nazaj')
    ).toBeInTheDocument()
  })

  it('pravilno prikaže "včeraj"', async () => {
    const now = Date.now()

    vi.spyOn(Date, 'now')
      .mockReturnValue(now)

    global.fetch = vi.fn((url) => {
      if (url.includes('/clanki')) {
        return jsonResponse([
          {
            id: 1,
            naslov: 'Včerajšnji članek',
            vir: 'RTV',
            datum: new Date(
              now - 25 * 60 * 60 * 1000
            ).toISOString(),
            url: 'https://example.com',
            osebe: [
              {
                ime: 'Janez',
                priimek: 'Novak',
              },
            ],
          },
        ])
      }

      return createDefaultFetchMock()(url)
    })

    renderHome()

    expect(
      await screen.findByText('včeraj')
    ).toBeInTheDocument()
  })

  it('pravilno prikaže xd nazaj', async () => {
    const now = Date.now()

    vi.spyOn(Date, 'now')
      .mockReturnValue(now)

    global.fetch = vi.fn((url) => {
      if (url.includes('/clanki')) {
        return jsonResponse([
          {
            id: 1,
            naslov: 'Stari članek',
            vir: 'RTV',
            datum: new Date(
              now - 3 * 24 * 60 * 60 * 1000
            ).toISOString(),
            url: 'https://example.com',
            osebe: [
              {
                ime: 'Janez',
                priimek: 'Novak',
              },
            ],
          },
        ])
      }

      return createDefaultFetchMock()(url)
    })

    renderHome()

    expect(
      await screen.findByText('3d nazaj')
    ).toBeInTheDocument()
  })


  it('članki imajo target="_blank" in rel="noopener noreferrer"', async () => {
    renderHome()

    const articleLink = await screen.findByRole('link', {
      name: /Nov članek/i,
    })

    expect(articleLink).toHaveAttribute(
      'target',
      '_blank'
    )

    expect(articleLink).toHaveAttribute(
      'rel',
      'noopener noreferrer'
    )
  })

  it('prikaže število lobistov in ovadenih', async () => {
    renderHome()

    await waitFor(() => {
      expect(
        document.querySelector('.hd-reg-lobist .hd-reg-count')
      ).toHaveTextContent('25')

      expect(
        document.querySelector('.hd-reg-ovaden .hd-reg-count')
      ).toHaveTextContent('10')
    })
  })

  it('ne prikaže števca lobistov, če je vrednost 0', async () => {
    global.fetch = vi.fn((url) => {
      if (url.includes('/lobisti')) {
        return jsonResponse({ skupaj: 0 })
      }

      return createDefaultFetchMock()(url)
    })

    renderHome()

    const lobisti = await waitFor(() => {
      const element = document.querySelector('.hd-reg-lobist')

      expect(element).toBeInTheDocument()

      return element
    })

    expect(
      lobisti.querySelector('.hd-reg-count')
    ).not.toBeInTheDocument()
  })

  it('ne prikaže števca ovadenih, če je vrednost 0', async () => {
    global.fetch = vi.fn((url) => {
      if (url.includes('/ovadeni')) {
        return jsonResponse({ skupaj: 0 })
      }

      return createDefaultFetchMock()(url)
    })

    renderHome()

    const ovadeni = await waitFor(() => {
      const element = document.querySelector('.hd-reg-ovaden')

      expect(element).toBeInTheDocument()

      return element
    })

    expect(
      ovadeni.querySelector('.hd-reg-count')
    ).not.toBeInTheDocument()
  })


  it('ob praznem iskalnem polju se /search ne kliče', async () => {
    renderHome()

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled()
    })

    const searchCalls = global.fetch.mock.calls.filter(
      ([url]) => url.includes('/search')
    )

    expect(searchCalls).toHaveLength(0)
  })

  it('ob praznem iskalnem polju se ne izvede navigacija', () => {
    renderHome()

    const input = screen.getByPlaceholderText(
      'Išči osebo ali podjetje…'
    )

    fireEvent.keyDown(input, {
      key: 'Enter',
      code: 'Enter',
    })

    expect(mockNavigate).not.toHaveBeenCalled()
    expect(mockTrackSearch).not.toHaveBeenCalled()
  })

  it('pri Enter z neveljavnim oziroma praznim nizom ne navigira', async () => {
    const user = userEvent.setup()

    renderHome()

    const input = screen.getByPlaceholderText(
      'Išči osebo ali podjetje…'
    )

    await user.type(input, '   ')
    await user.keyboard('{Enter}')

    expect(mockNavigate).not.toHaveBeenCalled()
    expect(mockTrackSearch).not.toHaveBeenCalled()
  })


  it('išče po vnosu v search', async () => {
    const user = userEvent.setup()

    renderHome()

    const input = screen.getByPlaceholderText(
      'Išči osebo ali podjetje…'
    )

    await user.type(input, 'Janez')

    await waitFor(
      () => {
        expect(
          screen.getByText(/1 rezultatov za/i)
        ).toBeInTheDocument()
      },
      { timeout: 1000 }
    )

    expect(
      screen.getByText('Janez Novak', {
        selector: '.card-name',
      })
    ).toBeInTheDocument()
  })

  it('pri iskanju pravilno uporabi encodeURIComponent(query)', async () => {
    const user = userEvent.setup()

    global.fetch = createDefaultFetchMock()

    renderHome()

    const input = screen.getByPlaceholderText(
      'Išči osebo ali podjetje…'
    )

    await user.type(input, 'Janez Novak & test')

    await waitFor(
      () => {
        expect(global.fetch).toHaveBeenCalledWith(
          'https://povezava-si.vercel.app/search?q=Janez%20Novak%20%26%20test'
        )
      },
      { timeout: 1000 }
    )
  })

  it('pri iskanju uporablja debounce in ne kliče /search ob vsakem pritisku tipke', async () => {
    const user = userEvent.setup()

    renderHome()

    const input = screen.getByPlaceholderText(
      'Išči osebo ali podjetje…'
    )

    await user.type(input, 'Janez')

    const searchCallsImmediately =
      global.fetch.mock.calls.filter(
        ([url]) => url.includes('/search')
      )

    expect(searchCallsImmediately.length).toBeLessThan(5)

    await waitFor(
      () => {
        const searchCalls =
          global.fetch.mock.calls.filter(
            ([url]) => url.includes('/search')
          )

        expect(searchCalls.length).toBe(1)
      },
      { timeout: 1000 }
    )
  })


  it('prikaže "Iščem…" med izvajanjem iskanja', async () => {
    const user = userEvent.setup()

    let resolveSearch

    global.fetch = vi.fn((url) => {
      if (url.includes('/search')) {
        return new Promise(resolve => {
          resolveSearch = resolve
        })
      }

      return createDefaultFetchMock()(url)
    })

    renderHome()

    const input = screen.getByPlaceholderText(
      'Išči osebo ali podjetje…'
    )

    await user.type(input, 'Janez')

    await waitFor(
      () => {
        expect(
          screen.getByText('Iščem…')
        ).toBeInTheDocument()
      },
      { timeout: 1000 }
    )

    resolveSearch({
      json: () => Promise.resolve([]),
    })
  })


  it('prikaže "Ni rezultatov za ..." ko iskanje ne vrne rezultatov', async () => {
    const user = userEvent.setup()

    global.fetch = vi.fn((url) => {
      if (url.includes('/search')) {
        return jsonResponse([])
      }

      return createDefaultFetchMock()(url)
    })

    renderHome()

    const input = screen.getByPlaceholderText(
      'Išči osebo ali podjetje…'
    )

    await user.type(input, 'Neobstoječe')

    await waitFor(
      () => {
        expect(
          screen.getByText(
            /Ni rezultatov za „Neobstoječe"/
          )
        ).toBeInTheDocument()
      },
      { timeout: 1000 }
    )
  })


  it('po uspešnem iskanju prikaže pravilno število rezultatov', async () => {
    const user = userEvent.setup()

    global.fetch = vi.fn((url) => {
      if (url.includes('/search')) {
        return jsonResponse([
          {
            id: 1,
            tip: 'oseba',
            ime: 'Janez',
            priimek: 'Novak',
            stevilo_povezav: 5,
          },
          {
            id: 2,
            tip: 'oseba',
            ime: 'Maja',
            priimek: 'Kovač',
            stevilo_povezav: 4,
          },
          {
            id: 3,
            tip: 'podjetje',
            naziv: 'Test d.o.o.',
            stevilo_povezav: 3,
          },
        ])
      }

      return createDefaultFetchMock()(url)
    })

    renderHome()

    await user.type(
      screen.getByPlaceholderText(
        'Išči osebo ali podjetje…'
      ),
      'test'
    )

    await waitFor(
      () => {
        expect(
          screen.getByText(/3 rezultatov za/i)
        ).toBeInTheDocument()
      },
      { timeout: 1000 }
    )
  })


  it('pri osebi prikaže oznako "Oseba"', async () => {
    const user = userEvent.setup()

    renderHome()

    await user.type(
      screen.getByPlaceholderText(
        'Išči osebo ali podjetje…'
      ),
      'Janez'
    )

    await waitFor(
      () => {
        expect(
          screen.getByText('Oseba')
        ).toBeInTheDocument()
      },
      { timeout: 1000 }
    )
  })

  it('pri podjetju prikaže oznako "Organizacija"', async () => {
    const user = userEvent.setup()

    global.fetch = vi.fn((url) => {
      if (url.includes('/search')) {
        return jsonResponse([
          {
            id: 20,
            tip: 'podjetje',
            naziv: 'Moje podjetje d.o.o.',
            stevilo_povezav: 8,
          },
        ])
      }

      return createDefaultFetchMock()(url)
    })

    renderHome()

    await user.type(
      screen.getByPlaceholderText(
        'Išči osebo ali podjetje…'
      ),
      'podjetje'
    )

    await waitFor(
      () => {
        expect(
          screen.getByText('Organizacija')
        ).toBeInTheDocument()
      },
      { timeout: 1000 }
    )
  })


  it('pravilno izpiše "povezava" pri eni povezavi', async () => {
    const user = userEvent.setup()

    global.fetch = vi.fn((url) => {
      if (url.includes('/search')) {
        return jsonResponse([
          {
            id: 1,
            tip: 'oseba',
            ime: 'Janez',
            priimek: 'Novak',
            stevilo_povezav: 1,
          },
        ])
      }

      return createDefaultFetchMock()(url)
    })

    renderHome()

    await user.type(
      screen.getByPlaceholderText(
        'Išči osebo ali podjetje…'
      ),
      'Janez'
    )

    await waitFor(
      () => {
        expect(
          screen.getByText('1 povezava')
        ).toBeInTheDocument()
      },
      { timeout: 1000 }
    )
  })

  it('pravilno izpiše "povezav" pri več povezavah', async () => {
    const user = userEvent.setup()

    renderHome()

    await user.type(
      screen.getByPlaceholderText(
        'Išči osebo ali podjetje…'
      ),
      'Janez'
    )

    await waitFor(
      () => {
        expect(
          screen.getByText('12 povezav')
        ).toBeInTheDocument()
      },
      { timeout: 1000 }
    )
  })

  it('klik na rezultat tipa podjetje odpre /podjetje/:id', async () => {
    const user = userEvent.setup()

    global.fetch = vi.fn((url) => {
      if (url.includes('/search')) {
        return jsonResponse([
          {
            id: 99,
            tip: 'podjetje',
            naziv: 'Test podjetje',
            stevilo_povezav: 7,
          },
        ])
      }

      return createDefaultFetchMock()(url)
    })

    renderHome()

    const input = screen.getByPlaceholderText(
      'Išči osebo ali podjetje…'
    )

    await user.type(input, 'Test')

    const result = await screen.findByText(
      'Test podjetje',
      { selector: '.card-name' }
    )

    await user.click(result)

    expect(mockNavigate).toHaveBeenCalledWith(
      '/podjetje/99'
    )
  })

  it('ob kliku na rezultat pokliče tudi trackSearch()', async () => {
    const user = userEvent.setup()

    global.fetch = vi.fn((url) => {
      if (url.includes('/search')) {
        return jsonResponse([
          {
            id: 50,
            tip: 'oseba',
            ime: 'Test',
            priimek: 'Oseba',
            stevilo_povezav: 15,
          },
        ])
      }

      return createDefaultFetchMock()(url)
    })

    renderHome()

    const input = screen.getByPlaceholderText(
      'Išči osebo ali podjetje…'
    )

    await user.type(input, 'Test')

    const result = await screen.findByText(
      'Test Oseba',
      { selector: '.card-name' }
    )

    await user.click(result)

    expect(mockTrackSearch).toHaveBeenCalledWith(
      'Test'
    )

    expect(mockNavigate).toHaveBeenCalledWith(
      '/oseba/50'
    )
  })

  it('klik na osebo iz Največ povezav navigira na njen profil', async () => {
    const user = userEvent.setup()

    global.fetch = vi.fn((url) => {
      if (url.includes('/osebe')) {
        return jsonResponse([
          {
            id: 1,
            ime: 'Test',
            priimek: 'Oseba',
            stevilo_povezav: 100,
            institucija: 'Test podjetje',
          },
        ])
      }

      if (url.includes('/akademiki')) {
        return jsonResponse([])
      }

      return createDefaultFetchMock()(url)
    })

    renderHome()

    const person = await screen.findByText(
      'Test Oseba',
      { selector: '.hd-row-name' }
    )

    await user.click(person)

    expect(mockNavigate).toHaveBeenCalledWith(
      '/oseba/1'
    )
  })


  it('počisti search z clear gumbom', async () => {
    const user = userEvent.setup()

    renderHome()

    const input = screen.getByPlaceholderText(
      'Išči osebo ali podjetje…'
    )

    await user.type(input, 'test')

    const clearBtn =
      document.querySelector('.hd-clear-btn')

    expect(clearBtn).toBeInTheDocument()

    await user.click(clearBtn)

    expect(input).toHaveValue('')
  })

  it('brisanje iskanja skrije rezultate', async () => {
    const user = userEvent.setup()

    renderHome()

    const input = screen.getByPlaceholderText(
      'Išči osebo ali podjetje…'
    )

    await user.type(input, 'Janez')

    expect(
      await screen.findByText(
        'Janez Novak',
        { selector: '.card-name' }
      )
    ).toBeInTheDocument()

    const clearBtn =
      document.querySelector('.hd-clear-btn')

    await user.click(clearBtn)

    await waitFor(() => {
      expect(
        screen.queryByText(
          'Janez Novak',
          { selector: '.card-name' }
        )
      ).not.toBeInTheDocument()
    })
  })

  it('ima iskalno polje ob nalaganju strani fokus', () => {
    renderHome()

    const input = screen.getByPlaceholderText(
      'Išči osebo ali podjetje…'
    )

    expect(input).toHaveFocus()
  })

  it('ob Enter navigira na search page', async () => {
    const user = userEvent.setup()

    renderHome()

    const input = screen.getByPlaceholderText(
      'Išči osebo ali podjetje…'
    )

    await user.type(input, 'Novak')
    await user.keyboard('{Enter}')

    expect(mockTrackSearch).toHaveBeenCalledWith(
      'Novak'
    )

    expect(mockNavigate).toHaveBeenCalledWith(
      '/search?q=Novak'
    )
  })
})
