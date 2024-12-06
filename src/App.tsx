import { createEffect, createMemo, createSignal, For, mapArray, on, onMount, Show, Signal, untrack, useContext } from 'solid-js'
import './App.scss'
import Chessboard from './Chessboard'
import { makePersistedNamespaced } from './persisted'
import { Puzzle, puzzle_all_tags, puzzle_has_tags } from './puzzles'
import { MyWorkerContext, MyWorkerProvider } from './Worker'
import { Shala } from './Shalala'
import { stepwiseScroll } from './common/scroll'

function App() {
  return (<>
    <MyWorkerProvider>
      <WithWorker />
    </MyWorkerProvider>
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
    }
  })

  createEffect(on(selected_puzzle, () => {
    set_i_selected_sans(-1)
  }))

  const shalala = new Shala()
  

  const on_wheel = stepwiseScroll((e: WheelEvent) => {
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
              <div class={'san' + (i_selected_sans() === i() ? ' active': '') + ((selected_puzzle()!.solve.i ?? 99) <= i() ? ' fail': '') }  onClick={() => set_i_selected_sans(i)}>{san}</div>
            }</For>
          </div>
        </div>
        <div class='editor-wrap'>
          <Editor />
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

  const { progress } = useContext(MyWorkerContext)!


  return (<>
    <Show when={progress()}>{progress =>
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

  get has_tags() {
    return puzzle_has_tags(this.puzzle)
  }

  get all_tags() {
    return puzzle_all_tags(this.puzzle)
  }

  private constructor(readonly puzzle: Puzzle) {}
}

const Puzzles = (props: { on_selected_puzzle: (_: Puzzle) => void }) => {

  let { puzzles, filter_puzzles } = useContext(MyWorkerContext)!

  const [filter, set_filter] = makePersistedNamespaced<string | undefined>(undefined, 'filter')

  const filtered = createMemo(mapArray(() => puzzles(), PuzzleMemo.create))

  const [id_selected, set_id_selected] = makePersistedNamespaced<string | undefined>(undefined, 'id_selected')

  const selected_puzzle = createMemo(() => filtered().find(_ => _.id === id_selected()))
  //const selected_fen = createMemo(() => selected_puzzle()?.fen)

  createEffect(on(selected_puzzle, (puzzle) => {
    if (puzzle) {
      props.on_selected_puzzle(puzzle.puzzle)
    } else {
      if (filtered()[0]) {
        set_id_selected(filtered()[0]?.id)
      }
    }
  }))

  createEffect(on(filter, f => {
    filter_puzzles(f)
  }))


  let $el_filter: HTMLInputElement

  const on_filter_change = (filter: string) => {
    set_filter(filter)
  }

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
              <span class='tags'><For each={Object.keys(puzzle.tags)}>{tag => <span class='tag'>{tag}</span>}</For></span>
            </div>
        }</For>
      }</Show>
      </div>

      </div>
  )
}

class Node {

  get rule() {
    return this._rule[0]()
  }

  set rule(rule: string) {
    this._rule[1](rule)
  }

  get children() {
    return this._children[0]()
  }

  set children(children: Node[]) {
    this._children[1](children)
  }

  _rule: Signal<string>
  _children: Signal<Node[]>
  parent: Node | undefined

  constructor(public depth: number, rule: string) {
    this._rule = createSignal(rule)
    this._children = createSignal<Node[]>([])
  }

  add_children(nodes: Node[]) {
    untrack(() => {
      nodes.forEach(_ => _.parent = this)
      this.children = [...this.children, ...nodes]
    })
  }

  add_new_sibling_after() {
    return untrack(() => {
      let i = this.parent!.children.indexOf(this)
      let child = new Node(0, 'new')
      child.parent = this.parent
      this.parent!.children.splice(i + 1, 0, child)
      this.parent!.children = [...this.parent!.children]
      return child
    })
  }

  remove() {
    untrack(() => {
      let i = this.parent!.children.indexOf(this)
      this.parent!.children.splice(i, 1)
      this.parent!.children = [...this.parent!.children]
    })
  }

}

function parse_rules(str: string) {

    let ss = str.trim().split('\n')

    let root = new Node(0, '')
    const stack = [root]

    ss.forEach(line => {
        const rule = line.trim()
        if (!rule) return

        const depth = line.search(/\S/)

        const node = new Node(depth, rule)

        while (stack.length > depth + 1) {
            stack.pop()
        }

        stack[stack.length - 1].add_children([node])
        stack.push(node)
    })
    root.children.forEach(_ => _.parent = undefined)

    return root.children
}


function Editor() {

  const { set_rules: c_set_rules } = useContext(MyWorkerContext)!

  const [rules, set_rules] = makePersistedNamespaced<string>('', 'rules')

  c_set_rules(rules())

  const children = createMemo(() => parse_rules(rules()))

  const [in_edit, set_in_edit] = createSignal<Node | undefined>(undefined)

  let $el_rules: HTMLTextAreaElement

  onMount(() => {
    $el_rules.value = rules()
  })

  const on_set_rules = (e: KeyboardEvent) => {
    set_rules($el_rules.value)

    if (e.key === 'Enter') {
      c_set_rules($el_rules.value)
    }
  }

  return (<>
  <div class='text-wrap'>
    <textarea ref={_ => $el_rules = _} class='editor-input' onKeyDown={on_set_rules} title='rules' rows={20} cols={40}/>
  </div>
  <div class='editor'>
    <Show when={children().length > 0}>
    <div class='nest'>
    <For each={children()}>{ node =>
      <NestNode node={node} in_edit={in_edit()} on_edit={set_in_edit}/>
     }</For>
    </div>
    </Show>
  </div>
  </>)
}

const NestNode = (props: { node: Node, in_edit: Node | undefined, on_edit: (_: Node | undefined) => void }) => {

  let $el_text: HTMLInputElement
  const on_key_down = (e: KeyboardEvent) => {

    if (e.key === 'Enter') {
      if ($el_text.value === '') {
        props.node.remove()
        props.on_edit(undefined)
      } else {
        props.node.rule = $el_text.value
        props.on_edit(props.node.add_new_sibling_after())
      }
    }
    if (e.key === 'Escape') {
      props.node.rule = $el_text.value
      props.on_edit(undefined)
    }
  }

  return (<>
    <span onClick={() => props.on_edit(props.node)} class='rule'>
      <Show when={props.in_edit === props.node} fallback={props.node.rule}>
        <>
        <input ref={_ => $el_text = _} autofocus={true} type='text' title='rule' onKeyDown={on_key_down} value={props.node.rule}></input>
        </>
      </Show></span>
    <Show when={props.node.children.length > 0}>
    <div class='nest'>
    <For each={props.node.children}>{ node =>
      <NestNode {...props} node={node}/>
     }</For>
    </div>
    {/*
    <span class='new' onClick={() => props.on_edit(props.node.add_new_sibling_after())}>+</span>
    */
      }
    </Show>
    </>)
}

export default App
