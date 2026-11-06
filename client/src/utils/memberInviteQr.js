// Build the invite QR code in the browser so no outside service receives the code.
const SIZE = 37;
const DATA_CODEWORDS = 108;
const ECC_CODEWORDS = 26;

function multiply(x, y) {
  let result = 0;
  for (let i = 7; i >= 0; i -= 1) {
    result = (result << 1) ^ ((result >>> 7) * 0x11d);
    result ^= ((y >>> i) & 1) * x;
  }
  return result;
}

function errorCorrection(data) {
  const degree = ECC_CODEWORDS;
  const divisor = new Array(degree).fill(0);
  divisor[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i += 1) {
    for (let j = 0; j < degree; j += 1) {
      divisor[j] = multiply(divisor[j], root);
      if (j + 1 < degree) divisor[j] ^= divisor[j + 1];
    }
    root = multiply(root, 2);
  }

  const remainder = new Array(degree).fill(0);
  data.forEach((byte) => {
    const factor = byte ^ remainder[0];
    remainder.shift();
    remainder.push(0);
    for (let i = 0; i < degree; i += 1) remainder[i] ^= multiply(divisor[i], factor);
  });
  return remainder;
}

function appendBits(bits, value, length) {
  for (let i = length - 1; i >= 0; i -= 1) bits.push((value >>> i) & 1);
}

function codewordsFor(text) {
  const bytes = Array.from(new TextEncoder().encode(text));
  if (bytes.length > 106) throw new Error('This invitation is too long to fit in a QR code.');

  const bits = [];
  appendBits(bits, 0b0100, 4); // Store the text as bytes.
  appendBits(bits, bytes.length, 8);
  bytes.forEach(byte => appendBits(bits, byte, 8));
  appendBits(bits, 0, Math.min(4, DATA_CODEWORDS * 8 - bits.length));
  while (bits.length % 8) bits.push(0);

  const data = [];
  for (let i = 0; i < bits.length; i += 8) {
    data.push(bits.slice(i, i + 8).reduce((value, bit) => (value << 1) | bit, 0));
  }
  for (let pad = 0; data.length < DATA_CODEWORDS; pad += 1) data.push(pad % 2 === 0 ? 0xec : 0x11);
  return [...data, ...errorCorrection(data)];
}

export function createMemberInviteQr(text) {
  const matrix = Array.from({ length: SIZE }, () => Array(SIZE).fill(false));
  const reserved = Array.from({ length: SIZE }, () => Array(SIZE).fill(false));
  const setFunction = (row, col, dark) => {
    if (row >= 0 && row < SIZE && col >= 0 && col < SIZE) {
      matrix[row][col] = dark;
      reserved[row][col] = true;
    }
  };

  const finder = (centerRow, centerCol) => {
    for (let dy = -4; dy <= 4; dy += 1) {
      for (let dx = -4; dx <= 4; dx += 1) {
        const distance = Math.max(Math.abs(dx), Math.abs(dy));
        setFunction(centerRow + dy, centerCol + dx, distance !== 2 && distance !== 4);
      }
    }
  };
  finder(3, 3);
  finder(3, SIZE - 4);
  finder(SIZE - 4, 3);

  // Add alternating squares so scanners can read the grid spacing.
  for (let i = 8; i < SIZE - 8; i += 1) {
    setFunction(6, i, i % 2 === 0);
    setFunction(i, 6, i % 2 === 0);
  }

  // Add position markers to help scanners line up the grid.
  const alignment = (centerRow, centerCol) => {
    for (let dy = -2; dy <= 2; dy += 1) {
      for (let dx = -2; dx <= 2; dx += 1) {
        setFunction(centerRow + dy, centerCol + dx, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }
    }
  };
  alignment(6, 30);
  alignment(30, 6);
  alignment(30, 30);

  // Keep these squares for QR settings instead of invitation data.
  for (let i = 0; i < 9; i += 1) {
    if (i !== 6) {
      setFunction(8, i, false);
      setFunction(i, 8, false);
    }
  }
  for (let i = 0; i < 8; i += 1) {
    setFunction(8, SIZE - 1 - i, false);
    setFunction(SIZE - 1 - i, 8, false);
  }
  setFunction(SIZE - 8, 8, true);

  const bits = codewordsFor(text).flatMap(byte => Array.from({ length: 8 }, (_, i) => (byte >>> (7 - i)) & 1));
  let bitIndex = 0;
  for (let right = SIZE - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    const upward = ((right + 1) & 2) === 0;
    for (let vert = 0; vert < SIZE; vert += 1) {
      const row = upward ? SIZE - 1 - vert : vert;
      for (let offset = 0; offset < 2; offset += 1) {
        const col = right - offset;
        if (reserved[row][col]) continue;
        const bit = bitIndex < bits.length ? bits[bitIndex] : 0;
        bitIndex += 1;
        // Flip alternating squares to make the code easier to scan.
        matrix[row][col] = Boolean(bit ^ ((row + col) % 2 === 0 ? 1 : 0));
      }
    }
  }

  // Encode the QR settings and add check bits so scanners can recover damaged settings.
  const formatData = 0b01000;
  let remainder = formatData;
  for (let i = 0; i < 10; i += 1) remainder = (remainder << 1) ^ (((remainder >>> 9) & 1) * 0x537);
  const formatBits = ((formatData << 10) | remainder) ^ 0x5412;
  const bit = index => ((formatBits >>> index) & 1) !== 0;
  for (let i = 0; i <= 5; i += 1) matrix[i][8] = bit(i);
  matrix[7][8] = bit(6);
  matrix[8][8] = bit(7);
  matrix[8][7] = bit(8);
  for (let i = 9; i < 15; i += 1) matrix[8][14 - i] = bit(i);
  for (let i = 0; i < 8; i += 1) matrix[8][SIZE - 1 - i] = bit(i);
  for (let i = 8; i < 15; i += 1) matrix[SIZE - 15 + i][8] = bit(i);
  matrix[SIZE - 8][8] = true;

  return matrix;
}

export function memberInvitePayload(email, inviteCode) {
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  const memberPayload = `${normalizedEmail}|${inviteCode}`;
  try {
    createMemberInviteQr(memberPayload);
    return memberPayload;
  } catch {
    // If the email will not fit, include only the invite code in the QR.
    return inviteCode;
  }
}
