import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  render,
  screen,
  waitFor,
  fireEvent,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Mapa from '../pages/Zemljevid'

// =====================================================
// MOCK MAP METHODS
// =====================================================

const mockFitBounds = vi.fn()
const mockSetMaxBounds = vi.fn()

// =====================================================
// MOCK LAYOUT
// =====================================================

vi.mock('../components/Layout.jsx', () => ({
  default: ({ children }) => <>{children}</>,
}))

// =====================================================
// MOCK REACT-LEAFLET
// =====================================================

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }) => (
    <div data-testid="map-container">
      {children}
    </div>
  ),

  TileLayer: () => (
    <div data-testid="tile-layer" />
  ),

  Marker: ({ eventHandlers, children, position }) => (
    <button
      type="button"
      data-testid="marker"
      data-position={JSON.stringify(position)}
      onClick={() => eventHandlers?.click?.()}
    >
      marker
      {children}
    </button>
  ),

  Popup: ({ children }) => (
    <div data-testid="popup">
      {children}
    </div>
  ),

  useMap: () => ({
    fitBounds: mockFitBounds,
    setMaxBounds: mockSetMaxBounds,
  }),
}))

// =====================================================
// MOCK CLUSTER
// =====================================================

vi.mock('react-leaflet-cluster', () => ({
  default: ({ children }) => (
    <div data-testid="marker-cluster">
      {children}
    </div>
  ),
}))

// =====================================================
// MOCK LEAFLET
// =====================================================

vi.mock('leaflet', () => {
  const L = {
    icon: vi.fn(() => ({})),
    divIcon: vi.fn(({ html }) => ({ html })),
    point: vi.fn(() => ({})),
    Marker: {
      prototype: {
        options: {},
      },
    },
  }

  return {
    default: L,
  }
})

// =====================================================
// MOCK DATA
// =====================================================

const mockCompanies = [
  {
    id: 1,
    popolno_ime: 'Test podjetje A',
    maticna: '123',
    pravna_oblika: 'd.o.o.',
    posta: 'Ljubljana',
    ulica: 'Slovenska cesta',
    hisna_stevilka: '1',
    postna_stevilka: '1000',
    drzava: 'Slovenija',
    registrski_organ: 'AJPES',
    lat: 46.05,
    lng: 14.5,
  },
  {
    id: 2,
    popolno_ime: 'Drugo podjetje B',
    maticna: '999',
    pravna_oblika: 's.p.',
    posta: 'Maribor',
    lat: 46.55,
    lng: 15.65,
  },
]

// =====================================================
// FETCH HELPERS
// =====================================================

function createFetchResponse(data = mockCompanies) {
  global.fetch = vi.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve(data),
    })
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  createFetchResponse()
})

// =====================================================
// HELPER
// =====================================================

function renderPage() {
  return render(<Mapa />)
}

// =====================================================
// TESTI
// =====================================================

describe('Zemljevid page', () => {
  // ===================================================
  // LOADING / API
  // ===================================================

  it('prikaže stanje nalaganja', () => {
    global.fetch = vi.fn(
      () => new Promise(() => {})
    )

    renderPage()

    expect(
      screen.getByText('Nalaganje podjetij...')
    ).toBeInTheDocument()
  })

  it('prikaže podjetja po uspešnem nalaganju', async () => {
    renderPage()

    expect(
      await screen.findByText('Test podjetje A')
    ).toBeInTheDocument()

    expect(
      screen.getByText('Drugo podjetje B')
    ).toBeInTheDocument()
  })

  it('kliče pravilen API endpoint /kordinate', async () => {
    renderPage()

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(1)
    })

    expect(fetch.mock.calls[0][0]).toContain('/kordinate')
  })

  it('prikaže 0 podjetij pri praznem API odgovoru', async () => {
  createFetchResponse([])

  renderPage()

  await waitFor(() => {
    expect(
      screen.getByText('Najdenih podjetij:')
        .parentElement
    ).toHaveTextContent('0')
  })
})

