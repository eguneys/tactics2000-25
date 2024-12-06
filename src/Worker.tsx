import { Accessor, createContext, createSignal, JSX } from "solid-js"
import MyWorker from './worker?worker'
import { Pattern, Puzzle } from "./puzzles"

type MyWorkerType = {
    error: Accessor<string | undefined>,
    progress: Accessor<[number, number] | undefined>,
    puzzles: Accessor<Puzzle[] | undefined>,
    all_puzzles: Accessor<Puzzle[] | undefined>,
    filter_puzzles: (_?: string) => void,
    set_patterns: (_: Pattern[]) => void
    set_rules: (_: string) => void
}

export const MyWorkerContext = createContext<MyWorkerType>()

export const MyWorkerProvider = (props: { children: JSX.Element }) => {
    let worker  = new MyWorker({})

    const [error, set_error] = createSignal<string | undefined>()
    const [progress, set_progress] = createSignal<[number, number] | undefined>()

    const [all_puzzles, set_all_puzzles] = createSignal<Puzzle[] | undefined>()
    const [puzzles, set_puzzles] = createSignal<Puzzle[] | undefined>()

    worker.onerror = (err) => {
        set_error(err.message)
    }

    let rules: string = ''
    let filter: string | undefined = undefined
    worker.onmessage = (e) => {
        if (e.data === 'ready') {
            worker.postMessage({ t: 'rules', d: rules })
            worker.postMessage({ t: 'filter', d: filter })
            return
        }
        switch (e.data.t) {
            case 'progress':
                set_progress(e.data.d)
                return
            case 'puzzles':
                let { all, filtered } = e.data.d
                set_puzzles(filtered)
                set_all_puzzles(all)
                return
        }
    }

    let res = {
        error,
        progress,
        puzzles,
        all_puzzles,
        filter_puzzles(_filter?: string) {
            filter = _filter
            worker.postMessage({ t: 'filter', d: filter })
        },
        set_patterns(patterns: Pattern[]) {
            worker.postMessage({t: 'cancel'})
            worker.postMessage({ t: 'patterns', d: patterns })
        },
        set_rules(_rules: string) {
            rules = _rules
            worker.postMessage({ t: 'rules', d: rules })
        }
    }

    return <MyWorkerContext.Provider value={res}>
        {props.children}
    </MyWorkerContext.Provider>
}