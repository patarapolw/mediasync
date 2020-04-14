import { split } from './shlex'

export function parseQ (col: firebase.firestore.Query<any>, q: string) {
  split(q).map((arg) => {
    const m = /^(.+?)(<|<=|==|>|>=|:)(.+?)$/.exec(arg)
    if (m) {
      let [_, k, op, v] = m

      v = unquote(v)

      if (k === 'tag') {
        op = 'array-contains'
      }

      if (op === ':') {
        op = '>='
      }

      col = col.where(k, op as any, v)
    } else {
      col = col.where('name', '>=', arg)
    }
  })
  return col
}

function unquote (s: string) {
  s = s.trim()
  if (s[0] === s[s.length - 1] && ['"', "'"].includes(s[0])) {
    return s.substr(1, s.length - 2)
  }

  return s
}
