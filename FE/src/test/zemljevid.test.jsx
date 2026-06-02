import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Mapa from '../pages/Zemljevid'

// mocks

vi.mock('../components/Layout.jsx', () => ({
  default: ({ children }) => <div>{children}</div>,
}))

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }) => <div data-testid="map">{children}</div>,
  TileLayer: () => null,
  Marker: ({ children, eventHandlers }) => (
    <button
      data-testid="marker"
      onClick={() => eventHandlers?.click?.()}
    >
      marker
      {children}
    </button>
  ),
  Popup: ({ children }) => <div>{children}</div>,
  useMap: () => ({
    fitBounds: vi.fn(),
    setMaxBounds: vi.fn(),
  }),
}))

vi.mock('react-leaflet-cluster', () => ({
  default: ({ children }) => <div>{children}</div>,
}))


vi.mock('leaflet', () => {
  const L = {
    icon: vi.fn(() => ({})),
    divIcon: vi.fn(({ html }) => ({ html })),
    point: vi.fn(() => ({})),
    Marker: { prototype: { options: {} } },
  }
  return { default: L }
})

// fetch mock

const mockCompanies = [
  {
    id: 1,
    popolno_ime: 'Test podjetje A',
    maticna: '123',
    pravna_oblika: 'd.o.o.',
    posta: 'Ljubljana',
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

beforeEach(() => {
  vi.clearAllMocks()

  global.fetch = vi.fn(() =>
    Promise.resolve({
      json: () => Promise.resolve(mockCompanies),
    })
  )
})


function renderPage() {
  return render(<Mapa />)
}

// testi

describe('Zemljevid page', () => {
    it('prikaže podjetja po nalaganju', async () => {
    renderPage()

    expect(
        await screen.findByText('Test podjetje A')
    ).toBeInTheDocument()
    })

  it('prikaže markerje za podjetja', async () => {
    renderPage()

    const markers = await screen.findAllByTestId('marker')
    expect(markers).toHaveLength(2)
  })


it('filtrira po imenu podjetja', async () => {
  renderPage()

  const inputs = screen.getAllByRole('textbox')
  const nameInput = inputs[0]

  await userEvent.type(nameInput, 'Drugo')

  expect(screen.getByText('1')).toBeInTheDocument()
})

it('filtrira po matični številki', async () => {
  renderPage()

  const inputs = screen.getAllByRole('textbox')
  const maticnaInput = inputs[1]

  await userEvent.type(maticnaInput, '123')

  expect(screen.getByText('1')).toBeInTheDocument()
})

it('resetira filtre', async () => {
  renderPage()

  const inputs = screen.getAllByRole('textbox')
  const nameInput = inputs[0]

  await userEvent.type(nameInput, 'Test')

  await userEvent.click(
    screen.getByText(/Ponastavi filtre/i)
  )

  expect(nameInput).toHaveValue('')
})

    it('prikaže selekcijo pravne oblike', async () => {
    renderPage()

    const select = await screen.findAllByRole('combobox')
    const pravnaSelect = select[0]

    await waitFor(() => {
        expect(pravnaSelect).toContainHTML('d.o.o.')
    })

    await userEvent.selectOptions(pravnaSelect, 'd.o.o.')

    expect(pravnaSelect).toHaveValue('d.o.o.')
    })

    it('prikaže selekcijo kraja', async () => {
    renderPage()

    const selects = await screen.findAllByRole('combobox')
    const krajSelect = selects[1]

    await waitFor(() => {
        expect(krajSelect).toContainHTML('Ljubljana')
    })

    await userEvent.selectOptions(krajSelect, 'Ljubljana')

    expect(krajSelect).toHaveValue('Ljubljana')
    })

  it('odpre in zapre filters panel (mobile toggle)', async () => {
    renderPage()

    const title = screen.getByText('Filtri')

    await userEvent.click(title)

    const panel = document.querySelector('.left-panel')
    expect(panel.className).toContain('open')
  })
})