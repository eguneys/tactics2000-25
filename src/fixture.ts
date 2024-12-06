import { Chess, parseUci } from 'hopefox'
import { makeFen, parseFen } from 'hopefox/fen'
import { makeSan } from 'hopefox/san'
import { Puzzle } from './puzzles'

export const puzzles = await fetch('/data/athousand_sorted.csv').then(_ => _.text()).then(parse_puzzles)
export const tenk = await fetch('/data/tenk_puzzle.csv').then(_ => _.text()).then(parse_puzzles)

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
            id, link, fen, moves, tags, move_fens, sans, has_tags, has_pattern, solve: { i: undefined }
        }
    })
}