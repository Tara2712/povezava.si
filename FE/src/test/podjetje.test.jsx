import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  render,
  screen,
  waitFor,
  within,
  fireEvent,
} from '@testing-library/react'
import {
  MemoryRouter,
  Route,
  Routes,
  useNavigate,
  Link,
} from 'react-router-dom'
import Podjetje from '../pages/Podjetje'
import { generatePodjetjePdf } from '../utils/generatePodjetjePdf'

const mockNavigate = vi.hoisted(() => vi.fn())

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')

  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.mock('../components/Layout', () => ({
  default: ({ children }) => <>{children}</>,
}))

vi.mock('../components/Avatar', () => ({
  default: ({ name }) => <div data-testid="avatar">{name}</div>,
}))

vi.mock('../utils/generatePodjetjePdf', () => ({
  generatePodjetjePdf: vi.fn(),
}))

vi.mock('../api', () => ({
  API: 'http://test-api',
}))

const mockData = {
  id: 1,
  popolno_ime: 'Firma d.o.o.',
  pravna_oblika: 'd.o.o.',
  posta: '1000 Ljubljana',
  maticna: '12345678',
  osebe: [
    {
      oseba_id: 10,
      ime: 'Janez',
      priimek: 'Novak',
      vloga: 'Direktor',
      datum_od: '2020-01-01',
      vir: 'https://example.com',
    },
  ],
}

beforeEach(() => {
  vi.clearAllMocks()

  global.fetch = vi.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve(mockData),
    })
  )
})

function renderPage(id = 1) {
  return render(
    <MemoryRouter initialEntries={[`/podjetje/${id}`]}>
      <Routes>
        <Route
          path="/podjetje/:id"
          element={<Podjetje />}
        />
      </Routes>
    </MemoryRouter>
  )
}