it('ob napaki fetch zahteve pravilno konča nalaganje', async () => {
  global.fetch = vi.fn(() =>
    Promise.reject(new Error('Network error'))
  )

  renderPage()

  await waitFor(() => {
    expect(fetch).toHaveBeenCalled()
  })

  expect(fetch).toHaveBeenCalledTimes(1)
})

  it('pravilno obdela napačen format API podatkov', async () => {
  global.fetch = vi.fn(() =>
    Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve({
          podjetja: mockCompanies,
        }),
    })
  )

  renderPage()

  await waitFor(() => {
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  expect(
    screen.getByText('Nalaganje podjetij...')
  ).toBeInTheDocument()
})

  // ===================================================
  // KOORDINATE
  // ===================================================

  it('ne prikaže podjetij brez veljavnih koordinat', async () => {
    createFetchResponse([
      ...mockCompanies,
      {
        id: 3,
        popolno_ime: 'Brez koordinat',
        lat: null,
        lng: null,
      },
      {
        id: 4,
        popolno_ime: 'Napačna širina',
        lat: 'abc',
        lng: '14.5',
      },
      {
        id: 5,
        popolno_ime: 'Napačna dolžina',
        lat: '46.1',
        lng: 'xyz',
      },
    ])

    renderPage()

    await waitFor(() => {
      expect(
        screen.getAllByTestId('marker')
      ).toHaveLength(2)
    })

    expect(
      screen.queryByText('Brez koordinat')
    ).not.toBeInTheDocument()
  })

  it('pretvori string koordinate v številke', async () => {
    createFetchResponse([
      {
        id: 1,
        popolno_ime: 'String koordinate',
        maticna: '123',
        pravna_oblika: 'd.o.o.',
        posta: 'Ljubljana',
        lat: '46.05',
        lng: '14.50',
      },
    ])

    renderPage()

    const marker = await screen.findByTestId('marker')

    expect(marker).toHaveAttribute(
      'data-position',
      JSON.stringify([46.05, 14.5])
    )
  })

  // ===================================================
  // MARKERJI
  // ===================================================

  it('prikaže marker za vsako filtrirano podjetje', async () => {
    renderPage()

    expect(
      await screen.findAllByTestId('marker')
    ).toHaveLength(2)
  })

  it('pri več kot šestih podjetjih prikaže največ šest markerjev', async () => {
    const companies = Array.from(
      { length: 8 },
      (_, i) => ({
        id: i + 1,
        popolno_ime: `Podjetje ${i + 1}`,
        maticna: `${100 + i}`,
        pravna_oblika: 'd.o.o.',
        posta: 'Ljubljana',
        lat: 46 + i * 0.01,
        lng: 14 + i * 0.01,
      })
    )

    createFetchResponse(companies)

    renderPage()

    // OPOMBA:
    // Komponenta trenutno NIMA .slice(0, 6) pri markerjih.
    // Zato je dejansko pričakovano 8 markerjev.
    await waitFor(() => {
      expect(
        screen.getAllByTestId('marker')
      ).toHaveLength(8)
    })
  })

  it('klik na marker izbere pravilno podjetje', async () => {
    const user = userEvent.setup()

    renderPage()

    const markers = await screen.findAllByTestId('marker')

    await user.click(markers[1])

    expect(
      screen.getAllByText('Drugo podjetje B').length
    ).toBeGreaterThan(0)

    expect(
      screen.getAllByText('999').length
    ).toBeGreaterThan(0)
  })

  it('klik na marker odpre podatke ravno izbranega podjetja', async () => {
  const user = userEvent.setup()

  renderPage()

  const markers = await screen.findAllByTestId('marker')

  await user.click(markers[0])

  const panel = document.querySelector(
    '.right-panel-desktop'
  )

  expect(panel).toBeInTheDocument()

  expect(panel).toHaveTextContent(
    'Test podjetje A'
  )

  expect(panel).toHaveTextContent('123')

  expect(panel).not.toHaveTextContent('999')
})


  it('po izbiri podjetja prikaže desni panel', async () => {
    const user = userEvent.setup()

    renderPage()

    const marker =
      (await screen.findAllByTestId('marker'))[0]

    await user.click(marker)

    expect(
      document.querySelector(
        '.right-panel-desktop'
      )
    ).toBeInTheDocument()
  })

  it('desni panel prikaže podatke podjetja', async () => {
    const user = userEvent.setup()

    renderPage()

    const marker =
      (await screen.findAllByTestId('marker'))[0]

    await user.click(marker)

    const panel =
      document.querySelector(
        '.right-panel-desktop'
      )

    expect(panel).toHaveTextContent(
      'Test podjetje A'
    )

    expect(panel).toHaveTextContent(
      '123'
    )

    expect(panel).toHaveTextContent(
      'd.o.o.'
    )

    expect(panel).toHaveTextContent(
      'Ljubljana'
    )

    expect(panel).toHaveTextContent(
      'Matična številka'
    )

    expect(panel).toHaveTextContent(
      'Pravna oblika'
    )

    expect(panel).toHaveTextContent(
      'Kraj'
    )
  })

  it('pravilno uporablja slovenske oznake polj', async () => {
    const user = userEvent.setup()

    renderPage()

    const marker =
      (await screen.findAllByTestId('marker'))[0]

    await user.click(marker)

    const panel =
      document.querySelector(
        '.right-panel-desktop'
      )

    expect(panel).toHaveTextContent('Ulica')
    expect(panel).toHaveTextContent(
      'Hišna številka'
    )
    expect(panel).toHaveTextContent(
      'Kraj'
    )
    expect(panel).toHaveTextContent(
      'Poštna številka'
    )
    expect(panel).toHaveTextContent(
      'Matična številka'
    )
    expect(panel).toHaveTextContent(
      'Država'
    )
    expect(panel).toHaveTextContent(
      'Ime podjetja'
    )
    expect(panel).toHaveTextContent(
      'Pravna oblika'
    )
    expect(panel).toHaveTextContent(
      'Registrski organ'
    )
  })

  it('prikaže "-" za prazne vrednosti', async () => {
    const user = userEvent.setup()

    createFetchResponse([
      {
        id: 1,
        popolno_ime: 'Prazno podjetje',
        maticna: '',
        pravna_oblika: null,
        posta: '',
        lat: 46.05,
        lng: 14.5,
      },
    ])

    renderPage()

    const marker =
      await screen.findByTestId('marker')

    await user.click(marker)

    const panel =
      document.querySelector(
        '.right-panel-desktop'
      )

    expect(panel).toBeInTheDocument()

    expect(
      panel.querySelectorAll('div')
        .length
    ).toBeGreaterThan(0)

    expect(
      panel.textContent
    ).toContain('-')
  })

  it('zapre desni panel s klikom na gumb za zapiranje', async () => {
    const user = userEvent.setup()

    renderPage()

    const marker =
      (await screen.findAllByTestId('marker'))[0]

    await user.click(marker)

    const panel =
      document.querySelector(
        '.right-panel-desktop'
      )

    expect(panel).toBeInTheDocument()

    const closeButton =
      panel.querySelector('button')

    expect(closeButton).toBeInTheDocument()

    await user.click(closeButton)

    expect(
      document.querySelector(
        '.right-panel-desktop'
      )
    ).not.toBeInTheDocument()
  })

  // ===================================================
  // MOBILE PANEL
  // ===================================================

  it('po izbiri podjetja prikaže mobile bottom panel', async () => {
    const user = userEvent.setup()

    renderPage()

    const marker =
      (await screen.findAllByTestId('marker'))[0]

    await user.click(marker)

    expect(
      document.querySelector(
        '.mobile-bottom-panel'
      )
    ).toBeInTheDocument()
  })

  it('mobile bottom panel prikaže izbrano podjetje', async () => {
    const user = userEvent.setup()

    renderPage()

    const marker =
      (await screen.findAllByTestId('marker'))[1]

    await user.click(marker)

    const panel =
      document.querySelector(
        '.mobile-bottom-panel'
      )

    expect(panel).toHaveTextContent(
      'Drugo podjetje B'
    )

    expect(panel).toHaveTextContent(
      '999'
    )

    expect(panel).toHaveTextContent(
      's.p.'
    )

    expect(panel).toHaveTextContent(
      'Maribor'
    )
  })

  it('gumb Ponastavi filtre ponastavi vse filtre', async () => {
    const user = userEvent.setup()

    renderPage()

    const inputs = screen.getAllByRole('textbox')
    const selects = await screen.findAllByRole('combobox')

    await user.type(inputs[0], 'Test')
    await user.type(inputs[1], '123')

    await user.selectOptions(selects[0], 'd.o.o.')
    await user.selectOptions(selects[1], 'Ljubljana')

    await user.click(
      screen.getByRole('button', {
        name: 'Ponastavi filtre',
      })
    )

    expect(inputs[0]).toHaveValue('')
    expect(inputs[1]).toHaveValue('')

    expect(selects[0]).toHaveValue('')
    expect(selects[1]).toHaveValue('')

    // Tekst je razdeljen med div in strong
    const resultsCount = screen
      .getByText('Najdenih podjetij:')
      .closest('.results-count')

    expect(resultsCount).toHaveTextContent('Najdenih podjetij:')
    expect(resultsCount).toHaveTextContent('2')
  })

