import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import SearchResultsPage from '../pages/Search'

const mockNavigate = vi.fn()
let mockSearch = '?q=test'

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')

  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({
      search: mockSearch
    })
  }
})

let mockCandidate = null
const mockSelect = vi.fn()
const mockClear = vi.fn()

vi.mock('../hooks/usePersonStorage', () => ({
  useComparison: () => ({
    candidate: mockCandidate,
    select: mockSelect,
    clear: mockClear
  })
}))

vi.mock('../components/Layout', () => ({
  default: ({ children }) => <>{children}</>
}))

vi.mock('../components/Avatar', () => ({
  default: ({ name, foto }) => (
    <div
      data-testid="avatar"
      data-foto={foto || ''}
    >
      {name}
    </div>
  )
}))

vi.mock('../components/ShareBtn', () => ({
  default: ({ url, name }) => (
    <button
      type="button"
      data-testid="share-btn"
      data-url={url}
      data-name={name}
    >
      Share
    </button>
  )
}))

const mockOsebe = [
  {
    id: 1,
    ime: 'Janez',
    priimek: 'Novak',
    naziv: 'Direktor',
    institucija: 'ABC d.o.o.',
    stevilo_povezav: 3,
    fotografija_url: '/janez.jpg'
  }
]

const mockPodjetja = [
  {
    id: 10,
    popolno_ime: 'Test d.o.o.',
    pravna_oblika: 'd.o.o.',
    posta: 'Ljubljana',
    stevilo_povezav: 5
  }
]

beforeEach(() => {
  vi.clearAllMocks()

  mockCandidate = null
  mockSearch = '?q=test'

  global.fetch = vi.fn(url => {
    if (url.includes('/api/osebe')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockOsebe)
      })
    }

    if (url.includes('/api/podjetja')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockPodjetja)
      })
    }

    return Promise.reject(
      new Error(`Unknown fetch: ${url}`)
    )
  })
})

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/?q=test']}>
      <SearchResultsPage />
    </MemoryRouter>
  )
}

function createFetchResponse(
  osebe = mockOsebe,
  podjetja = mockPodjetja
) {
  global.fetch = vi.fn(url => {
    if (url.includes('/api/osebe')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(osebe)
      })
    }

    if (url.includes('/api/podjetja')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(podjetja)
      })
    }

    return Promise.reject(
      new Error(`Unknown fetch: ${url}`)
    )
  })
}

