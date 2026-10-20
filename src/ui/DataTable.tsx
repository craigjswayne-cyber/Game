import type { HTMLAttributes, ReactNode, TdHTMLAttributes } from 'react'
import { ariaSort, refocus } from './rowNav'

/**
 * ONE TABLE, COLUMNS DEFINED ONCE (owner, 1.9.4: "align the columns
 * correctly", then "yes, do this" to a shared table).
 *
 * Every list used to write its own colgroup, its own heading row and its own
 * cells, and the three drifted: a heading left-aligned over centred dots, a
 * value pushed out by its arrow, a heading wider than the column it named.
 * Here a column is one object - its heading, its width, its alignment and how
 * to draw a cell - and the alignment class goes on the heading AND on every
 * cell from the same field, so the two cannot disagree.
 *
 * The classes are the stylesheet's own (`num` right, `center`, `name`), so a
 * table moved onto this looks exactly as it did.
 */

export type Align = 'left' | 'right' | 'center'

export interface Col<R> {
  id: string
  /** the heading; omit for a column with no heading text */
  head?: ReactNode
  /** px, or a share such as '29%'; leave out for the column that takes the rest */
  width?: number | string
  align?: Align
  /** extra classes for the heading and every cell (e.g. 'name') */
  className?: string
  /** a sortable heading: the key handed to onSort */
  sort?: string
  /** the key sorts A-Z / low-high first (for aria-sort) */
  ascFirst?: boolean
  /** the heading may take two lines in a long language */
  wrapHead?: boolean
  cell: (row: R) => ReactNode
  /** per-cell attributes: a style, a title, a handler */
  td?: (row: R) => TdHTMLAttributes<HTMLTableCellElement>
}

export interface SortState {
  key: string
  desc: boolean
  onSort: (key: string) => void
}

interface Props<R> {
  cols: Col<R>[]
  rows: R[]
  rowKey: (row: R) => string | number
  /** attributes for each row: a tap target, a highlight class */
  rowProps?: (row: R) => HTMLAttributes<HTMLTableRowElement>
  className?: string
  sort?: SortState
  /** a prefix for the sort buttons' focus keys, unique on the screen */
  focusKey?: string
  /** no heading row (the team sheet's numbered shirts need none) */
  noHead?: boolean
  /** a class for the heading row */
  headClass?: string
}

const ALIGN: Record<Align, string> = { left: '', right: 'num', center: 'center' }

function classes(...cs: (string | false | undefined)[]): string | undefined {
  const s = cs.filter(Boolean).join(' ')
  return s || undefined
}

export function DataTable<R>({ cols, rows, rowKey, rowProps, className, sort, focusKey = 'tbl', noHead, headClass }: Props<R>) {
  return (
    <table className={classes('dtable', className)}>
      <colgroup>
        {cols.map(c => (
          <col key={c.id} className={`c-${c.id}`}
            style={c.width == null ? undefined : { width: typeof c.width === 'number' ? `${c.width}px` : c.width }} />
        ))}
      </colgroup>
      {!noHead && (
        <thead>
          <tr className={headClass}>
            {cols.map(c => {
              const align = ALIGN[c.align ?? 'left']
              if (!c.sort || !sort) {
                return <th key={c.id} className={classes(align, c.className, c.wrapHead && 'th-wrap')}>{c.head}</th>
              }
              const active = sort.key === c.sort
              const fk = `${focusKey}-${c.sort}`
              return (
                <th key={c.id} className={classes('th-sort', active && 'active', align, c.className, c.wrapHead && 'th-wrap')}
                  aria-sort={ariaSort(active, sort.desc, !!c.ascFirst)}>
                  <button type="button" className="th-btn" data-focus-key={fk}
                    onClick={e => { refocus(fk, document.activeElement === e.currentTarget); sort.onSort(c.sort!) }}>
                    {c.head}{active ? (sort.desc ? ' ▴' : ' ▾') : ''}
                  </button>
                </th>
              )
            })}
          </tr>
        </thead>
      )}
      <tbody>
        {rows.map(r => (
          <tr key={rowKey(r)} {...rowProps?.(r)}>
            {cols.map(c => {
              const extra = c.td?.(r)
              return (
                <td key={c.id} {...extra} className={classes(ALIGN[c.align ?? 'left'], c.className, extra?.className)}>
                  {c.cell(r)}
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
