import wasm_url from './assets/wasm/hopefox.wasm?url'
import { batch, createEffect, createMemo, createResource, createSignal, For, mapArray, on, Show, useContext } from 'solid-js'
import './App.scss'
import Chessboard from './Chessboard'
import { makePersistedNamespaced } from './persisted'
import { Puzzle, puzzle_all_tags, puzzle_has_tags } from './puzzles'
import { Shala } from './Shalala'
import { stepwiseScroll } from './common/scroll'
import { INITIAL_FEN } from 'chessops/fen'
import { Chess, find_san10_c, make_root, PositionManager, print_rules } from 'hopefox'
import { WorkerContext, WorkerProvider } from './Worker2'
import { debounce } from './common/timing'
import { parseFen } from 'hopefox/fen'



function App() {
  return (<>
    <WorkerProvider>
      <WithWorker />
    </WorkerProvider>
  </>)
}

function WithWorker() {

  const [selected_puzzle, set_selected_puzzle] = createSignal<Puzzle | undefined>(undefined)
  const [i_selected_sans, set_i_selected_sans] = createSignal(0)

  const puzzle_sans = createMemo(() => {
    let p = selected_puzzle()
    if (!p) {
      return []
    }
    return p.sans
  })

  createEffect(() => {
    let puzzle = selected_puzzle()
    let i = i_selected_sans()
    if (puzzle) {
      shalala.on_set_fen_uci(puzzle.move_fens[i + 1])
    } else {
      shalala.on_set_fen_uci(INITIAL_FEN)
    }
  })

  createEffect(on(selected_puzzle, () => {
    set_i_selected_sans(-1)
  }))

  const shalala = new Shala()
  

  const on_wheel = stepwiseScroll((e: WheelEvent, scroll) => {
    if (!scroll) {
      return
    }
    const target = e.target as HTMLElement;
    if (
      target.tagName !== 'PIECE' &&
      target.tagName !== 'SQUARE' &&
      target.tagName !== 'CG-BOARD'
    )
      return;
    e.preventDefault();

    let d = Math.sign(e.deltaY)

    let puzzle = selected_puzzle()
    if (d > 0) {

      if (puzzle) {
        set_i_selected_sans(Math.min(puzzle.move_fens.length - 2, i_selected_sans() + 1))
      }
    } else {
      set_i_selected_sans(Math.max(-1, i_selected_sans() - 1))
    }

  })

  return (
    <>
      <div class='header'></div>
      <div class='app-wrap'>
        <div class='board-wrap'>
          <div class='board' onWheel={on_wheel}>
            <Chessboard
              onShapes={() => { }}
              movable={true}
              doPromotion={shalala.promotion}
              onMoveAfter={shalala.on_move_after}
              fen_uci={shalala.fen_uci}
              color={shalala.turnColor}
              dests={shalala.dests} />
          </div>
          <div class='tree'>
            <For each={puzzle_sans()}>{ (san, i) =>
              <div class={'san' + (i_selected_sans() === i() ? ' active': '') }  onClick={() => set_i_selected_sans(i)}>{san}</div>
            }</For>
          </div>
        </div>
        <div class='editor-wrap'>
          <Editor2 fen={shalala.fen_uci[0]} />
        </div>

        <div class='puzzles-wrap'>
          <Puzzles on_selected_puzzle={set_selected_puzzle}/>
        </div>

        <Progress />
      </div>
    </>
  )
}


const Progress = () => {

  const ww = useContext(WorkerContext)!


  return (<>
    <Show when={ww.progress}>{progress =>
      <div class='progress'> {progress()[0]}/{progress()[1]} </div>
    }</Show>
  </>
  )
}

class PuzzleMemo {

  static create = (puzzle: Puzzle) => {

    return new PuzzleMemo(puzzle)
  }

  get id() {
    return this.puzzle.id
  }

  get fen() {
    return this.puzzle.fen
  }

  get tags() {
    return this.puzzle.tags
  }

