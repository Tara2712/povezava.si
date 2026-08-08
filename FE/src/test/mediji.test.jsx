import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Mediji from '../pages/Mediji'


vi.mock('../components/Layout', () => ({
  default: ({ children }) => <>{children}</>,
}))


vi.mock('../api', () => ({
  API: 'https://test-api',
}))

const mockData = {
  skupaj: 1,
  clanki: [
    {
      id: 1,
      vir: 'RTV',
      naslov: 'Primer članka',
      url: 'https://example.com',
      datum: '2024-01-10',
      osebe: [
        {
          id: 10,
          ime: 'Janez',
          priimek: 'Novak',
        },
      ],
    },
  ],
}

function mockSuccessfulFetch(data = mockData) {
  global.fetch = vi.fn(() =>
    Promise.resolve({
      json: () => Promise.resolve(data),
    })
  )
}

function mockRejectedFetch() {
  global.fetch = vi.fn(() =>
    Promise.reject(new Error('API error'))
  )
}

function renderPage() {
  return render(
    <MemoryRouter>
      <Mediji />
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useRealTimers()
  mockSuccessfulFetch()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('Mediji page', () => {
  it('prikaže loading state ob nalaganju', () => {
    global.fetch = vi.fn(
      () => new Promise(() => {})
    )

    renderPage()

    expect(screen.getByText('Nalagam...')).toBeInTheDocument()
  })

  it('prikaže naslov strani "V medijih"', async () => {
    renderPage()

    expect(
      await screen.findByRole('heading', {
        name: /V medijih/i,
      })
    ).toBeInTheDocument()
  })


  it('prikaže podnaslov strani', async () => {
    renderPage()

    expect(
      await screen.findByText(
        'Omembe oseb in podjetij v slovenskih medijih'
      )
    ).toBeInTheDocument()
  })

  it('prikaže število objav', async () => {
    renderPage()

    await screen.findByText('Primer članka')

    const count = document.querySelector('.mediji-count')

    expect(count).toBeInTheDocument()
    expect(count).toHaveTextContent('1')
    expect(count).toHaveTextContent('objav')
  })

  it('prikaže naslov članka', async () => {
    renderPage()

    expect(
      await screen.findByText('Primer članka')
    ).toBeInTheDocument()
  })

  it('prikaže vir članka', async () => {
    renderPage()

    expect(
      await screen.findByText('RTV')
    ).toBeInTheDocument()
  })

  it('prikaže formatiran datum', async () => {
    renderPage()

    const expectedDate = new Date(
      '2024-01-10'
    ).toLocaleDateString('sl-SI', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })

    expect(
      await screen.findByText(expectedDate)
    ).toBeInTheDocument()
  })

  it('članke pravilno razvrsti po letih', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        json: () =>
          Promise.resolve({
            clanki: [
              {
                id: 1,
                vir: 'RTV',
                naslov: 'Članek 2024',
                url: 'https://example.com/2024',
                datum: '2024-01-10',
                osebe: [
                  {
                    id: 10,
                    ime: 'Janez',
                    priimek: 'Novak',
                  },
                ],
              },
              {
                id: 2,
                vir: 'RTV',
                naslov: 'Članek 2025',
                url: 'https://example.com/2025',
                datum: '2025-01-10',
                osebe: [
                  {
                    id: 11,
                    ime: 'Miha',
                    priimek: 'Kovač',
                  },
                ],
              },
              {
                id: 3,
                vir: 'RTV',
                naslov: 'Članek 2023',
                url: 'https://example.com/2023',
                datum: '2023-01-10',
                osebe: [
                  {
                    id: 12,
                    ime: 'Ana',
                    priimek: 'Novak',
                  },
                ],
              },
            ],
          }),
      })
    )

    renderPage()

    await screen.findByText('Članek 2024')

    expect(screen.getByText('2025')).toBeInTheDocument()
    expect(screen.getByText('2024')).toBeInTheDocument()
    expect(screen.getByText('2023')).toBeInTheDocument()

    const groups = document.querySelectorAll(
      '.mediji-leto-skupina:not(.prihodnost)'
    )

    expect(groups.length).toBe(3)

    expect(
      groups[0]
        .querySelector('.mediji-leto-badge')
        ?.textContent
    ).toBe('2025')

    expect(
      groups[1]
        .querySelector('.mediji-leto-badge')
        ?.textContent
    ).toBe('2024')

    expect(
      groups[2]
        .querySelector('.mediji-leto-badge')
        ?.textContent
    ).toBe('2023')
  })

  it('za trenutno leto doda CSS razred tekoce', async () => {
    const currentYear = new Date().getFullYear()

    global.fetch = vi.fn(() =>
      Promise.resolve({
        json: () =>
          Promise.resolve({
            clanki: [
              {
                id: 1,
                vir: 'RTV',
                naslov: 'Članek letos',
                url: 'https://example.com',
                datum: `${currentYear}-01-10`,
                osebe: [
                  {
                    id: 10,
                    ime: 'Janez',
                    priimek: 'Novak',
                  },
                ],
              },
            ],
          }),
      })
    )

    renderPage()

    await screen.findByText('Članek letos')

    const yearGroup = document.querySelector(
      '.mediji-leto-skupina.tekoce'
    )

    expect(yearGroup).toBeInTheDocument()
  })

  it('za starejša leta doda CSS razred preteklost', async () => {
    const currentYear = new Date().getFullYear()

    global.fetch = vi.fn(() =>
      Promise.resolve({
        json: () =>
          Promise.resolve({
            clanki: [
              {
                id: 1,
                vir: 'RTV',
                naslov: 'Stari članek',
                url: 'https://example.com',
                datum: `${currentYear - 2}-01-10`,
                osebe: [
                  {
                    id: 10,
                    ime: 'Janez',
                    priimek: 'Novak',
                  },
                ],
              },
            ],
          }),
      })
    )

    renderPage()

    await screen.findByText('Stari članek')

    const yearGroup = document.querySelector(
      '.mediji-leto-skupina.preteklost'
    )

    expect(yearGroup).toBeInTheDocument()
  })

  it('prikaže placeholderje za leta 2027, 2028 in 2029, kadar iskanje ni aktivno', async () => {
    renderPage()

    await screen.findByText('Primer članka')

    expect(screen.getByText('2027')).toBeInTheDocument()
    expect(screen.getByText('2028')).toBeInTheDocument()
    expect(screen.getByText('2029')).toBeInTheDocument()

    expect(
      document.querySelectorAll(
        '.mediji-leto-skupina.prihodnost'
      )
    ).toHaveLength(3)
  })

  it('placeholderji izginejo, ko uporabnik začne iskati', async () => {
    const user = userEvent.setup()

    renderPage()

    await screen.findByText('Primer članka')

    expect(screen.getByText('2027')).toBeInTheDocument()
    expect(screen.getByText('2028')).toBeInTheDocument()
    expect(screen.getByText('2029')).toBeInTheDocument()

    const input = screen.getByPlaceholderText(
      'Išči po naslovu, osebi ali ključnih besedah...'
    )

    await user.type(input, 'Janez')

    await waitFor(() => {
      expect(
        screen.queryByText('2027')
      ).not.toBeInTheDocument()

      expect(
        screen.queryByText('2028')
      ).not.toBeInTheDocument()

      expect(
        screen.queryByText('2029')
      ).not.toBeInTheDocument()
    })
  })

  it('fetch se ob nalaganju pokliče z /clanki?limit=200', async () => {
    renderPage()

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })

    expect(global.fetch).toHaveBeenCalledWith(
      'https://test-api/clanki?limit=200'
    )
  })

  it('iskalnik sproži fetch z q parametrom', async () => {
    const user = userEvent.setup()

    renderPage()

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })

    const input = screen.getByPlaceholderText(
      'Išči po naslovu, osebi ali ključnih besedah...'
    )

    await user.type(input, 'Janez')

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2)
    })

    const lastCall =
      global.fetch.mock.calls.at(-1)[0]

    expect(lastCall).toContain('q=Janez')
  })


  it('ob spremembi iskalnega niza ponovno izvede fetch', async () => {
    const user = userEvent.setup()

    renderPage()

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })

    const input = screen.getByPlaceholderText(
      'Išči po naslovu, osebi ali ključnih besedah...'
    )

    await user.type(input, 'Janez')

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2)
    })

    await user.clear(input)
    await user.type(input, 'Novak')

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(3)
    })

    const lastCall =
      global.fetch.mock.calls.at(-1)[0]

    expect(lastCall).toContain('q=Novak')
  })

  it('pravilno kodira q parameter', async () => {
    const user = userEvent.setup()

    renderPage()

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })

    const query = 'Janez Novak & test'

    const input = screen.getByPlaceholderText(
      'Išči po naslovu, osebi ali ključnih besedah...'
    )

    await user.type(input, query)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2)
    })

    const url =
      global.fetch.mock.calls.at(-1)[0]

    const expectedEncodedQuery =
      new URLSearchParams({ q: query }).toString()

    expect(url).toContain(expectedEncodedQuery)
  })

  it('prikaže "Ni rezultatov za ..." kadar iskanje ne vrne zadetkov', async () => {
    const user = userEvent.setup()

    global.fetch = vi.fn(() =>
      Promise.resolve({
        json: () =>
          Promise.resolve({
            clanki: [],
          }),
      })
    )

    renderPage()

    await screen.findByPlaceholderText(
      'Išči po naslovu, osebi ali ključnih besedah...'
    )

    const input = screen.getByPlaceholderText(
      'Išči po naslovu, osebi ali ključnih besedah...'
    )

    await user.type(
      input,
      'Neobstoječi članek'
    )

    await waitFor(() => {
      expect(
        screen.getByText(
          'Ni rezultatov za "Neobstoječi članek"'
        )
      ).toBeInTheDocument()
    })
  })

  it('ob napaki API prikaže empty state', async () => {
    mockRejectedFetch()

    renderPage()

    await waitFor(() => {
      expect(
        screen.getByText('Ni objav.')
      ).toBeInTheDocument()
    })
  })

  it('po končanem fetchu loading stanje izgine', async () => {
    renderPage()

    expect(
      screen.getByText('Nalagam...')
    ).toBeInTheDocument()

    await waitFor(() => {
      expect(
        screen.queryByText('Nalagam...')
      ).not.toBeInTheDocument()
    })

    expect(
      screen.getByText('Primer članka')
    ).toBeInTheDocument()
  })

  it('prikaže povezavo do članka z ustreznimi atributi', async () => {
    renderPage()

    await screen.findByText('Primer članka')

    const articleLink = document.querySelector(
      'a[href="https://example.com"]'
    )

    expect(articleLink).toBeInTheDocument()

    expect(articleLink).toHaveAttribute(
      'href',
      'https://example.com'
    )

    expect(articleLink).toHaveAttribute(
      'target',
      '_blank'
    )

    expect(articleLink).toHaveAttribute(
      'rel',
      'noopener noreferrer'
    )
  })

  it('prikaže samo veljavna imena oseb', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        json: () =>
          Promise.resolve({
            clanki: [
              {
                id: 1,
                vir: 'RTV',
                naslov: 'Članek z osebami',
                url: 'https://example.com',
                datum: '2024-01-10',
                osebe: [
                  {
                    id: 10,
                    ime: 'Janez',
                    priimek: 'Novak',
                  },
                  {
                    id: 11,
                    ime: 'A',
                    priimek: 'B',
                  },
                  {
                    id: 12,
                    ime: 'ABC',
                    priimek: 'DEF',
                  },
                  {
                    id: 13,
                    ime: 'J.',
                    priimek: 'Novak',
                  },
                  {
                    id: 14,
                    ime: 'Miha',
                    priimek: 'Kovač',
                  },
                ],
              },
            ],
          }),
      })
    )

    renderPage()

    expect(
      await screen.findByText('Janez Novak')
    ).toBeInTheDocument()

    expect(
      screen.getByText('Miha Kovač')
    ).toBeInTheDocument()

    expect(
      screen.queryByText('A B')
    ).not.toBeInTheDocument()

    expect(
      screen.queryByText('ABC DEF')
    ).not.toBeInTheDocument()

    expect(
      screen.queryByText('J. Novak')
    ).not.toBeInTheDocument()
  })

  it('podvojene osebe v članku prikaže samo enkrat', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        json: () =>
          Promise.resolve({
            clanki: [
              {
                id: 1,
                vir: 'RTV',
                naslov: 'Članek',
                url: 'https://example.com',
                datum: '2024-01-10',
                osebe: [
                  {
                    id: 10,
                    ime: 'Janez',
                    priimek: 'Novak',
                  },
                  {
                    id: 11,
                    ime: 'Janez',
                    priimek: 'Novak',
                  },
                  {
                    id: 12,
                    ime: 'JANEZ',
                    priimek: 'NOVAK',
                  },
                ],
              },
            ],
          }),
      })
    )

    renderPage()

    await screen.findByText('Janez Novak')

    expect(
      screen.getAllByText('Janez Novak')
    ).toHaveLength(1)
  })

  it('prikaže osebo kot povezavo', async () => {
    renderPage()

    const person = await screen.findByText(
      'Janez Novak'
    )

    expect(
      person.closest('a')
    ).toHaveAttribute(
      'href',
      '/oseba/10'
    )
  })

  it('uporabi skupaj iz API podatkov za število objav', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        json: () =>
          Promise.resolve({
            skupaj: 999,
            clanki: [
              {
                id: 1,
                vir: 'RTV',
                naslov: 'Primer članka',
                url: 'https://example.com',
                datum: '2024-01-10',
                osebe: [
                  {
                    id: 10,
                    ime: 'Janez',
                    priimek: 'Novak',
                  },
                ],
              },
            ],
          }),
      })
    )

    renderPage()

    await screen.findByText('Primer članka')
    const count = document.querySelector(
      '.mediji-count'
    )

    expect(count).toHaveTextContent('1')
    expect(count).toHaveTextContent('objav')

    expect(
      screen.queryByText('999 objav')
    ).not.toBeInTheDocument()
  })

  it('ob praznem seznamu brez iskanja prikaže Ni objav', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        json: () =>
          Promise.resolve({
            clanki: [],
          }),
      })
    )

    renderPage()

    expect(
      await screen.findByText('Ni objav.')
    ).toBeInTheDocument()
  })

  it('prikaže loading med novim iskanjem', async () => {
    const user = userEvent.setup()

    let resolveInitialFetch

    global.fetch = vi.fn(() => {
      return new Promise(resolve => {
        resolveInitialFetch = resolve
      })
    })

    renderPage()

    expect(
      screen.getByText('Nalagam...')
    ).toBeInTheDocument()

    resolveInitialFetch({
      json: () =>
        Promise.resolve({
          clanki: [
            {
              id: 1,
              vir: 'RTV',
              naslov: 'Primer članka',
              url: 'https://example.com',
              datum: '2024-01-10',
              osebe: [
                {
                  id: 10,
                  ime: 'Janez',
                  priimek: 'Novak',
                },
              ],
            },
          ],
        }),
    })

    await waitFor(() => {
      expect(
        screen.queryByText('Nalagam...')
      ).not.toBeInTheDocument()
    })

    const input = screen.getByPlaceholderText(
      'Išči po naslovu, osebi ali ključnih besedah...'
    )

    // Drugi fetch bo ostal odprt, da lahko preveri loading
    global.fetch.mockImplementationOnce(() =>
      Promise.resolve({
        json: () =>
          Promise.resolve({
            clanki: [
              {
                id: 1,
                vir: 'RTV',
                naslov: 'Primer članka',
                url: 'https://example.com',
                datum: '2024-01-10',
                osebe: [
                  {
                    id: 10,
                    ime: 'Janez',
                    priimek: 'Novak',
                  },
                ],
              },
            ],
          }),
      })
    )

    await user.type(input, 'Janez')
    
    await new Promise(resolve =>
      setTimeout(resolve, 350)
    )

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2)
    })
  })
})