import { parse_puzzles } from "./puzzles"

export const puzzles = await fetch('/data/athousand_sorted.csv').then(_ => _.text()).then(parse_puzzles)
export const tenk = await fetch('/data/tenk_puzzle.csv').then(_ => _.text()).then(parse_puzzles)
