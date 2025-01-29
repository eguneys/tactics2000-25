import { batch, createContext, createSignal, JSX } from "solid-js"
import { Puzzle, Rule } from "./puzzles"
import Worker from './worker2?worker'

type WorkerReturn = {
    progress?: [number, number],
    puzzles?: Puzzle[],
    all?: Puzzle[],
    filter: (_?: string) => void,
    rules: (_: Rule[]) => void
}


export const WorkerContext = createContext<WorkerReturn>()


export const WorkerProvider = (props: { children: JSX.Element }) => {
    let worker = new Worker()

    const [progress, set_progress] = createSignal<[number, number] | undefined>()
    const [puzzles, set_puzzles] = createSignal<Puzzle[] | undefined>()
    const [all, set_all] = createSignal<Puzzle[] | undefined>()

    worker.onmessage = (e) => {
        if (e.data === 'ready') {
            worker_ready = true
            post_worker()
        }
        switch (e.data.t) {
            case 'progress':
                set_progress(e.data.d)
                break
            case 'puzzles':
                let { all, filtered } = e.data.d
                batch(() => {
                    set_all(all)
                    set_puzzles(filtered)
                })
                break
        }
    }

    let worker_ready = false
    let filter: string | undefined, rules: Rule[] = []
    function post_worker() {
        if (!worker_ready) {
            return
        }
        worker.postMessage({ t: 'filter', d: { filter, rules }})
    }


    const on_filter = (_?: string) => {
        filter = _
        post_worker()
    }

    const on_rules = (_: Rule[]) => {
        rules = _
        post_worker()
    }


    let res = {
        get progress() {
            return progress()
        },
        get puzzles() {
            return puzzles()
        },
        get all() {
            return all()
        },
        filter: on_filter,
        rules: on_rules
    }

    return <WorkerContext.Provider value={res}> {props.children} </WorkerContext.Provider>
}