  _has_tags: Record<string, boolean> | undefined
  get has_tags() {
    if (!this._has_tags) {
      this._has_tags = puzzle_has_tags(this.puzzle)
    }
    return this._has_tags
  }

  _all_tags: Record<string, boolean> | undefined
  get all_tags() {
    if (!this._all_tags) {
      this._all_tags = puzzle_all_tags(this.puzzle)
    }
    return this._all_tags
  }

  private constructor(readonly puzzle: Puzzle) {}
}

const Puzzles = (props: { on_selected_puzzle: (_?: Puzzle) => void }) => {

  let ww = useContext(WorkerContext)!

  const filtered = createMemo(mapArray(() => ww.puzzles, PuzzleMemo.create))

  const [filter, set_filter] = makePersistedNamespaced<string | undefined>(undefined, 'filter')

  const [id_selected, set_id_selected] = makePersistedNamespaced<string | undefined>(undefined, 'id_selected')

  const selected_puzzle = createMemo(() => filtered().find(_ => _.id === id_selected()))
  //const selected_fen = createMemo(() => selected_puzzle()?.fen)

  //const nb_solved = createMemo(() => filtered().filter(_ => _.solve.i === 99).length)

  let id_previous: string | undefined = undefined
  const toggle_id = () => {
    let f = filter()

    if (!f) {
      return
    }

    let puzzle = selected_puzzle()
    if (!puzzle) {
      return
    }

    if (id_previous) {
      set_filter(id_previous)
      id_previous = undefined
    } else {
      id_previous = f
      set_filter(`id_${puzzle.id} `)
    }
  }

  const toggle_solved = () => {
    let f = filter()

    if (!f) {
      return
    }

    if (f.includes('solved')) {
      f = f.replace('solved', '')
    } else {
      f = f.trim() + ' solved'
    }

    set_filter(f)
  }

  let failed_previous = filter()
  const toggle_failed = () => {
    let f = filter()

    if (!f) {
      return
    }

    if (f.includes('failed')) {
      f = failed_previous
      failed_previous = undefined
    } else {
      failed_previous = f
      f = 'failed'
    }

    set_filter(f)
  }



  createEffect(on(selected_puzzle, (puzzle) => {
    if (puzzle) {
      props.on_selected_puzzle(puzzle.puzzle)
    } else {
      if (filtered()[0]) {
        set_id_selected(filtered()[0]?.id)
      }
      props.on_selected_puzzle(undefined)
    }
  }))

  createEffect(on(filter, f => {
    ww.filter(f)
  }))


  let $el_filter: HTMLInputElement

  const on_filter_change = debounce((filter: string) => {
    set_filter(filter)
  }, 1100)

  return (
      <div class='puzzles'>
        <div class='filter'>
          <input spellcheck={false} value={filter()} onInput={() => on_filter_change($el_filter.value)} ref={_ => $el_filter = _} type="text" placeholder="Filter y_filter _!_ n_filter"></input>
          <span>{filtered().length}/{10000} Positions</span>
        </div>
        <div class='list'>
      <Show when={filtered()}>{ puzzles => 
        <For each={puzzles().slice(0, 1000)}>{puzzle => 
            <div onClick={() => set_id_selected(puzzle.id)} class={'puzzle' + (puzzle.id === id_selected() ? ' active' : '')}>
              <span class='id'><a target="_blank" href={`https://lichess.org/training/${puzzle.id}`}>{puzzle.id}</a></span>
              <span class='has-tags'><For each={Object.keys(puzzle.has_tags).filter(_ => !_.includes('id_'))}>{tag => <span class='tag'>{tag}</span>}</For></span>
              <span class='tags'><For each={Object.keys(puzzle.all_tags)}>{tag => <span class='tag'>{tag}</span>}</For></span>
            </div>
        }</For>
      }</Show>
      </div>
      <div class='info'>
        <button onClick={toggle_solved}>Toggle Solved</button>
        <button onClick={toggle_id}>Toggle Id</button>
        <button onClick={toggle_failed}>Toggle Failed</button>
      </div>
      </div>
  )
}


