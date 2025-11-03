/**
 * Valida parênteses/colchetes/chaves usando pilha.
 * Complexidade: O(n) tempo, O(n) espaço no pior caso.
 */

function isValid(s) {
  return findFirstError(s).valid;
}

/**
 * Retorna o primeiro erro encontrado.
 * Formato:
 *  - valid: boolean
 *  - error: 'UNEXPECTED_CLOSING' | 'MISMATCH' | 'UNCLOSED_OPENING' | 'INVALID_CHARACTER' | null
 *  - position: índice 0-based do caractere problemático (ou do primeiro abridor não fechado)
 *  - character: caractere na posição reportada (ou '' se não aplicável)
 *
 * Regras:
 *  - Apenas '()[]{}' são válidos; caracteres fora desse conjunto disparam INVALID_CHARACTER.
 *  - UNEXPECTED_CLOSING: fecha sem ter abridor correspondente na pilha.
 *  - MISMATCH: tipo de fechamento não casa com o topo da pilha.
 *  - UNCLOSED_OPENING: fim da string com abridores sobrando; aponta para o primeiro abridor não fechado.
 */
function findFirstError(s) {
  const opens = new Set(['(', '[', '{']);
  const closes = new Set([')', ']', '}']);
  const match = {
    ')': '(',
    ']': '[',
    '}': '{',
  };

  const stack = []; // itens: { char, idx }

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];

    // validar alfabeto
    if (!opens.has(ch) && !closes.has(ch)) {
      return { valid: false, error: 'INVALID_CHARACTER', position: i, character: ch };
    }

    if (opens.has(ch)) {
      stack.push({ char: ch, idx: i });
      continue;
    }

    // é fechamento
    if (stack.length === 0) {
      return { valid: false, error: 'UNEXPECTED_CLOSING', position: i, character: ch };
    }

    const top = stack[stack.length - 1];
    if (top.char !== match[ch]) {
      return { valid: false, error: 'MISMATCH', position: i, character: ch };
    }

    // casa: pop
    stack.pop();
  }

  if (stack.length > 0) {
    // aponta para o primeiro abridor que nunca foi fechado
    const firstUnclosed = stack[0];
    return { valid: false, error: 'UNCLOSED_OPENING', position: firstUnclosed.idx, character: firstUnclosed.char };
  }

  return { valid: true, error: null, position: -1, character: '' };
}

module.exports = { isValid, findFirstError };
