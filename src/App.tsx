import { createEffect, createMemo, createSignal, For, mapArray, on, onMount, Show, Signal, untrack, useContext } from 'solid-js'
import './App.scss'
import Chessboard from './Chessboard'
import { makePersistedNamespaced } from './persisted'
import { Puzzle, puzzle_all_tags, puzzle_has_tags } from './puzzles'
import { MyWorkerContext, MyWorkerProvider } from './Worker'
import { Shala } from './Shalala'
import { stepwiseScroll } from './common/scroll'
import { INITIAL_FEN } from 'chessops/fen'
import { Node as HNode, pnode, SanScore } from 'hopefox'

const str_hash = (str: string) => {
  var hash = 0,
    i, chr;
  if (str.length === 0) return hash;
  for (i = 0; i < str.length; i++) {
    chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
}

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
              <div class={'san' + (i_selected_sans() === i() ? ' active': '') + ((selected_puzzle()!.solve.i ?? 99) <= i() ? ' fail': '') }  onClick={() => set_i_selected_sans(i)}>{san}</div>
            }</For>
          </div>
        </div>
        <div class='editor-wrap'>
          <Editor fen={shalala.fen_uci[0]} />
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

  get solve() {
    return this.puzzle.solve
  }

  private constructor(readonly puzzle: Puzzle) {}
}

