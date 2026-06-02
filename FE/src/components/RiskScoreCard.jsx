export default function RiskScoreCard({ data, loading }) {
  if (loading) {
    return (
      <div className="risk-card">
        <div className="risk-loading">Nalagam indikatorje tveganja…</div>
      </div>
    )
  }

  if (!data) return null

  const { score, stopnja, indikatorji, razlaga } = data

  return (
    <div className={`risk-card risk-card-${stopnja}`}>
      <div className="risk-head">
        <div>
          <div className="risk-kicker">Indikatorji izpostavljenosti</div>
          <h2 className="risk-title">Stopnja tveganja</h2>
          <div className={`risk-level risk-text-${stopnja}`}>
            {stopnja}
          </div>
        </div>

        <div className="risk-score-circle">
          <span className="risk-score-num">{score}</span>
          <span className="risk-score-max">/100</span>
        </div>
      </div>

      <div className="risk-bar">
        <div
          className={`risk-fill risk-fill-${stopnja}`}
          style={{ width: `${score}%` }}
        />
      </div>

      <div className="risk-grid">
        <div className="risk-metric">
          <strong>{indikatorji.st_funkcij}</strong>
          <span>vseh funkcij</span>
        </div>

        <div className="risk-metric">
          <strong>{indikatorji.aktivne_funkcije}</strong>
          <span>aktivnih funkcij</span>
        </div>

        <div className="risk-metric">
          <strong>{indikatorji.je_lobist ? 'Da' : 'Ne'}</strong>
          <span>lobist</span>
        </div>

        <div className="risk-metric">
          <strong>{indikatorji.je_ovaden ? 'Da' : 'Ne'}</strong>
          <span>ovaden</span>
        </div>
      </div>

      {razlaga?.length > 0 && (
        <div className="risk-explain">
          <div className="risk-explain-title">Zakaj takšna ocena?</div>
          <ul>
            {razlaga.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      <p className="risk-note">
        Ocena je avtomatski indikator izpostavljenosti na podlagi podatkov v bazi.
        Ne predstavlja pravne ugotovitve krivde ali odgovornosti.
      </p>
    </div>
  )
}