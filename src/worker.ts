import { Chess, find_san4, hopefox, parseUci } from 'hopefox'
import { Pattern, Puzzle, puzzle_all_tags } from "./puzzles"
import tenk from './assets/tenk_puzzle.csv?raw'
import { parse_puzzles } from './fixture'
import { bestsan3 } from 'hopefox'
import { get_module } from './wasm_stuff'
import { parseFen } from 'hopefox/fen'
import { makeSan } from 'hopefox/san'

export function uci_to_san(fen: string, uci: string) {
  let pos = Chess.fromSetup(parseFen(fen).unwrap()).unwrap()
  return makeSan(pos, parseUci(uci)!)
}

let puzzles: Puzzle[] = []
let filter: string | undefined = undefined
let patterns: Pattern[] = []

let dirty_patterns = true

let rules = ''

let search: (fen: string, rules: string) => string

const init = async () => {

  search = await get_module()

  puzzles = await fetch_puzzles()
  dirty_patterns = true
  clear_progress()
  //send_puzzles()

  postMessage('ready')
}

const set_rules = (r: string) => {
  rules = r
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

  let all = puzzles.slice(333, -1)
  all = all.filter(_ => !['00JzT', '00KNB', '00KYC', '00Kd8'].includes(_.id))
  all = all.filter(_ => !['00L4x', '00LMb'].includes(_.id))
  //all = all.filter(_ => _.sans[0].includes('R') && _.sans[0].length === 3)
  //all = all.filter(_ => _.sans[0].includes('N'))
  all = all.filter(_ => _.sans[0].includes('Q'))
  //all = all.filter(_ => ['01Bcd', '00Ohu'].includes(_.id))
  let filtered = filter ? all.filter(yn_filter(filter)) : all

  filtered.slice(0, 10).forEach((_, i) => {
    if (i % 2 === 0) {
      send_progress(i, filtered.length)
    }
    _.solve = { i: solve_p(_) }
  })

  filtered = filter ? filtered.filter(yn_filter(filter)) : filtered

  postMessage({ t: 'puzzles', d: { all, filtered }})
  clear_progress()
}

function solve_p(p: Puzzle) {
    for (let i = 0; i < p.move_fens.length; i += 2) {
        let fen = p.move_fens[i]
        let san = p.sans[i]
        if (i > 1) {
          return 99
        }

        if (find_san4(fen, rules) !== san) {
          return i
        } else {
        }

    }
    return 99
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