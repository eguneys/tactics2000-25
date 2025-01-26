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

const rule_to_tags = (rule: RuleSolve) => {
  if (rule.solve === undefined) {
    return ['solved', `solved_${rule.rule.name}`]
  } else {
    return [`failed_${rule.rule.name}`]
  }
}

export const puzzle_all_tags = (puzzle: Puzzle): Record<string, boolean> => {
  let res = { ...puzzle.tags, ...puzzle_has_tags(puzzle) }

  let tags = [...new Set(puzzle.rules.flatMap(rule_to_tags))]

  tags.forEach(tag => res[tag] = true)

  return res
}