import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import Omrezje from '../pages/Omrezje'
import { exportNetworkPdf } from '../utils/generateGrafPdf'

const mockNavigate = vi.fn()

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

vi.mock('../utils/generateGrafPdf', () => ({
  exportNetworkPdf: vi.fn(),
}))

let mockNetworkInstance = null

vi.mock('vis-network', () => {
  class MockNetwork {
    constructor(container, data, options) {
      this.container = container
      this.data = data
      this.options = options
      this.handlers = {}
      this.onceHandlers = {}
      this.fit = vi.fn()
      this.destroy = vi.fn()

      mockNetworkInstance = this
    }

    on(event, callback) {
      this.handlers[event] = callback
    }

    once(event, callback) {
      this.onceHandlers[event] = callback

      setTimeout(() => {
        if (this.onceHandlers[event]) {
          this.onceHandlers[event]()
        }
      }, 0)
    }

    trigger(event, params) {
      if (this.handlers[event]) {
        this.handlers[event](params)
      }
    }
  }

  return {
    Network: MockNetwork,
  }
})

vi.mock('../api', () => ({
  API: 'http://test-api',
}))

const mockData = {
  center: {
    id: 1,
    name: 'Janez Novak',
  },

  nodes: [
    {
      key: 1,
      name: 'Janez Novak',
      type: 'oseba',
      depth: 0,
      id: 1,
    },
    {
      key: 2,
      name: 'Firma d.o.o.',
      type: 'podjetje',
      depth: 1,
      id: 2,
    },
  ],

  edges: [
    {
      from: 1,
      to: 2,
    },
  ],
}

