import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Asistent from '../pages/Asistent'

vi.mock('../components/Layout', () => ({
  default: ({ children }) => <div>{children}</div>,
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    Link: ({ children, to }) => <a href={to}>{children}</a>,
  }
})

vi.mock('../api', () => ({
  API: 'http://test-api',
}))

function mockStreamResponse(chunks) {
  const encoder = new TextEncoder()

  return {
    body: {
      getReader() {
        let i = 0
        return {
          read() {
            if (i >= chunks.length) {
              return Promise.resolve({ done: true })
            }

            const value = encoder.encode(chunks[i++] + '\n')
            return Promise.resolve({ done: false, value })
          },
        }
      },
    },
  }
}

function renderPage() {
  return render(<Asistent />)
}

describe('Asistent page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
  })

  it('prikaže začetno AI sporočilo', () => {
    renderPage()

    expect(
      screen.getByText(/Sem AI asistent/i)
    ).toBeInTheDocument()
  })

  it('pošiljanje vprašanja sproži fetch', async () => {
    const user = userEvent.setup()

    global.fetch = vi.fn(() =>
      mockStreamResponse([
        'data: {"chunk":"Odgovor"}',
        'data: {"done":true}',
      ])
    )

    renderPage()

    const input = screen.getByPlaceholderText(/Vprašajte/i)
    await user.type(input, 'test vprašanje')

    await user.click(screen.getByRole('button', { name: /Pošlji/i }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1)
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/ai/vprasaj'),
        expect.objectContaining({
          method: 'POST',
        })
      )
    })
  })

  it('prikaže streaming odgovor', async () => {
    const user = userEvent.setup()

    global.fetch = vi.fn(() =>
      mockStreamResponse([
        'data: {"chunk":"Živjo "}',
        'data: {"chunk":"svet"}',
        'data: {"done":true}',
      ])
    )

    renderPage()

    const input = screen.getByPlaceholderText(/Vprašajte/i)
    await user.type(input, 'hello')

    await user.click(screen.getByRole('button', { name: /Pošlji/i }))

    await waitFor(() => {
      expect(screen.getByText(/Živjo svet/i)).toBeInTheDocument()
    })
  })

  it('prikaže profil link iz meta podatkov', async () => {
    const user = userEvent.setup()

    global.fetch = vi.fn(() =>
      mockStreamResponse([
        'data: {"meta":{"podatki":{"profil":{"id":10,"ime":"Ana","priimek":"Kovač"}}}}',
        'data: {"chunk":"OK"}',
        'data: {"done":true}',
      ])
    )

    renderPage()

    await user.type(screen.getByPlaceholderText(/Vprašajte/i), 'test')
    await user.click(screen.getByRole('button', { name: /Pošlji/i }))

    expect(
      await screen.findByText(/Odpri profil: Ana Kovač/i)
    ).toBeInTheDocument()
  })

  it('clear history resetira chat', async () => {
    const user = userEvent.setup()

    renderPage()

    await user.click(screen.getByTitle(/Izbriši zgodovino/i))

    expect(
      screen.getByText(/Sem AI asistent/i)
    ).toBeInTheDocument()
  })

  it('predlogi sprožijo send', async () => {
    const user = userEvent.setup()

    global.fetch = vi.fn(() =>
      mockStreamResponse([
        'data: {"chunk":"OK"}',
        'data: {"done":true}',
      ])
    )

    renderPage()

    const suggestion = screen.getByRole('button', {
      name: /Koliko oseb je v bazi/i,
    })

    await user.click(suggestion)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled()
    })
  })
})