    function IncidentTelemetryPanel({ telemetry, tt, onCopyDump, onResetTelemetry }) {
      const truncCount = telemetry.totalTruncations || (telemetry.byCode && telemetry.byCode.LOOP_GUARD_PAYLOAD_TRUNCATED) || 0;
      const hasActivity = Boolean(telemetry.totalViolations > 0 || telemetry.steeredCount > 0 || truncCount > 0);
      return React.createElement('div', {
        style: { padding: '12px 14px', margin: '14px 0', background: 'color-mix(in srgb, var(--dsw-alias-label-primary) 2%, transparent)', borderRadius: 8, border: '1px solid var(--dsw-alias-border-l2)' }
      },
        React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 } },
          React.createElement('span', { style: { fontSize: 13, fontWeight: 600, color: 'var(--dsw-alias-label-primary)' } }, tt('telemetryTitle')),
          React.createElement('div', { style: { display: 'flex', gap: 6 } },
            (telemetry.totalViolations > 0 || truncCount > 0) && React.createElement('button', { className: 'alg-btn-ghost', onClick: onCopyDump }, tt('copyDump')),
            (hasActivity || (telemetry.incidents && telemetry.incidents.length > 0)) && React.createElement('button', { className: 'alg-btn-ghost', onClick: onResetTelemetry }, tt('resetStats'))
          )
        ),
        React.createElement('div', { style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)' } },
          telemetry.error
            ? React.createElement('span', { role: 'alert', 'aria-live': 'assertive', style: { color: 'var(--dsw-alias-state-error-primary)' } }, telemetry.error)
            : hasActivity
              ? React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 6 } },
                  React.createElement('div', { style: { display: 'flex', gap: 16, flexWrap: 'wrap' } },
                    React.createElement('div', null, tt('totalBlocked') + ': ', React.createElement('strong', { style: { color: 'var(--dsw-alias-state-warn-primary)' } }, telemetry.totalViolations || 0)),
                    React.createElement('div', null, tt('steeredCount') + ': ', React.createElement('strong', { style: { color: 'var(--dsw-alias-brand-primary)' } }, telemetry.steeredCount || 0)),
                    React.createElement('div', null, tt('totalTruncations') + ': ', React.createElement('strong', { style: { color: 'var(--dsw-alias-label-secondary)' } }, truncCount))
                  ),
                  telemetry.lastViolation && React.createElement('div', { style: { color: 'var(--dsw-alias-label-tertiary)' } },
                    tt('lastViolation') + ': ' + telemetry.lastViolation.code + ' (' + telemetry.lastViolation.tool + ')'
                  ),
                  telemetry.incidents && telemetry.incidents.length > 0 && React.createElement('div', { style: { marginTop: 6, borderTop: '1px solid var(--dsw-alias-border-l2)', paddingTop: 6 } },
                    React.createElement('div', { style: { fontWeight: 500, marginBottom: 4 } }, tt('incidentsTitle')),
                    telemetry.incidents.slice(0, 12).map((inc, i) => {
                      const timeStr = inc.timestamp ? new Date(inc.timestamp).toLocaleTimeString() : '';
                      const isSteer = inc.code === 'LOOP_GUARD_STEER';
                      const isTrunc = inc.code === 'LOOP_GUARD_PAYLOAD_TRUNCATED';
                      const color = isSteer ? 'var(--dsw-alias-brand-primary)' : (isTrunc ? 'var(--dsw-alias-label-secondary)' : 'var(--dsw-alias-state-error-primary)');
                      return React.createElement('div', { key: inc.id || i, className: 'alg-incident-row' },
                        timeStr ? React.createElement('span', { style: { color: 'var(--dsw-alias-label-tertiary)', minWidth: 54, fontSize: 10 } }, timeStr) : null,
                        React.createElement('span', { style: { fontWeight: 500, color } }, inc.code),
                        React.createElement('span', { style: { color: 'var(--dsw-alias-label-tertiary)', marginLeft: 'auto' } }, inc.tool)
                      );
                    })
                  )
                )
              : React.createElement('span', { style: { color: 'var(--dsw-alias-label-tertiary)' } }, tt('noViolations'))
        )
      );
    }
