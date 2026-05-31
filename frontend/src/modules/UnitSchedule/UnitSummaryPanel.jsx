/**
 * Unit Summary Panel — mirrors the "Unit Summary" table in the Excel Unit Sched tab.
 * Columns: Type · Cooling (Tons) · Equip+Accessories · Misc · Total Materials · Labor · Mat+Labor
 */
import React from 'react';

const fmt = (n) =>
  (n || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

const fmtTons = (n) =>
  n > 0 ? Number(n).toLocaleString('en-US', { maximumFractionDigits: 1 }) : null;

const ROW_CONFIG = [
  { type: 'Service of Existing', dot: '#888780' },
  { type: 'Packaged Unit',       dot: '#378ADD', pillBg: '#E6F1FB', pillText: '#0C447C' },
  { type: 'Standard Split',      dot: '#7F77DD', pillBg: '#EEEDFE', pillText: '#3C3489' },
  { type: 'Wall Mount Split',    dot: '#D4537E', pillBg: '#FBEAF0', pillText: '#72243E' },
  { type: 'VRF',                 dot: '#1D9E75', pillBg: '#E1F5EE', pillText: '#085041' },
];

const PLACEHOLDER_ROWS = ['[FPB / VAV]', '[Chiller]', 'Boilers'];

const tdBase = {
  padding: '7px 12px',
  borderBottom: '0.5px solid var(--color-border-tertiary)',
  whiteSpace: 'nowrap',
  fontVariantNumeric: 'tabular-nums',
  fontSize: 12,
  textAlign: 'right',
  color: 'var(--color-text-primary)',
};

const tdMuted = { ...tdBase, color: 'var(--color-text-tertiary)' };

export default function UnitSummaryPanel({ summary }) {
  const { sections = [], grand = {} } = summary || {};
  const byType = Object.fromEntries(sections.map(s => [s.type, s]));
  const hasAnyData = sections.some(s => (s.totalCost || 0) > 0);
  const activeCount = ROW_CONFIG.filter(r => (byType[r.type]?.totalCost || 0) > 0).length;

  return (
    <div style={{ paddingBottom: '1rem', fontFamily: 'var(--font-sans)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Unit Summary
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 500, padding: '3px 10px', borderRadius: 999, background: '#E6F1FB', color: '#0C447C' }}>
            {activeCount} type{activeCount !== 1 ? 's' : ''} active
          </span>
          {hasAnyData && (
            <span style={{ fontSize: 11, fontWeight: 500, padding: '3px 10px', borderRadius: 999, background: '#E1F5EE', color: '#085041' }}>
              {fmtTons(grand.coolTons) || 0} tons total
            </span>
          )}
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 680 }}>
          <thead>
            <tr>
              {[
                { label: '',                  align: 'center', w: 28,  style: {} },
                { label: 'Type',              align: 'left',   w: 180, style: {} },
                { label: 'Cooling (tons)',    align: 'right',  w: null, style: {} },
                { label: 'Equip + accessories', align: 'right', w: null, style: {} },
                { label: 'Misc.',             align: 'right',  w: null, style: {} },
                { label: 'Total material',    align: 'right',  w: null, style: { background: '#E6F1FB', color: '#0C447C' } },
                { label: 'Labor',             align: 'right',  w: null, style: {} },
                { label: 'Mat + labor',       align: 'right',  w: null, style: { background: '#E1F5EE', color: '#085041', borderLeft: '1.5px solid #9FE1CB' } },
              ].map(({ label, align, w, style }, i) => (
                <th key={i} style={{
                  padding: '7px 12px', fontSize: 11, fontWeight: 500,
                  color: 'var(--color-text-secondary)', textAlign: align,
                  borderBottom: '1.5px solid var(--color-border-tertiary)',
                  background: 'var(--color-background-secondary)',
                  whiteSpace: 'nowrap',
                  width: w || undefined,
                  ...style,
                }}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROW_CONFIG.map(({ type, dot, pillBg, pillText }, i) => {
              const s = byType[type];
              const active = s && (s.totalCost || 0) > 0;
              const tons = fmtTons(s?.coolTons);

              return (
                <tr key={type} style={{ background: i % 2 === 0 ? 'var(--color-background-primary)' : 'var(--color-background-secondary)' }}>
                  {/* # */}
                  <td style={{ ...tdMuted, textAlign: 'center' }}>{i + 1}</td>

                  {/* Type */}
                  <td style={{ ...tdBase, textAlign: 'left' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                      <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: dot, marginRight: 8, flexShrink: 0 }} />
                      <span style={{ fontWeight: active ? 500 : 400, color: active ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)' }}>
                        {type}
                      </span>
                      {active && tons && pillBg && (
                        <span style={{ fontSize: 10, fontWeight: 500, padding: '1px 7px', borderRadius: 999, marginLeft: 7, background: pillBg, color: pillText }}>
                          {tons}t
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Cooling tons */}
                  <td style={active ? tdBase : tdMuted}>{active && tons ? tons : '—'}</td>

                  {/* Equip + accessories */}
                  <td style={active ? tdBase : tdMuted}>{active ? fmt(s.totalEquipAcc) : '—'}</td>

                  {/* Misc */}
                  <td style={active ? tdBase : tdMuted}>{active ? fmt(s.totalMisc) : '—'}</td>

                  {/* Total material */}
                  <td style={{ ...tdBase, background: '#E6F1FB22', color: active ? '#185FA5' : 'var(--color-text-tertiary)', fontWeight: active ? 500 : 400 }}>
                    {active ? fmt(s.totalMaterial) : '—'}
                  </td>

                  {/* Labor */}
                  <td style={active ? tdBase : tdMuted}>{active ? fmt(s.totalLabor) : '—'}</td>

                  {/* Mat + labor */}
                  <td style={{ ...tdBase, background: '#E1F5EE33', color: active ? '#0F6E56' : 'var(--color-text-tertiary)', fontWeight: active ? 500 : 400, borderLeft: '1.5px solid #9FE1CB44' }}>
                    {active ? fmt(s.totalCost) : '—'}
                  </td>
                </tr>
              );
            })}

            {/* Placeholder rows */}
            {PLACEHOLDER_ROWS.map((label, i) => (
              <tr key={label} style={{ background: (ROW_CONFIG.length + i) % 2 === 0 ? 'var(--color-background-primary)' : 'var(--color-background-secondary)' }}>
                <td style={{ ...tdMuted, textAlign: 'center' }}>{ROW_CONFIG.length + i + 1}</td>
                <td style={{ ...tdMuted, textAlign: 'left', fontStyle: 'italic' }}>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#B4B2A9', marginRight: 8 }} />
                    {label}
                  </div>
                </td>
                <td style={tdMuted} /><td style={tdMuted} /><td style={tdMuted} />
                <td style={{ ...tdMuted, background: '#E6F1FB11' }} />
                <td style={tdMuted} />
                <td style={{ ...tdMuted, background: '#E1F5EE11', borderLeft: '1.5px solid #9FE1CB44' }} />
              </tr>
            ))}
          </tbody>

          {/* Totals footer */}
          {hasAnyData && (
            <tfoot>
              <tr>
                <td style={{ padding: '9px 12px', borderTop: '1.5px solid var(--color-border-primary)' }} />
                <td style={{ padding: '9px 12px', borderTop: '1.5px solid var(--color-border-primary)', fontSize: 12, fontStyle: 'italic', color: 'var(--color-text-secondary)' }}>
                  Total
                </td>
                <td style={{ ...tdBase, borderTop: '1.5px solid var(--color-border-primary)', color: 'var(--color-text-secondary)' }}>
                  {fmtTons(grand.coolTons) || '—'}
                </td>
                <td style={{ ...tdBase, borderTop: '1.5px solid var(--color-border-primary)' }}>{fmt(grand.totalEquipAcc)}</td>
                <td style={{ ...tdBase, borderTop: '1.5px solid var(--color-border-primary)' }}>{fmt(grand.totalMisc)}</td>
                <td style={{ ...tdBase, borderTop: '1.5px solid var(--color-border-primary)', background: '#B5D4F444', color: '#0C447C', fontSize: 13 }}>
                  {fmt(grand.totalMaterial)}
                </td>
                <td style={{ ...tdBase, borderTop: '1.5px solid var(--color-border-primary)' }}>{fmt(grand.totalLabor)}</td>
                <td style={{ ...tdBase, borderTop: '1.5px solid var(--color-border-primary)', background: '#9FE1CB55', color: '#085041', fontSize: 15, fontWeight: 500, borderLeft: '1.5px solid #9FE1CB' }}>
                  {fmt(grand.totalCost)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Copper bar */}
      {(grand.totalCopper || 0) > 0 && (
        <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', background: '#FAEEDA', border: '0.5px solid #FAC775', borderRadius: 'var(--border-radius-md)' }}>
          <span style={{ fontSize: 15, color: '#854F0B' }}>⚡</span>
          <span style={{ fontSize: 12, color: '#633806', flex: 1 }}>
            Copper pipes — extracted independently, included in combined total
          </span>
          <span style={{ fontSize: 13, fontWeight: 500, color: '#412402', fontVariantNumeric: 'tabular-nums' }}>
            {fmt(grand.totalCopper)}
          </span>
        </div>
      )}
    </div>
  );
}
