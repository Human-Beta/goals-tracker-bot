export class KeyValueParseError extends Error {
  readonly code = 'KEY_VALUE_PARSE_ERROR';

  constructor(message: string) {
    super(message);
    this.name = 'KeyValueParseError';
  }
}

function isWhitespace(char: string): boolean {
  return /\s/.test(char);
}

function isKeyChar(char: string): boolean {
  return /\w/.test(char);
}

function createPositionMessage(message: string, position: number): string {
  return `${message} at position ${position}`;
}

export function parseKeyValueArgs(rawInput: string): Record<string, string> {
  const result: Record<string, string> = {};
  const input = rawInput.trim();
  const length = input.length;
  let index = 0;

  while (index < length) {
    while (index < length && isWhitespace(input[index])) {
      index += 1;
    }

    if (index >= length) {
      break;
    }

    const keyStart = index;
    while (index < length && isKeyChar(input[index])) {
      index += 1;
    }

    if (keyStart === index) {
      throw new KeyValueParseError(createPositionMessage('Expected argument key', index + 1));
    }

    const key = input.slice(keyStart, index);
    if (index >= length || input[index] !== '=') {
      throw new KeyValueParseError(createPositionMessage(`Expected "=" after key "${key}"`, index + 1));
    }
    index += 1;

    if (index >= length) {
      throw new KeyValueParseError(`Missing value for key "${key}"`);
    }

    let value = '';
    if (input[index] === '"') {
      index += 1;
      let isClosed = false;
      while (index < length) {
        const char = input[index];
        if (char === '\\') {
          if (index + 1 >= length) {
            throw new KeyValueParseError(`Invalid escape sequence for key "${key}"`);
          }

          value += input[index + 1];
          index += 2;
          continue;
        }

        if (char === '"') {
          isClosed = true;
          index += 1;
          break;
        }

        value += char;
        index += 1;
      }

      if (!isClosed) {
        throw new KeyValueParseError(`Unclosed quoted value for key "${key}"`);
      }
    } else {
      const valueStart = index;
      while (index < length && !isWhitespace(input[index])) {
        index += 1;
      }

      value = input.slice(valueStart, index);
      if (value.length === 0) {
        throw new KeyValueParseError(`Missing value for key "${key}"`);
      }
    }

    if (result[key] !== undefined) {
      throw new KeyValueParseError(`Duplicate argument "${key}"`);
    }
    result[key] = value;
  }

  return result;
}
