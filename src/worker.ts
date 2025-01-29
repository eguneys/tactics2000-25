import { hopefox } from 'hopefox'
import { parse_puzzles, Pattern, Puzzle, puzzle_all_tags, Rule, solve_p } from "./puzzles"
import tenk from './assets/tenk_puzzle.csv?raw'

let puzzles: Puzzle[] = []
let filter: string | undefined = undefined
let patterns: Pattern[] = []

let dirty_patterns = true

let rules: Rule[] = []

const init = async () => {

  puzzles = await fetch_puzzles()
  dirty_patterns = true
  clear_progress()
  //send_puzzles()

  postMessage('ready')
}

const set_rules = (r: Rule[]) => {
  let xx = r.filter(_ => _.rule.length > 0)
  rules = [
    ...rules.filter(e => !r.find(_ => _.name === e.name)),
    ...xx]
  send_puzzles()
}

const set_patterns = (ps: Pattern[]) => {
  patterns = ps
  dirty_patterns = true

  send_puzzles()
}



//export const fetch_puzzles = () => fetch('./data/tenk_puzzle.csv').then(_ => _.text()).then(parsePuzzles)
const fetch_puzzles = async () => parse_puzzles(tenk)

const yn_filter = (filter: string) => {
  return (puzzle: Puzzle) => {
    let all_tags = puzzle_all_tags(puzzle)
    let [y,n] = filter.split('_!_').map(_ => _.trim())

    let ys = y === '' ? [] : y.split(' ')

    if (n) {

      let ns = n.split(' ')

      if (ns.find(_ => all_tags[_])) {
        return false
      }
    }

    return ys.every(y => all_tags[y])
  }

}

function send_progress(i: number, t: number) {
  postMessage({t: 'progress', d: [i, t]})
}

function clear_progress() {
  postMessage({ t: 'progress' })
}


const filter_puzzles = (_filter?: string) => {
  filter = _filter
  send_puzzles()
}

const send_puzzles = () => {

  if (dirty_patterns) {
    for (let i = 0; i < puzzles.length; i++) {
      let puzzle = puzzles[i]
      if (i % 500 === 0) send_progress(i, puzzles.length)
      let has_pattern = puzzle.has_pattern
      puzzle.has_pattern = {}
      for (let pattern of patterns) {
        puzzle.has_pattern[pattern.pattern] = true
        if (!has_pattern[pattern.pattern]) {
          let compute = hopefox(puzzle.fen, pattern.pattern)
          if (compute) {
            puzzle.has_tags[pattern.name] = compute
          } else {
            delete puzzle.has_tags[pattern.name]
          }
        }
      }
    }
    dirty_patterns = false
  }

  let all = puzzles
  //all = all.filter(_ => !['00JzT', '00KNB', '00KYC', '00Kd8'].includes(_.id))
  //all = all.filter(_ => !['00L4x', '00LMb'].includes(_.id))
  //all = all.filter(_ => _.sans[0].includes('R') && _.sans[0].length === 3)
  //all = all.filter(_ => _.sans[0].includes('N'))
  all = all.filter(_ => _.sans[0].includes('B'))
  //all = all.filter(_ => ['01Bcd', '00Ohu'].includes(_.id))

  let filtered = all.slice(0, 3000)//filter ? all.filter(yn_filter(filter)) : all

  filtered.forEach((_, i) => {
    if (i % 2 === 0) {
      send_progress(i, filtered.length)
    }
    _.rules = rules.map(rule => ({ rule, solve: solve_p(_, rule.rule) }))
  })

  filtered = filter ? filtered.filter(yn_filter(filter)) : filtered

  postMessage({ t: 'puzzles', d: { all, filtered }})
  clear_progress()
}


onmessage = (e) => {
    switch (e.data.t) {
      case 'filter': {
        filter_puzzles(e.data.d)
      } break
      case 'patterns': {
        set_patterns(e.data.d)
      } break
      case 'rules': {
        set_rules(e.data.d)
      }
    }

}


init()