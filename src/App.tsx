import { createEffect, createMemo, createSignal, For, Show, Signal, untrack } from 'solid-js'
import './App.scss'

function App() {
  return (
    <>
      <div class='app-wrap'>
        <div class='editor-wrap'>
          <Editor />
        </div>
      </div>
    </>
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


  const [rules, set_rules] = createSignal('')

  const children = createMemo(() => parse_rules(rules()))

  const [in_edit, set_in_edit] = createSignal<Node | undefined>(undefined)

  let $el_rules: HTMLTextAreaElement

  const on_set_rules = () => {
    set_rules($el_rules.value)
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