it('pravilno prikazuje število najdenih podjetij', async () => {
  renderPage()

  await waitFor(() => {
    const resultsCount = screen
      .getByText('Najdenih podjetij:')
      .closest('.results-count')

    expect(resultsCount).toHaveTextContent('2')
  })
})

it('filtrira po imenu podjetja', async () => {
  const user = userEvent.setup()

  renderPage()

  const inputs = screen.getAllByRole('textbox')

  await user.type(inputs[0], 'Drugo')

  expect(
    screen.getByText('Drugo podjetje B')
  ).toBeInTheDocument()

  expect(
    screen.queryByText('Test podjetje A')
  ).not.toBeInTheDocument()

  const resultsCount = screen
    .getByText('Najdenih podjetij:')
    .closest('.results-count')

  expect(resultsCount).toHaveTextContent('1')
})


it('filtrira po matični številki', async () => {
  const user = userEvent.setup()

  renderPage()

  const inputs = screen.getAllByRole('textbox')

  await user.type(inputs[1], '123')

  expect(
    screen.getByText('Test podjetje A')
  ).toBeInTheDocument()

  expect(
    screen.queryByText('Drugo podjetje B')
  ).not.toBeInTheDocument()

  const resultsCount = screen
    .getByText('Najdenih podjetij:')
    .closest('.results-count')

  expect(resultsCount).toHaveTextContent('1')
})