const Puzzles = (props: { on_selected_puzzle: (_?: Puzzle) => void }) => {

  let { puzzles, filter_puzzles } = useContext(MyWorkerContext)!

  const [filter, set_filter] = makePersistedNamespaced<string | undefined>(undefined, 'filter')

  const filtered = createMemo(mapArray(() => puzzles(), PuzzleMemo.create))

  const [id_selected, set_id_selected] = makePersistedNamespaced<string | undefined>(undefined, 'id_selected')

  const selected_puzzle = createMemo(() => filtered().find(_ => _.id === id_selected()))
  //const selected_fen = createMemo(() => selected_puzzle()?.fen)

  const nb_solved = createMemo(() => filtered().filter(_ => _.solve.i === 99).length)

  const toggle_id = () => {
    let f = filter()

    if (!f) {
      return
    }

    if (f.includes('id_')) {
      f = f.replace(/id_\w*/, '')
    } else {

      let puzzle = selected_puzzle()
      if (!puzzle) {
        return
      }

      let [y,n] = f.split('_!_')
      
      f = y.trim() + ` id_${puzzle.id} `
      if (n !== undefined) {
        f += '_!_' + n.trim()
      }
    }
    set_filter(f)
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
      <div class='info'>
        <span class='solved'>Solved {`${nb_solved()}/${filtered().length}`}</span>
        <button onClick={toggle_solved}>Toggle Solved</button>
        <button onClick={toggle_id}>Toggle Id</button>
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

  get best_match() {
    return this._best_match[0]()
  }
  
  set best_match(_: SanScore | undefined) {
    this._best_match[1](_)
  }

  _rule: Signal<string>
  _children: Signal<Node[]>
  _best_match: Signal<SanScore | undefined>
  parent: Node | undefined

  constructor(public depth: number, public line: number, rule: string) {
    this._rule = createSignal(rule)
    this._children = createSignal<Node[]>([])
    this._best_match = createSignal<SanScore | undefined>(undefined)
  }

  add_children(nodes: Node[]) {
    untrack(() => {
      nodes.forEach(_ => _.parent = this)
      this.children = [...this.children, ...nodes]
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

function parse_rules(str: string, n_solution: HNode) {

    let ss = str.trim().split('\n')

    let root = new Node(0, 0, '')
    const stack = [root]

    ss.forEach((line, i) => {
        const rule = line.trim()
        if (!rule) return

        const depth = line.search(/\S/)

        const node = new Node(depth, i, rule)
        node.best_match = n_solution.best_match(i)

        while (stack.length > depth + 1) {
            stack.pop()
        }

        stack[stack.length - 1].add_children([node])
        stack.push(node)
    })
    root.children.forEach(_ => _.parent = undefined)

    return root.children
}


function Editor(props: { fen?: string }) {

  let pcache: Record<string, Node[]> = {}
  const { set_rules: c_set_rules } = useContext(MyWorkerContext)!

  const [rules, set_rules] = makePersistedNamespaced<string>('', 'rules')

  c_set_rules(rules())

  const children = createMemo(() => {
    if (!props.fen) {
      return []
    }

    let key = str_hash(props.fen + rules())
    if (!pcache[key]) {
      pcache[key] = parse_rules(rules(), pnode(props.fen, rules()))
    }
    return pcache[key]
  })

  const [in_edit, set_in_edit] = createSignal<Node | undefined>(undefined)

  let $el_rules: HTMLTextAreaElement

  onMount(() => {
    $el_rules.value = rules()
  })

  const on_set_rules = (e: KeyboardEvent) => {
    set_rules($el_rules.value)

    if (e.key === 'Escape') {
      c_set_rules($el_rules.value)
    }
  }

  const best_score_depth0 = createMemo(() => children().map(_ => _.depth === 0 ? _.best_match : undefined).filter(Boolean).sort((a, b) => b!.score - a!.score)[0])


  const on_go_to_line = (line: number) => {
    let i = $el_rules.value.split('\n').slice(0, line).map(_ => _.length + 1).reduce((a, b) => a + b, 0)
      $el_rules.setSelectionRange(i, i)
      $el_rules.blur()
      $el_rules.focus()
      $el_rules.setSelectionRange(i, i + 1)
  }

  return (<>
  <div class='text-wrap'>
    <textarea ref={_ => $el_rules = _} class='editor-input' onKeyDown={on_set_rules} title='rules' rows={20} cols={28}/>
    <div class='info'>
      <Show when={best_score_depth0()}>{bb => 
          <>
            Best Score:
            <span class='san'>{bb().san}</span>
            <span class='score'>{bb().score}</span>
          </>
        }</Show>
    </div>
  </div>
  <div class='editor'>
    <div class='scroll-wrap'>
    <Show when={children().length > 0}>
    <div class='nest'>
    <For each={children()}>{ node =>
      <NestNode node={node} in_edit={in_edit()} on_edit={set_in_edit} on_go_to_line={on_go_to_line}/>
     }</For>
    </div>
    </Show>
    </div>
  </div>
  </>)
}

const NestNode = (props: { node: Node, in_edit: Node | undefined, on_go_to_line: (_: number) => void, on_edit: (_: Node | undefined) => void }) => {

  let $el_text: HTMLInputElement
  const on_key_down = (e: KeyboardEvent) => {

    if (e.key === 'Enter') {
      if ($el_text.value === '') {
        props.node.remove()
        props.on_edit(undefined)
      } else {
        props.node.rule = $el_text.value
        //props.on_edit(props.node.add_new_sibling_after())
      }
    }
    if (e.key === 'Escape') {
      props.node.rule = $el_text.value
      props.on_edit(undefined)
    }
  }

  return (<>
    <span onClick={() => props.on_go_to_line(props.node.line)} class='rule'>
      <Show when={props.in_edit === props.node} fallback={
        <>
          <span class='text'>{props.node.rule}</span>
          <Show when={props.node.best_match}>{ match =>
            <>
            <Show when={props.node.children.length > 0}>
              <span class='minmax'>{props.node.depth %2 === 0 ? 'max': 'min' }</span>
              </Show>
              <span class='score'>{match().score}</span>
              <span class='san'>{match().san}</span>
            </>
          }</Show>
        </>}>
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

/*

backup rules

b +
 k =x
  b =x

b =x

b =x
 b =x
  q =x

b
 q
  n =x
   q =x
    r =x
 q =x
  n =x
  .
  b =x
  .
 .

n
 q =x
  q =x
  .
 .

p =x
 b =x
  b
   q
    n =x
     q =x
      r =x

p =x
 q o
 q
  p =x


q +
 k =x
 p =x
 n
  q =x

q +
 k =x
 q =x
 r =x
 k
  r
   b =x
    q =x

r
 q =x
 b =x
  #
  q =x
   q =x
   k =x
   b

q =x
 p =x
  r =x
   r =x
    r =x

q =x
 q =x
 p =x
 n =x
 r =x
 .

q =x
 p =x
  n =x

n +
 k
  n =x
   r =x
    n =x


n +
 b =x
  b =x
 k
  b =x
  n =x

n
 q =x
 p =x
 r =x
  n +
   k
    n =x

n =x
 q =x

n =x

r + =x
 r =x
 k =x
 k
  r =x
   k =x
   .

r +
 k =x
 k
  r +
   k
    r =x
  r =x
   k =x
   .

r
 q =x
  b =x
 .
 

r =x

p
 q =x
  q =x
 q o
  p =x
   p =x
  p


*/