import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Asistent from '../pages/Asistent'

vi.mock('../components/Layout', () => ({
  default: ({ children }) => <>{children}</>,
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')

  return {
    ...actual,
    Link: ({ children, to, ...props }) => (
      <a href={to} {...props}>
        {children}
      </a>
    ),
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

            return Promise.resolve({
              done: false,
              value,
            })
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

    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('prikaže začetno AI sporočilo', () => {
    renderPage()

    expect(
      screen.getByText(/Sem AI asistent/i)
    ).toBeInTheDocument()
  })


  it('pritisk tipke Enter pošlje sporočilo', async () => {
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
    await user.keyboard('{Enter}')

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })
  })


  it('Shift + Enter ne pošlje sporočila', async () => {
    const user = userEvent.setup()

    global.fetch = vi.fn()

    renderPage()

    const input = screen.getByPlaceholderText(/Vprašajte/i)

    await user.type(input, 'test vprašanje')
    await user.keyboard('{Shift>}{Enter}{/Shift}')

    expect(global.fetch).not.toHaveBeenCalled()

    expect(input).toHaveValue('test vprašanje\n')
  })


  it('prazen vnos se ne pošlje', async () => {
    const user = userEvent.setup()

    global.fetch = vi.fn()

    renderPage()

    const input = screen.getByPlaceholderText(/Vprašajte/i)

    await user.click(input)
    await user.keyboard('{Enter}')

    expect(global.fetch).not.toHaveBeenCalled()
  })


  it('gumb Pošlji je onemogočen, ko je vnosno polje prazno', () => {
    renderPage()

    const button = screen.getByRole('button', {
      name: /Pošlji/i,
    })

    expect(button).toBeDisabled()
  })


  it('gumb Pošlji je omogočen, ko uporabnik vnese besedilo', async () => {
    const user = userEvent.setup()

    renderPage()

    const input = screen.getByPlaceholderText(/Vprašajte/i)

    const button = screen.getByRole('button', {
      name: /Pošlji/i,
    })

    await user.type(input, 'Pozdrav')

    expect(button).toBeEnabled()
  })


  it('prikaže loading stanje med čakanjem na odgovor', async () => {
    const user = userEvent.setup()

    let resolveFetch

    global.fetch = vi.fn(
      () =>
        new Promise(resolve => {
          resolveFetch = resolve
        })
    )

    renderPage()

    const input = screen.getByPlaceholderText(/Vprašajte/i)

    await user.type(input, 'test')
    await user.click(
      screen.getByRole('button', { name: /Pošlji/i })
    )

    await waitFor(() => {
      expect(
        document.querySelector('.ai-msg-loading')
      ).toBeInTheDocument()
    })

    resolveFetch(
      mockStreamResponse([
        'data: {"chunk":"OK"}',
        'data: {"done":true}',
      ])
    )
  })


  it('predlogi so med loading stanjem onemogočeni', async () => {
    const user = userEvent.setup()

    let resolveFetch

    global.fetch = vi.fn(
      () =>
        new Promise(resolve => {
          resolveFetch = resolve
        })
    )

    renderPage()

    const input = screen.getByPlaceholderText(/Vprašajte/i)

    await user.type(input, 'test')
    await user.click(
      screen.getByRole('button', { name: /Pošlji/i })
    )

    await waitFor(() => {
      const suggestions = screen.getAllByRole('button')

      const suggestion = suggestions.find(button =>
        /Koliko oseb je v bazi/i.test(button.textContent)
      )

      expect(suggestion).toBeDisabled()
    })

    resolveFetch(
      mockStreamResponse([
        'data: {"chunk":"OK"}',
        'data: {"done":true}',
      ])
    )
  })


  it('se vnosno polje po pošiljanju izprazni', async () => {
    const user = userEvent.setup()

    global.fetch = vi.fn(() =>
      mockStreamResponse([
        'data: {"chunk":"OK"}',
        'data: {"done":true}',
      ])
    )

    renderPage()

    const input = screen.getByPlaceholderText(/Vprašajte/i)

    await user.type(input, 'test vprašanje')
    await user.click(
      screen.getByRole('button', { name: /Pošlji/i })
    )

    await waitFor(() => {
      expect(input).toHaveValue('')
    })
  })


  it('prikaže vir odgovora - Groq AI', async () => {
    const user = userEvent.setup()

    global.fetch = vi.fn(() =>
      mockStreamResponse([
        'data: {"vir":"groq"}',
        'data: {"chunk":"Odgovor"}',
        'data: {"done":true}',
      ])
    )

    renderPage()

    await user.type(
      screen.getByPlaceholderText(/Vprašajte/i),
      'test'
    )

    await user.click(
      screen.getByRole('button', { name: /Pošlji/i })
    )

    expect(
      await screen.findByText('Groq AI')
    ).toBeInTheDocument()
  })

  it('prikaže vir odgovora - Gemini', async () => {
    const user = userEvent.setup()

    global.fetch = vi.fn(() =>
      mockStreamResponse([
        'data: {"vir":"gemini"}',
        'data: {"chunk":"Odgovor"}',
        'data: {"done":true}',
      ])
    )

    renderPage()

    await user.type(
      screen.getByPlaceholderText(/Vprašajte/i),
      'test'
    )

    await user.click(
      screen.getByRole('button', { name: /Pošlji/i })
    )

    expect(
      await screen.findByText('Gemini')
    ).toBeInTheDocument()
  })

  it('prikaže vir odgovora - Sistem', async () => {
    const user = userEvent.setup()

    global.fetch = vi.fn(() =>
      mockStreamResponse([
        'data: {"vir":"sistem"}',
        'data: {"chunk":"Odgovor"}',
        'data: {"done":true}',
      ])
    )

    renderPage()

    await user.type(
      screen.getByPlaceholderText(/Vprašajte/i),
      'test'
    )

    await user.click(
      screen.getByRole('button', { name: /Pošlji/i })
    )

    expect(
      await screen.findByText('Sistem')
    ).toBeInTheDocument()
  })


it('prikaže Napaka: ... ko backend vrne error', async () => {
  const user = userEvent.setup()

  global.fetch = vi.fn(() =>
    mockStreamResponse([
      'data: {"error":"Nekaj je šlo narobe."}',
      'data: {"chunk":"Napaka: Nekaj je šlo narobe."}',
    ])
  )

  renderPage()

  await user.type(
    screen.getByPlaceholderText(/Vprašajte/i),
    'test'
  )

  await user.click(
    screen.getByRole('button', { name: /Pošlji/i })
  )

  await waitFor(() => {
    expect(
      screen.getByText('Napaka: Nekaj je šlo narobe.')
    ).toBeInTheDocument()
  })
})


  it('prikaže napako pri klicu strežnika, ko fetch vrže izjemo', async () => {
    const user = userEvent.setup()

    global.fetch = vi.fn(() =>
      Promise.reject(new Error('Network error'))
    )

    renderPage()

    await user.type(
      screen.getByPlaceholderText(/Vprašajte/i),
      'test'
    )

    await user.click(
      screen.getByRole('button', { name: /Pošlji/i })
    )

    expect(
      await screen.findByText(
        /Napaka pri klicu strežnika\./i
      )
    ).toBeInTheDocument()
  })


  it('prikaže Ni odgovora, ko backend ne vrne besedila', async () => {
    const user = userEvent.setup()

    global.fetch = vi.fn(() =>
      mockStreamResponse([
        'data: {"done":true}',
      ])
    )

    renderPage()

    await user.type(
      screen.getByPlaceholderText(/Vprašajte/i),
      'test'
    )

    await user.click(
      screen.getByRole('button', { name: /Pošlji/i })
    )

    expect(
      await screen.findByText('Ni odgovora.')
    ).toBeInTheDocument()
  })


  it('pravilno shrani zgodovino v localStorage', async () => {
    const user = userEvent.setup()

    global.fetch = vi.fn(() =>
      mockStreamResponse([
        'data: {"chunk":"Odgovor"}',
        'data: {"done":true}',
      ])
    )

    renderPage()

    await user.type(
      screen.getByPlaceholderText(/Vprašajte/i),
      'Moje vprašanje'
    )

    await user.click(
      screen.getByRole('button', { name: /Pošlji/i })
    )

    await waitFor(() => {
      const saved = JSON.parse(
        localStorage.getItem('ai-history')
      )

      expect(saved).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            role: 'user',
            text: 'Moje vprašanje',
          }),
        ])
      )
    })
  })


  it('pravilno naloži zgodovino iz localStorage', () => {
    localStorage.setItem(
      'ai-history',
      JSON.stringify([
        {
          role: 'ai',
          text: 'Prejšnji odgovor',
          vir: 'groq',
        },
        {
          role: 'user',
          text: 'Prejšnje vprašanje',
        },
      ])
    )

    renderPage()

    expect(
      screen.getByText('Prejšnji odgovor')
    ).toBeInTheDocument()

    expect(
      screen.getByText('Prejšnje vprašanje')
    ).toBeInTheDocument()
  })


  it('brisanje zgodovine resetira chat in pokliče localStorage.removeItem()', async () => {
    const user = userEvent.setup()

    const removeItemSpy = vi.spyOn(
      Storage.prototype,
      'removeItem'
    )

    renderPage()

    await user.click(
      screen.getByTitle(/Izbriši zgodovino/i)
    )

    expect(removeItemSpy).toHaveBeenCalledWith(
      'ai-history'
    )

    expect(
      screen.getByText(/Sem AI asistent/i)
    ).toBeInTheDocument()
  })


  it('pošlje vprasanje in history v body zahtevka', async () => {
    const user = userEvent.setup()

    global.fetch = vi.fn(() =>
      mockStreamResponse([
        'data: {"chunk":"OK"}',
        'data: {"done":true}',
      ])
    )

    renderPage()

    const input = screen.getByPlaceholderText(/Vprašajte/i)

    await user.type(input, 'Kaj je Povezava.si?')

    await user.click(
      screen.getByRole('button', { name: /Pošlji/i })
    )

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        'http://test-api/ai/vprasaj',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: expect.any(String),
        })
      )

      const [, options] = global.fetch.mock.calls[0]

      const body = JSON.parse(options.body)

      expect(body.vprasanje).toBe(
        'Kaj je Povezava.si?'
      )

      expect(body.history).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            role: 'ai',
          }),
        ])
      )
    })
  })


  it('v zahtevek pošlje samo zadnjih 6 sporočil', async () => {
    const user = userEvent.setup()

    const history = Array.from(
      { length: 10 },
      (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'ai',
        text: `Sporočilo ${i + 1}`,
      })
    )

    localStorage.setItem(
      'ai-history',
      JSON.stringify(history)
    )

    global.fetch = vi.fn(() =>
      mockStreamResponse([
        'data: {"chunk":"OK"}',
        'data: {"done":true}',
      ])
    )

    renderPage()

    await user.type(
      screen.getByPlaceholderText(/Vprašajte/i),
      'Novo vprašanje'
    )

    await user.click(
      screen.getByRole('button', { name: /Pošlji/i })
    )

    await waitFor(() => {
      const [, options] = global.fetch.mock.calls[0]

      const body = JSON.parse(options.body)

      expect(body.history).toHaveLength(6)

      expect(body.history).toEqual(
        history.slice(-6)
      )
    })
  })


  it('ProfilLink se ne prikaže, če profil nima id', async () => {
    const user = userEvent.setup()

    global.fetch = vi.fn(() =>
      mockStreamResponse([
        'data: {"meta":{"podatki":{"profil":{"ime":"Ana","priimek":"Kovač"}}}}',
        'data: {"chunk":"Odgovor"}',
        'data: {"done":true}',
      ])
    )

    renderPage()

    await user.type(
      screen.getByPlaceholderText(/Vprašajte/i),
      'test'
    )

    await user.click(
      screen.getByRole('button', { name: /Pošlji/i })
    )

    await waitFor(() => {
      expect(
        screen.queryByText(/Odpri profil: Ana Kovač/i)
      ).not.toBeInTheDocument()
    })
  })


  it('prikaže profil link, če profil vsebuje id', async () => {
    const user = userEvent.setup()

    global.fetch = vi.fn(() =>
      mockStreamResponse([
        'data: {"meta":{"podatki":{"profil":{"id":10,"ime":"Ana","priimek":"Kovač"}}}}',
        'data: {"chunk":"OK"}',
        'data: {"done":true}',
      ])
    )

    renderPage()

    await user.type(
      screen.getByPlaceholderText(/Vprašajte/i),
      'test'
    )

    await user.click(
      screen.getByRole('button', { name: /Pošlji/i })
    )

    const link = await screen.findByText(
      /Odpri profil: Ana Kovač/i
    )

    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute(
      'href',
      '/oseba/10'
    )
  })


  it('pravilno prikaže Markdown vsebino', async () => {
    const user = userEvent.setup()

    global.fetch = vi.fn(() =>
      mockStreamResponse([
        'data: {"chunk":"**Krepko besedilo**"}',
        'data: {"done":true}',
      ])
    )

    renderPage()

    await user.type(
      screen.getByPlaceholderText(/Vprašajte/i),
      'test'
    )

    await user.click(
      screen.getByRole('button', { name: /Pošlji/i })
    )

    const bold = await screen.findByText(
      'Krepko besedilo'
    )

    expect(bold).toBeInTheDocument()
    expect(bold.tagName).toBe('STRONG')
  })

  it('pravilno prikaže Markdown povezave', async () => {
    const user = userEvent.setup()

    global.fetch = vi.fn(() =>
      mockStreamResponse([
        'data: {"chunk":"[Google](https://google.com)"}',
        'data: {"done":true}',
      ])
    )

    renderPage()

    await user.type(
      screen.getByPlaceholderText(/Vprašajte/i),
      'test'
    )

    await user.click(
      screen.getByRole('button', { name: /Pošlji/i })
    )

    const link = await screen.findByRole(
      'link',
      { name: 'Google' }
    )

    expect(link).toHaveAttribute(
      'href',
      'https://google.com'
    )
  })


  it('Markdown povezave imajo target="_blank" in rel="noopener noreferrer"', async () => {
    const user = userEvent.setup()

    global.fetch = vi.fn(() =>
      mockStreamResponse([
        'data: {"chunk":"[Povezava](https://example.com)"}',
        'data: {"done":true}',
      ])
    )

    renderPage()

    await user.type(
      screen.getByPlaceholderText(/Vprašajte/i),
      'test'
    )

    await user.click(
      screen.getByRole('button', { name: /Pošlji/i })
    )

    const link = await screen.findByRole(
      'link',
      { name: 'Povezava' }
    )

    expect(link).toHaveAttribute(
      'target',
      '_blank'
    )

    expect(link).toHaveAttribute(
      'rel',
      'noopener noreferrer'
    )
  })


  it('po pošiljanju vrne fokus na vnosno polje', async () => {
    const user = userEvent.setup()

    global.fetch = vi.fn(() =>
      mockStreamResponse([
        'data: {"chunk":"Odgovor"}',
        'data: {"done":true}',
      ])
    )

    renderPage()

    const input = screen.getByPlaceholderText(/Vprašajte/i)

    await user.type(input, 'test')

    await user.click(
      screen.getByRole('button', { name: /Pošlji/i })
    )

    await waitFor(() => {
      expect(input).toHaveFocus()
    })
  })


  it('pravilno obdela realen streaming odgovor: meta + vir + chunki + done', async () => {
    const user = userEvent.setup()

    global.fetch = vi.fn(() =>
      mockStreamResponse([
        'data: {"meta":{"podatki":{"profil":{"id":25,"ime":"Janez","priimek":"Novak"}}}}',
        'data: {"vir":"groq"}',
        'data: {"chunk":"To je "}',
        'data: {"chunk":"prvi del "}',
        'data: {"chunk":"odgovora."}',
        'data: {"done":true}',
      ])
    )

    renderPage()

    await user.type(
      screen.getByPlaceholderText(/Vprašajte/i),
      'Povej mi nekaj'
    )

    await user.click(
      screen.getByRole('button', { name: /Pošlji/i })
    )

    await waitFor(() => {
      expect(
        screen.getByText('To je prvi del odgovora.')
      ).toBeInTheDocument()
    })

    expect(
      screen.getByText('Groq AI')
    ).toBeInTheDocument()

    expect(
      screen.getByText(
        /Odpri profil: Janez Novak/i
      )
    ).toBeInTheDocument()
  })

  it('samodejno pomakne pogovor na dno ob novem sporočilu', async () => {
    const user = userEvent.setup()

    global.fetch = vi.fn(() =>
      mockStreamResponse([
        'data: {"chunk":"Novi odgovor"}',
        'data: {"done":true}',
      ])
    )

    renderPage()

    const messagesContainer =
      document.querySelector('.ai-messages')

    expect(messagesContainer).toBeInTheDocument()

    Object.defineProperty(
      messagesContainer,
      'scrollHeight',
      {
        configurable: true,
        value: 1000,
      }
    )

    const scrollTopSetter = vi.fn()

    Object.defineProperty(
      messagesContainer,
      'scrollTop',
      {
        configurable: true,
        get: () => 0,
        set: scrollTopSetter,
      }
    )

    await user.type(
      screen.getByPlaceholderText(/Vprašajte/i),
      'test'
    )

    await user.click(
      screen.getByRole('button', { name: /Pošlji/i })
    )

    await waitFor(() => {
      expect(scrollTopSetter).toHaveBeenCalledWith(1000)
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

    await user.click(
      screen.getByRole('button', { name: /Pošlji/i })
    )

    await waitFor(() => {
      expect(
        screen.getByText(/Živjo svet/i)
      ).toBeInTheDocument()
    })
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

    const [, options] = global.fetch.mock.calls[0]

    const body = JSON.parse(options.body)

    expect(body.vprasanje).toBe(
      'Koliko oseb je v bazi?'
    )
  })
})