    function IncidentTelemetryPanel({ telemetry, tt, onCopyDump, onResetTelemetry }) {
      return React.createElement('div', {
        style: { padding: '12px 14px', margin: '14px 0', background: 'color-mix(in srgb, var(--dsw-alias-label-primary) 2%, transparent)', borderRadius: 8, border: '1px solid var(--dsw-alias-border-l2)' }
      },
        React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 } },
          React.createElement('span', { style: { fontSize: 13, fontWeight: 600, color: 'var(--dsw-alias-label-primary)' } }, tt('telemetryTitle')),
          React.createElement('div', { style: { display: 'flex', gap: 6 } },
            telemetry.totalViolations > 0 && React.createElement('button', { className: 'alg-btn-ghost', onClick: onCopyDump }, tt('copyDump')),
            (telemetry.totalViolations > 0 || (telemetry.incidents && telemetry.incidents.length > 0)) && React.createElement('button', { className: 'alg-btn-ghost', onClick: onResetTelemetry }, tt('resetStats'))
          )
        ),
        React.createElement('div', { style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)' } },
          telemetry.error
            ? React.createElement('span', { style: { color: 'var(--dsw-alias-state-error-primary)' } }, telemetry.error)
            : (telemetry.totalViolations > 0 || telemetry.steeredCount > 0)
              ? React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 6 } },
                  React.createElement('div', { style: { display: 'flex', gap: 16 } },
                    React.createElement('div', null, tt('totalBlocked') + ': ', React.createElement('strong', { style: { color: 'var(--dsw-alias-state-warn-primary)' } }, telemetry.totalViolations)),
                    React.createElement('div', null, tt('steeredCount') + ': ', React.createElement('strong', { style: { color: 'var(--dsw-alias-brand-primary)' } }, telemetry.steeredCount || 0))
                  ),
                  telemetry.lastViolation && React.createElement('div', { style: { color: 'var(--dsw-alias-label-tertiary)' } },
                    tt('lastViolation') + ': ' + telemetry.lastViolation.code + ' (' + telemetry.lastViolation.tool + ')'
                  ),
                  telemetry.incidents && telemetry.incidents.length > 0 && React.createElement('div', { style: { marginTop: 6, borderTop: '1px solid var(--dsw-alias-border-l2)', paddingTop: 6 } },
                    React.createElement('div', { style: { fontWeight: 500, marginBottom: 4 } }, tt('incidentsTitle')),
                    telemetry.incidents.slice(0, 4).map((inc, i) => React.createElement('div', { key: inc.id || i, className: 'alg-incident-row' },
                      React.createElement('span', { style: { fontWeight: 500, color: inc.code === 'LOOP_GUARD_STEER' ? 'var(--dsw-alias-brand-primary)' : 'var(--dsw-alias-state-error-primary)' } }, inc.code),
                      React.createElement('span', { style: { color: 'var(--dsw-alias-label-tertiary)' } }, inc.tool)
                    ))
                  )
                )
              : React.createElement('span', { style: { color: 'var(--dsw-alias-label-tertiary)' } }, tt('noViolations'))
        )
      );
    }