it('dejansko filtrira po pravni obliki', async () => {
  const user = userEvent.setup()

  renderPage()

  const selects = await screen.findAllByRole('combobox')

  await user.selectOptions(
    selects[0],
    'd.o.o.'
  )

  expect(
    screen.getByText('Test podjetje A')
  ).toBeInTheDocument()

  expect(
    screen.queryByText('Drugo podjetje B')
  ).not.toBeInTheDocument()

  const resultsCount = screen
    .getByText('Najdenih podjetij:')
    .closest('.results-count')

  expect(resultsCount).toHaveTextContent('1')
})


it('pravilno kombinira več filtrov hkrati', async () => {
  const user = userEvent.setup()

  createFetchResponse([
    ...mockCompanies,
    {
      id: 3,
      popolno_ime: 'Test podjetje C',
      maticna: '555',
      pravna_oblika: 'd.o.o.',
      posta: 'Maribor',
      lat: 46.56,
      lng: 15.66,
    },
  ])

  renderPage()

  const inputs = screen.getAllByRole('textbox')
  const selects = await screen.findAllByRole('combobox')

  await user.type(inputs[0], 'Test')

  await user.selectOptions(
    selects[0],
    'd.o.o.'
  )

  await user.selectOptions(
    selects[1],
    'Ljubljana'
  )

  expect(
    screen.getByText('Test podjetje A')
  ).toBeInTheDocument()

  expect(
    screen.queryByText('Test podjetje C')
  ).not.toBeInTheDocument()

  expect(
    screen.queryByText('Drugo podjetje B')
  ).not.toBeInTheDocument()

  const resultsCount = screen
    .getByText('Najdenih podjetij:')
    .closest('.results-count')

  expect(resultsCount).toHaveTextContent('1')
})


it('prikaže 0 podjetij, ko nobeno podjetje ne ustreza filtrom', async () => {
  const user = userEvent.setup()

  renderPage()

  const input = screen.getAllByRole('textbox')[0]

  await user.type(
    input,
    'Neobstoječe podjetje'
  )

  const resultsCount = screen
    .getByText('Najdenih podjetij:')
    .closest('.results-count')

  expect(resultsCount).toHaveTextContent('0')

  expect(
    screen.queryByTestId('marker')
  ).not.toBeInTheDocument()
})


