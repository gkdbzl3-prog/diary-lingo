import React from 'react';

export default function Notes({ notes }) {
  const vocab = notes?.vocab ?? [];
  const highlights = notes?.highlights ?? [];
  if (vocab.length === 0 && highlights.length === 0) return null;

  return (
    <section className="notes">
      {vocab.length > 0 ? (
        <>
          <h2>어휘·표현</h2>
          <table className="vocab">
            <tbody>
              {vocab.map((v, i) => (
                <tr key={i}>
                  <th>{v.expr}</th>
                  <td className="vocab-reading">{v.reading}</td>
                  <td>{v.meaning}</td>
                  <td className="vocab-sid">#{v.sid}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}

      {highlights.length > 0 ? (
        <>
          <h2>짚어볼 표현</h2>
          <dl className="highlights">
            {highlights.map((h, i) => (
              <div key={i}>
                <dt>
                  {h.title} <span className="vocab-sid">#{h.sid}</span>
                </dt>
                <dd>{h.body}</dd>
              </div>
            ))}
          </dl>
        </>
      ) : null}
    </section>
  );
}
