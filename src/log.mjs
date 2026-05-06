// tiny ANSI helpers, zero-dep
const supportsColor =
  process.stdout.isTTY && process.env.TERM !== 'dumb' && !process.env.NO_COLOR

const wrap = (open, close) => (s) =>
  supportsColor ? `\x1b[${open}m${s}\x1b[${close}m` : String(s)

export const c = {
  bold: wrap(1, 22),
  dim: wrap(2, 22),
  red: wrap(31, 39),
  green: wrap(32, 39),
  yellow: wrap(33, 39),
  blue: wrap(34, 39),
  cyan: wrap(36, 39),
}