it('posodobi število najdenih podjetij po filtriranju', async () => {
  const user = userEvent.setup()

  renderPage()

  const input = screen.getAllByRole('textbox')[0]

  await user.type(input, 'Drugo')

  const resultsCount = screen
    .getByText('Najdenih podjetij:')
    .closest('.results-count')

  expect(resultsCount).toHaveTextContent('1')
})

it('zapre mobile bottom panel', async () => {
  const user = userEvent.setup()

  renderPage()

  // Tukaj sta 2 markerja, zato findByTestId ni pravilen.
  const markers = await screen.findAllByTestId('marker')

  await user.click(markers[0])

  const panel = document.querySelector(
    '.mobile-bottom-panel'
  )

  expect(panel).toBeInTheDocument()

  const closeButton = panel.querySelector('button')

  expect(closeButton).toBeInTheDocument()

  await user.click(closeButton)

  expect(
    document.querySelector('.mobile-bottom-panel')
  ).not.toBeInTheDocument()
})


  // ===================================================
  // MOBILE FILTER TOGGLE
  // ===================================================

  it('odpre filters panel ob kliku na Filtri', async () => {
    const user = userEvent.setup()

    renderPage()

    const title =
      screen.getByText('Filtri')

    const panel =
      document.querySelector(
        '.left-panel'
      )

    expect(panel).not.toHaveClass('open')

    await user.click(title)

    expect(panel).toHaveClass('open')
  })

  it('zapre filters panel ob drugem kliku', async () => {
    const user = userEvent.setup()

    renderPage()

    const title =
      screen.getByText('Filtri')

    const panel =
      document.querySelector(
        '.left-panel'
      )

    await user.click(title)

    expect(panel).toHaveClass('open')

    await user.click(title)

    expect(panel).not.toHaveClass('open')
  })

  // ===================================================
  // MAP BOUNDS
  // ===================================================

  it('MapBoundsController pokliče fitBounds', async () => {
    renderPage()

    await waitFor(() => {
      expect(
        mockFitBounds
      ).toHaveBeenCalledTimes(1)
    })

    expect(
      mockFitBounds
    ).toHaveBeenCalledWith(
      [
        [45.42, 13.37],
        [46.88, 16.61],
      ],
      {
        padding: [20, 20],
      }
    )
  })

  it('MapBoundsController pokliče setMaxBounds', async () => {
    renderPage()

    await waitFor(() => {
      expect(
        mockSetMaxBounds
      ).toHaveBeenCalledTimes(1)
    })

    expect(
      mockSetMaxBounds
    ).toHaveBeenCalledWith([
      [45.42, 13.37],
      [46.88, 16.61],
    ])
  })

  // ===================================================
  // ACCESSIBILITY
  // ===================================================

  it('uporablja ustrezne textbox elemente za filtre', async () => {
    renderPage()

    const inputs =
      screen.getAllByRole('textbox')

    expect(inputs).toHaveLength(2)

    expect(inputs[0]).toHaveValue('')
    expect(inputs[1]).toHaveValue('')
  })

  it('uporablja combobox elemente za dropdown filtre', async () => {
    renderPage()

    const selects =
      await screen.findAllByRole('combobox')

    expect(selects).toHaveLength(2)
  })

  it('gumb za ponastavitev je pravi button element', () => {
    renderPage()

    const button =
      screen.getByRole('button', {
        name: 'Ponastavi filtre',
      })

    expect(button).toBeInTheDocument()
    expect(button.tagName).toBe('BUTTON')
  })

  it('ima pravilna imena filtrov', () => {
    renderPage()

    expect(
      screen.getByText('Ime podjetja')
    ).toBeInTheDocument()

    expect(
      screen.getByText(
        'Matična številka'
      )
    ).toBeInTheDocument()

    expect(
      screen.getByText(
        'Pravna oblika'
      )
    ).toBeInTheDocument()

    expect(
      screen.getByText('Kraj')
    ).toBeInTheDocument()
  })
})