describe('Podjetje page', () => {
  it('prikaže loading state', () => {
    renderPage()

    expect(
      screen.getByText(/nalagam/i)
    ).toBeInTheDocument()
  })

  it('prikaže ime podjetja', async () => {
    renderPage()

    expect(
      await screen.findByRole('heading', {
        name: /Firma d\.o\.o\./i,
      })
    ).toBeInTheDocument()
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
      await screen.findByText('1000 Ljubljana')
    ).toBeInTheDocument()
  })

  it('prikaže matično številko', async () => {
    renderPage()

    expect(
      await screen.findByText('12345678')
    ).toBeInTheDocument()
  })

  it('ne prikaže matične številke, če se začne z AI-', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            ...mockData,
            maticna: 'AI-12345678',
          }),
      })
    )

    renderPage()

    await screen.findByRole('heading', {
      name: /Firma d\.o\.o\./i,
    })

    expect(
      screen.queryByText('AI-12345678')
    ).not.toBeInTheDocument()

    expect(
      screen.queryByText(/matična številka/i)
    ).not.toBeInTheDocument()
  })

  it('prikaže zastopnika', async () => {
    renderPage()

    await screen.findByRole('heading', {
      name: /Firma d\.o\.o\./i,
    })

    const details = Array.from(
      document.querySelectorAll('.detail-item')
    )

    const zastopnikDetail = details.find((item) =>
      item.querySelector('label')?.textContent.includes('Zastopnik')
    )

    expect(zastopnikDetail).toBeDefined()

    expect(
      within(zastopnikDetail).getByText('Janez Novak')
    ).toBeInTheDocument()
  })


  it('prikaže vlogo zastopnika', async () => {
    renderPage()

    const details = await screen.findAllByText('Direktor')

    expect(details).toHaveLength(2)

    const vlogaDetail = Array.from(
      document.querySelectorAll('.detail-item')
    ).find((item) =>
      item.querySelector('label')?.textContent.includes('Vloga')
    )

    expect(vlogaDetail).toBeInTheDocument()
    expect(vlogaDetail).toHaveTextContent('Direktor')
  })


  it('prikaže vir kot povezavo, če je URL', async () => {
    renderPage()

    const link = await screen.findByRole('link', {
      name: /odpri vir/i,
    })

    expect(link).toHaveAttribute(
      'href',
      'https://example.com'
    )

    expect(link).toHaveAttribute(
      'target',
      '_blank'
    )

    expect(link).toHaveAttribute(
      'rel',
      'noopener'
    )
  })

  it('prikaže vir kot navadno besedilo, če ni URL', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            ...mockData,
            osebe: [
              {
                ...mockData.osebe[0],
                vir: 'AJPES',
              },
            ],
          }),
      })
    )

    renderPage()

    expect(
      await screen.findByText('AJPES')
    ).toBeInTheDocument()

    expect(
      screen.queryByRole('link', {
        name: /odpri vir/i,
      })
    ).not.toBeInTheDocument()
  })

  it('klik na gumb "Nazaj" pokliče navigate(-1)', async () => {
    renderPage()

    const button = await screen.findByRole('button', {
      name: /nazaj/i,
    })

    fireEvent.click(button)

    expect(mockNavigate).toHaveBeenCalledWith(-1)
  })

  it('gumb "Prenesi PDF" pokliče generatePodjetjePdf', async () => {
    renderPage()

    const button = await screen.findByRole('button', {
      name: /prenesi pdf/i,
    })

    fireEvent.click(button)

    expect(generatePodjetjePdf).toHaveBeenCalled()
  })

  it('PDF funkcija dobi pravilne podatke podjetja', async () => {
    renderPage()

    const button = await screen.findByRole('button', {
      name: /prenesi pdf/i,
    })

    fireEvent.click(button)

    expect(generatePodjetjePdf).toHaveBeenCalledWith(
      mockData
    )
  })

  it('prikaže več povezanih oseb', async () => {
    const osebe = [
      {
        oseba_id: 10,
        ime: 'Janez',
        priimek: 'Novak',
        vloga: 'Direktor',
        datum_od: '2020-01-01',
        vir: 'https://example.com',
      },
      {
        oseba_id: 11,
        ime: 'Ana',
        priimek: 'Kovač',
        vloga: 'Prokurist',
        datum_od: '2021-05-10',
        vir: 'AJPES',
      },
    ]

    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            ...mockData,
            osebe,
          }),
      })
    )

    renderPage()

    expect(
      await screen.findByText('Povezane osebe (2)')
    ).toBeInTheDocument()

    const cards = await screen.findAllByRole('link')

    const personCards = cards.filter((card) =>
      card.classList.contains('conn-card')
    )

    expect(personCards).toHaveLength(2)

    expect(personCards[0]).toHaveTextContent('Janez Novak')
    expect(personCards[0]).toHaveTextContent('Direktor')

    expect(personCards[1]).toHaveTextContent('Ana Kovač')
    expect(personCards[1]).toHaveTextContent('Prokurist')
  })

  it('povezava na profil osebe uporablja /oseba/:id', async () => {
    renderPage()

    const link = await screen.findByRole('link', {
      name: /Janez Novak/i,
    })

    expect(link).toHaveAttribute(
      'href',
      '/oseba/10'
    )
  })

  it('prikaže datum začetka povezave', async () => {
    renderPage()

    expect(
      await screen.findByText(/od 1\. 1\. 2020/i)
    ).toBeInTheDocument()
  })

  it('formatira datum v pravilni slovenski obliki', async () => {
    renderPage()

    const expectedDate =
      new Date('2020-01-01').toLocaleDateString('sl-SI')

    expect(
      await screen.findByText(
        new RegExp(`od ${expectedDate.replace(/\./g, '\\.')}`, 'i')
      )
    ).toBeInTheDocument()
  })

  it('prikaže podjetje brez povezanih oseb', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            ...mockData,
            osebe: [],
          }),
      })
    )

    renderPage()

    expect(
      await screen.findByText(/ni znanih oseb/i)
    ).toBeInTheDocument()

    expect(
      screen.getByText('Povezane osebe (0)')
    ).toBeInTheDocument()
  })

  it('prikaže error sporočilo pri napaki API klica', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: false,
        json: () => Promise.resolve({}),
      })
    )

    renderPage()

    expect(
      await screen.findByText(/podjetje ni najdeno/i)
    ).toBeInTheDocument()
  })

  it('pravilno obdela API odgovor z ok: false', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: false,
        json: () =>
          Promise.resolve({
            ok: false,
            error: 'Napaka',
          }),
      })
    )

    renderPage()

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        'http://test-api/podjetja/1'
      )
    })

    expect(
      await screen.findByText(/podjetje ni najdeno/i)
    ).toBeInTheDocument()
  })

  it('ponovno naloži podatke ob spremembi id parametra', async () => {
    const fetchMock = vi.fn((url) => {
      const id = url.split('/').pop()

      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            ...mockData,
            id: Number(id),
            popolno_ime:
              id === '1'
                ? 'Prvo podjetje'
                : 'Drugo podjetje',
          }),
      })
    })

    global.fetch = fetchMock

    render(
      <MemoryRouter initialEntries={['/podjetje/1']}>
        <Routes>
          <Route
            path="/podjetje/:id"
            element={
              <>
                <Podjetje />

                <Link to="/podjetje/2">
                  Spremeni ID
                </Link>
              </>
            }
          />
        </Routes>
      </MemoryRouter>
    )

    expect(
      await screen.findByRole('heading', {
        name: 'Prvo podjetje',
      })
    ).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('link', {
        name: 'Spremeni ID',
      })
    )

    expect(
      await screen.findByRole('heading', {
        name: 'Drugo podjetje',
      })
    ).toBeInTheDocument()

    expect(fetchMock).toHaveBeenCalledWith(
      'http://test-api/podjetja/1'
    )

    expect(fetchMock).toHaveBeenCalledWith(
      'http://test-api/podjetja/2'
    )
  })

  it('pravilno prikaže podjetje brez pravne oblike', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            ...mockData,
            pravna_oblika: null,
          }),
      })
    )

    renderPage()

    expect(
      await screen.findByRole('heading', {
        name: /Firma d\.o\.o\./i,
      })
    ).toBeInTheDocument()

    expect(
      screen.queryByText('d.o.o.')
    ).not.toBeInTheDocument()
  })

  it('pravilno prikaže podjetje brez pošte', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            ...mockData,
            posta: null,
          }),
      })
    )

    renderPage()

    expect(
      await screen.findByRole('heading', {
        name: /Firma d\.o\.o\./i,
      })
    ).toBeInTheDocument()

    expect(
      screen.queryByText('1000 Ljubljana')
    ).not.toBeInTheDocument()
  })

  it('pravilno prikaže podjetje brez matične številke', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            ...mockData,
            maticna: null,
          }),
      })
    )

    renderPage()

    expect(
      await screen.findByRole('heading', {
        name: /Firma d\.o\.o\./i,
      })
    ).toBeInTheDocument()

    expect(
      screen.queryByText('12345678')
    ).not.toBeInTheDocument()

    expect(
      screen.queryByText(/matična številka/i)
    ).not.toBeInTheDocument()
  })

  it('pravilno prikaže podjetje brez podatkov zastopnika', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            ...mockData,
            osebe: [
              {
                oseba_id: 10,
                ime: '',
                priimek: '',
                vloga: null,
                datum_od: null,
                vir: null,
              },
            ],
          }),
      })
    )

    renderPage()

    await screen.findByRole('heading', {
      name: /Firma d\.o\.o\./i,
    })

    const details = document.querySelectorAll('.detail-item')

    expect(details).toHaveLength(4)

    const vloga = Array.from(details).find((item) =>
      item.querySelector('label')?.textContent.includes('Vloga')
    )

    const vir = Array.from(details).find((item) =>
      item.querySelector('label')?.textContent.includes('Vir')
    )

    expect(vloga).toHaveTextContent('—')
    expect(vir).toHaveTextContent('—')
  })


  it('pravilno obdela prazen objekt iz API-ja', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      })
    )

    renderPage()

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        'http://test-api/podjetja/1'
      )
    })

    expect(
      await screen.findByText('Povezane osebe (0)')
    ).toBeInTheDocument()

    expect(
      screen.queryByText(/ni znanih oseb/i)
    ).not.toBeInTheDocument()
  })

  it('fetch se pokliče za pravilno podjetje', async () => {
    renderPage()

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        'http://test-api/podjetja/1'
      )
    })
  })

  it('prikaže PDF gumb', async () => {
    renderPage()

    expect(
      await screen.findByRole('button', {
        name: /prenesi pdf/i,
      })
    ).toBeInTheDocument()
  })
})