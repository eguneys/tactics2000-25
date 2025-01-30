import { parse_puzzles, Puzzle, Rule, solve_p, yn_filter } from "./puzzles"
import tenk from './assets/tenk_puzzle.csv?raw'

let all: Puzzle[] = []



const fetch_puzzles = async () => parse_puzzles(tenk)
const init = async () => {
    all = await fetch_puzzles()
    postMessage('ready')
}
init()



onmessage = (e) => {
    switch (e.data.t) {
        case 'filter': {
            let {filter, rules} = e.data.d
            set_filter(filter)
            set_rules(rules)
            send_work()
        } break
    }
}

let filter: string| undefined = undefined
let rules: Rule[] = []

function set_filter(f: string) {
    filter = f
}

const set_rules = (r: Rule[]) => {
    let xx = r.filter(_ => _.rule.length > 0)
    rules = [
        ...rules.filter(e => !r.find(_ => _.name === e.name)),
        ...xx
    ]
}


function send_work() {
    postMessage(work_while_checking())
}


function work_while_checking() {

    let puzzles = all

    puzzles = puzzles.filter(_ => _.sans[0].includes('B'))
    puzzles = puzzles.filter(_ => !_.tags['mate'] && !_.tags['endgame'])
    puzzles = puzzles.slice(0, 200)

    for (let i = 0; i < puzzles.length; i++) {
        if (i % 10 === 0) {
            send_progress([i, puzzles.length])
        }

        let puzzle = puzzles[i]
        puzzle.rules = rules.map(rule => ({ rule, solve: solve_p(puzzle, rule.rule )}))
    }

    let filtered = filter ? puzzles.filter(yn_filter(filter)) : puzzles

    send_progress()
    return { t: 'puzzles', d: { all, filtered }}
}


function send_progress(it?: [number, number]) {
    postMessage({ t: 'progress', d: it})
}