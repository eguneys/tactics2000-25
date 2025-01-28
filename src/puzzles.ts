import { Chess, find_san7, LRUCache, parseUci } from "hopefox"
import { makeFen, parseFen } from "hopefox/fen"
import { makeSan } from "hopefox/san"


export function parse_puzzles(str: string): Puzzle[] {
    return str.trim().split('\n').map(_ => {
        let [id, fen, moves, _a, _b, _c, _d, _tags] = _.split(',')

        let sans: string[] = []
        let move_fens: string[] = []

        let pos = Chess.fromSetup(parseFen(fen).unwrap()).unwrap()

        moves.split(' ').forEach((uci, i) => {
            let move = parseUci(uci)!
            if (i > 0) sans.push(makeSan(pos, move))
            pos.play(move)

            move_fens.push(makeFen(pos.toSetup()))
        })

        let link = `https://lichess.org/training/${id}`

        let has_tags: Record<string, true> = {}
        let has_pattern: Record<string, true> = {}

        let tags: Record<string, true> = {}
        _tags.split(' ').forEach(_ => tags[_] = true)



        return {
            rules: [],
            id, link, fen, moves, tags, move_fens, sans, has_tags, has_pattern, solve: { i: undefined }
        }
    })
}

export type Puzzle = {
  id: string,
  link: string,
  fen: string,
  moves: string,
  sans: string[],
  move_fens: string[],
  tags: Record<string, true>,
  has_tags: Record<string, true>,
  has_pattern: Record<string, true>,
  rules: RuleSolve[]
}

export type RuleSolve = {
  rule: Rule,
  solve: number | undefined 
}

export type Rule = { name: string, rule: string }

export type Pattern = { name: string, pattern: string }

export const puzzle_has_tags = (puzzle: Puzzle): Record<string, true> => {
  let nb_tags = Object.keys(puzzle.has_tags).length
  let res = { ... puzzle.has_tags }
  if (nb_tags > 0) {
    res.has_tag = true
    if (nb_tags === 1) {
      res.single_tag = true
    } else {
      res.many_tags = true
    }
  }
  res[`id_${puzzle.id}`] = true
  return res
}

export const puzzle_all_tags = (puzzle: Puzzle): Record<string, boolean> => {
  let res = { ...puzzle.tags, ...puzzle_has_tags(puzzle) }

  if (puzzle.rules) {
    let tags = [...new Set(puzzle.rules.flatMap(rule_to_tags))]

    tags.forEach(tag => res[tag] = true)
  }

  return res
}

const rule_to_tags = (rule: RuleSolve) => {
  if (rule.solve === undefined) {
    return ['solved', `solved_${rule.rule.name}`]
  } else if (rule.solve >= 0) {
    return ['failed', `failed_${rule.rule.name}`]
  } else {
    return ['']
  }
}



const lruCache = new LRUCache(1000); // Set a capacity

function cache_san(fen: string, rule: string) {
    const key = `${fen}${rule}`;

    const cachedValue = lruCache.get(key);
    if (cachedValue !== undefined) {
        return cachedValue;
    }

    try {
      const result = find_san7(fen, rule);
      lruCache.put(key, result);
      return result;
    } catch {
      return undefined
    }
}

export function solve_p(p: Puzzle, rule: string) {
    for (let i = 0; i < p.move_fens.length; i += 2) {
        let fen = p.move_fens[i]
        let san = p.sans[i]
        if (i > 1) {
          return undefined
        }
      //let solved_san = find_san4(fen, rule)
      let solved_san = cache_san(fen, rule)
      if (solved_san === undefined) {
        return -1
      }
      if (solved_san !== san) {
        return i
      } else {
      }

    }
    return undefined
}