describe('SearchResultsPage', () => {


  it('prikaže loading state', () => {
    global.fetch = vi.fn(
      () => new Promise(() => {})
    )

    renderPage()

    expect(
      screen.getByText('Nalaganje rezultatov...')
    ).toBeInTheDocument()
  })

  it('prikaže naslov z iskalnim izrazom', async () => {
  renderPage()

  const title = await screen.findByRole('heading', {
  name: /Rezultati za.*test/i
  })

  expect(title).toBeInTheDocument()
  })


  it('prikaže sekcijo Top 6 rezultati — osebe', async () => {
    renderPage()

    expect(
      await screen.findByText(
        'Top 6 rezultati — osebe'
      )
    ).toBeInTheDocument()
  })

  it('prikaže sekcijo Top 6 rezultati — podjetja', async () => {
    renderPage()

    expect(
      await screen.findByText(
        'Top 6 rezultati — podjetja'
      )
    ).toBeInTheDocument()
  })


it('prikaže ime osebe', async () => { 
  renderPage() 
  const card = await screen.findByRole('button', { name: /Janez Novak/ }) 
  expect(card).toBeInTheDocument() 
  expect(card).toHaveTextContent('Janez Novak') 
})

  it('prikaže število povezav pri osebi', async () => {
    renderPage()

    expect(
      await screen.findByText('3 povezav')
    ).toBeInTheDocument()
  })

  it('prikaže naziv in institucijo osebe', async () => { 
    renderPage() 

    const card = await screen.findByRole('button', { name: /Janez Novak/ }) 

    expect( within(card).getByText('Direktor') ).toBeInTheDocument() 
    expect( within(card).getByText('ABC d.o.o.') ).toBeInTheDocument() 
  })

  it('prikaže fotografijo/avatar podatke osebe', async () => { 
    renderPage() 
    
    const avatars = await screen.findAllByTestId('avatar') 
    const personAvatar = avatars.find( avatar => avatar.getAttribute('data-foto') === '/janez.jpg' ) 
    expect(personAvatar).toBeInTheDocument() 
    expect(personAvatar).toHaveTextContent('Janez Novak') 
    expect(personAvatar).toHaveAttribute( 'data-foto', '/janez.jpg' ) 
  })

  it('prikaže ShareBtn na kartici osebe', async () => {
    renderPage()

    const shareBtn =
      await screen.findByTestId('share-btn')

    expect(shareBtn).toBeInTheDocument()

    expect(shareBtn).toHaveAttribute(
      'data-url',
      '/oseba/1'
    )

    expect(shareBtn).toHaveAttribute(
      'data-name',
      'Janez Novak'
    )
  })

  it('prikaže "1 povezava" pri eni povezavi', async () => {
    createFetchResponse([
      {
        ...mockOsebe[0],
        stevilo_povezav: 1
      }
    ])

    renderPage()

    expect(
      await screen.findByText('1 povezava')
    ).toBeInTheDocument()
  })

  it('prikaže "povezav" pri več povezavah', async () => {
    createFetchResponse([
      {
        ...mockOsebe[0],
        stevilo_povezav: 5
      }
    ])

    renderPage()

    expect(
      await screen.findByText('5 povezav')
    ).toBeInTheDocument()
  })

  it('prikaže sporočilo za prazen seznam oseb', async () => {
    createFetchResponse([], mockPodjetja)

    renderPage()

    expect(
      await screen.findByText('Ni najdenih oseb.')
    ).toBeInTheDocument()
  })


  it('klik na kartico osebe navigira na profil osebe', async () => { 
    const user = userEvent.setup() 
    
    renderPage() 
    
    const card = await screen.findByRole('button', { name: /Janez Novak/ }) 
    await user.click(card) 
    expect(mockNavigate).toHaveBeenCalledWith('/oseba/1') 
  })

  it('klik na Poglej vse osebe navigira na /osebe?q=test', async () => {
    const user = userEvent.setup()

    renderPage()

    const buttons =
      await screen.findAllByText(
        'Poglej vse rezultate →'
      )

    await user.click(buttons[0])

    expect(mockNavigate).toHaveBeenCalledWith(
      '/osebe?q=test'
    )
  })


  it('povezava Omrežje vodi na pravilen URL', async () => {
    renderPage()

    const link =
      await screen.findByRole('link', {
        name: 'Omrežje →'
      })

    expect(link).toHaveAttribute(
      'href',
      '/omrezje/1'
    )
  })

  it('povezava AI vodi na pravilen URL', async () => {
    renderPage()

    const link =
      await screen.findByRole('link', {
        name: 'AI ✦'
      })

    expect(link).toHaveAttribute(
      'href',
      '/asistent?q=Janez%20Novak'
    )
  })


  it('brez izbranega kandidata prikaže gumb za primerjavo', async () => {
    mockCandidate = null

    renderPage()

    const compareButton =
      await screen.findByTitle('Primerjaj')

    expect(compareButton).toBeInTheDocument()
    expect(compareButton).toHaveClass(
      'osebe-card-compare-icon'
    )
  })

  it('klik na osebo brez kandidata pokliče selectForCompare', async () => {
    const user = userEvent.setup()

    mockCandidate = null

    renderPage()

    const compareButton =
      await screen.findByTitle('Primerjaj')

    await user.click(compareButton)

    expect(mockSelect).toHaveBeenCalledTimes(1)
    expect(mockSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 1,
        ime: 'Janez',
        priimek: 'Novak'
      })
    )
  })

  it('ko obstaja candidate, prikaže povezavo na primerjavo', async () => {
    mockCandidate = {
      id: 99,
      ime: 'Ana',
      priimek: 'Kranjc'
    }

    renderPage()

    const compareLink =
      await screen.findByRole('link', {
        name: ''
      }).catch(() => null)

    const allLinks =
      await screen.findAllByRole('link')

    const comparisonLink =
      allLinks.find(link =>
        link.getAttribute('href') ===
        '/primerjava?a=99&b=1'
      )

    expect(comparisonLink).toBeInTheDocument()
  })

  it('ko obstaja candidate, je URL primerjave pravilen', async () => {
    mockCandidate = {
      id: 25,
      ime: 'Ana',
      priimek: 'Kranjc'
    }

    renderPage()

    await waitFor(() => {
      const link = document.querySelector(
        'a.osebe-card-compare-icon.active'
      )

      expect(link).toBeInTheDocument()
      expect(link).toHaveAttribute(
        'href',
        '/primerjava?a=25&b=1'
      )
    })
  })

  it('klik na primerjavo z drugim kandidatom pokliče clearCompare', async () => {
    const user = userEvent.setup()

    mockCandidate = {
      id: 25,
      ime: 'Ana',
      priimek: 'Kranjc'
    }

    renderPage()

    const compareLink =
      await screen.findByRole('link', {
        name: /primerjaj z ana kranjc/i
      })

    await user.click(compareLink)

    expect(mockClear).toHaveBeenCalledTimes(1)
  })

  it('klik na že izbrano osebo pokliče clearCompare', async () => {
    const user = userEvent.setup()

    mockCandidate = {
      id: 1,
      ime: 'Janez',
      priimek: 'Novak'
    }

    renderPage()

    const button =
      await screen.findByTitle(
        'Izbran — klikni drugo osebo'
      )

    await user.click(button)

    expect(mockClear).toHaveBeenCalledTimes(1)
  })

  it('prikaže ime podjetja', async () => { renderPage() 
    const card = await screen.findByRole('button', { name: /Test d\.o\.o\./ }) 
    expect(card).toBeInTheDocument() 
    expect(card).toHaveTextContent('Test d.o.o.') 
  })

  it('prikaže pravno obliko podjetja', async () => {
    renderPage()

    expect(
      await screen.findByText('d.o.o.')
    ).toBeInTheDocument()
  })

  it('prikaže pošto podjetja', async () => {
    renderPage()

    expect(
      await screen.findByText('Ljubljana')
    ).toBeInTheDocument()
  })

  it('prikaže število povezav podjetja', async () => {
    renderPage()

    expect(
      await screen.findByText('5 oseb')
    ).toBeInTheDocument()
  })

  it('klik na podjetje navigira na pravilen profil', async () => {
     const user = userEvent.setup() 
     
     renderPage() 
     
     const company = await screen.findByRole('button', { name: /Test d\.o\.o\./ }) 
     await user.click(company) 
     expect(mockNavigate).toHaveBeenCalledWith('/podjetje/10') 
    })

  it('klik na Poglej vse podjetja navigira na /podjetja?q=test', async () => {
    const user = userEvent.setup()

    renderPage()

    const buttons =
      await screen.findAllByText(
        'Poglej vse rezultate →'
      )

    await user.click(buttons[1])

    expect(mockNavigate).toHaveBeenCalledWith(
      '/podjetja?q=test'
    )
  })

  it('prikaže sporočilo za prazen seznam podjetij', async () => {
    createFetchResponse(mockOsebe, [])

    renderPage()

    expect(
      await screen.findByText(
        'Ni najdenih podjetij.'
      )
    ).toBeInTheDocument()
  })

  it('pri več kot 6 osebah prikaže samo prvih 6', async () => {
     const osebe = Array.from( { length: 8 }, (_, i) => 
      ({ id: i + 1, ime: `Oseba${i + 1}`, priimek: 'Test', stevilo_povezav: i + 1 }) ) 
     createFetchResponse(osebe, []) 
     
     renderPage() 
     
     await waitFor(() => { expect( screen.getAllByTestId('avatar') ).toHaveLength(6) }) 
     expect( screen.queryByRole('button', { name: /Oseba7 Test/ }) ).not.toBeInTheDocument() 
     expect( screen.queryByRole('button', { name: /Oseba8 Test/ }) ).not.toBeInTheDocument() 
    })

  it('pri več kot 6 podjetjih prikaže samo prvih 6', async () => {
    const podjetja = Array.from(
      { length: 8 },
      (_, i) => ({
        id: i + 1,
        popolno_ime: `Podjetje ${i + 1}`,
        pravna_oblika: 'd.o.o.',
        posta: 'Ljubljana',
        stevilo_povezav: i + 1
      })
    )

    createFetchResponse([], podjetja)

    renderPage()

    await waitFor(() => {
      expect(
        screen.getAllByTestId('avatar')
      ).toHaveLength(6)
    })

    expect(
      screen.queryByText('Podjetje 7')
    ).not.toBeInTheDocument()

    expect(
      screen.queryByText('Podjetje 8')
    ).not.toBeInTheDocument()
  })

  it('oba endpointa se pokličeta zaradi Promise.all', async () => {
    const calls = []

    global.fetch = vi.fn(url => {
      calls.push(url)

      if (url.includes('/api/osebe')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockOsebe)
        })
      }

      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockPodjetja)
      })
    })

    renderPage()

    await waitFor(() => {
      expect(calls).toHaveLength(2)
    })

    expect(
      calls.some(url =>
        url.includes('/api/osebe?q=test&limit=6')
      )
    ).toBe(true)

    expect(
      calls.some(url =>
        url.includes('/api/podjetja?q=test&limit=6')
      )
    ).toBe(true)
  })

  it('pravilno obdela API odgovor v obliki objekta', async () => {
    global.fetch = vi.fn(url => {
      if (url.includes('/api/osebe')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              osebe: mockOsebe,
              podjetja: []
            })
        })
      }

      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            osebe: [],
            podjetja: mockPodjetja
          })
      })
    })

    renderPage()

    expect( await screen.findByRole('button', { name: /Janez Novak/ }) ).toBeInTheDocument() 
    expect( await screen.findByRole('button', { name: /Test d\.o\.o\./ }) ).toBeInTheDocument()
  })

  it('prikaže napako, če endpoint za osebe ne uspe', async () => {
    global.fetch = vi.fn(url => {
      if (url.includes('/api/osebe')) {
        return Promise.resolve({
          ok: false
        })
      }

      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockPodjetja)
      })
    })

    renderPage()

    expect(
      await screen.findByText(
        'Prišlo je do napake pri iskanju.'
      )
    ).toBeInTheDocument()
  })

  it('prikaže napako, če endpoint za podjetja ne uspe', async () => {
    global.fetch = vi.fn(url => {
      if (url.includes('/api/osebe')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockOsebe)
        })
      }

      return Promise.resolve({
        ok: false
      })
    })

    renderPage()

    expect(
      await screen.findByText(
        'Prišlo je do napake pri iskanju.'
      )
    ).toBeInTheDocument()
  })

  it('prikaže točno sporočilo pri napaki API-ja', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: false
      })
    )

    renderPage()

    expect(
      await screen.findByText(
        'Prišlo je do napake pri iskanju.'
      )
    ).toBeInTheDocument()
  })

  it('pri praznem query parametru fetch ne izvede', () => {
    mockSearch = '?q='

    render(
      <MemoryRouter initialEntries={['/?q=']}>
        <SearchResultsPage />
      </MemoryRouter>
    )

    expect(fetch).not.toHaveBeenCalled()
  })


  it('ponovno prikaže loading ob spremembi iskalnega izraza', async () => { 
    let resolveSecondFetch 
    let callCount = 0 
    global.fetch = vi.fn(url => { callCount++ 
      
      if (callCount <= 2) {
         if (url.includes('/api/osebe')) 
          { return Promise.resolve({ ok: true, json: () => Promise.resolve(mockOsebe) }) 
        } return Promise.resolve({ ok: true, json: () => Promise.resolve(mockPodjetja) }) 
      } return new Promise(resolve => { resolveSecondFetch = resolve }) }) 
      
      const { rerender } = render( <MemoryRouter initialEntries={['/?q=test']}> 
      <SearchResultsPage /> </MemoryRouter> ) 
      await waitFor(() => { expect( screen.getByRole('button', { name: /Janez Novak/ }) ).toBeInTheDocument() 
    }) 
    mockSearch = '?q=drugo' 
    rerender( <MemoryRouter initialEntries={['/?q=drugo']}> 
    <SearchResultsPage /> </MemoryRouter> ) 

    await waitFor(() => { expect( screen.getByText('Nalaganje rezultatov...') ).toBeInTheDocument() })
     expect(fetch).toHaveBeenCalledTimes(4) 
     resolveSecondFetch({ ok: true, json: () => Promise.resolve([]) }) })
})