beforeEach(() => {
  vi.clearAllMocks()

  mockNetworkInstance = null

  global.fetch = vi.fn(() =>
    Promise.resolve({
      json: () => Promise.resolve(mockData),
    })
  )
})

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/omrezje/1']}>
      <Routes>
        <Route path="/omrezje/:id" element={<Omrezje />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('Omrezje page', () => {

  it('prikaže loading state', () => {
    renderPage()

    expect(
      screen.getByText(/nalagam omrežje/i)
    ).toBeInTheDocument()
  })

  it('prikaže naslov in statistiko', async () => {
    renderPage()

    expect(
      await screen.findByText('Janez Novak')
    ).toBeInTheDocument()

    expect(
      screen.getByText(/2 vozlišč · 1 povezav/i)
    ).toBeInTheDocument()
  })

  it('prikaže depth gumbe', async () => {
    renderPage()

    expect(
      await screen.findByText('Stopnje:')
    ).toBeInTheDocument()

    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('6')).toBeInTheDocument()
  })

  it('ob API napaki prikaže "Napaka pri nalaganju."', async () => {
    global.fetch = vi.fn(() =>
      Promise.reject(new Error('API napaka'))
    )

    renderPage()

    expect(
      await screen.findByText('Napaka pri nalaganju.')
    ).toBeInTheDocument()
  })

  it('klik na depth 3 spremeni active stanje in pokliče pravilen API URL', async () => {
    const user = userEvent.setup()

    renderPage()

    await screen.findByText('Janez Novak')

    const btn = screen.getByText('3')

    await user.click(btn)

    expect(btn.className).toContain('active')

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        'http://test-api/omrezje/1?depth=3'
      )
    })
  })

  it('klik na depth 4 spremeni active stanje in pokliče pravilen API URL', async () => {
    const user = userEvent.setup()

    renderPage()

    await screen.findByText('Janez Novak')

    const btn = screen.getByText('4')

    await user.click(btn)

    expect(btn.className).toContain('active')

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        'http://test-api/omrezje/1?depth=4'
      )
    })
  })

  it('klik na depth 5 spremeni active stanje in pokliče pravilen API URL', async () => {
    const user = userEvent.setup()

    renderPage()

    await screen.findByText('Janez Novak')

    const btn = screen.getByText('5')

    await user.click(btn)

    expect(btn.className).toContain('active')

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        'http://test-api/omrezje/1?depth=5'
      )
    })
  })

  it('klik na depth 6 spremeni active stanje in pokliče pravilen API URL', async () => {
    const user = userEvent.setup()

    renderPage()

    await screen.findByText('Janez Novak')

    const btn = screen.getByText('6')

    await user.click(btn)

    expect(btn.className).toContain('active')

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        'http://test-api/omrezje/1?depth=6'
      )
    })
  })

  it('več različnih depth sprememb sproži API klic za vsako spremembo', async () => {
    const user = userEvent.setup()

    renderPage()

    await screen.findByText('Janez Novak')

    await user.click(screen.getByText('3'))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        'http://test-api/omrezje/1?depth=3'
      )
    })

    await user.click(screen.getByText('4'))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        'http://test-api/omrezje/1?depth=4'
      )
    })

    await user.click(screen.getByText('5'))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        'http://test-api/omrezje/1?depth=5'
      )
    })

    await user.click(screen.getByText('6'))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        'http://test-api/omrezje/1?depth=6'
      )
    })

    expect(global.fetch).toHaveBeenCalledTimes(5)
  })

  it('prikaže filtre Vse, Osebe in Podjetja', async () => {
    renderPage()

    expect(
      await screen.findByText('Vse')
    ).toBeInTheDocument()

    expect(
      screen.getByText('Osebe')
    ).toBeInTheDocument()

    expect(
      screen.getByText('Podjetja')
    ).toBeInTheDocument()
  })

  it('filter Vse je na začetku aktiven', async () => {
    renderPage()

    const btn = await screen.findByText('Vse')

    expect(btn.className).toContain('active')
  })

  it('klik na filter Osebe spremeni active stanje', async () => {
    const user = userEvent.setup()

    renderPage()

    const vse = await screen.findByText('Vse')
    const osebe = screen.getByText('Osebe')

    await user.click(osebe)

    expect(osebe.className).toContain('active')
    expect(vse.className).not.toContain('active')
  })

  it('klik na filter Podjetja spremeni active stanje', async () => {
    const user = userEvent.setup()

    renderPage()

    const vse = await screen.findByText('Vse')
    const podjetja = screen.getByText('Podjetja')

    await user.click(podjetja)

    expect(podjetja.className).toContain('active')
    expect(vse.className).not.toContain('active')
  })

  it('filter Vse/Osebe/Podjetja se pravilno preklaplja', async () => {
    const user = userEvent.setup()

    renderPage()

    const vse = await screen.findByText('Vse')
    const osebe = screen.getByText('Osebe')
    const podjetja = screen.getByText('Podjetja')

    expect(vse.className).toContain('active')

    await user.click(osebe)

    expect(osebe.className).toContain('active')
    expect(vse.className).not.toContain('active')
    expect(podjetja.className).not.toContain('active')

    await user.click(podjetja)

    expect(podjetja.className).toContain('active')
    expect(osebe.className).not.toContain('active')
    expect(vse.className).not.toContain('active')

    await user.click(vse)

    expect(vse.className).toContain('active')
    expect(osebe.className).not.toContain('active')
    expect(podjetja.className).not.toContain('active')
  })


  it('barvni način Po stopnji je na začetku aktiven', async () => {
    renderPage()

    const btn = await screen.findByText('Po stopnji')

    expect(btn.className).toContain('active')
  })

  it('klik na "Po tipu" spremeni active stanje', async () => {
    const user = userEvent.setup()

    renderPage()

    const poStopnji = await screen.findByText('Po stopnji')
    const poTipu = screen.getByText('Po tipu')

    await user.click(poTipu)

    expect(poTipu.className).toContain('active')
    expect(poStopnji.className).not.toContain('active')
  })

  it('PDF gumb pokliče exportNetworkPdf s pravilnimi parametri', async () => {
    const user = userEvent.setup()

    renderPage()

    await screen.findByText('Janez Novak')

    await user.click(
      screen.getByText(/prenesi pdf/i)
    )

    expect(exportNetworkPdf).toHaveBeenCalledWith(
      expect.objectContaining({
        container: expect.any(HTMLElement),
        title: 'Janez Novak',
        depth: 2,
        filter: 'vse',
        colorMode: 'stopnja',
        stats: {
          nodes: 2,
          edges: 1,
        },
      })
    )
  })

  it('PDF uporabi trenutno izbran depth, filter in colorMode', async () => {
    const user = userEvent.setup()

    renderPage()

    await screen.findByText('Janez Novak')

    await user.click(screen.getByText('4'))
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        'http://test-api/omrezje/1?depth=4'
      )
    })

    await user.click(screen.getByText('Podjetja'))
    await user.click(screen.getByText('Po tipu'))

    await user.click(
      screen.getByText(/prenesi pdf/i)
    )

    expect(exportNetworkPdf).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Janez Novak',
        depth: 4,
        filter: 'podjetje',
        colorMode: 'tip',
        stats: {
          nodes: 2,
          edges: 1,
        },
      })
    )
  })

  it('klik na podjetje node odpre info panel z imenom in tipom', async () => {
    renderPage()

    await screen.findByText('Janez Novak')

    await waitFor(() => {
      expect(mockNetworkInstance).not.toBeNull()
    })

    mockNetworkInstance.trigger('click', {
      nodes: [2],
    })

    expect(
      await screen.findByText('Firma d.o.o.')
    ).toBeInTheDocument()

    expect(
      screen.getByText('Podjetje')
    ).toBeInTheDocument()
  })

  it('klik brez node-a zapre info panel', async () => {
    renderPage()

    await screen.findByText('Janez Novak')

    await waitFor(() => {
      expect(mockNetworkInstance).not.toBeNull()
    })

    mockNetworkInstance.trigger('click', {
      nodes: [1],
    })

    expect(
      await screen.findByText('Oseba')
    ).toBeInTheDocument()

    mockNetworkInstance.trigger('click', {
      nodes: [],
    })

    await waitFor(() => {
      expect(
        screen.queryByText('Oseba')
      ).not.toBeInTheDocument()
    })
  })

  it('klik na ✕ zapre info panel', async () => {
    renderPage()

    await screen.findByText('Janez Novak')

    await waitFor(() => {
      expect(mockNetworkInstance).not.toBeNull()
    })

    mockNetworkInstance.trigger('click', {
      nodes: [1],
    })

    expect(
      await screen.findByText('Oseba')
    ).toBeInTheDocument()

    const closeButton = screen.getByText('✕')

    await userEvent.setup().click(closeButton)

    expect(
      screen.queryByText('Oseba')
    ).not.toBeInTheDocument()
  })

  it('gumb "Profil" navigira na profil osebe', async () => {
    const user = userEvent.setup()

    renderPage()

    const back = await screen.findByText(/profil/i)

    await user.click(back)

    expect(mockNavigate).toHaveBeenCalledWith(
      '/oseba/1'
    )
  })

  it('gumb "Odpri profil" za osebo navigira na /oseba/:id', async () => {
    const user = userEvent.setup()

    renderPage()

    await screen.findByText('Janez Novak')

    await waitFor(() => {
      expect(mockNetworkInstance).not.toBeNull()
    })

    mockNetworkInstance.trigger('click', {
      nodes: [1],
    })

    const openProfile = await screen.findByText(
      /odpri profil/i
    )

    await user.click(openProfile)

    expect(mockNavigate).toHaveBeenCalledWith(
      '/oseba/1'
    )
  })

  it('gumb "Odpri profil" za podjetje navigira na /podjetje/:id', async () => {
    const user = userEvent.setup()

    renderPage()

    await screen.findByText('Janez Novak')

    await waitFor(() => {
      expect(mockNetworkInstance).not.toBeNull()
    })

    mockNetworkInstance.trigger('click', {
      nodes: [2],
    })

    const openProfile = await screen.findByText(
      /odpri profil/i
    )

    await user.click(openProfile)

    expect(mockNavigate).toHaveBeenCalledWith(
      '/podjetje/2'
    )
  })

  it('gumb ⊕ "Prilagodi pogled" pokliče network.fit()', async () => {
    const user = userEvent.setup()

    renderPage()

    await screen.findByText('Janez Novak')

    await waitFor(() => {
      expect(mockNetworkInstance).not.toBeNull()
    })

    mockNetworkInstance.fit.mockClear()

    const fitButton = screen.getByTitle(
      'Prilagodi pogled'
    )

    await user.click(fitButton)

    expect(
      mockNetworkInstance.fit
    ).toHaveBeenCalledWith({
      animation: {
        duration: 500,
        easingFunction: 'easeInOutQuad',
      },
    })
  })

  it('med stabilizacijo prikaže "Razporejam omrežje..."', async () => {
    renderPage()

    await screen.findByText('Janez Novak')

    expect(
      screen.getByText('Razporejam omrežje...')
    ).toBeInTheDocument()
  })

  it('po stabilizaciji odstrani "Razporejam omrežje..."', async () => {
    renderPage()

    await screen.findByText('Janez Novak')

    await waitFor(() => {
      expect(
        screen.queryByText('Razporejam omrežje...')
      ).not.toBeInTheDocument()
    })
  })

  it('po stabilizaciji pokliče network.fit()', async () => {
    renderPage()

    await screen.findByText('Janez Novak')

    await waitFor(() => {
      expect(mockNetworkInstance).not.toBeNull()
      expect(
        mockNetworkInstance.fit
      ).toHaveBeenCalled()
    })
  })

  it('pri praznih nodes in edges podatkih stran ne pade', async () => {
    const emptyData = {
      center: {
        id: 1,
        name: 'Janez Novak',
      },
      nodes: [],
      edges: [],
    }

    global.fetch = vi.fn(() =>
      Promise.resolve({
        json: () => Promise.resolve(emptyData),
      })
    )

    renderPage()

    expect(
      await screen.findByText('Janez Novak')
    ).toBeInTheDocument()

    expect(
      screen.getByText(/0 vozlišč · 0 povezav/i)
    ).toBeInTheDocument()
  })


  it('ob nalaganju pokliče pravilen začetni API endpoint', async () => {
    renderPage()

    await screen.findByText('Janez Novak')

    expect(global.fetch).toHaveBeenCalledWith(
      'http://test-api/omrezje/1?depth=2'
    )
  })

  it('sprememba depth ponovno naloži podatke iz API-ja', async () => {
    const user = userEvent.setup()

    renderPage()

    await screen.findByText('Janez Novak')

    expect(global.fetch).toHaveBeenCalledWith(
      'http://test-api/omrezje/1?depth=2'
    )

    await user.click(screen.getByText('3'))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        'http://test-api/omrezje/1?depth=3'
      )
    })

    expect(
      global.fetch
    ).toHaveBeenCalledTimes(2)
  })
})