function Editor2(props: { fen?: string }) {

  let ww = useContext(WorkerContext)!
  const filtered = createMemo(mapArray(() => ww.all, PuzzleMemo.create))

  const nb_failed = (name: string) => {
    return filtered().filter(_ => _.all_tags[`failed_${name}`]).length
  }
  const nb_solved = (name: string) => {
    return filtered().filter(_ => _.all_tags[`solved_${name}`]).length
  }



  function new_rule() {
    let i = 1
    let name = `rule${i}`
    let l = rule_list()

    while (l.find(_ => _.name === name)) {
      name = `rule${i++}`
    }

    return { name, rule: '', z: l.length }
  }

  const [rule_list, set_rule_list] = makePersistedNamespaced([{name: 'rule1', rule: '', z: 0}], 'rule-list')

  const [i_rule_list, set_i_rule_list] = createSignal(0)

  ww.rules(rule_list())

  const selected_rule = createMemo(() => rule_list()[i_rule_list()])


  const on_set_rules = (e: KeyboardEvent) => {

    if (e.key === 'Escape') {
      let rule = (e.target as HTMLTextAreaElement).value
      let ss = selected_rule()
      let updated = { name: ss.name, rule, z: ss.z }

      let l = rule_list()
      let i = l.findIndex(_ => _.name === ss.name)
      l.splice(i, 1, updated)
      set_rule_list([...l])

      ww.rules([updated])
    }
  }


  const add_new_rule = () => {
    batch(() => {
      set_rule_list([new_rule(), ...rule_list()])
      set_i_rule_list(0)
    })
  }

  const delete_rule = () => {
    let l = rule_list()
    if (l.length === 1) {
      return
    }
    let dd = l.splice(i_rule_list(), 1)
    batch(() => {
      set_rule_list([...l])
      if (i_rule_list() === l.length) {
        set_i_rule_list(l.length - 1)
      }
    })
    ww.rules(dd.map(_ => ({name: _.name, rule: '', z: -1})))
  }

  let [get_m] = createResource<PositionManager>(() => PositionManager.make(() => wasm_url))

  let found_san = createMemo(() => { 
    let m = get_m()
    let rule = selected_rule().rule
    if (!props.fen) {
      return undefined
    }
    if (!m) {
      return undefined
    }
    try {
      return find_san10_c(props.fen, rule, m)
    } catch(e) {   
      return 'Error' + e
    }
  })

  const ascii_san = createMemo(() => {
    let rule = selected_rule()
    if (!rule || !props.fen) {
      return
    }
    let m = get_m()
    if (!m) {
      return
    }

    let pos = Chess.fromSetup(parseFen(props.fen).unwrap()).unwrap()
    return print_rules(make_root(props.fen, rule.rule, m), pos)
  })

  return (<>
    <div class='rule-list'>
      <div class='scroll-wrap'>
        <For each={rule_list()}>{(rule, i) =>
          <div onClick={() => set_i_rule_list(i())} class={'rule' + (i() === i_rule_list() ? ' active' : '')}>
            <span class='name'>{rule.name}</span>
            <span class='stats'>f {nb_failed(rule.name)} / s {nb_solved(rule.name)}</span>
          </div>
        }</For>
      </div>
      <div class='tools'>
        <div onClick={add_new_rule} class='rule'>+ New rule</div>
        <div onClick={delete_rule} class='rule'>- Delete rule</div>
      </div>
    </div>

    <div class='text-wrap'>
      <textarea class='editor-input' onKeyDown={on_set_rules} title='rules' rows={13} cols={21} value={selected_rule()?.rule ?? 'Select a rule'} />
      <div class='ascii'>
        <textarea disabled={true}>{ascii_san()}</textarea>

        <Show when={found_san()}>{ found_san => <span>{found_san()}</span>}</Show>
      </div>
    </div>
  </>)
}

export default App
